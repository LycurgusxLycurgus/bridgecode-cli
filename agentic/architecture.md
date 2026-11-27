TOKENS_USED: ~2449
## Overview
Dependency-free Node ≥22 ESM CLI (`bin/bridgecode.mjs` → `src/cli.mjs`), the engine (`engine/engine.mjs`) and a Markdown payload. Authoring output is the sibling `../condensation/` (`shared/bridgecode/`, `shared/engine/`, `roles/`, `codex/`, `claude/`, `exp/`), usable locally as is; the generalists and guides are generated into it by `../build/gen.mjs` and `../build/human.mjs` from `../build/generalist.src.md`. `npm run sync:payload` copies condensation here. Commands: `npm run sync:payload`, `npm run build:manifest`, `npm test`, `npm run test:release -- --output release`, `node tools/flow-diagram.mjs` (README diagram). Tag `v<version>` triggers `.github/workflows/release.yml`, which tests and packs the exact artifact and attaches it to the existing GitHub release; it never publishes to npm.
## Tree
- `bridgecode/*.md` — 12 shared specialists, installed at the same path.
- `engine/` — `engine.mjs` (state, guards, runs, calls, ladder, metrics, memory shape), `flow.json`, `triggers.json`, `cards/` (22), `core/` (4); installed under `.bridgecode/engine/`.
- `editions/<codex|claude|exp>/` — generalist (`AGENTS.md` or `CLAUDE.md`) and `README_HUMAN.txt`.
- `roles/<extension>-<profile>.json` — role rows and turn lines per edition, vendored from a pinned extension commit.
- `hooks/bridgecode-turn.mjs` — the one installed hook for both hosts; calls the engine's `turn`.
- `legacy/*.json` — trusted snapshots: 4.1.0–4.3.2 keyed by install path.
- `src/manifest.mjs` — package identity, editions, specialists, cards, engine files, payload map, safe paths.
- `src/install.mjs` — install, update and uninstall lifecycle; writes `roles.json`.
- `src/verification.mjs` — release construction and exact installed-state verification.
- `src/extensions.mjs` — roles parsing, claim resolution, `roles.json`, standalone detection and replacement.
- `src/hooks.mjs` — hook entries per edition and permission ownership.
- `src/metrics.mjs` — the CLI wrapper over the engine's metrics.
- `src/doctor.mjs` — integrity checks; memory shape (from the engine), hooks-off, exp and standalone warnings.
- `src/repo-rules.mjs` — managed-core markers and repository-rule migration.
- `src/instructions.mjs` — 4.3 bootstrap parsing and removal.
- `src/transaction.mjs` — journal, preconditions, rollback, recovery.
- `scripts/` — payload sync, manifest build, exact-artifact release test.
- `tools/flow-diagram.mjs` — the README flow diagram from `flow.json`; not packed.
- `test/` — lifecycle, safety, hooks, extensions, metrics, doctor, policy, engine, tarball; not packed.
- `test/fixtures/standalones/` — real installs of cheapGPT 1.10.0 `cheap-100` and cLoop 1.2.0 `town`; regenerated when a standalone changes what it installs.
## Decisions
- A-01: `safeTarget` rejects symlinked or junctioned components, escaping paths and non-file targets before any access | linked-path writes outside the project | enforced by test/safety.test.mjs
- A-02: verification rebuilds the expected release from the package or a trusted snapshot and compares bytes, never trusting metadata hashes | forged metadata legitimizing changed files | enforced by test/safety.test.mjs
- A-03: every write goes through one journaled transaction with preconditions; recovery restores only bytes it can prove | partial installs | enforced by test/safety.test.mjs, test/lifecycle.test.mjs
- A-04: recognized repository rules move from `AGENTS.md` into `agentic/architecture.md` byte for byte, in the same transaction | lost or duplicated rules | enforced by test/lifecycle.test.mjs
- A-05: a new payload path that already exists in the project is refused even when the bytes match; retired files are removed only when unchanged | ownership confusion | enforced by test/safety.test.mjs
- A-06: the manifest hashes package paths; `payloadMap(edition)` maps them to install paths | per-edition payload drift | enforced by test/policy.test.mjs
- A-07: the CLI resolves extension claims into `.bridgecode/engine/roles.json`, outside the owned set and rebuilt on every install and update | an assignment the agent or the user resolves by hand | enforced by test/extensions.test.mjs
- A-08: hook entries are versioned; 4.3.x installs verify against their own entries before migration | legacy installs failing verification | enforced by test/lifecycle.test.mjs
- A-09: the hook reads only state, the instruction file and the metrics cache, and calls the engine's `turn` with an 8 s timeout | a repository walk on every turn | enforced by test/hooks.test.mjs
- A-10: state records whether Bridgecode added or found `Bash(codex exec:*)` and whether it created the host config | removing a permission or file the user owned | enforced by test/extensions.test.mjs, test/lifecycle.test.mjs
- A-11: an edition change is uninstall plus install | two instruction files carrying the core | enforced by test/lifecycle.test.mjs
- A-12: the release test installs the packed tarball in every edition | publishing an untested rebuild | enforced by scripts/test-release.mjs
- A-14: the hook stays within 2,000 characters by dropping alert details first and crossing details second, never the base, status or extension lines | a reminder the host truncates | enforced by test/hooks.test.mjs
- A-15: process discipline lives in the engine's guards, not in rubric criteria; `state.json` is verified against the log's last record | method criteria judging the record instead of the product | enforced by test/engine.test.mjs
- A-16: the core cards are generated into each generalist from `engine/core/`, and sync fails when a source card is missing from the manifest | a core card drifting from its specialist | enforced by test/policy.test.mjs
- A-17: one features stage, and the route decides the build: `fullOnly` refuses ONESHOT on FOCUSED, `oneshotFirst` refuses LOOP on FULL before the one-shot, `nextShotDone` refuses GATE until a next-shot passed; GATE is pre-release on HEAD and release on the frozen candidate, and building again makes the pre-release gate due; tasks on the two-stage flow migrate on load | two build stages and a core gate re-testing the core | enforced by test/engine.test.mjs
- A-18: `flow.json` holds 34 guards (31 per state, plus `ladder`, `pendingStepBack`, `breakTargets` on every transition); every refusal names a command; each guard's refusal is asserted exactly once at the transition it gates, and an audit test fails on an untested or doubly asserted guard | dead ends; duplicate scenarios | enforced by test/engine.test.mjs
- A-19: when `.git` refuses the writes delegates need (probed by making them), the task uses `.bridgecode/git`, a bare clone keeping the source's HEAD; `.git` is only read; git commands run as `engine.mjs git <args>` | a task stuck on a checkout that refuses branches or worktrees | enforced by test/engine.test.mjs
- A-20: a standalone cheapGPT or cLoop is removed only with `--replace-standalones`, exactly as its own uninstaller would, in one transaction that refuses on unknown files or malformed markers, never touches `agentic/` and writes nothing of Bridgecode; without the flag install and update print the plan and exit 2 | two orchestrators in one project; removing a user's file | enforced by test/extensions.test.mjs
- A-21: Bridgecode's installed files (`.bridgecode/`, `bridgecode/`, `agentic/tasks/`, `temporary/`, host configs, instruction files, `README_HUMAN.txt`) are method paths, excluded from ADOPT's start check, dirty-tree checks, diffs and metrics; metrics counts git-tracked files only | the method's own files counted as product code | enforced by test/engine.test.mjs, test/metrics.test.mjs
- A-22: the prevent is one rule as data: `flow.json` `prevent` names, per working state, the step size, whether the one-block is owed and the work commands that wait for it; `preventFirst` refuses those commands and the one `stepBack` guard checks the exits; a step back after an outcome and an approved re-plan carry into the next state; tasks saved mid-state owe it from their next entry | the prevent enforced only in the building states and recorded after the work elsewhere | enforced by test/engine.test.mjs
## Vetoes
- AV-01: DON'T write bootstraps into other instruction files | a pointer copy drifted from the core | one generalist per edition
- AV-02: DON'T write global host configuration | user-wide side effects | project-local hooks only
- AV-03: DON'T let the agent or the user resolve extension claims | inconsistent assignments | the CLI resolves them
- AV-04: DON'T remove a standalone cheapGPT or cLoop without the user's yes, or remove anything its own uninstaller would not | two orchestrators in one project; deleting what the user owns | print the plan and exit 2; remove only with `--replace-standalones` (the CLI cannot verify the yes, so the agent asks)
- AV-05: DON'T parse extension Markdown at install time | prose drift broke the role tables | vendored `roles/*.json` checked against a pinned commit
## Budgets
- Production LOC 2213 (19 files), test LOC 1294 (14 files), ratio 59%, by `bridgecode metrics` on the 4.6.0 commit (it counts git-tracked files only). `npm test` 109 tests, 0 skipped; `npm run test:release` 1; the engine walks take most of the suite time.
- Floor above the 30% target: each lifecycle, safety and migration case is the only checker of a G1 criterion for one edition or predecessor version, and each scripted engine task the only checker of a G7 criterion.
## Harness
This package repository is not itself a Bridgecode installation; it dogfoods the memory templates only. Historical authoring reference (not runtime policy) lives in `agentic/reference/`. 4.5.x was never published, so updates come from 4.1.0–4.3.2 only; the release after this one adds `legacy/<this version>.json`.
## Unverified rules
