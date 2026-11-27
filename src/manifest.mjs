import { createHash } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const METADATA_PATH = ".bridgecode/installation.json";
export const SCHEMA_VERSION = 2;
export const MANIFEST_SCHEMA = 3;
export const LEGACY_HOOK_PATH = ".codex/hooks/bridgecode-turn.mjs";
export const SPECIALISTS = ["bertram-gilfoyle", "tony-stark", "best-agent", "signal", "taste", "distillation", "monoprompting", "memory", "writing", "copywriting", "design", "imagegen"];
export const CARDS = ["adopt", "define", "planner", "merge", "judge", "explore", "explorer", "oneshot", "loop", "step-back", "dynamic", "mechanical", "break", "breaker", "gate", "consolidate", "ask", "accept", "condense", "report", "done", "stopped"];
export const CORE_CARDS = ["best-agent", "signal", "bertram-gilfoyle", "tony-stark"];
// Package path under engine/ -> installed under .bridgecode/engine/.
export const ENGINE_FILES = ["engine.mjs", "flow.json", "triggers.json", ...CARDS.map(c => `cards/${c}.md`), ...CORE_CARDS.map(c => `core/${c}.md`)];
export const ENGINE_DIR = ".bridgecode/engine";
// roles.json is written by the CLI from the installed extensions and is outside the owned set.
export const ROLES_PATH = `${ENGINE_DIR}/roles.json`;
export const EXTENSIONS = ["cheapgpt-cheap", "cheapgpt-cheap-100", "cloop-town", "cloop-high"];
export const rolesSource = id => `roles/${id}.json`;
export const EDITIONS = {
  codex: { instruction: "AGENTS.md", hookConfig: ".codex/hooks.json", hookPath: ".codex/hooks/bridgecode-turn.mjs" },
  claude: { instruction: "CLAUDE.md", hookConfig: ".claude/settings.json", hookPath: ".claude/hooks/bridgecode-turn.mjs" },
  exp: { instruction: "CLAUDE.md", hookConfig: ".claude/settings.json", hookPath: ".claude/hooks/bridgecode-turn.mjs" },
};
export const editionSource = (edition, file) => `editions/${edition}/${file}`;
export const PAYLOAD_PATHS = [
  ...SPECIALISTS.map(n => `bridgecode/${n}.md`),
  ...ENGINE_FILES.map(f => `engine/${f}`),
  ...EXTENSIONS.map(rolesSource),
  ...Object.entries(EDITIONS).flatMap(([e, d]) => [editionSource(e, d.instruction), editionSource(e, "README_HUMAN.txt")]),
];
export const RESERVED = /^(?:\.git|\.agents|\.codex|\.claude|\.bridgecode|agentic)(?:\/|$)/i;
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const toPosixPath = value => value.split(path.sep).join("/");

export function assertEdition(edition) {
  if (!Object.hasOwn(EDITIONS, edition)) throw new Error(`Invalid --edition value: ${edition} (use codex, claude or exp)`);
  return edition;
}
// Install path -> package path for one edition; extensions change only roles.json, which is not owned.
export function payloadMap(edition) {
  const map = {};
  for (const n of SPECIALISTS) map[`bridgecode/${n}.md`] = `bridgecode/${n}.md`;
  for (const f of ENGINE_FILES) map[`${ENGINE_DIR}/${f}`] = `engine/${f}`;
  map["README_HUMAN.txt"] = editionSource(edition, "README_HUMAN.txt");
  return map;
}

