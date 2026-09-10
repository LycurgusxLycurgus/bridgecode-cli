import { sha256, validateRelativePath } from "./manifest.mjs";

export const BOOTSTRAP_END = "<!-- bridgecode:bootstrap:end -->";

function startPattern() {
  return /<!-- bridgecode:bootstrap:start version="([^"]+)" schema="([^"]+)" -->/g;
}

function findAll(text, needle) {
  const result = [];
  let position = 0;
  while ((position = text.indexOf(needle, position)) !== -1) {
    result.push(position);
    position += needle.length;
  }
  return result;
}

export function buildLegacyBootstrap(version, eol = "\n") {
  return [
    `<!-- bridgecode:bootstrap:start version="${version}" schema="1" -->`,
    "At the beginning of every new task/session, read the root AGENTS.md completely before substantive work. Follow its Bridgecode processflow router and load the general, selected processflow, and specialist files it requires. Treat AGENTS.md as the canonical source of Bridgecode and repository-specific rules.",
    "After Bridgecode is installed or updated, start a fresh task/session so the harness discovers the new root AGENTS.md.",
    BOOTSTRAP_END,
  ].join(eol);
}

export function buildBootstrap(version, eol = "\n") {
  return [
    `<!-- bridgecode:bootstrap:start version="${version}" schema="2" -->`,
    "Read the complete root AGENTS.md at each new task and after lost context. Apply its Bridgecode policy and load each triggered specialist before its governed action. Use agentic/architecture.md to locate current code and agentic/analysis.md to recover active work. These instructions remain within the host hierarchy and current user scope.",
    "After installing or updating Bridgecode, start a fresh task/session.",
    BOOTSTRAP_END,
  ].join(eol);
}

export function parseBootstrap(text) {
  const starts = [...text.matchAll(startPattern())];
  const ends = findAll(text, BOOTSTRAP_END);
  const hasMarker = text.includes("bridgecode:bootstrap:");
  if (starts.length === 0 && ends.length === 0 && !hasMarker) return null;
  if (starts.length !== 1 || ends.length !== 1 || findAll(text, "bridgecode:bootstrap:start").length !== 1 || findAll(text, "bridgecode:bootstrap:end").length !== 1) {
    throw new Error("Bridgecode bootstrap markers are missing, duplicated, or malformed");
  }
  const start = starts[0].index;
  const end = ends[0] + BOOTSTRAP_END.length;
  if (end <= start) throw new Error("Bridgecode bootstrap marker order is malformed");
  const block = text.slice(start, end);
  return {
    start,
    end,
    version: starts[0][1],
    schema: Number(starts[0][2]),
    block,
    hash: sha256(block),
  };
}

export function upsertBootstrap(existingText, version) {
  const parsed = parseBootstrap(existingText);
  const eol = existingText.includes("\r\n") ? "\r\n" : "\n";
  const block = buildBootstrap(version, eol);
  if (parsed) {
    return { text: `${existingText.slice(0, parsed.start)}${block}${existingText.slice(parsed.end)}`, block };
  }
  if (existingText.length === 0) return { text: `${block}${eol}`, block };
  const separator = existingText.endsWith("\n") ? eol : `${eol}${eol}`;
  return { text: `${existingText}${separator}${block}${eol}`, block };
}

export function removeBootstrap(existingText) {
  const parsed = parseBootstrap(existingText);
  if (!parsed) return existingText;
  let start = parsed.start;
  let end = parsed.end;
  if (start > 0 && existingText.slice(0, start).endsWith("\r\n")) start -= 2;
  else if (start > 0 && existingText.slice(0, start).endsWith("\n")) start -= 1;
  if (existingText.startsWith("\r\n", end)) end += 2;
  else if (existingText.startsWith("\n", end)) end += 1;
  return `${existingText.slice(0, start)}${existingText.slice(end)}`;
}

export function selectInstructionPaths({ mode, customPaths, existingClaude, previousPaths }) {
  const selected = new Set();
  if (mode === "claude" || mode === "both" || (mode === "auto" && existingClaude)) {
    selected.add("CLAUDE.md");
  }
  if (mode === undefined && previousPaths) {
    for (const item of previousPaths) selected.add(validateRelativePath(item, "instruction path"));
  }
  for (const item of customPaths ?? []) {
    selected.add(validateRelativePath(item, "instruction path"));
  }
  return [...selected].sort();
}

export function assertInstructionMode(mode) {
  const allowed = new Set(["auto", "agents", "claude", "both", "none"]);
  if (!allowed.has(mode)) {
    throw new Error(`Invalid --instruction-files value: ${mode}`);
  }
}
