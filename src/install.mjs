import { readFile } from "node:fs/promises";
import path from "node:path";
import { inspectInstallation } from "./doctor.mjs";
import {
  assertInstructionMode,
  parseBootstrap,
  removeBootstrap,
  selectInstructionPaths,
  upsertBootstrap,
} from "./instructions.mjs";
import {
  assertProjectDirectory,
  loadPackageContext,
  METADATA_PATH,
  readPayloadFile,
  resolveInside,
  SCHEMA_VERSION,
  sha256,
  validateRelativePath,
} from "./manifest.mjs";
import {
  adoptUnmarkedAgents,
  assertArchitectureFirst,
  buildManagedAgents,
  parseManagedAgents,
  splitCanonicalAgents,
} from "./repo-rules.mjs";
import { applyTransaction } from "./transaction.mjs";

async function readOptional(target) {
  return readFile(target).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

async function loadMetadata(projectRoot) {
  const bytes = await readOptional(resolveInside(projectRoot, METADATA_PATH, "metadata path"));
  if (!bytes) return null;
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Bridgecode installation metadata is malformed; no files were changed");
  }
}

async function assertRecordedStateClean(projectRoot, metadata, agentsText) {
  if (metadata.schemaVersion !== SCHEMA_VERSION || metadata.package !== "@bridgecode/cli") {
    throw new Error("Installed Bridgecode metadata has an unsupported identity or schema");
  }
  for (const [relativePath, expectedHash] of Object.entries(metadata.managedFiles ?? {})) {
    validateRelativePath(relativePath, "managed metadata path");
    const bytes = await readOptional(resolveInside(projectRoot, relativePath, "managed path"));
    if (!bytes || sha256(bytes) !== expectedHash) {
      throw new Error(`Managed file conflict: ${relativePath}; no files were changed`);
    }
  }
  const agents = parseManagedAgents(agentsText);
  if (!agents || agents.managedHash !== metadata.agents?.managedHash) {
    throw new Error("Managed AGENTS.md content was modified; no files were changed");
  }
  for (const [relativePath, expectedHash] of Object.entries(metadata.bootstraps ?? {})) {
    validateRelativePath(relativePath, "bootstrap metadata path");
    const bytes = await readOptional(resolveInside(projectRoot, relativePath, "bootstrap path"));
    const bootstrap = bytes ? parseBootstrap(bytes.toString("utf8")) : null;
    if (!bootstrap || bootstrap.hash !== expectedHash) {
      throw new Error(`Managed bootstrap conflict: ${relativePath}; no files were changed`);
    }
  }
}

async function assertUnrecordedManagedFilesSafe(projectRoot, context) {
  for (const [relativePath, expectedHash] of Object.entries(context.manifest.files)) {
    if (relativePath === "AGENTS.md") continue;
    const bytes = await readOptional(resolveInside(projectRoot, relativePath, "managed path"));
    if (bytes && sha256(bytes) !== expectedHash) {
      throw new Error(
        `Existing package-managed path is not an exact Bridgecode payload: ${relativePath}; no files were changed`,
      );
    }
  }
}

function appendManagedSection(existingText, managedBlock) {
  if (existingText.length === 0) return `${managedBlock}\n`;
  const eol = existingText.includes("\r\n") ? "\r\n" : "\n";
  const separator = existingText.endsWith("\n") ? eol : `${eol}${eol}`;
  return `${existingText}${separator}${managedBlock}${eol}`;
}

function replaceManagedSection(existingText, parsed, managedBlock) {
  return `${existingText.slice(0, parsed.start)}${managedBlock}${existingText.slice(parsed.end)}`;
}

