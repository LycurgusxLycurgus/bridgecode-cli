TOKENS_USED: ~2387
## Goals
### G1 Safe lifecycle
- G1.C1 | CORE | tags: law | `install`, `update` and `uninstall` leave every project byte as it was under `--dry-run` or when any write fails, for supported project states, seen in byte snapshots of the dry-run and rollback cases | scope: every edition; projects with no, current or 4.1.0–4.3.2 installations | unsupported: refused before any write | evidence: test/lifecycle.test.mjs, test/safety.test.mjs
- G1.C3 | CORE | An update from 4.1.0, 4.3.0, 4.3.1 or 4.3.2 keeps `agentic/` and every instruction byte outside the managed core, seen in the migration tests | scope: canonical installs and exact unmarked cores | unsupported: locally changed cores are refused | evidence: test/lifecycle.test.mjs
- G1.C4 | CORE | `doctor` fails when an owned file, the managed core or a hook entry differs from the exact release, seen in the tampering cases | scope: installed projects | unsupported: a version without a trusted snapshot is refused | evidence: test/safety.test.mjs
- G1.C5 | NON-CORE | An update with nothing to change writes zero files, seen in byte snapshots | scope: every edition and extension set | unsupported: none | evidence: test/lifecycle.test.mjs, test/extensions.test.mjs
- G1.C6 | NON-CORE | The install and update summary recommends the adoption task only when the previous installation predates 4.5, seen in the formatted summary | scope: non-dry-run installs and updates | unsupported: none | evidence: test/lifecycle.test.mjs
- G1.C7 | CORE | The ownership check ignores `.bridgecode/` caches, reports, `roles.json` and `agentic/`, including task records, seen in `doctor` and a no-op update | scope: installed projects | unsupported: none | evidence: test/lifecycle.test.mjs, test/extensions.test.mjs
### G2 Editions
- G2.C1 | CORE | Each edition places the generalist only in its instruction file (codex `AGENTS.md`, claude and exp `CLAUDE.md`), seen in the installed tree | scope: fresh installs | unsupported: an edition change is refused with the uninstall-then-install command | evidence: test/lifecycle.test.mjs
- G2.C2 | CORE | The three generalists are identical outside their edition line and invocation paragraph, seen in the policy test | scope: the shipped payload | unsupported: none | evidence: test/policy.test.mjs
### G3 Extensions
- G3.C1 | CORE | tags: law | The written `.bridgecode/engine/roles.json` depends only on the installed extension set, not on the order of adding or removing, seen in the file's bytes | scope: cheapgpt and cloop profiles in every edition | unsupported: two profiles of one extension are refused | evidence: test/extensions.test.mjs
- G3.C2 | CORE | The shipped extensions' required claims are disjoint, seen in the parsed `roles/*.json` rows | scope: every edition | unsupported: an overlap fails the build | evidence: test/extensions.test.mjs
- G3.C3 | CORE | `Bash(codex exec:*)` is removed only when Bridgecode added it and no active extension needs it, seen in `.claude/settings.json` | scope: the exp edition | unsupported: none | evidence: test/extensions.test.mjs
- G3.C4 | CORE | A standalone cheapGPT or cLoop install stops install and update before any write and prints its uninstall command and matching extension, seen in the error and byte snapshots | scope: state files, install folders and managed markers | unsupported: none | evidence: test/extensions.test.mjs
### G4 Steering numbers
- G4.C1 | CORE | `bridgecode metrics` reports non-blank production and test LOC equal to hand counts, seen in the polyglot fixture | scope: tracked files, or a bounded walk outside git | unsupported: binary and non-source files are skipped | evidence: test/metrics.test.mjs
- G4.C2 | NON-CORE | A budget is reported in its alert band inside the band (tests 60–90%, architecture or spec 18k–30k tokens) and crossed only above it (> 90%, > 30k), seen in `alerts` and `crossed` | scope: metrics runs | unsupported: none | evidence: test/metrics.test.mjs
- G4.C3 | NON-CORE | `doctor` warns on each memory-shape defect (extra, reordered or missing section, missing `TOKENS_USED`, rubric line without ID, class, scope or evidence, an unknown tag) and on disabled hooks, seen in its warnings | scope: rubric, spec, architecture and installation state | unsupported: content truth is not checked | evidence: test/doctor.test.mjs
### G5 Hooks
- G5.C1 | CORE | The installed hook passes the prompt to the engine's `turn` and emits a reminder carrying the task's status line, every active extension turn line and every crossed budget, within 2,000 characters, seen in its output and the task log | scope: codex and claude hosts | unsupported: an altered core yields a fallback message | evidence: test/hooks.test.mjs
- G5.C2 | NON-CORE | Hook installation keeps every unrelated key and hook entry in the host configuration, seen in the merged file | scope: `.codex/hooks.json`, `.claude/settings.json` | unsupported: invalid JSON is refused | evidence: test/hooks.test.mjs, test/lifecycle.test.mjs
### G6 Payload
- G6.C1 | CORE | tags: law | The payload uses one outcome vocabulary (REGRESSION, PASS, ADVANCED, BLOCKED, STALLED) and no retired verdict set or mechanism, seen in the policy test | scope: generalists, specialists, cards, `flow.json`, the engine, the hook | unsupported: none | evidence: test/policy.test.mjs
- G6.C2 | NON-CORE | tags: law | No specialist names another specialist or a generalist, seen in the policy test | scope: bridgecode/*.md | unsupported: none | evidence: test/policy.test.mjs
- G6.C3 | NON-CORE | Each taste-bearing specialist ships an empty default that reads `agentic/default-styles.md`, seen in the policy test | scope: writing, copywriting, design, imagegen, monoprompting | unsupported: none | evidence: test/policy.test.mjs
- G6.C4 | CORE | The packed artifact holds the payload and no development files, and installs in every edition, seen in the release test | scope: `npm pack` output | unsupported: none | evidence: scripts/test-release.mjs
- G6.C5 | CORE | Each core card is inlined verbatim in every generalist and carries its specialist's version, seen in the policy test | scope: engine/core/*.md | unsupported: none | evidence: test/policy.test.mjs
- G6.C6 | NON-CORE | The README's flow diagram equals the one generated from `engine/flow.json`, seen in `tools/flow-diagram.mjs --check` | scope: README.md | unsupported: none | evidence: test/policy.test.mjs
### G7 Engine
- G7.C1 | CORE | tags: law | Every state in `flow.json` is reachable from a start and reaches a terminal state, and every guard it names is implemented, seen in the engine's `check` and the flow test | scope: engine/flow.json | unsupported: none | evidence: test/engine.test.mjs
- G7.C2 | CORE | tags: law | Every guard `flow.json` names refuses its transition with the command that satisfies it, and lets it pass once satisfied, seen in the task walks and the guard audit | scope: every guard in `flow.json` | unsupported: none | evidence: test/engine.test.mjs
- G7.C3 | CORE | `run`, `run --before` and `reproduce` record the real exit code and output digest, and `reproduce` refuses a verdict its run contradicts, seen in the task log | scope: commands run by the engine | unsupported: none | evidence: test/engine.test.mjs
- G7.C4 | CORE | Read-only calls are voided when the tree changes before their judging, and a reply without a verdict line per criterion is a failed call, seen in the refusals | scope: reviewer calls | unsupported: none | evidence: test/engine.test.mjs
- G7.C5 | CORE | A hand-edited `state.json` is refused until `recover`, and `answer` is refused when the quoted words appear in no prompt the hook recorded, seen in the refusals | scope: task records | unsupported: no recorded prompt marks the answer UNWITNESSED | evidence: test/engine.test.mjs
- G7.C6 | CORE | Outcomes move the rung as the ladder table in `flow.json` states, seen in the task state after scripted judgings | scope: the scripted sequences | unsupported: none | evidence: test/engine.test.mjs
- G7.C7 | NON-CORE | A computed trigger binds its specialist on a rubric tag, a state and a changed-file pattern, and the call packet of each role `triggers.json` names carries it, seen in the turn line and the packet | scope: engine/triggers.json | unsupported: none | evidence: test/engine.test.mjs
## Drop
- Model compliance and live hook delivery | no installation can prove them | the behavioral tasks of spec 19
- Cursor, OpenCode and other harnesses | no edition targets them | a requested harness edition
- A runtime orchestrator beyond the engine | the engine records and refuses; the agent works | none planned
## Vetoes
- RV-01: weighted sub-points and a `bridgecode score` | the weighted gap became the target and stayed flat (councilgpt 3.6, phase E) | single-property criteria counted by `metrics`
- RV-02: a hidden control candidate | it always passed and leaked once | the pre-freeze check on real cases
- RV-03: round-based review (first, correction, terminal) | rounds made large diffs that created their own findings | loops on the ladder, two gates
- RV-04: bootstraps for other instruction files | a second copy of the policy pointer drifted from the core | one generalist per edition
- RV-05: method criteria in the rubric (G0) | the model kept the board by hand and the criteria judged the record, not the product | the engine's guards
## Backlog
- Distill the generalists toward the 15–20 KB target once the behavioral tasks show which wording carries the routing.
- A portfolio step back across workstreams.
