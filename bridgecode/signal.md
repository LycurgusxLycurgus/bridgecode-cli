---
name: max-signal
description: Execute any task for maximum informational and functional signal with zero noise: separate signal, noise and proxy, run the 80/20 analysis, and treat every remaining element once (REMOVE, MERGE, ELEVATE). Use when ranking what matters in an analysis, review, plan, rubric or prompt, and when distilling documentation or memory.
version: 0.4
---

# EXECUTION CONSTRAINT: MAXIMUM INFORMATIONAL / FUNCTIONAL SIGNAL / ZERO NOISE

Execute the task for maximum useful information and functional effectiveness. Judge each decision by what it enables the intended reader, operator, or system to understand, decide, perform, verify, secure, or maintain. Optimize correctness, clarity, completeness within scope, reliability, and proportionate efficiency. Readable organization, legible interfaces, and clear presentation remain valuable when they improve use or reduce error. Neither brevity nor minimalism is an objective in itself.

## SIGNAL / NOISE / PROXY

- **INFORMATIONAL / FUNCTIONAL SIGNAL:** Facts, evidence, distinctions, mechanisms, requirements, relationships, instructions, decisions, and capabilities that improve understanding or execution; also the validation, security, error handling, observability, performance, and maintainability needed for dependable use.
- **NOISE:** Any text, code, structure, process, or presentation choice that consumes attention or resources without a distinct informational or functional contribution. Necessary complexity, safeguards, documentation, and justified redundancy are not noise.
- **PROXY:** A measurable stand-in for the objective (a test, score, count, checklist, review verdict). A **good proxy** moves with the objective: it passes when the objective is met and has been seen to fail when it is not. A **bad proxy** can be satisfied while the objective is missed (a test that also passes on defective work, a count of items produced, agreement without evidence).

## 80/20 PARETO ANALYSIS

A small part of the signals carries most of the result. Before building, writing, or revising, list the candidate signals and rank each by how much of the objective depends on it, using evidence from real use (what a run, a reader, or a failure showed) rather than how prominent, recent, or frequent the signal is. The 80/20 ratio is a heuristic, not a quota: the split is wherever the evidence puts it.

**The vital ~20%: high-quality signals and good proxies. ELEVATE them.**
A signal is vital when removing it makes the objective fail, when it caused an observed success or prevents an observed failure, or when its consequence is severe or irreversible, however rarely it applies. Elevate means: state it first and explicitly, build and verify it before anything else, give it the strongest evidence, and protect it from later trimming.

**The remaining ~80%: mixed signals. Give each one a treatment.**

| Class | Treatment |
|---|---|
| Noise; bad proxies | **REMOVE.** If the objective still needs a measure, **REPLACE** the bad proxy with a good one. |
| Duplicated signals; several symptoms of one cause | **MERGE** into one statement or one rule that covers the whole property, unless separation is needed for traceability, independent verification, safety, or clear responsibility. |
| Mid-low quality but necessary signals | **COMPACT:** state once, briefly, at the place of use; keep the condition and the action, drop the commentary. |
| Compound signals mixing vital and minor parts | **SPLIT** into single-property signals, then rank each part separately. |
| Valid but not needed for the current objective | **DEFER** to a backlog, visited once after the vital part works; never mixed into it. |
| Unconfirmed signals (asserted, not observed) | **VERIFY** with a real case; promote or remove on the result. Until then, label as unconfirmed. |
| Conflicting signals | **RESOLVE** by evidence; if one solution satisfies every reading, use it; otherwise ask the owner of the objective. |
| Things that caused an observed failure | **VETO:** record as a DON'T with its replacement, so it is not reintroduced. |

Repeat the analysis after each real result, including a first failure, or when the work contradicts the brief: evidence can promote a deferred signal or demote an elevated one. Ranking is by contribution to the objective, never by effort already spent.

## LAWS (DO)

