import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { EXTENSIONS, rolesSource } from "./manifest.mjs";

export const ROLES = ["planner", "reviewer", "loop-breaker", "explorer", "builder-dynamic", "builder-mechanical"];
export const CODEX_EXEC_PERMISSION = "Bash(codex exec:*)";
const SPAWNS = { codex: ["spawn_agent"], claude: ["Agent tool"], exp: ["Agent tool", "codex exec"] };

// "cloop:town" -> "cloop-town"; at most one profile per extension.
export function normalizeExtensions(specs) {
  const ids = [...new Set(specs.map(s => {
    const m = /^([a-z0-9]+):([a-z0-9-]+)$/i.exec(s);
    const id = m ? `${m[1].toLowerCase()}-${m[2].toLowerCase()}` : s;
    if (!EXTENSIONS.includes(id)) throw new Error(`Unknown extension: ${s} (use cheapgpt:cheap, cheapgpt:cheap-100, cloop:town or cloop:high)`);
    return id;
  }))].sort();
  const names = ids.map(extensionName);
  if (new Set(names).size !== names.length) throw new Error("At most one profile per extension");
  return ids;
}
export const extensionName = id => id.split("-")[0];

// One extension's vendored roles data for one edition: rows, the recommended root and the turn line.
export function parseRoles(text, edition, id = "extension") {
  const data = JSON.parse(text), e = data.editions?.[edition];
  if (!data.source?.commit || !/^[0-9a-f]{40}$/.test(data.source.commit)) throw new Error(`${id}: roles data needs its source commit`);
  if (!e || !Array.isArray(e.rows) || !e.rows.length) throw new Error(`${id}: no roles for the ${edition} edition`);
  for (const r of e.rows) if (!ROLES.includes(r.role) || !r.model || !r.effort || !SPAWNS[edition].includes(r.spawn) || !["fresh", "inherits"].includes(r.context) || !["required", "optional"].includes(r.claim)) throw new Error(`${id}: invalid roles row: ${JSON.stringify(r)}`);
  if (typeof e.turnLine !== "string" || !e.turnLine || e.turnLine.includes("\n") || e.turnLine.length > 300) throw new Error(`${id}: the turn line is one line of at most 300 characters`);
  return { rows: e.rows, turnLine: e.turnLine, root: e.root, source: data.source };
}

// Required beats optional; two required claims on one role are a package defect caught at release.
// The result's rolesJson is what the CLI writes to .bridgecode/engine/roles.json.
export function resolveExtensions(edition, ids, readText) {
  const parsed = Object.fromEntries(ids.map(id => [id, parseRoles(readText(rolesSource(id)), edition, id)]));
  const assignment = {}, roles = {};
  for (const role of ROLES) {
    const claims = ids.filter(id => parsed[id].rows.some(r => r.role === role));
    const required = claims.filter(id => parsed[id].rows.some(r => r.role === role && r.claim === "required"));
    if (required.length > 1) throw new Error(`Required claims overlap on ${role}: ${required.join(", ")}`);
    assignment[role] = required[0] ?? claims.sort()[0] ?? "core";
    if (assignment[role] !== "core") roles[role] = parsed[assignment[role]].rows.filter(r => r.role === role).map(({ role: _, ...r }) => ({ ...r, source: assignment[role] }));
  }
  const needsCodexExec = Object.values(roles).some(rows => rows.some(r => r.spawn === "codex exec"));
  const line = `Roles: ${ROLES.map(r => `${r}: ${assignment[r]}`).join(" · ")}`;
  const rolesJson = { edition, extensions: ids.map(id => ({ id, root: parsed[id].root, turnLine: parsed[id].turnLine, source: parsed[id].source })), roles };
  return { ids, assignment, needsCodexExec, line, turnLines: ids.map(id => parsed[id].turnLine), rolesJson };
}

