import { readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  assertProjectDirectory,
  loadPackageContext,
  METADATA_PATH,
  resolveInside,
  SCHEMA_VERSION,
  sha256,
  validateRelativePath,
} from "./manifest.mjs";
import { parseBootstrap } from "./instructions.mjs";
import { assertArchitectureFirst, parseManagedAgents } from "./repo-rules.mjs";

async function readOptional(target) {
  return readFile(target).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

async function configuredInstructionLimit() {
  const configRoot = process.env.CODEX_HOME
    ? path.resolve(process.env.CODEX_HOME)
    : path.join(os.homedir(), ".codex");
  const config = await readOptional(path.join(configRoot, "config.toml"));
  if (!config) return { bytes: 32 * 1024, source: "Codex default" };
  const match = /^\s*project_doc_max_bytes\s*=\s*(\d+)\s*$/m.exec(config.toString("utf8"));
  return match
    ? { bytes: Number(match[1]), source: `${path.join(configRoot, "config.toml")}` }
    : { bytes: 32 * 1024, source: "Codex default" };
}

function addCheck(checks, name, ok, detail) {
  checks.push({ name, ok, detail });
}

export async function inspectInstallation({
  projectRoot,
  packageRoot,
  packageContext,
} = {}) {
  const root = await assertProjectDirectory(projectRoot ?? ".");
  const context = packageContext ?? (await loadPackageContext(packageRoot));
  const checks = [];
  let metadata;
  try {
    const bytes = await readFile(resolveInside(root, METADATA_PATH, "metadata path"));
    metadata = JSON.parse(bytes.toString("utf8"));
    addCheck(
      checks,
      "installed version and schema",
      metadata.package === context.packageJson.name &&
        metadata.version === context.packageJson.version &&
        metadata.schemaVersion === SCHEMA_VERSION,
      `installed ${metadata.package ?? "unknown"}@${metadata.version ?? "unknown"}, schema ${
        metadata.schemaVersion ?? "unknown"
      }; doctor ${context.packageJson.name}@${context.packageJson.version}`,
    );
  } catch (error) {
    addCheck(checks, "installed version and schema", false, error.message);
    return { ok: false, projectRoot: root, checks };
  }

  for (const [relativePath, expectedHash] of Object.entries(metadata.managedFiles ?? {})) {
    try {
      validateRelativePath(relativePath, "managed metadata path");
      const bytes = await readFile(resolveInside(root, relativePath, "managed metadata path"));
      const actual = sha256(bytes);
      addCheck(
        checks,
        `managed payload ${relativePath}`,
        actual === expectedHash &&
          context.manifest.files[relativePath] === expectedHash,
        actual === expectedHash
          ? "hash matches installation metadata"
          : `expected ${expectedHash}, got ${actual}`,
      );
    } catch (error) {
      addCheck(checks, `managed payload ${relativePath}`, false, error.message);
    }
  }

  let agentsBytes;
  try {
    agentsBytes = await readFile(path.join(root, "AGENTS.md"));
    const agents = parseManagedAgents(agentsBytes.toString("utf8"));
    if (!agents) throw new Error("managed Bridgecode section is missing");
    assertArchitectureFirst(agents.rules);
    addCheck(
      checks,
      "AGENTS.md managed markers and repository rules",
      agents.schema === SCHEMA_VERSION &&
        agents.version === context.packageJson.version &&
        agents.managedHash === metadata.agents?.managedHash,
      `managed version ${agents.version}, schema ${agents.schema}; repository rules are structurally valid`,
    );
  } catch (error) {
    addCheck(checks, "AGENTS.md managed markers and repository rules", false, error.message);
  }

  for (const [relativePath, expectedHash] of Object.entries(metadata.bootstraps ?? {})) {
    try {
      validateRelativePath(relativePath, "bootstrap path");
      const bytes = await readFile(resolveInside(root, relativePath, "bootstrap path"));
      const bootstrap = parseBootstrap(bytes.toString("utf8"));
      if (!bootstrap) throw new Error("bootstrap block is missing");
      addCheck(
        checks,
        `instruction bootstrap ${relativePath}`,
        bootstrap.version === context.packageJson.version &&
          bootstrap.schema === SCHEMA_VERSION &&
          bootstrap.hash === expectedHash,
        `version ${bootstrap.version}, schema ${bootstrap.schema}`,
      );
    } catch (error) {
      addCheck(checks, `instruction bootstrap ${relativePath}`, false, error.message);
    }
  }

  const requiredFiles = [
    "AGENTS.md",
    "README_HUMAN.txt",
    "bridgecode/general-functions.md",
    "bridgecode/specific-functions/general-processflow.md",
    "bridgecode/specific-functions/specific-processflow.md",
    "bridgecode/specific-functions/frontend-design.md",
    "bridgecode/specific-functions/monoprompting.md",
  ];
  for (const relativePath of requiredFiles) {
    const info = await stat(resolveInside(root, relativePath, "required path")).catch(() => null);
    addCheck(
      checks,
      `required file ${relativePath}`,
      Boolean(info?.isFile()),
      info?.isFile() ? "present" : "missing",
    );
  }

  const agentsText = agentsBytes?.toString("utf8") ?? "";
  addCheck(
    checks,
    "instruction loading contract",
    agentsText.includes("Bridgecode 4.1 Processflow Router") &&
      agentsText.includes("bridgecode/general-functions.md") &&
      agentsText.includes("general-processflow.md") &&
      agentsText.includes("specific-processflow.md"),
    "root AGENTS.md contains the complete router and routed file references",
  );

  const limit = await configuredInstructionLimit();
  const instructionBytes = agentsBytes?.byteLength ?? 0;
  const belowLimit = instructionBytes <= limit.bytes;
  const ratio = limit.bytes === 0 ? 1 : instructionBytes / limit.bytes;
  addCheck(
    checks,
    "Codex combined instruction size",
    belowLimit,
    `${instructionBytes} of ${limit.bytes} bytes (${limit.source})${
      ratio >= 0.9
        ? "; near/over the limit—raise project_doc_max_bytes manually or reduce other applicable AGENTS.md content"
        : ""
    }`,
  );

  return {
    ok: checks.every((check) => check.ok),
    projectRoot: root,
    version: metadata.version,
    checks,
  };
}

export function formatDoctorReport(report) {
  const lines = [`Bridgecode doctor for ${report.projectRoot}`];
  for (const check of report.checks) {
    lines.push(`${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`);
  }
  lines.push(report.ok ? "Doctor passed." : "Doctor found problems; no files were changed.");
  return lines.join("\n");
}

export async function doctorBridgecode(options = {}) {
  const report = await inspectInstallation({
    ...options,
    projectRoot: options.projectRoot ?? options.project,
  });
  return { report, output: formatDoctorReport(report) };
}
