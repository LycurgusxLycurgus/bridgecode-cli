import { doctorBridgecode } from "./doctor.mjs";
import { formatLifecycleSummary, installBridgecode } from "./install.mjs";
import { PACKAGE_ROOT } from "./manifest.mjs";
import { updateBridgecode } from "./update.mjs";

const HELP = `Bridgecode CLI

Usage:
  bridgecode install [--project <path>] [--dry-run]
  bridgecode update [--project <path>] [--dry-run]
  bridgecode doctor [--project <path>]

Instruction registration:
  --instruction-files auto|agents|claude|both|none
  --instruction-file <safe-relative-custom-path>  (repeatable)

Bridgecode always installs the canonical complete root AGENTS.md. Other instruction
files receive only a bounded bootstrap that points back to root AGENTS.md.
`;

export function parseArguments(argv) {
  const [command = "help", ...rest] = argv;
  const options = {
    project: ".",
    dryRun: false,
    instructionFile: [],
    packageRoot: PACKAGE_ROOT,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
    } else if (argument === "--project") {
      options.project = rest[++index];
      if (!options.project) throw new Error("--project requires a path");
    } else if (argument === "--instruction-files") {
      options.instructionFiles = rest[++index];
      if (!options.instructionFiles) {
        throw new Error("--instruction-files requires a mode");
      }
    } else if (argument === "--instruction-file") {
      const value = rest[++index];
      if (!value) throw new Error("--instruction-file requires a path");
      options.instructionFile.push(value);
    } else if (argument === "--help" || argument === "-h") {
      return { command: "help", options };
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return { command, options };
}

export async function run(argv) {
  const { command, options } = parseArguments(argv);
  if (command === "help" || command === "--help" || command === "-h") {
    return { code: 0, output: HELP };
  }
  if (command === "install") {
    const summary = await installBridgecode(options);
    return { code: 0, output: formatLifecycleSummary(summary) };
  }
  if (command === "update") {
    const summary = await updateBridgecode(options);
    return { code: 0, output: formatLifecycleSummary(summary) };
  }
  if (command === "doctor") {
    const { report, output } = await doctorBridgecode(options);
    return { code: report.ok ? 0 : 1, output };
  }
  throw new Error(`Unknown command: ${command}\n\n${HELP}`);
}

export async function main(argv) {
  try {
    const result = await run(argv);
    process.stdout.write(`${result.output}\n`);
    process.exitCode = result.code;
  } catch (error) {
    process.stderr.write(`Bridgecode error: ${error.message}\n`);
    process.exitCode = 1;
  }
}