1. **REQUIREMENTS & FIDELITY.** Identify the actual objective, scope, constraints, inputs, outputs, and completion criteria. Preserve material evidence, qualifications, domain distinctions, and established terminology; match every claim to its support.
2. **PRIORITY (80/20).** Rank signals by contribution to the objective and work in that order: the vital part first, complete and verified, then the rest by treatment. Serve the objective, not its measure; trust a proxy only after it has been seen to fail on a known-bad case.
3. **CLARITY & EXPLANATION.** Use precise, familiar language where it preserves meaning. Define necessary technical terms, explain mechanisms and dependencies, and make conditions, ownership, effects, and failure states explicit when they matter. Develop connected reasoning sufficiently for the intended reader to follow it.
4. **STRUCTURE & DEPENDENCIES.** Organize information and implementations around real relationships, interfaces, dependency order, and the work the recipient must perform. Use headings, lists, diagrams, tables, modules, and other structures when they clarify those relationships or make the result easier to operate.
5. **CORRECTNESS & ROBUSTNESS.** Deliver complete behavior appropriate to the requirements. Include relevant input validation, error handling, tests, security controls, accessibility, logging, recovery, and edge-case handling where their absence would create real risk or failure. Make important assumptions and limits inspectable.
6. **EFFICIENCY & MAINTAINABILITY.** Prefer straightforward, maintainable solutions and optimize performance or resource use where requirements or evidence justify it. Use abstractions, comments, documentation, and intentional redundancy when they lower operational cost, risk, or ambiguity. Answer a failure by removing or sharpening what exists before adding something new.
7. **DELIVERY & ECONOMY.** Provide the answer or artifact at the depth needed for correct use, with prerequisites, meaningful tradeoffs, verification steps, and limitations when relevant. Give each significant element a distinct job and stop when the agreed objective is met.

## NOISE_VETO (DON'T → INSTEAD)

1. DON'T invent requirements, certainty, metrics, authority, or functionality → state only what the request or the evidence supports, and mark the rest as unknown or unconfirmed.
2. DON'T broaden the task to make the result look more complete → finish the agreed scope and list anything else as a deferred option.
3. DON'T treat all signals as equal or work them in the order they arrived → rank by contribution to the objective and do the vital part first.
4. DON'T rank by prominence, recency, frequency, or effort already spent → rank by what a real run, reader, or failure showed.
5. DON'T optimize a proxy (a passing test, a score, a count, an approval) in place of the objective → check the objective directly, and keep only proxies seen to fail when the objective is missed.
6. DON'T prune a rare signal whose consequence is severe or irreversible → keep it in the vital part regardless of frequency.
7. DON'T patch duplicated signals or symptoms one by one → merge them into one statement or one rule for the shared cause.
8. DON'T shorten indiscriminately or compress into cryptic shorthand that forces reconstruction → compact only necessary lower-value signals, keeping condition and action intact.
9. DON'T use filler, vague significance claims, decorative vocabulary, needless qualifications, unexplained jargon, or arbitrary bursts of short phrases → say the specific thing in plain words, with terms defined.
10. DON'T impose stock templates, ceremonial layers, arbitrary taxonomies, repetitive labels, decorative containers, or fragmentation that hides the logic → let the structure follow the real relationships and the recipient's work.
11. DON'T trade away reliability, safety, or critical context to reduce lines or tokens → keep every safeguard whose absence creates real risk.
12. DON'T add defenses, features, dependencies, speculative architectures, wrappers, or premature optimization for hypothetical needs → add them only for a stated requirement or an observed failure.
13. DON'T duplicate logic without a purpose, write opaque cleverness, or add commentary that restates the evident → write it once, plainly, and comment only on what is not evident.
14. DON'T pad with throat-clearing, repeated conclusions, generic advice, or performative thoroughness → give each element a distinct job and stop when the objective is met.
15. DON'T answer a failure by adding a new layer on top → remove or sharpen the existing element that failed, and record the cause as a veto.

## SIGNALS (TRIGGERS / CUES)

Cues that tell which class a candidate belongs to, and which law or veto applies.
Most cues are single events; the first two are trajectory cues, read across several results, and take precedence over single-event cues.

A cue is detected either by a check (a count, a diff, a test result, or a comparison of revisions) or by judgment; prefer the check when the work keeps the records it needs.

**Spiral → STOP AND RE-RANK (Laws 2, 6; Vetoes 7, 15)**
- The same problem returns in another form.
- A fix is justified only by an earlier fix.
- Effort or size grows while the result does not improve.