// A standalone cheapGPT or cLoop install is a second orchestrator. Bridgecode reports it and, on the user's yes
// (install --replace-standalones), removes exactly what that standalone's own uninstaller removes, nothing else:
// its managed block, its engine folder, its hook script and hook entries, its config blocks. Task records and
// memory (agentic/, cheapgpt/, cloop/) are never touched.
const STANDALONES = {
  cheapgpt: { dir: ".cheapgpt", engine: "cheapgpt.mjs", marker: "cheapgpt", hookScript: ".codex/hooks/cheapgpt-turn.mjs", hookConfig: ".codex/hooks.json", hookTags: ["cheapgpt-turn.mjs", "cheapgpt:"], emptyConfigKeys: ["description"], toml: ".codex/config.toml", choices: ["cheap", "cheap-100"], profiles: { cheap: "cheap", "cheap-100": "cheap-100", "cheap-5x": "cheap-100", "cheap-20x": "cheap-100", ultracheap: "cheap" } },
  cloop: { dir: ".cloop", engine: "cloop.mjs", marker: "cloop", hookScript: ".claude/hooks/cloop-turn.mjs", hookConfig: ".claude/settings.json", hookTags: ["cloop-turn.mjs", "cloop:"], emptyConfigKeys: [], legacy: { path: "cloop.mjs", header: "// cLoop tool: the flow, the escalation ladder" }, choices: ["town", "high"], profiles: { town: "town", high: "high" } },
};
const INSTRUCTIONS = ["AGENTS.md", "CLAUDE.md"];
const markers = name => [`<!-- ${name}:managed:start -->`, `<!-- ${name}:managed:end -->`];
const isDir = p => lstat(p).then(i => i.isDirectory(), () => false);

export async function detectStandalones(read, root) {
  const found = [];
  const instructions = [];
  for (const p of INSTRUCTIONS) instructions.push((await read(p))?.toString("utf8") ?? "");
  for (const [name, s] of Object.entries(STANDALONES)) {
    let profile = null, present = false;
    if (root && await isDir(path.join(root, s.dir))) present = true;
    const state = await read(s.dir + "/state.json").catch(() => null);
    if (state) { present = true; try { profile = JSON.parse(state.toString("utf8")).profile ?? null; } catch { profile = null; } }
    const start = `${name}:managed:start`;
    for (const text of instructions) if (text.includes(start)) {
      present = true;
      profile ??= new RegExp(`${start}[\\s\\S]*?Active profile: \`([^\`]+)\``).exec(text)?.[1] ?? null;
    }
    if (present) found.push({ name, profile, extension: `${name}:${s.profiles[profile] ?? s.choices[0]}` });
  }
  return found;
}

