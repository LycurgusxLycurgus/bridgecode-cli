import { doctorBridgecode } from "./doctor.mjs";
import { formatLifecycleSummary, installBridgecode, uninstallBridgecode } from "./install.mjs";
import { PACKAGE_ROOT, assertProjectDirectory } from "./manifest.mjs";
import { updateBridgecode } from "./update.mjs";
import { recoverTransaction } from "./transaction.mjs";
import { runMetrics, formatMetrics } from "./metrics.mjs";

const HELP = `Bridgecode CLI

Usage:
  bridgecode install   [--project <path>] [--edition codex|claude|exp] [--extension <name>:<profile>]... [--replace-standalones] [--dry-run]
  bridgecode update    [--project <path>] [--extension <name>:<profile>]... | [--no-extensions] [--dry-run]
  bridgecode uninstall [--project <path>] [--dry-run]
  bridgecode doctor    [--project <path>]
  bridgecode metrics   [--project <path>]
  bridgecode recover   [--project <path>]

Options:
  --edition codex|claude|exp   codex: AGENTS.md (default); claude: CLAUDE.md; exp: CLAUDE.md with Codex sub-agents.
                               update keeps the installed edition; changing it is uninstall + install.
  --extension <name>:<profile> cheapgpt:cheap, cheapgpt:cheap-100, cloop:town or cloop:high (repeatable,
                               one profile per extension). On update it replaces the installed set.
  --no-extensions              Remove every installed extension.
  --replace-standalones        With the user's yes: remove a standalone cheapGPT or cLoop (exactly what it installed)
                               and stop; then install again with the --extension the user chooses. Without it, install
                               prints the removal plan and exits 2.
  --hooks | --no-hooks         Configure the per-turn and compaction hooks (default: on).
  --json                       Structured output.
`;

export function parseArguments(argv) {
  const [command = "help", ...rest] = argv;
  const options = { project: ".", dryRun: false, extensions: [], packageRoot: PACKAGE_ROOT };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    const value = name => { const v = rest[++index]; if (!v) throw new Error(`${name} requires a value`); return v; };
    if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--hooks" || argument === "--no-hooks") options.hooks = argument === "--hooks";
    else if (argument === "--json") options.json = true;
    else if (argument === "--project") options.project = value("--project");
    else if (argument === "--edition") options.edition = value("--edition");
    else if (argument === "--extension") options.extensions.push(value("--extension"));
    else if (argument === "--no-extensions") options.noExtensions = true;
    else if (argument === "--replace-standalones") options.replaceStandalones = true;
    else if (argument === "--help" || argument === "-h") return { command: "help", options };
    else throw new Error(`Unknown argument: ${argument}`);
  }
  if (options.noExtensions && options.extensions.length) throw new Error("--extension and --no-extensions are exclusive");
  return { command, options };
}

export async function run(argv) {
  const { command, options } = parseArguments(argv);
  const lifecycle = summary => ({ code: summary.stopped ? 2 : 0, output: options.json ? JSON.stringify(summary) : formatLifecycleSummary(summary) });
  if (command === "help" || command === "--help" || command === "-h") return { code: 0, output: HELP };
  if (command === "install") return lifecycle(await installBridgecode(options));
  if (command === "update") return lifecycle(await updateBridgecode(options));
  if (command === "uninstall") return lifecycle(await uninstallBridgecode(options));
  if (command === "doctor") {
    const { report, output } = await doctorBridgecode(options);
    return { code: report.ok ? 0 : 1, output: options.json ? JSON.stringify(report) : output };
  }
  if (command === "metrics") {
    const result = await runMetrics(options);
    return { code: 0, output: options.json ? JSON.stringify(result) : formatMetrics(result) };
  }
  if (command === "recover") {
    if (options.dryRun) throw new Error("recover requires an explicit real recovery invocation");
    const result = await recoverTransaction(await assertProjectDirectory(options.project));
    return { code: 0, output: options.json ? JSON.stringify(result) : result.recovered ? "Recovery completed; run doctor with the previous installed version." : "No pending recovery." };
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