Stop, repeat the 80/20 analysis on the work as a whole, and remove or sharpen before adding.

**Virtuous cycle → ELEVATE (Law 2)**
- One change resolves several problems.
- Removing an element improves the result.
- A result holds on a materially different case.

Elevate the successful pattern. Elevate it beyond its original case only after it holds on a materially different case; until then, treat it as a local fix, because one success can be a coincidence of that case.

**Cues of a vital signal → ELEVATE (Laws 1, 2, 5)**
- Removing it makes the objective fail or the result unusable.
- It is named in the completion criteria, or the user stated it as a constraint.
- A real run shows it caused the success, or its absence caused the failure.
- Several other elements depend on it (it comes first in dependency order).
- Its failure is severe or irreversible: safety, legal, privacy, money, data loss.

**Cues of a good proxy → KEEP**
- It has been seen to fail on a known-bad case and pass on a known-good one.
- It is checked at the same unit and on the same real input the objective names.

**Cues of a bad proxy → REMOVE or REPLACE (Law 2, Veto 5)**
- It passes on work known to be defective, or was never seen to fail.
- It can be raised without the objective improving (counts, length, coverage, agreement, a changed finish line).
- It is a paraphrase from memory of the requirement rather than the requirement's own wording.

**Cues of noise → REMOVE (Vetoes 9, 10, 14)**
- Deleting it changes nothing the reader does, decides, or verifies.
- It restates something already said or evident; it exists to look thorough.
- No requirement, evidence, or observed failure traces to it.

**Cues of duplication → MERGE (Veto 7)**
- Two elements do the same job, or several problems share one cause.

**Cues of a necessary lower-value signal → COMPACT (Veto 8)**
- It is needed for correct use but only in one place or one condition.
- It takes more space than its share of the result.

**Cues of a compound signal → SPLIT**
- It contains "and", several conditions, or can be half-met.

**Cues of an optional signal → DEFER (Veto 2)**
- It is valid and attractive, but the objective is met without it.
- It answers a hypothetical future need.

**Cues of an unconfirmed signal → VERIFY (Veto 1)**
- It is asserted without a run, a source, or a case; it comes from memory or inference.

**Cues of a conflict → RESOLVE**
- Two requirements cannot both hold on a real case; a requirement has more than one literal reading; the evidence contradicts the plan.

## FINAL TEST: REMOVE, MERGE, ELEVATE

- **REMOVE** an element when its absence does not impair understanding, correctness, operation, verification, safety, or maintenance.
- **MERGE** elements that duplicate the same function, unless separation is needed for traceability, independent verification, safety, or clear responsibility.
- **ELEVATE** necessary but weak elements by making requirements explicit, explanations intelligible, mechanisms observable, implementations reliable, and outputs verifiable. Improve the work rather than decorating or indiscriminately shortening it.
- **CHECK THE SPLIT:** the vital signals come first and are verified; every other element has received one treatment (compact, split, defer, verify, resolve, or veto); no bad proxy remains.

Deliver the maximum informational and functional signal required by the task with no avoidable noise. **Zero noise means zero unjustified content or complexity, not zero explanation, safeguards, or structure.**

## NOTES

NOTE1: When using these principles to create or revise prompts for other LLMs, first run the 80/20 Pareto analysis on the candidate instructions, then ask the prompt creator to distill the selected signals into three sections:

- **LAWS (DO):** the vital, high-signal principles that guide behavior, stated as abstract positive laws, in priority order.
- **NOISE_VETO (DON'T → INSTEAD):** each unwanted behavior stated as a DON'T rule followed, in the same line, by what to do instead. Each veto should trace to an observed or clearly foreseeable failure.
- **SIGNALS (TRIGGERS / CUES):** the general, universal inputs or situations that should trigger each law or veto, stated as observable cues ("when you see X → apply Y"), so the laws and vetoes are applied at the right moment, effectively and efficiently; when the prompt governs iterative work, explicitly name the two trajectory cues, Spiral and Virtuous cycle.

Every law and veto should have at least one cue; a rule with no trigger is rarely applied, and a cue with no rule is noise.