// The standalone's managed block out of an instruction file, joined as its own uninstaller joins it.
function withoutBlock(text, name, file) {
  const [open, close] = markers(name), start = text.indexOf(open), end = text.indexOf(close);
  if (start < 0 && end < 0) return null;
  if (start < 0 || end < start || text.indexOf(open, start + 1) >= 0)
    throw new Error(`${file} holds malformed ${name} markers, so the ${name} block cannot be removed exactly; repair or remove the block by hand, then re-run bridgecode install --replace-standalones`);
  const before = text.slice(0, start).replace(/\s+$/, ""), after = text.slice(end + close.length).replace(/^\s+/, "").replace(/\s+$/, "");
  return before && after ? `${before}\n\n${after}\n` : before || after ? `${before || after}\n` : "";
}
// The standalone's hook handlers (and cLoop's codex permission when it added it) out of a hook configuration.
function withoutHooks(bytes, s, file, { dropPermission, created }) {
  let c;
  try { c = JSON.parse(bytes.toString("utf8")); } catch { throw new Error(`${file} is not valid JSON, so the standalone's hook entries cannot be removed exactly; repair it, then re-run bridgecode install --replace-standalones`); }
  const owned = h => [h?.command, h?.commandWindows, h?.statusMessage].some(v => typeof v === "string" && s.hookTags.some(t => v.includes(t)));
  let removed = 0;
  if (c.hooks && typeof c.hooks === "object") for (const [event, groups] of Object.entries(c.hooks)) {
    if (!Array.isArray(groups)) continue;
    const keep = [];
    for (const g of groups) {
      if (!Array.isArray(g?.hooks)) { keep.push(g); continue; }
      const rest = g.hooks.filter(h => !owned(h));
      removed += g.hooks.length - rest.length;
      if (rest.length) keep.push({ ...g, hooks: rest });
    }
    if (keep.length) c.hooks[event] = keep; else delete c.hooks[event];
  }
  let permission = false;
  if (dropPermission && Array.isArray(c.permissions?.allow) && c.permissions.allow.includes(CODEX_EXEC_PERMISSION)) {
    c.permissions.allow = c.permissions.allow.filter(p => p !== CODEX_EXEC_PERMISSION); permission = true;
    if (!c.permissions.allow.length) delete c.permissions.allow;
    if (!Object.keys(c.permissions).length) delete c.permissions;
  }
  if (c.hooks && !Object.keys(c.hooks).length) delete c.hooks;
  if (!removed && !permission) return null;
  const empty = Object.keys(c).every(k => s.emptyConfigKeys.includes(k));
  return { bytes: empty && created ? null : Buffer.from(JSON.stringify(c, null, 2) + "\n"), removed, permission };
}
// cheapGPT's two config.toml blocks; the multi-agent table goes too when cheapGPT created it and it is left blank.
function withoutToml(text, createdTable) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n", trailing = /\r?\n$/.test(text);
  let lines = text.split(/\r?\n/), found = [];
  for (const tag of ["multi-agent-v2", "agents-md-limit"]) {
    const a = lines.findIndex(l => l.trim() === `# cheapgpt:${tag}:start`), b = lines.findIndex(l => l.trim() === `# cheapgpt:${tag}:end`);
    if (a < 0 && b < 0) continue;
    if (a < 0 || b < a) throw new Error(`.codex/config.toml holds malformed cheapgpt:${tag} markers; repair them by hand, then re-run bridgecode install --replace-standalones`);
    lines = [...lines.slice(0, a), ...lines.slice(b + 1)]; found.push(tag);
  }
  if (!found.length) return null;
  if (createdTable) {
    const h = lines.findIndex(l => /^\s*\[features\.multi_agent_v2\]\s*$/.test(l));
    if (h >= 0) { let e = h + 1; while (e < lines.length && !/^\s*\[/.test(lines[e]) && !lines[e].trim()) e++; if (e === lines.length || /^\s*\[/.test(lines[e])) lines.splice(h, e - h); }
  }
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return { text: lines.length ? lines.join(eol) + (trailing ? eol : "") : null, found };
}

// The exact removal for each found standalone: [{path, bytes (null = remove), what}], plus the folders to drop once empty.
export async function planStandaloneRemoval(read, root, found, { keepPermission = false } = {}) {
  const items = [], dirs = [], current = new Map();
  const get = async p => current.has(p) ? current.get(p) : read(p);
  const put = (p, bytes, what) => { current.set(p, bytes); const i = items.findIndex(x => x.path === p); if (i >= 0) items[i] = { path: p, bytes, what: items[i].what + "; " + what }; else items.push({ path: p, bytes, what }); };
  for (const { name } of found) {
    const s = STANDALONES[name];
    let state = null;
    try { state = JSON.parse((await read(s.dir + "/state.json"))?.toString("utf8") ?? "null"); } catch { state = null; }
    const created = state?.created ?? {};
    for (const file of INSTRUCTIONS) {
      const text = (await get(file))?.toString("utf8");
      const next = text === undefined ? null : withoutBlock(text, name, file);
      if (next !== null) put(file, next.trim() ? Buffer.from(next) : null, `the ${name} managed block`);
    }
    const engineDir = path.join(root, s.dir), unknown = [];
    if (await isDir(engineDir)) {
      for (const e of await readdir(engineDir, { withFileTypes: true })) {
        if (e.isFile() && ["state.json", s.engine, "flow.json"].includes(e.name)) put(`${s.dir}/${e.name}`, null, `${name}'s ${e.name === "state.json" ? "install record" : e.name === s.engine ? "engine" : "flow"}`);
        else if (e.isDirectory() && e.name === "cards") {
          for (const c of await readdir(path.join(engineDir, "cards"), { withFileTypes: true }))
            if (c.isFile() && c.name.endsWith(".md")) put(`${s.dir}/cards/${c.name}`, null, `${name}'s card`); else unknown.push(`${s.dir}/cards/${c.name}`);
          dirs.push(`${s.dir}/cards`);
        } else unknown.push(`${s.dir}/${e.name}`);
      }
      dirs.push(s.dir);
    }
    if (unknown.length) throw new Error(`${s.dir}/ holds files ${name} does not install (${unknown.join(", ")}), so removing it would delete them; move them out of ${s.dir}/, then re-run bridgecode install --replace-standalones`);
    if (await get(s.hookScript)) put(s.hookScript, null, `${name}'s hook script`);
    const config = await get(s.hookConfig);
    if (config) {
      const next = withoutHooks(config, s, s.hookConfig, { dropPermission: name === "cloop" && state?.codexPermission === true && !keepPermission, created: Boolean(created.hooksJson) });
      if (next) put(s.hookConfig, next.bytes, [next.removed ? `${next.removed} ${name} hook entr${next.removed === 1 ? "y" : "ies"}` : "", next.permission ? `the ${CODEX_EXEC_PERMISSION} permission ${name} added` : ""].filter(Boolean).join(" and "));
    }
    if (s.toml) {
      const toml = (await get(s.toml))?.toString("utf8");
      const next = toml === undefined ? null : withoutToml(toml, Boolean(state?.toml?.createdTable ?? created.tomlTable));
      if (next) put(s.toml, next.text === null ? null : Buffer.from(next.text), `the ${next.found.map(t => "cheapgpt:" + t).join(" and ")} block${next.found.length > 1 ? "s" : ""}`);
    }
    if (s.legacy && (await get(s.legacy.path))?.toString("utf8").includes(s.legacy.header)) put(s.legacy.path, null, `${name} 1.1's engine at the project root`);
  }
  return { items, dirs: dirs.sort((a, b) => b.length - a.length) };
}
// Proof that nothing of the standalones remains in the projected files.
export async function verifyStandalonesRemoved(read, found, plan) {
  const left = [];
  for (const it of plan.items) {
    const now = await read(it.path);
    if (it.bytes === null ? now : !now || !now.equals(it.bytes)) left.push(it.path);
  }
  for (const { name } of found) for (const file of INSTRUCTIONS) if ((await read(file))?.toString("utf8").includes(`${name}:managed:`)) left.push(`${file} (${name} block)`);
  if (left.length) throw new Error("Standalone removal incomplete: " + left.join(", "));
}

const suggestions = found => found.map(f => `--extension ${f.name}:${STANDALONES[f.name].choices.join("|")} (${f.extension.split(":")[1]} suggested)`).join(" ");
export function standaloneMessage(found, plan, { project = ".", edition } = {}) {
  return [
    `Standalone orchestrator installed: ${found.map(f => `${f.name}${f.profile ? ` (${f.profile})` : ""}`).join(", ")}. Bridgecode stopped before writing anything.`,
    "Removal plan (exactly what the standalone installed; agentic/, cheapgpt/ and cloop/ task records and memory stay):",
    ...plan.items.filter(i => !/\/cards\//.test(i.path)).map(i => `- ${i.bytes === null ? "remove" : "edit"} ${i.path}: ${i.what}`),
    ...plan.dirs.filter(d => d.endsWith("/cards")).map(d => { const cards = plan.items.filter(i => i.path.startsWith(d + "/")).map(i => i.path.slice(d.length + 1)); return `- remove ${d}/: ${cards.length} card${cards.length === 1 ? "" : "s"} (${cards.join(", ")})`; }),
    ...plan.dirs.filter(d => !d.endsWith("/cards")).map(d => `- remove the folder ${d}/ once empty`),
    `Ask the user whether to remove it. On a yes run: bridgecode install --project ${project} --replace-standalones`,
    `Then they choose the extension: bridgecode install --project ${project} --edition ${edition ?? "codex|claude|exp"} ${suggestions(found)}`,
  ].join("\n");
}
export function replacedMessage(found, { project = ".", edition } = {}) {
  return found.map(f => `Removed standalone ${f.name}${f.profile ? ` (${f.profile})` : ""}.`).join(" ") +
    ` Choose the extension and re-run: bridgecode install --project ${project} --edition ${edition ?? "codex|claude|exp"} ${suggestions(found)}`;
}
