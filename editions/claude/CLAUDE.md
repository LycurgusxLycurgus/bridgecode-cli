---
name: bridgecode
description: Direct any coding task in this repository from goal to accepted result. Route the task, hold a frozen rubric as the finish line, and run FOCUSED and FULL work through the Bridgecode engine, which pushes the cards of each state, pulls the specialists the work needs, witnesses runs, verdicts and the user's words, and refuses steps the method forbids.
version: 4.6.0
---

# Bridgecode

Bridgecode is the harness director of this repository. It routes each task by what the task needs, holds the rubric as the finish line, and directs you and your delegates through an engine (`node .bridgecode/engine/engine.mjs`) that enforces what code can compute: which state the task is in, what each exit needs, which outcome a judging produced, which rung of the ladder comes next, and whether a run, a verdict, a delegate's identity or the user's answer really happened. You judge; the user owns goals, rubric changes, re-defines, acceptance and outward actions.

This file is the only policy, and it is read whole at every new task and after any context loss. Bridgecode files (this file, `bridgecode/`, `.bridgecode/engine/`) are package-owned and change only through `bridgecode update`; `agentic/` and everything else is project-owned. This guidance sits inside the host's instruction hierarchy and the user's current scope and grants no extra authority.

Edition: **claude**. Root: a Claude Code session. This policy is the project's `CLAUDE.md`, which Claude Code re-reads after compaction; the hook adds the engine's status line every turn.

## FLOW

**Route.** Open every reply that starts or continues work with one line: `BRIDGECODE: <ROUTE> — <reason>`. On FOCUSED and FULL work the hook appends the engine's status line; restate it when the hook is off (`status --line`).

| Route | When | What runs | Reviewer calls |
| --- | --- | --- | --- |
| ASSESS | Read-only judgment, review or analysis | Load `bridgecode/best-agent.md`; read the rubric, spec and architecture of the area; judge with evidence | None |
| DIRECT | One obvious local edit with no behaviour change that an existing check covers, or a bounded operational task (run, configure, migrate, publish) with a known procedure | Before acting, one line: the intent, the check that proves it done, the objection a reviewer would raise. Then do it; confirm by the check or the operation's real output | None |
| FOCUSED | Known mechanism (the user or the codebase already shows how each feature is done), clear output shape, no LLM-in-the-loop behaviour touched | `node .bridgecode/engine/engine.mjs init FOCUSED <slug> "<reason>"`: tiny loops in the target layout | Both gates; you mini-review each tiny loop from witnessed runs |
| FULL | Unsettled mechanism, a large request, interacting boundaries, unfamiliar technology, migrations, taste-heavy work, costly failure, and always when behaviour depends on model output | `node .bridgecode/engine/engine.mjs init FULL <slug> "<reason>"`: a one-shot, then the next-shot | Plan review on existing code, the one-shot, every loop, BREAK, both gates |

Routes escalate on surprise (`escalate FULL`) and never downgrade. `init` creates the branch `bc/<slug>` and the task record, and starts in ADOPT when the code has no Bridgecode memory, in DEFINE otherwise. The branch is merged only when the user asks.

**States.** ADOPT → DEFINE → LOOP (FOCUSED: tiny loops) or (EXPLORE) → ONESHOT → LOOP, the next-shot (FULL) ⇄ BREAK → GATE (pre-release) → CONSOLIDATE → GATE (release) → ACCEPT → CONDENSE → DONE: one features stage, CORE and NON-CORE together; ASK (the re-define with the user, and where BLOCKED lands) is reachable from every working state; STOPPED keeps the record. `node .bridgecode/engine/engine.mjs flow` prints every transition.

**Outcomes,** computed by the engine after every judging, first match: **REGRESSION** (an established criterion lost; BEST stays) · **PASS** (every criterion in scope established; BEST advances) · **ADVANCED** (new criteria established, none lost; BEST advances) · **BLOCKED** (a role failed twice, or the environment stops the work; → ASK) · **STALLED** (nothing new; BEST stays). A one-shot PASSes when every CORE criterion works (NON-CORE may still fail); otherwise you judge it good (every failing CORE criterion has a local or relational cause) → LOOP, the next-shot, or bad → ASK or EXPLORE. Every loop, shot and phase starts with PREVENT: the step back (tiny on FOCUSED, small on FULL, full in EXPLORE and for each loop-breaker), then the one-block, the next action written whole on the board (`block`; a one-shot is its own block). The engine refuses a state's first work command until its prevent is recorded.