export function validateRelativePath(value, label = "path") {
  if (typeof value !== "string" || !value || /[\x00-\x1f]/.test(value)) throw new Error(`Unsafe ${label}`);
  const p = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(p) || p.includes(":") || p.split("/").some(x => !x || x === "." || x === ".." || /[. ]$/.test(x) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x))) throw new Error(`Unsafe ${label}: ${value}`);
  return p;
}
export function resolveInside(root, relative, label = "path") {
  const safe = validateRelativePath(relative, label);
  const target = path.resolve(root, ...safe.split("/"));
  const rel = path.relative(path.resolve(root), target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Unsafe ${label}: ${relative}`);
  return target;
}
export async function safeTarget(root, relative) {
  const target = resolveInside(root, relative);
  let cursor = path.resolve(root);
  for (const part of validateRelativePath(relative).split("/")) {
    cursor = path.join(cursor, part);
    const info = await lstat(cursor).catch(e => { if (e.code === "ENOENT") return null; throw e; });
    if (!info) break;
    if (info.isSymbolicLink()) throw new Error(`Linked path is unsupported: ${relative}`);
    const actual = await realpath(cursor);
    const rel = path.relative(root, actual);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Resolved path escapes project: ${relative}`);
    if (cursor !== target && !info.isDirectory()) throw new Error(`Parent is not a directory: ${relative}`);
    if (cursor === target && !info.isFile()) throw new Error(`Target is not a regular file: ${relative}`);
  }
  return target;
}
export async function readOptional(root, relative) {
  return readFile(await safeTarget(root, relative)).catch(e => { if (e.code === "ENOENT") return null; throw e; });
}
export async function assertProjectDirectory(project) {
  const root = await realpath(path.resolve(project));
  if (!(await lstat(root)).isDirectory()) throw new Error("Project is not a directory");
  return root;
}
export function assertHashMap(map, label) {
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error(`Invalid ${label}`);
  const keys = new Set();
  for (const [p,h] of Object.entries(map)) {
    if (validateRelativePath(p, label) !== p || keys.has(p.toLowerCase()) || !/^[a-f0-9]{64}$/.test(h)) throw new Error(`Invalid ${label}: ${p}`);
    keys.add(p.toLowerCase());
  }
}
export async function loadPackageContext(packageRoot = PACKAGE_ROOT) {
  const root = await assertProjectDirectory(packageRoot);
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(root, "payload-manifest.json"), "utf8"));
  if (packageJson.name !== "@bridgecode/cli" || manifest.package !== packageJson.name || manifest.version !== packageJson.version || manifest.schemaVersion !== MANIFEST_SCHEMA) throw new Error("Payload manifest identity/version/schema mismatch");
  assertHashMap(manifest.files, "manifest path");
  for (const p of PAYLOAD_PATHS) if (!Object.hasOwn(manifest.files,p)) throw new Error(`Required payload absent: ${p}`);
  for (const p of Object.keys(manifest.files)) if (RESERVED.test(p)) throw new Error(`Reserved payload path: ${p}`);
  await verifyPayload(root, manifest);
  const hook = await readFile(path.join(root, "hooks/bridgecode-turn.mjs"));
  if (sha256(hook) !== manifest.hookHash) throw new Error("Hook payload checksum mismatch");
  const texts = {};
  for (const p of Object.keys(manifest.files)) texts[p] = (await readFile(path.join(root, p))).toString("utf8");
  return {packageRoot:root, packageJson, manifest, hook, texts};
}
export async function verifyPayload(root, manifest) {
  assertHashMap(manifest.files, "manifest path");
  for (const [p,h] of Object.entries(manifest.files)) {
    const bytes = await readOptional(root,p);
    if (!bytes || sha256(bytes) !== h) throw new Error(`Payload checksum mismatch: ${p}`);
  }
}
export async function legacyContext(packageRoot = PACKAGE_ROOT, version = "4.1.0") {
  if(!/^\d+\.\d+\.\d+$/.test(version))throw new Error("Invalid legacy version");
  const old = JSON.parse(await readFile(path.join(packageRoot,"legacy",version+".json"),"utf8"));
  return { ...old, hashes: Object.fromEntries(Object.entries(old.files).map(([p,s]) => [p,sha256(Buffer.from(s))])) };
}