async function prepareLifecycle({
  command,
  project = ".",
  packageRoot,
  dryRun = false,
  instructionFiles,
  instructionFile = [],
  transactionFailAfterWrites,
} = {}) {
  const projectRoot = await assertProjectDirectory(project);
  const context = await loadPackageContext(packageRoot);
  const version = context.packageJson.version;
  const metadata = await loadMetadata(projectRoot);
  const agentsTarget = path.join(projectRoot, "AGENTS.md");
  const agentsBytes = await readOptional(agentsTarget);
  const agentsText = agentsBytes?.toString("utf8") ?? "";
  const canonicalText = (await readPayloadFile(context, "AGENTS.md")).toString("utf8");
  const templateRules = splitCanonicalAgents(canonicalText).templateRules.replace(/\r?\n$/, "");

  if (metadata) {
    await assertRecordedStateClean(projectRoot, metadata, agentsText);
  } else {
    await assertUnrecordedManagedFilesSafe(projectRoot, context);
  }

  let parsed = parseManagedAgents(agentsText);
  let repoRules;
  let agentsMode;
  if (parsed) {
    repoRules = parsed.rules;
    agentsMode = "replace marked Bridgecode section";
    if (!metadata) {
      const expected = parseManagedAgents(buildManagedAgents(canonicalText, version, repoRules));
      if (parsed.managedHash !== expected.managedHash) {
        throw new Error(
          "Marked Bridgecode AGENTS.md has no trustworthy metadata and differs from this payload",
        );
      }
    }
  } else {
    const adopted = agentsText.length > 0 ? adoptUnmarkedAgents(agentsText, canonicalText) : null;
    if (adopted) {
      repoRules = adopted.rules;
      agentsMode = "adopt unmarked Bridgecode 4.1";
    } else {
      if (command === "update") {
        throw new Error("Bridgecode is not installed; run install before update");
      }
      repoRules = templateRules;
      agentsMode = agentsText.length === 0 ? "create AGENTS.md" : "append to unrelated AGENTS.md";
    }
  }
  assertArchitectureFirst(repoRules);

  const managedBlock = buildManagedAgents(canonicalText, version, repoRules);
  const expectedAgents = parseManagedAgents(managedBlock);
  const nextAgentsText = parsed
    ? replaceManagedSection(agentsText, parsed, managedBlock)
    : agentsMode === "adopt unmarked Bridgecode 4.1"
      ? `${managedBlock}\n`
      : appendManagedSection(agentsText, managedBlock);

  const effectiveMode =
    instructionFiles ?? (metadata ? metadata.instructionMode : "auto");
  assertInstructionMode(effectiveMode);
  const claudeExists = Boolean(await readOptional(path.join(projectRoot, "CLAUDE.md")));
  const previousBootstrapPaths = metadata ? Object.keys(metadata.bootstraps ?? {}) : null;
  const desiredBootstrapPaths = selectInstructionPaths({
    mode: instructionFiles === undefined && metadata ? undefined : effectiveMode,
    customPaths: instructionFile,
    existingClaude: claudeExists,
    previousPaths: previousBootstrapPaths,
  });
  const reservedPaths = new Set([METADATA_PATH, ...Object.keys(context.manifest.files)]);
  for (const relativePath of desiredBootstrapPaths) {
    if (reservedPaths.has(relativePath)) {
      throw new Error(`Instruction bootstrap path overlaps a managed target: ${relativePath}`);
    }
  }

  const changes = [];
  const currentAgentsHash = agentsBytes ? sha256(agentsBytes) : null;
  const nextAgentsBytes = Buffer.from(nextAgentsText);
  if (currentAgentsHash !== sha256(nextAgentsBytes)) {
    changes.push({ path: "AGENTS.md", content: nextAgentsBytes });
  }

  const managedFiles = {};
  for (const [relativePath, hash] of Object.entries(context.manifest.files)) {
    if (relativePath === "AGENTS.md") continue;
    const bytes = await readPayloadFile(context, relativePath);
    managedFiles[relativePath] = hash;
    const current = await readOptional(resolveInside(projectRoot, relativePath, "managed path"));
    if (!current || sha256(current) !== hash) changes.push({ path: relativePath, content: bytes });
  }

  const bootstraps = {};
  const allBootstrapPaths = new Set([
    ...desiredBootstrapPaths,
    ...Object.keys(metadata?.bootstraps ?? {}),
  ]);
  for (const relativePath of [...allBootstrapPaths].sort()) {
    const target = resolveInside(projectRoot, relativePath, "bootstrap path");
    const currentBytes = await readOptional(target);
    const currentText = currentBytes?.toString("utf8") ?? "";
    if (desiredBootstrapPaths.includes(relativePath)) {
      const updated = upsertBootstrap(currentText, version);
      bootstraps[relativePath] = sha256(updated.block);
      if (!currentBytes || sha256(currentBytes) !== sha256(Buffer.from(updated.text))) {
        changes.push({ path: relativePath, content: Buffer.from(updated.text) });
      }
    } else {
      const updated = removeBootstrap(currentText);
      if (updated !== currentText) {
        changes.push({
          path: relativePath,
          content: updated.trim().length === 0 ? null : Buffer.from(updated),
        });
      }
    }
  }

  const nextMetadata = {
    package: context.packageJson.name,
    version,
    schemaVersion: SCHEMA_VERSION,
    instructionMode: effectiveMode,
    instructionFiles: desiredBootstrapPaths,
    managedFiles: Object.fromEntries(Object.entries(managedFiles).sort()),
    agents: {
      path: "AGENTS.md",
      managedHash: expectedAgents.managedHash,
    },
    bootstraps: Object.fromEntries(Object.entries(bootstraps).sort()),
  };
  const metadataBytes = Buffer.from(`${JSON.stringify(nextMetadata, null, 2)}\n`);
  const currentMetadataBytes = await readOptional(
    resolveInside(projectRoot, METADATA_PATH, "metadata path"),
  );
  if (!currentMetadataBytes || sha256(currentMetadataBytes) !== sha256(metadataBytes)) {
    changes.push({ path: METADATA_PATH, content: metadataBytes });
  }

  const summary = {
    command,
    projectRoot,
    version,
    dryRun,
    agentsMode,
    changes: changes.map((change) => ({
      path: change.path,
      action: change.content === null ? "remove managed block/file" : "write",
    })),
    repoRulesHash: sha256(Buffer.from(repoRules)),
  };

  if (!dryRun && changes.length > 0) {
    await applyTransaction(projectRoot, changes, {
      failAfterWrites: transactionFailAfterWrites,
      postCheck: async () => {
        const report = await inspectInstallation({ projectRoot, packageContext: context });
        if (!report.ok) {
          const failures = report.checks
            .filter((check) => !check.ok)
            .map((check) => `${check.name}: ${check.detail}`)
            .join("; ");
          throw new Error(`post-write doctor failed: ${failures}`);
        }
      },
    });
  }
  return summary;
}

export async function installBridgecode(options = {}) {
  return prepareLifecycle({ ...options, command: "install" });
}

export function formatLifecycleSummary(summary) {
  const prefix = summary.dryRun ? "DRY RUN" : "DONE";
  const lines = [
    `${prefix}: Bridgecode ${summary.version} ${summary.command} for ${summary.projectRoot}`,
    `AGENTS.md: ${summary.agentsMode}`,
  ];
  if (summary.changes.length === 0) {
    lines.push("No file changes were required; the installation is idempotent.");
  } else {
    for (const change of summary.changes) lines.push(`${change.action}: ${change.path}`);
  }
  if (summary.dryRun) {
    lines.push("Dry-run completed with zero writes.");
  } else {
    lines.push("Doctor passed after the transaction.");
    lines.push(
      "Start a fresh task/session now: Codex and other harnesses discover instruction files when a task/session begins.",
    );
  }
  return lines.join("\n");
}

export { prepareLifecycle };