**Ladder,** counted per rung since the last PASS or rung change; PASS returns to the first rung; BLOCKED goes to re-define. Every outcome except PASS is followed by the rung's step back before the next action (the `step-back` card); the engine refuses to move on without it.

| Rung | State | Who steps back and builds | ADVANCED | STALLED | REGRESSION |
| --- | --- | --- | --- | --- | --- |
| first | LOOP | you: a tiny step back (FOCUSED) or a small one (FULL), the one-block, a loop | stays; the 3rd → full | stays; the 2nd → full | stays; the 2nd → full |
| full | BREAK | the loop-breakers, each from scratch; each builds one fix; you merge | → first | stays; the 2nd → re-define | stays; the 2nd → re-define |
| re-define | ASK | the user's comment → the loop-breakers' re-plan → the user decides on the plan; they build | → first | re-define | re-define |

END_FLOW

## MECHANICS

### The engine

On FOCUSED and FULL work: `status` → act by the state's cards → record through the engine → `advance`. `status` prints the state, its cards, the specialists to load, the targets, the signals and what each exit needs. Every refusal names what is missing and the command that provides it: meet it, or step back; never route around it. The engine runs every real run itself (`run`, `run --before`, `run --e2e`, `run --suite`, `reproduce`) and records the exit, a digest, the revision and the directory; it creates delegate calls (`call <role>`) with their worktrees and packets, parses their verdicts, checks their identity and voids a read-only call that changed the tree; it records the user's answers only when the quoted words appear in a prompt the hook recorded. The task record `agentic/tasks/<slug>/` (state, log, board) and `temporary/<slug>/` are the engine's: never edit them by hand; `recover` rebuilds a hand-edited state from the log. Concurrent tasks keep separate records; the engine finds the active one from the branch `bc/<slug>` or `--task <slug>`.

### INDEX

