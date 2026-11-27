---
name: memory
description: Create, edit, distill and prune a project's durable agentic memory (rubric, spec, architecture and default styles) with exact fixed-section templates and a final-state edit protocol. Use when creating the first memory in a project, adopting a project without this memory or with pre-existing plans, migrating legacy repository rules, condensing a finished task, or when a memory or test-volume budget alerts or is crossed.
version: 2.0
---

# Memory

Project memory keeps the finish line, the oracle and the map in separate files so each changes for one reason: `rubric.md` is what reviewers judge against, `spec.md` is what the product takes, does and outputs independent of representation, and `architecture.md` is how the code meets them. A full rewrite in another stack keeps the spec intact; a structural edit changes only the architecture. Memory states the final state of the project, never its history.

## Task

Write and maintain the project's durable memory files under `agentic/` so they match the code, keep their fixed sections, stay within budget, and carry no edit traces.

## I/O

**Input:** the project, its existing `agentic/` files, the task's outcome, and the latest output of `node .bridgecode/engine/engine.mjs metrics`.

**Output:** memory files that follow the templates below exactly, each durable file starting with the current `TOKENS_USED` line.

## LAWS

1. **L1 Fixed sections.** The three durable files keep exactly their template's `##` sections, in order. No section is ever added, renamed or reordered; content changes only beneath them. An empty section stays, with no placeholder text.
2. **L2 Final state only.** No dates, "now", "changed from", version narrative or turn logs; history belongs in changelogs and commits.
3. **L3 Remove, modify, then add.** Every edit follows the edit protocol, so memory shrinks when the project does.
4. **L4 One line per entry.** An entry that needs a paragraph should usually be a check in code.
5. **L5 Numbers are computed.** `TOKENS_USED`, test volume and criteria counts come from the engine's `metrics`, which writes the `TOKENS_USED` lines itself; never estimate them.

END_LAWS

## NOISE_VETO

1. **V1** DON'T append a new section or a dated note to a durable file → place the knowledge in its fixed section, modifying an existing entry where one covers it.
2. **V2** DON'T keep an entry the change made obsolete or false → remove it in the same edit.
3. **V3** DON'T write criteria or Drop items outside DEFINE → they change only at DEFINE or a re-define; vetoes and backlog items found during a task wait in the task record until CONDENSE.
4. **V4** DON'T shrink the rubric to meet a budget → the rubric has no memory pass; shrinking it is a rubric change with the user.
5. **V5** DON'T delete a test that is the only checker of a rubric criterion or of a repair-ledger defect → that floor wins over the test-volume target.
6. **V6** DON'T drop, soften or silently reinterpret an imported legacy rule → move it intact and keep it binding until reconciled.

END_NOISE_VETO

## SIGNALS

- A file's `##` headings differ from its template, or its first line is not `TOKENS_USED: ~N` → L1, L5; the engine's `memory` command and `bridgecode doctor` report it.
- A memory entry mentions a date, a version history or "previously" → L2, V1.
- `metrics` alerts architecture or spec at 18k–30k tokens → keep entries to one line and remove before adding; over 30k → DISTILL at CONDENSE.
- `metrics` alerts test LOC at 60–90% of production LOC → new properties get law-level checks, not more examples; over 90% → PRUNE at CONSOLIDATE.
- The project holds plans, rubrics, specs or architecture notes written before these templates, or has no memory for the area a task touches → ADOPTION.
- An instruction file or an imported-constraints block holds repository rules → LEGACY_RULE_MIGRATION.
- A task reached CONDENSE → the edit protocol, then `metrics`.

END_SIGNALS

## TEMPLATES

Copy these exactly. Text after a heading on the same template line is guidance, not file content: in the actual files each `##` line is the heading alone (for example `## Goals`).

```markdown
<!-- agentic/rubric.md — the finish line -->
TOKENS_USED: ~N
## Goals            per goal: ### G1 <objective>; criteria as
                    - G1.C1 | CORE | tags: ui | <shape sentence> | scope: … | unsupported: … | evidence: …
## Drop             what is out and never judged: item | why | what would bring it in
## Vetoes           RV-01 …: mechanism tried and rejected | why | instead
## Backlog          supplementary items, never criteria, never blocking
```

Criterion shape: `<product part> <does/states> <property> for <inputs in scope>, seen in <evidence>`. Every criterion line carries its ID (`G<n>.C<n>`, under its goal's `### G<n>` heading), `CORE` or `NON-CORE`, optional `tags:` from `ui`, `prose`, `copy`, `image`, `taste`, `llm`, `prompt`, `law` (they decide which specialists the work loads), the property, `scope:`, `unsupported:` (the required behaviour for input outside scope: reject, quarantine or route to review) and `evidence:` (a run or a deterministic check, never a reader's judgment). One property per criterion; no process criteria (tests exist or pass, coverage, the method was followed), bundles, terms with two readings, outcomes over undeclared inputs, or undecidable criteria. A universal property ("never", "every", "zero") is tagged `law` and names its check method in `evidence:`, strongest first: formal law, runtime invariant, property-based check, real-input oracle, examples.

```markdown
<!-- agentic/spec.md — what the product takes, does and outputs; representation-independent -->
TOKENS_USED: ~N
## Intent           what the product is for, who uses it, why (≤ 10 lines)
## Inputs           real inputs, their sources and their variety
## Behaviour        what the product does, as observable statements
## Outputs          what it produces and for whom
## Constraints      legal, safety, performance and platform limits
## Directions       approved taste directions: surface, stance, practitioner(s) with responsibilities, governing principles, vetoes
## Open decisions   user-owned questions not yet answered
```

