TOKENS_USED: ~1505
## Intent
`@bridgecode/cli` installs, updates, verifies and removes Bridgecode in a project: one agent policy (the generalist) for Codex or Claude Code, the engine that holds a task's state and refuses a skipped step, twelve on-demand specialists, optional cheapGPT and cLoop role assignments, hooks, and project memory the agent keeps. Users are coding agents acting on a user's request, and the users who review what they install. It exists so the policy and the engine arrive byte-exact, can be upgraded without losing project content, and give the agent deterministic numbers and refusals it must not estimate or skip.
## Inputs
- A project directory: empty, with its own `AGENTS.md`/`CLAUDE.md` and host settings, with a 4.1.0–4.3.2 installation (marked or exact unmarked), with a current installation, or with a standalone cheapGPT or cLoop install.
- Command-line arguments: command, `--project`, `--edition`, `--extension` (repeatable), `--no-extensions`, `--replace-standalones`, `--hooks`/`--no-hooks`, `--dry-run`, `--json`.
- The package payload: shared specialists, the engine (`engine.mjs`, `flow.json`, `triggers.json`, cards, core cards), per-edition generalists and guides, extension role files, the hook script, and trusted snapshots in `legacy/`.
- For the engine: the agent's commands, the user's prompts recorded by the hook, the project's git history and its `agentic/` memory.
- For metrics: the project's tracked files, its `agentic/` memory and `.bridgecode/config.json`.
## Behaviour
- Install projects every write, verifies the projected installation against the release, then writes it in one journaled transaction; dry-run stops before writing.
- Update keeps the recorded edition and extension set unless `--extension` or `--no-extensions` replaces it; an edition change is refused with the uninstall-then-install command.
- Repository rules found in `AGENTS.md` move into `agentic/architecture.md` byte for byte, flagged binding and unverified.
- Extension claims resolve with required over optional; the resolved rows and turn lines are written to `.bridgecode/engine/roles.json`, which the engine reads.
- Under exp, `Bash(codex exec:*)` is added when an extension needs it, recorded as added or found, and removed only when added and no longer needed.
- A standalone cheapGPT or cLoop install makes install and update write nothing: they print the removal plan and the detected profile, exit 2 and name `--replace-standalones`. With the flag, after the user's yes, the CLI removes exactly what the standalone's own uninstaller removes, in one transaction that refuses on unknown files or malformed markers and never touches `agentic/`; it writes nothing of Bridgecode and prints the extension choice with the detected profile suggested. Doctor warns about two orchestrators and names the same command.
- The engine walks a task through `flow.json` (13 states, 34 guards, one features stage): FOCUSED builds in tiny loops the root mini-reviews; FULL builds a one-shot, then a next-shot that repairs it and moves it into the layout, reviewed independently; every working state opens with a prevent (`stepback`, then `block`; a one-shot or an explorer's option is its own block), and the engine refuses the state's first work command until it is recorded; GATE runs pre-release on HEAD and release on the frozen candidate, with CONSOLIDATE between. Each transition passes its guards or is refused with the command that satisfies it; the engine runs commands and records their exit and digest, binds cards and specialists, writes call packets, settles outcomes and moves the rung (`first`, `full`, `redefine`). A re-define asks the user for a comment (`answer`) and then a decision on the re-plan (`approve`).
- When the checkout's `.git` refuses delegates' writes, the engine keeps the task's commits in `.bridgecode/git`, a bare clone, and never writes `.git`.
- Uninstall removes only owned content and `roles.json`, and keeps `agentic/` and `.bridgecode/` metrics, config and reports.
- Doctor without an installation says so and names `install`; otherwise it verifies the installation against the exact release and warns on memory-shape drift, an unknown rubric tag, disabled hooks, an orchestration block in `AGENTS.md` under exp, and standalones.
- Metrics counts git-tracked files only and computes LOC, tokens, criteria counts, alert bands and crossed thresholds, caches them for the hook and writes each memory file's `TOKENS_USED` line.
- The hook passes each prompt to the engine's `turn` and emits a reminder with the task's status line, the extension turn lines and crossed budgets; after compaction, codex also receives the policy and the recovery command.
- A non-dry-run install or update from no installation or one older than 4.5 recommends the adoption task in its summary.
## Outputs
- Installed files: the managed core in the instruction file, `bridgecode/`, `.bridgecode/engine/`, `.bridgecode/engine/roles.json`, `README_HUMAN.txt`, hook script and entries, `.bridgecode/installation.json`.
- Task records under `agentic/tasks/<slug>/` (`state.json`, `log.jsonl`, `board.md`) and evidence under `temporary/<slug>/`, written by the engine.
- Human-readable or `--json` summaries; doctor exit code 1 on integrity failure; engine exit code 2 on a refusal.
- `.bridgecode/metrics.json` for the hook and the agent.
## Constraints
- Node 22 or later; no runtime dependencies; nothing added to the project's dependencies; git for the engine.
- Windows, macOS and Linux paths: no symlinked or escaping targets, no device names, case-insensitive aliasing refused.
- Never edits global host settings, another package's files, or project memory outside the engine's `TOKENS_USED` lines.
- A release ships a trusted snapshot of every version it updates from.
- Prompts (generalists, cards, specialists) have no quantitative size target: each is as compact and effective as possible without underprompting, judged by effectiveness, not counted.
## Directions
## Open decisions
