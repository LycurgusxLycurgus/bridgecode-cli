import { sha256 } from "./manifest.mjs";

export const MANAGED_START_PATTERN =
  /<!-- bridgecode:managed:start version="([^"]+)" schema="([^"]+)" -->/g;
export const MANAGED_END = "<!-- bridgecode:managed:end -->";
export const REPO_RULES_START = "<!-- bridgecode:repo-rules:start -->";
export const REPO_RULES_END = "<!-- bridgecode:repo-rules:end -->";

function allIndexes(text, needle) {
  const indexes = [];
  let from = 0;
  while (true) {
    const index = text.indexOf(needle, from);
    if (index === -1) return indexes;
    indexes.push(index);
    from = index + needle.length;
  }
}

function lineEndingAt(text, index) {
  if (text.startsWith("\r\n", index)) return "\r\n";
  if (text.startsWith("\n", index)) return "\n";
  return "";
}

export function splitCanonicalAgents(text) {
  const match = /^## 5\) Specific Repo Rules[^\r\n]*(?:\r?\n|$)/m.exec(text);
  if (!match) {
    throw new Error("Canonical AGENTS.md is missing the Specific Repo Rules heading");
  }
  let bodyStart = match.index + match[0].length;
  const blankEnding = lineEndingAt(text, bodyStart);
  if (blankEnding) bodyStart += blankEnding.length;
  return {
    prefix: text.slice(0, bodyStart),
    templateRules: text.slice(bodyStart),
    eol: text.includes("\r\n") ? "\r\n" : "\n",
  };
}

export function buildManagedAgents(canonicalText, version, repoRules) {
  const { prefix, eol } = splitCanonicalAgents(canonicalText);
  const safeRules = repoRules.length === 0 ? "- " : repoRules;
  return (
    `<!-- bridgecode:managed:start version="${version}" schema="1" -->${eol}` +
    `${prefix}${REPO_RULES_START}${eol}${safeRules}${eol}` +
    `${REPO_RULES_END}${eol}${MANAGED_END}`
  );
}

export function parseManagedAgents(text) {
  const startMatches = [...text.matchAll(MANAGED_START_PATTERN)];
  const endIndexes = allIndexes(text, MANAGED_END);
  const repoStartIndexes = allIndexes(text, REPO_RULES_START);
  const repoEndIndexes = allIndexes(text, REPO_RULES_END);
  const hasMarkerText =
    text.includes("bridgecode:managed:") || text.includes("bridgecode:repo-rules:");

  if (startMatches.length === 0 && endIndexes.length === 0 && !hasMarkerText) return null;
  if (
    startMatches.length !== 1 ||
    endIndexes.length !== 1 ||
    repoStartIndexes.length !== 1 ||
    repoEndIndexes.length !== 1
  ) {
    throw new Error("Bridgecode markers are missing, duplicated, or malformed");
  }

  const start = startMatches[0].index;
  const end = endIndexes[0] + MANAGED_END.length;
  const repoStart = repoStartIndexes[0];
  const repoEnd = repoEndIndexes[0];
  if (!(start < repoStart && repoStart < repoEnd && repoEnd < end)) {
    throw new Error("Bridgecode marker ranges are malformed or ambiguous");
  }
  const afterRepoStart = repoStart + REPO_RULES_START.length;
  const openingEol = lineEndingAt(text, afterRepoStart);
  if (!openingEol) {
    throw new Error("Repository-rules start marker must occupy its own line");
  }
  let rulesStart = afterRepoStart + openingEol.length;
  let rulesEnd = repoEnd;
  if (text.slice(0, rulesEnd).endsWith("\r\n")) rulesEnd -= 2;
  else if (text.slice(0, rulesEnd).endsWith("\n")) rulesEnd -= 1;
  if (rulesEnd < rulesStart) {
    throw new Error("Repository-rules block is malformed");
  }
  const managed = text.slice(start, end);
  const relativeRulesStart = rulesStart - start;
  const relativeRulesEnd = rulesEnd - start;
  const skeleton = `${managed.slice(0, relativeRulesStart)}<bridgecode:repo-rules>${managed.slice(
    relativeRulesEnd,
  )}`;

  return {
    start,
    end,
    version: startMatches[0][1],
    schema: Number(startMatches[0][2]),
    rules: text.slice(rulesStart, rulesEnd),
    managed,
    managedHash: sha256(skeleton),
  };
}

export function adoptUnmarkedAgents(existingText, canonicalText) {
  if (
    !existingText.includes("Bridgecode 4.1 Processflow Router") &&
    !existingText.includes("## 5) Specific Repo Rules")
  ) {
    return null;
  }
  const existing = splitCanonicalAgents(existingText);
  const canonical = splitCanonicalAgents(canonicalText);
  const normalize = (value) => value.replaceAll("\r\n", "\n");
  if (normalize(existing.prefix) !== normalize(canonical.prefix)) {
    throw new Error(
      "Unmarked Bridgecode-like AGENTS.md cannot be adopted unambiguously; no files were changed",
    );
  }
  return { rules: existing.templateRules.replace(/\r?\n$/, "") };
}

export function isRulesPopulated(rules) {
  return rules
    .split(/\r?\n/)
    .some((line) => line.trim() !== "" && !/^-\s*$/.test(line.trim()));
}

export function assertArchitectureFirst(rules) {
  const first = rules
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line !== "" && !/^-\s*$/.test(line));
  if (!first) return;
  if (!/^(?:-\s*)?Architecture\s*:/.test(first)) {
    throw new Error(
      "Specific Repo Rules are populated, but Architecture is not the first repository rule",
    );
  }
}