```markdown
<!-- agentic/architecture.md — how the code meets the rubric and the spec -->
TOKENS_USED: ~N
## Overview         ≤ 10 lines: stack, entry points, run and test commands
## Tree             load-bearing files only, one line each; generated and vendor trees grouped
## Decisions        A-01 …: decision | why | error it prevents (if corrective) | enforced by <check>
## Vetoes           AV-01 …: DON'T <structural pattern> | error it caused | instead
## Budgets          last metrics and pass results: production LOC, test LOC, ratio, suite time, floor reason if > 30%
## Harness          edition, active extensions, host notes
## Unverified rules imported legacy rules pending reconciliation (empty when done)
```

```markdown
<!-- agentic/default-styles.md — model-dependent defaults -->
## <model> · <craft>
<the distilled DEFAULT_STYLE, its coverage limits; or the word uncalibrated>
## <model> · writing rule
<one paragraph: the model's writing guidance and its DEFAULT_STYLE distilled together>
```

`default-styles.md` has no other sections. Entries are added as crafts are calibrated; switching the root model adds entries and removes none. Approved directions for the project are not model-dependent and go to `spec.md` under Directions.

The task record (`agentic/tasks/<slug>/`) is the engine's: it renders and checks it, and no one edits it by hand. It is not durable memory.

END_TEMPLATES

## EDIT_PROTOCOL

For `rubric.md`, `spec.md` and `architecture.md`:
1. **REMOVE** first: delete entries the change made obsolete or false.
2. **MODIFY** next: rewrite an entry in place when the change refines it; keep its ID.
3. **ADD** last, only when no existing entry can absorb the knowledge.
4. Final state only: no dates, "now", "changed from", version narrative or turn logs.
5. One line per entry where possible.

Then run `metrics`, which rewrites each file's `TOKENS_USED` line. Criteria and the Drop list change only at DEFINE or a re-define; vetoes and backlog are written at CONDENSE, after the rubric hash is verified.

END_EDIT_PROTOCOL

## DISTILL

When `architecture.md` or `spec.md` exceeds 30k tokens, rewrite it in place toward 9k tokens, section by section, under the edit protocol with four treatments: REMOVE entries the code no longer needs to explain (anything a reader can recover from one file or one command); MERGE entries that state one decision or behaviour; COMPACT each remaining entry to one line; ELEVATE an entry that needs a paragraph into a check in code with a one-line pointer. Keep every decision that prevents a recorded error, every veto and every unverified rule: protection, not the target, decides where the pass stops. Run `metrics` again.

END_DISTILL

## PRUNE

When test LOC exceeds 90% of production LOC, at CONSOLIDATE, optimize the suite toward 30% with four treatments, applied to every test: REMOVE tests that mirror the implementation, duplicate another test or check something trivial; MERGE overlapping tests, and the many examples of one property into one table-driven check or one verification law; COMPACT setup, fixtures and helpers; ELEVATE the vital checks (CORE properties, observed failures, real-input oracles) to real-input contract tests. The pass improves everything measurable about the suite, not only its size: run time, duplication, flakiness, setup cost and the strength of each check. The only floor is protection: a test that is the sole checker of a rubric property or of a repair-ledger defect is kept or merged, never dropped; the pass stops at that floor, not at the first redundancy removed. Measure before and after (LOC, test count, suite time, coverage of rubric properties unchanged), record them and any floor reason under Budgets in `architecture.md`, and rerun the affected tests and `metrics`.

END_PRUNE

## ADOPTION

For a project without this memory, in the first task that touches an area: reverse-derive the rubric criteria, spec and architecture for that area from the code and its real behaviour, apply the trace test (what in the problem requires this element?), say whether the current architecture can reach the rubric, and confirm them with the user. There is no up-front whole-repository rubric; memory grows area by area. An existing `architecture.md` in another shape is rewritten into the template, keeping every constraint it states; evidence already established stays valid unless a change invalidates it. Adoption never raises the criterion count: splits are paid for by merges and removals, and criteria only a reading can judge start in Backlog. Class every existing criterion as CORE, NON-CORE, Backlog or Drop; make every required criterion decidable and tag each universal property `law` with its check method; migrate legacy rules (LEGACY_RULE_MIGRATION); show the user the before and after criterion counts. Adoption changes no product behaviour.

END_ADOPTION

## LEGACY_RULE_MIGRATION

Repository rules found in an instruction file, or imported by the installer into `architecture.md` under an "Imported repository constraints" heading, move into the `Unverified rules` section, byte for byte. Each remains binding while unverified. For each rule: inspect the code and tests it constrains; if it is implemented, record it as a Decision (with the check that enforces it) or a Veto and delete it from `Unverified rules`; if it is not, implement the correction within the authorized scope, verify it, record it, then delete it. A rule that needs the user's decision stays in `Unverified rules` and goes to the user. The section is empty when the migration is done.

END_LEGACY_RULE_MIGRATION

## VALIDATION_GATE

Before finishing a memory edit, confirm: each durable file has exactly its template's `##` sections in order and a current `TOKENS_USED` line; every rubric criterion line has an ID under its goal, a class, known tags only, a scope, an unsupported field and a decidable evidence field; nothing in memory carries a date, a history or a placeholder; obsolete entries were removed; no criterion or Drop item changed outside DEFINE or a re-define; imported rules were preserved until reconciled. The shape check does not check that memory is true, so read it against the code.

END_VALIDATION_GATE
