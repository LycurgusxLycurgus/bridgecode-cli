# Changelog

## 4.6.0

Bridgecode becomes a harness director with an engine. `.bridgecode/engine/engine.mjs` holds each FOCUSED or FULL task's state in `agentic/tasks/<slug>/`, walks it through `flow.json` (ADOPT, DEFINE, EXPLORE, ONESHOT, LOOP, BREAK, GATE, CONSOLIDATE, ASK, ACCEPT, CONDENSE), hands out a step card per state, runs the commands that count as evidence with their exit code and digest, writes delegate packets, and refuses any transition whose guard fails, naming the command that satisfies it. One features stage: FOCUSED builds in tiny loops in the target layout; FULL starts with a single-file one-shot that passes on CORE, then one next-shot loop judged on every required criterion. Every loop, shot and phase opens with PREVENT (the step back, tiny on FOCUSED and small on FULL, full in EXPLORE and for each loop-breaker, then the one-block); the engine refuses each working state's first work command until it is recorded. GATE has a pre-release kind on HEAD and a release kind on the frozen candidate, whose reviewer sees the consolidation diff. One outcome vocabulary (PASS, ADVANCED, STALLED, REGRESSION, BLOCKED) moves the task on a three-rung ladder: the root's first step back, the loop-breakers' full step back, and a re-define with the user, whose re-plan is shown in plain words with what differs from their comment and approved by any clear yes. BREAK with nothing left to fix is refused and names `advance GATE`. A task begun on the earlier two-stage flow migrates on load. When `.git` refuses the writes delegates need, the task moves to a separate store, `.bridgecode/git`, seeded from the checkout's history; `.git` is left untouched. Answers and approvals count only when the user's words appear in a prompt the hook recorded; a hand-edited task state is refused until `recover`.

The generalist is rewritten around the engine and inlines four core cards (best-agent, bertram-gilfoyle, tony-stark, signal 0.4). `loop-mechanics.md` dissolves into 22 step cards; `triggers.json` binds the other specialists to rubric tags, states, changed files and signals and routes them into each role's packet. Taste-bearing specialists ship empty defaults read from `agentic/default-styles.md`. The rubric's G0 Method criteria are retired in favour of the engine's guards.

Extensions are role data: `roles/<extension>-<profile>.json`, vendored from pinned cheapGPT 1.10.0 and cLoop 1.2.0 commits, resolved by the CLI into `.bridgecode/engine/roles.json` (not owned, rebuilt on every install and update). Extension Markdown and the `ACTIVE_EXTENSIONS:` line are removed. Standalone detection also covers `.cheapgpt/` and `.cloop/` folders; `install` prints the removal plan and exits 2, and `install --replace-standalones` removes exactly what the standalone installed, verifies it, and stops so the user chooses the extension. The hook passes each prompt to the engine and carries the task's status line; `metrics` delegates to the engine and writes the `TOKENS_USED` lines.

Distribution moves to GitHub: install from a clone of a `v4.6.0` tag; npm keeps versions up to 4.3.2 as a record. The README carries a flow diagram and ladder table generated from `flow.json`, with a drift test. Engine tests walk scripted tasks in disposable repositories and assert each of the 34 guards' refusals exactly once. 4.5.x was never released; updates come from 4.1.0–4.3.2.

## 4.3.2

Embed proportionate engineering and stable acceptance/relevance gates in shared research, planning, execution, review and condensation stages. Preserve supported-path correctness and safety while excluding speculative requirements and optional refinements.

Replace recursive review with a fresh same-model/same-effort first verdict, at most one coherent correction stage, and a terminal same-model/same-effort PASS/UNRESOLVED verdict. Recovery preserves the cycle budget; no third implementation reviewer or reviewer-driven correction pass. Update hook/guide wording and include the exact 4.3.1 migration snapshot.

## 4.3.1

Restore the explicit every-turn route and analysis-file pointer, with a first-block three-move Best-Agent decision brief before task work. Follow-ups update one temporary board; completion condenses durable knowledge and removes completed state while preserving unfinished work.

Remove the AGENTS.md size rejection. Updates transactionally transfer recognized repo rules into architecture.md as binding, initially unverified constraints, preserve existing memory, and retain unrelated AGENTS blocks after the core. Add the exact 4.3.0 migration snapshot alongside 4.1.0. Size diagnostics and installed-hook checks remain informational about host behavior.

## 4.3.0

A compact permanent core replaces the always-loaded multi-process payload. Six specialists load at their action boundaries. ROBUST pauses on unresolved user decisions or requested checkpoints; native question cards compare evidenced perspectives or minimal complementary amalgams. Direct frontend authorship retains three-reference design exploration, shared Taste, and real UI acceptance. One coordinated regression block and a fresh native same-model reviewer govern implemented work, with a persistent second-REPLAN stop.

Architecture memory now points to verified code, constraints, and regression protection. Causal defects are corrected in code, with architectural change when structurally warranted. Legacy rules remain temporarily visible and urgent until individually reconciled; schema-2 installation separates them from package-owned instructions.

CLI changes add bounded Codex heartbeat/compact hooks, exact canonical verification, complete ownership coverage, linked-path rejection, collision checks, clean obsolete-file retirement, projected dry-run verification, genuine no-op validation, journaled recovery, and exact-artifact release testing. Known 4.1.0 migrations are supported through a trusted snapshot. Live hook delivery and model compliance are not certified by installation.

## 4.1.0

Initial public CLI release with repo-local installation, bounded instruction blocks, legacy repo rules, dry-run, doctor, custom harness bootstraps, and checksum-based updates.