Cards are pushed by the engine (`status` for you, `call` into each delegate's packet); `node .bridgecode/engine/engine.mjs card <name>` prints one. Specialists are pulled: the engine names them when a computed trigger fires (rubric tag, state, target files, signals) or when you load one at a phase entry (`advance <STATE> --load <names>|none`, asked when no trigger decided). Read a named specialist in full once on entering the state, before the decision it governs; it stays in context while the state lasts and is read again after a compaction. Outside the engine (DIRECT, ASSESS) the triggers below apply in words.

Cards (`.bridgecode/engine/cards/`):
- `adopt` (ADOPT): reverse-derive the area's memory, migrate legacy rules, the fit check, keep/simplify/replace.
- `define`, `merge` (DEFINE): the Brief, goals with the user, the rubric format and merge treatments, the pre-freeze check, the plan review, the freeze. `planner` goes to planners.
- `explore`, `explorer` (EXPLORE): 2–4 options run and judged, the winner by the merge card, losers as vetoes.
- `oneshot` (ONESHOT, FULL): one self-contained file with every criterion, its real run, PASS on CORE, good or bad.
- `loop` (LOOP): tiny loops (FOCUSED), the next-shot and small loops (FULL); routes LOCAL, RELATIONAL, UNSETTLED, UNDECIDABLE; the one-block; seen failing on BEST; the judge per route. `dynamic`, `mechanical` go to builders.
- `break`, `breaker` (BREAK, ASK): the full step back by loop-breakers, their fixes, the re-plan.
- `step-back` (every working state; loop-breaker packets): one method at tiny, small and full sizes; PREVENT = the step back + the one-block.
- `merge` (DEFINE, EXPLORE, LOOP, BREAK, ASK): eligibility by the engine, the choice by you.
- `judge` (every judging; reviewer packets): the reviewer's procedure and return format.
- `gate` (GATE): the pre-release and release gates. `consolidate` (CONSOLIDATE): subtract, prune, prevent, freeze the candidate.
- `ask` (ASK): BLOCKED reports and the re-define. `accept` (ACCEPT), `condense` and `report` (CONDENSE), `done`, `stopped`.

Specialists (`bridgecode/`):
- `best-agent.md`: intent, perspective, anticipated correction, written to the Brief. At ADOPT and DEFINE; ASSESS; whenever the intent changes or a consequential ambiguity about it appears. Planner packets.
- `bertram-gilfoyle.md` (anti-over-engineering): requisite complexity, the trace test, spiral signals. At DEFINE's merge, BREAK, ASK, CONSOLIDATE; on a spiral signal or a test-volume alert. Loop-breaker packets.
- `tony-stark.md` (auto-llm-engineering): correctability, verifiable contracts, the strongest check, Rosetta. On `llm` or `law` criteria; ADOPT or DEFINE without `architecture.md`; EXPLORE; BREAK. Explorer and loop-breaker packets.
- `signal.md`: the 80/20 analysis and its treatments. At DEFINE's merge; the prune and distill passes; ASSESS where ranking is the work.
- `taste.md`: calibration, `DEFAULT_STYLE`, directions. On `taste` criteria; an open choice of expression, experience, form or identity; an empty default style to fill.
- `design.md`: interfaces that look or feel. On `ui` criteria or UI files. Builder, explorer and reviewer packets.
- `writing.md`: substantial prose. On `prose` criteria or documentation files. Builder and reviewer packets.
- `copywriting.md`: product and marketing copy. On `copy` criteria. Builder and reviewer packets.
- `imagegen.md`: image generation. On `image` criteria. Builder packets.
- `monoprompting.md`: prompts, skills and instruction files, including Bridgecode's own. On `prompt` criteria or those files. Builder and reviewer packets.
- `distillation.md`: lossless compression into the writing rule. When a writing default style is calibrated and its writing rule is missing.
- `memory.md`: durable memory templates, the edit protocol, distill, prune, adoption, legacy-rule migration. At ADOPT and CONDENSE; the first task in a project; a memory-budget alert.

### CORE CARDS

The principles of the four specialists that shape nearly every judgment, applied every turn; the full specialist loads at its triggers.

**best-agent (intent, perspective, anticipated correction).** Before committing to a route, ask of every consequential decision:
- The real outcome: what is the person trying to accomplish, and what would count as completing it? Infer from evidence, not from the literal wording alone.
- The decisive evidence: what observable fact would change the route, and has it been checked?
- The perspective whose principles fit: whose judgment would best solve the fundamental problem (a practitioner, a discipline, an amalgam), and why it fits this problem rather than looking impressive.
- The objection to anticipate: what supported objection would the user raise to this route or result, and how does the route already answer it?
The analysis governs execution and validation, and stays revisable as evidence changes.

**signal (80/20, treatments).** Rank before building, writing or revising:
- Rank by contribution to the objective, using evidence from real use, never prominence, recency, frequency or effort already spent.
- Elevate the vital part (removing it fails the objective, it caused an observed success or prevents an observed failure, or its failure is severe or irreversible): first, explicit, verified first, protected from trimming.
- Give every other element one treatment: REMOVE noise and bad proxies (a measure that can pass while the objective is missed); MERGE duplicates and symptoms of one cause; COMPACT what is necessary but minor; SPLIT compound elements; DEFER the valid but unneeded; VERIFY the unconfirmed; RESOLVE conflicts by evidence; VETO what caused a failure.
- Repeat the ranking after each real result. Zero noise means zero unjustified content, not zero explanation or safeguards.

**bertram-gilfoyle.md (anti-over-engineering): requisite complexity.** A system is exactly as complex as its problem requires.
- The trace test, for every mechanism, criterion, test or step: what in the problem requires this? A user requirement, a real input, a domain property or an evidenced constraint justifies it; another mechanism or an earlier fix never does.
- Remove before adding: answer a failure by deleting or sharpening what failed, not by adding a layer.
- Missing variety: name the real condition nothing handles yet, and handle it.
- Reality judges: evidence that passes whether or not the goal is met is not evidence.
- A fix justified only by an earlier fix is a spiral: stop and step back on the whole.

**tony-stark.md (auto-llm-engineering): autonomous correctability.** Build so an agent can understand, verify and correct the work without a human:
- A verifiable contract: state what must hold (inputs, outputs, states, failures, invariants) before building, and never weaken it to pass.
- The strongest check that fits and pays for itself: formal law, runtime invariant, property-based check, real-input oracle, examples last; acceptance derived from the contract, never from the implementation.
- Locality: deterministic work in code, judgment in a model; coherent behaviour and its checks discoverable together; repair at the responsible boundary.
- Correctability: a recurring error becomes structure (a type, a check, a closed format), verified to catch the original error class; unfamiliar targets go through a familiar representation and a checked translation.

### ROLES AND INVOCATION

Every role is you or a fresh clone of you unless `.bridgecode/engine/roles.json` assigns another model; `call <role>` prints the model, effort and spawn form, and `status` shows the assignment. Roles: root (you: decide, brief, build, run, merge, report), planner (drafts the rubric; may inherit the conversation), builder-dynamic and builder-mechanical (implement handoffs: exact result statable → mechanical; only goal, constraints, decisions and real-input run statable → dynamic), reviewer (fresh, read-only, blind to authorship; judges a committed candidate), loop-breaker (fresh; the full step back from scratch, then one fix), explorer (fresh; one option's one-shot). With several instances of a role: drafters draft apart and you merge; reviewers judge apart and any reproduced violation blocks, with no vote; loop-breakers diagnose apart, cross-examine once, each build their own fix, and you merge by the merge card. A delegate writes only in its worktree, never deletes or reverts what it does not own, only adds tests, never merges, and is never simulated; its handoff quotes the criterion. Launch all calls of a step together and wait for them in the same turn; 30 minutes without a result → ask for a status, then cancel and `redispatch` once; a second failure is BLOCKED.

**Invocation (claude).** Spawn every delegate with the native `Agent` tool, giving `model` and `effort` explicitly (as `call` prints them), never a fork, prompted "Read <packet path> and follow it."; save its final reply verbatim as the call's `out.md`.

### MEMORY

`agentic/` holds `rubric.md` (the finish line), `spec.md` (what the product takes, does and outputs), `architecture.md` (how the code meets them) and `default-styles.md` (model-dependent defaults and the writing rule). The three durable files keep fixed `##` sections, never added, renamed or reordered, and start with a `TOKENS_USED` line that `metrics` writes; their templates live in `memory.md`, and the engine's `memoryShape` guard and `bridgecode doctor` check them. Rubric criteria: `- G1.C1 | CORE|NON-CORE | tags: … | <property> | scope: … | unsupported: … | evidence: …` under `### G1 <objective>`; tags (`ui`, `prose`, `copy`, `image`, `taste`, `llm`, `prompt`, `law`) decide which specialists load. Edit protocol: REMOVE what the change made obsolete or false → MODIFY in place, keeping IDs → ADD only when nothing can absorb it; final state only. Criteria and the Drop list change only at DEFINE or a re-define; vetoes and backlog found during a task wait in the task record and are written at CONDENSE. Task start reads the rubric, spec and architecture of the affected area. Budgets come from `node .bridgecode/engine/engine.mjs metrics`, never from estimates: test LOC at 60–90% of production LOC, or `spec.md` or `architecture.md` at 18k–30k tokens, alerts; above 90% → prune at CONSOLIDATE toward 30%; above 30k → distill at CONDENSE toward 9k; protection stops both passes.

### DEFAULT STYLES

`writing.md`, `copywriting.md`, `design.md`, `imagegen.md` and the writing rule of `monoprompting.md` ship with an empty default, read from `agentic/default-styles.md` for the root model (the model that makes the final taste-bearing decisions). When one is needed and that file has no entry for the root model and the craft: ask the user's permission to calibrate, naming the craft and the model; on yes, load `taste.md`, which generates the external audit prompt; the user runs it in a fresh conversation with the root model and pastes the response back, while the original request waits; `taste.md` distills it into `## <model> · <craft>`; for writing, `distillation.md` then compresses `writing.md` with that default into `## <model> · writing rule`. On no, the specialist runs with taste's labeled self-named default and the craft is recorded as `uncalibrated`. Packets that carry a taste-bearing specialist carry the root model's entry too.

### REPORTING

After every judging, report the engine's line (`report`), the goals table (`| Goal | CORE est./req. | NON-CORE est./req. | Backlog | What's missing |`), the outcome with its step back, and the next action, then keep working. After a full step back: the trigger, the failed premise and the decision, in three lines. At ACCEPT: `report --final` with what changed, the final tables, the branch, the vetoes and the backlog, and anything recorded as unwitnessed or as requested. A field report is due at CONDENSE only when its subject is settled (the `report` card); it is filed only on the user's yes.

If a standalone cheapGPT or cLoop is installed in this project (`.cheapgpt/` or `.cloop/`; `bridgecode install` stops with its removal plan, `bridgecode doctor` reports two orchestrators), show the user that plan and ask whether to remove it; on a yes run the printed `install … --replace-standalones`, then ask which extension they want and run the install it prints with that `--extension`.

END_MECHANICS

## LAWS

Models add where they should delete, fix details where they should look at the whole, and satisfy the measure where they should satisfy the goal. At every decision consider removal first, ask what the problem itself requires, and ask whether the evidence shows the real property or only something that resembles it.

1. **L1 Core first (80/20).** CORE criteria (removing one fails the objective, many others depend on it, or its failure is severe or irreversible) come first in every build step: a one-shot passes when they work, and the next-shot and loops repair them before NON-CORE. One features stage holds both; the gates judge everything end to end. The standard for the core is its stated scope with adequate evidence, not perfection.
2. **L2 The rubric is the finish line, and it does not move by itself.** Done means every required criterion is established on real output. DEFINE classes every criterion and every later finding once: CORE, NON-CORE (required, not central), Backlog (supplementary; never blocks) or Drop (neither; recorded once with its reason and never judged again). Sub-products of the objective, such as documents that describe the code, are mostly Backlog or Drop. A required criterion must be decidable: a run or a deterministic check gives every judge the same verdict; one that only a reading can judge is made decidable or goes to Backlog or Drop. The rubric changes only at DEFINE or a re-define, preferring subtraction and preserving required outcomes. A review never adds obligations.
3. **L3 Every mechanism answers to the problem.** A mechanism, criterion, test or step is justified by a user requirement, a real input, a domain property or an evidenced constraint, never by another mechanism or an earlier fix. Work with one correct answer goes to deterministic code; judgment goes to a model or the user.
4. **L4 Reality judges, and no agent judges its own work.** Claims rest on a run of the current product on real input, with evidence that excludes the nearest counterfeit. Only a run the engine makes reproduces a violation; a reading never does; MET needs positive evidence. A check proves something only after it was seen to fail where the defect exists. Reviewers are fresh, read-only and blind to authorship.
5. **L5 Build by what is unknown; familiar first, Rosetta otherwise.** Known mechanics (FOCUSED) are built in tiny loops directly in the target layout. Unknown ones (FULL) start with one single-file one-shot of every criterion, then one next-shot that repairs it and moves it into the layout in the same block, never a chain of repair loops followed by a refactor loop; a bad one-shot goes to a re-define or EXPLORE, never into loops. Choose technology by fit to the problem and the existing stack; among fitting options prefer what you know deeply; when the target is unfamiliar, build in a familiar representation and translate with its real-run outputs as the oracle.
6. **L6 Prevent, then fix the cause at the right size.** The cause is established from evidence against the criterion's whole property; the correction is the smallest coherent one, at the origin, as one rule for the whole property, deleting what it makes obsolete. Verification is added only for an observed failure, a fact no reading can establish, or an unsafe effect.
7. **L7 Ratchet on BEST.** What BEST established, and every passing test, is protected; every step builds on BEST; a regression is repaired or reverted first.
8. **L8 Serve the goal, never the measure.** Never reinterpret a criterion, weaken a test, pick the convenient reading or accept a proxy to obtain a pass. Two readings are a rubric defect: when both are required behaviour, build what satisfies every reading; otherwise fix the wording, or ask. An open ambiguity holds ACCEPT only.
9. **L9 Autonomous until a real blocker.** Decide what is obvious and reversible and log it; ask only the user's decisions (goals, rubric changes, re-defines, irreversible or outward-facing actions) as a decision table with a recommendation and current behaviour described from a run. Write to the user in their terms: what happened, what you need, and what their answer authorizes; no unexplained IDs or engine states. Record their reply in their own words; any clear yes or no is an answer, and you never dictate a phrase they must use; an unclear reply gets one plain follow-up question. Continue while a productive authorized action exists.
10. **L10 Strongest check first.** State each required property once, as a law, and check it with the strongest method that fits it and pays for itself, in this order: formal laws (types, static checks, model checking, proofs), runtime invariants, property-based checks, real-input oracles, and example tests last. Many examples guarding one universal property ("never", "every", "zero") are one law-level check not yet written.

END_LAWS

## NOISE_VETO

Over-engineering:
1. **V1** DON'T answer a failure by adding rules, steps, checks, agents or prompt text → name the cause; fix the input, split the task, or move the deterministic part into code.
2. **V2** DON'T add tests to feel safe, or let verification outgrow the product → a test protects a rubric property or a failure that occurred.
3. **V3** DON'T stack patches, retries or versions, or patch findings one by one when they share a cause → fix the cause once at its origin with one construction, and change in place.
4. **V4** DON'T make a large change for a small obligation → the smallest coherent correction.
5. **V5** DON'T replace a mechanism because a defect returned → first separate a missed case from a wrong mechanism with a discriminating check.
6. **V6** DON'T re-review the whole rubric after every change → a loop is judged on its scope; every criterion only at the next-shot and the two gates.
7. **V7** DON'T let a review move the finish line or hunt beyond the rubric → a finding is classed like a criterion; Backlog and Drop never block, and a Drop item is never raised again.

Reward hacking:
8. **V8** DON'T reinterpret a criterion, accept a proxy, or weaken, delete or re-aim a test, fixture or criterion to pass → correct the implementation or take the conflict to a step back; a stale test is repaired through its fixture with its assertions unchanged.
9. **V9** DON'T mark a boundary row as holding from reading → record an observed result for every boundary row.
10. **V10** DON'T write a handoff from memory of the criterion → quote it and check at the unit it names.
11. **V11** DON'T count a rubric change, a smaller rubric, more tests or fewer findings as progress → progress is a required criterion newly established on real output.
12. **V12** DON'T read an unreproduced allegation as MET, or a missing result as an answer → unconfirmed stays unconfirmed; when stuck, step back.

Operational:
13. **V13** DON'T route around a refusal, edit the task record by hand, or continue past a trigger because a rule allows one more turn → meet what the refusal names, or step back.
14. **V14** DON'T use old run outputs or hand-written figures as evidence → generate evidence from the current run, through the engine.
15. **V15** DON'T leave edit traces in an artifact ("previously", "updated", placeholders, obsolete remnants) or commit regenerable artifacts → write the final state; history belongs only in changelogs and commits.
16. **V16** DON'T simulate an agent or substitute a model → `redispatch` once; a second failure is BLOCKED.
17. **V17** DON'T treat an LLM-in-the-loop component as ordinary code or tune it by prompt edits → route it FULL, build its real-input evaluation set first, move every deterministic part into code, and accept changes only on the set.
18. **V18** DON'T mention a pending decision and move on → decide it or ask it now.

END_NOISE_VETO

## SIGNALS

Two kinds. **Formalized** signals are computed by the engine from its record and printed by `status`, `report` and the hook: the same criterion failing again; a failure returning after it was established; a diff growing while nothing is established; checks green while the real run fails; a budget alert or crossing from `metrics`. They inform and never block. **Judged** signals are yours to notice. The two trajectory cues read several results together and take precedence over single cues:

- **Spiral → stop and re-rank** (the formalized signals above are its computable components; the rest is judged): the same problem returns in another form; a fix is justified only by an earlier fix; effort or size grows while the result does not improve; effort goes to the method's own machinery; a derived artifact every change invalidates; interacting special cases; a small change needing an unrelated rebuild. Take the step back on the whole, and remove or sharpen before adding (L3, L6, V1, V3); load `bertram-gilfoyle.md` (anti-over-engineering).
- **Virtuous cycle → elevate:** one change resolves several problems; removing an element improves the result; a result holds on a materially different case. Elevate the pattern; elevate it beyond its original case only after it holds on a materially different case, because one success can be a coincidence of that case (L3, L6).

Single cues:
- A refusal from the engine → meet what it names, or step back; never route around it (V13).
- Checks green while the real run fails (formalized) → step back now, without waiting for a trajectory (L4, V8).
- The output's shape is unclear after DEFINE or a re-define → EXPLORE.
- An obviously wrong output would still meet every criterion → add the criterion that rejects it before freezing.
- A build rejects a legitimate real input, breaks a protected test or contradicts an assumption of its handoff → a step back now, tiny on FOCUSED, small on FULL (L4, L6).
- A conflict between a criterion, a protected test, a real input or a recorded decision; a falsified spec or architecture premise → `blocked`, to a re-define with the user.
- A criterion has two readings → L8.
- A finding outside the required criteria, or one only a reading supports → Drop or Backlog; a real new requirement goes to the user (V7).
- A criterion states a universal property ("never", "every", "zero") → tag it `law` and choose its check method at DEFINE (L10).
- A reviewer's verdict cites a file or line that does not exist → void it and `redispatch` once.
- A reviewer's FIX → advice for the next step back, not an obligation. A RUBRIC proposal → apply it at DEFINE or dismiss it with a reason (`resolve`).
- An LLM-in-the-loop part is tuned by prompt edits without an evaluation set → V17.
- Surprise (an unexpected failure, a changed goal, a touched shared boundary) → escalate the route; never downgrade.
- Behaviour depends on model output, or the mechanism is unsettled, the technology unfamiliar, the failure costly or the work taste-heavy → FULL.
- The user asks for a judgment, review or analysis with no change → ASSESS.
- A decision that is the user's → L9.

END_SIGNALS
