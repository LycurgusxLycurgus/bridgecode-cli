---
name: anti-over-engineering
description: Keeps any LLM work matched to its problem, with no self-justifying machinery, no missing essential handling and no measure satisfied in place of the goal. Counters the default practices of LLMs first (adding instead of deleting, fixing details instead of the whole, reward hacking). Use when designing, implementing, debugging or reviewing code, prompts, schemas, tests or any other work an LLM takes part in, and whenever asked for a Requisite Complexity review.
version: 2.2
---

# Negentropic Engineering

A system should be exactly as complex as its problem requires: no more and no less. That is its requisite complexity. Entropy, here, is everything in a system that the problem does not determine: a mechanism nothing requires (over-engineering), a real condition nothing handles (under-engineering), and evidence that passes whether or not the goal is met (reward hacking). Negentropic engineering removes all three, so that every part of the system, and every piece of evidence about it, carries information about the problem. This document sets out one principle, the corollary that governs verification, and the laws derived from them. It applies equally to a demo and to a production system. What changes between the two is the evidence the problem supplies, not the rules.

## LLM default practices

> **Any default practice that makes engineering more fallible must be avoided, because it degrades every process an LLM takes part in.**

This section applies to all LLM work (code, prompts, documents, data, reviews), not only to engineering. LLMs have three such defaults. They are standing tendencies, not occasional mistakes, so counter them first: before any other rule in this document, and at every decision.

| Default | Counter-practice | Rests on |
|---|---|---|
| Adds where it should delete; complexifies where it should simplify | Consider removal first; trace or remove | §1.1 (trace test), L4 |
| Fixes details where it should look at the whole | Step back to the whole problem; name the class and its cause; make one correction that states the rule for the whole property | L5, signals 1–2 |
| Satisfies the measure where it should satisfy the goal (reward hacking) | Check the goal directly; trust a measure only after seeing it fail on a known-bad case | §1.2, consequence 3 |

At every decision:

1. Consider removal first.
2. Ask what the problem itself requires.
3. Ask whether the evidence shows the real property or only something that resembles it.

The first default makes excess the usual failure in practice: an agent adds a mechanism whenever something fails and rarely removes one. The correction is still not "delete". It is "trace": keep what the problem requires, add what it requires and is missing, and remove everything else.

---

## 1. Foundation

### 1.1 The Principle: every mechanism answers to the problem

> **Every mechanism must be justified by the problem, never by another mechanism.**

A *mechanism* is any element of the solution that consumes attention or resources, or can fail.

**The trace test.** For any mechanism, ask: *what in the problem requires this?*

| Valid answers (trace to the problem) | Invalid answers (trace back into the system) |
|---|---|
| A stated requirement of the user or operator | Another mechanism of the system needs it |
| A real input or condition that has been observed | An earlier fix or design choice needs it |
| A known property of the domain, even if not yet observed | The system's own verification needs it |
| A constraint backed by evidence | It might happen: a risk with no evidence and no basis in the domain |

The test works in both directions:

- **Too little:** something the domain actually varies on has no handling in the system. The problem requires something that is missing, so you add it.
- **Too much:** a mechanism's only justification points back into the system. Nothing in the problem requires it, so you remove it, along with whatever made it seem necessary.

**How spirals form.** A failure is patched with a mechanism whose justification is an earlier design choice rather than the problem. The patch adds new failure surface. The next failure is patched in the same way, and the justifications form a chain that never reaches the problem. Every step seems reasonable on its own, but the system gradually becomes about itself. The warning sign is a fix whose justification cites an earlier fix.

**Where this comes from:**

- **Fred Brooks.** Magnum opus: *The Mythical Man-Month* (1975). Key essay: *No Silver Bullet: Essence and Accident in Software Engineering* (1986). Brooks split software complexity into **essential** complexity, which belongs to the problem and cannot be removed without changing what is solved, and **accidental** complexity, which comes from how we chose to solve it. Only accidental complexity can be removed, and engineering judgment consists of telling the two apart.
- **Ben Moseley and Peter Marks.** *Out of the Tar Pit* (2006). They extended Brooks by identifying the main sources of accidental complexity: **state** and **control**, meaning stored data and orchestration the problem does not demand. Their prescription is to keep essential logic pure, keep essential state minimal, and isolate everything accidental so it can be inspected and removed.
- **W. Ross Ashby.** *An Introduction to Cybernetics* (1956). The **Law of Requisite Variety** says a regulator can only control the disturbances it has states to respond to, or more briefly, only variety can absorb variety. A system with fewer distinctions than its environment fails on real inputs. This is the "no less" half of the principle, and the source of this document's name. The variety that is *requisite* is the environment's variety, not the system's own.

Brooks and Moseley and Marks set the upper bound: nothing accidental. Ashby sets the lower bound: everything the environment actually varies on.

### 1.2 The Corollary: reality is the only judge

> **A solution is correct only when real inputs from the problem show that it works. Evidence the system produces about itself is not proof.**

This is the principle applied to verification. Evidence also has to trace to the problem. If the inputs, the expected results or the judge of a check were produced by the system or its authors, the evidence traces back into the system. It can be a useful signal, but it does not show that the problem is solved.

The corollary has three working consequences:

1. **Grow from a simple system that works on real input.** Get a thin end-to-end path running against real inputs before adding depth. Each addition should be justified by what real runs reveal.
2. **Do not fool yourself.** A test you designed, passing on data you designed, confirms your own expectations. Real input is the test that can disagree with you.
3. **Do not turn a measure into a goal.** Any count, rate or pass/fail signal is a measure of the outcome, not the outcome itself. Once a measure becomes a target, the system gets optimized to produce the measure instead of solving the problem. A measure is only valid while it tracks the real outcome. Optimizing the measure is reward hacking, and these rules prevent it:
   - **Two readings.** A requirement with two readings is a requirement defect. When every reading is required behaviour and one implementation satisfies them all, build that one; otherwise get an unambiguous wording from its owner. Never pick the convenient reading.
   - **Counterfeits.** A proxy is not the property: a file name is not provenance, passing tests are not satisfaction, agreement is not evidence. Name the nearest counterfeit (what could look like the property without being it) and show the evidence that excludes it.
   - **Seen to fail.** A check proves something only after it has been seen to fail where the defect exists.
   - **Progress.** A changed or smaller requirement, more tests or fewer instances are not progress. Progress is a required outcome newly shown on real input.
   - **Unconfirmed.** An allegation that does not reproduce is unconfirmed: it is neither a violation nor a proof.

**Where this comes from:**

- **John Gall.** *Systemantics* (1975; later *The Systems Bible*). **Gall's Law:** every complex system that works evolved from a simple system that worked. A complex system designed from scratch never works and cannot be patched into working. You have to restart from a simple system that works.
- **Richard Feynman.** Magnum opus: *The Feynman Lectures on Physics* (1963–65). Key texts: the *Cargo Cult Science* commencement address (Caltech, 1974) and his appendix to the Rogers Commission report on the Challenger disaster (1986). In *Cargo Cult Science*, he warns that the first duty is not to fool yourself, and that you are the easiest person to fool. The Challenger appendix ends with the observation that "nature cannot be fooled." A procedure that has the form of verification but never confronts reality is cargo cult.
- **Charles Goodhart.** *Problems of Monetary Management: The U.K. Experience* (1975). **Goodhart's Law:** a statistical regularity breaks down once it is used for control. Anthropologist Marilyn Strathern later generalized it (1997): when a measure becomes a target, it stops being a good measure.

### 1.3 The two tests every decision must pass

1. **Trace test (Principle):** what in the problem requires this mechanism? If the answer points inward, remove it. If the problem requires something that is missing, add it.
2. **Reality test (Corollary):** what real input showed that this works? If the only evidence was produced by the system about itself, or cannot tell the real property from its nearest counterfeit, the work is not done.

Every law in this document applies these two tests to a recurring situation. A law that cannot be traced back to one of them does not belong here.

---

## 2. Laws

Each law applies the trace test (T), the reality test (R), or both. The laws do not change with a project's stage. Stage only changes what the problem supplies as evidence: stakes, consumers and real inputs.

**L1. Fit the real problem. (T)**
Before building, establish the objective, the real inputs, the stakes and what counts as done. Requirements also have to pass the trace test. If a requirement contradicts the nature of the domain, challenge it before building around it. Scale safeguards to the real stakes, not to the author's anxiety. Define done in terms of the problem's outcomes, not the system's internal signals. Once set, the done criterion changes only on new requirements or new evidence, never on preference. A deliberate limit is recorded with the condition that would require revisiting it.

**L2. Give each responsibility to whatever does it reliably and most cheaply. (T)**
Work with one correct answer belongs in deterministic code. Work that needs judgment belongs to a model or a person. Never make a component do work that another component already does reliably, and never add a mechanism whose only job is to catch the mistakes of a misplaced responsibility. Move the responsibility instead. Before writing new code, use the first adequate mechanism that already exists: the codebase itself, then the standard library or platform, then an installed dependency. Write the smallest new code only when none of these is adequate.

**L3. Mirror the domain. (T)**
The system's states should match the outcomes the domain actually has, with none missing and none invented. Normal conditions of the world, including absence, unavailability and uncertainty, are represented as values, not treated as errors. Dependencies between parts of the system should match real dependencies in the domain, so a failure reaches only what genuinely depends on it.

**L4. Prefer subtraction. (T)**
For every change, consider removal first. Change things in place. Delete whatever a change makes obsolete within that same change. Keep old forms, versions or compatibility paths only for consumers outside the system that really depend on them. Subtraction never removes what traces to the problem: validation at trust boundaries, protection against data loss, security, accessibility, or anything the user asked for.

**L5. Fix causes, not symptoms. (T)**
Reproduce the failure before changing anything, and change one variable at a time. A fix must name the cause and the class of failure, must fix the class once at the point where it arises, with one rule for the whole property instead of a patch per case, and must reach every place the change affects. If a fix's justification cites an earlier fix, stop: the chain has stopped tracing to the problem (see §4.1).

**L6. Let reality judge. (R)**
Get a thin end-to-end path running on real input early, and grow it in response to what real runs reveal. Work is done only when real input has shown that it works. Tests protect contracts and failures that have actually been observed. A measure is evidence, never a target, and it is trusted only after it has been seen to fail on a known-bad case (§1.2).

---

## 3. NOISE_VETO

These are always vetoed. Each line names the pattern and what to do instead.

- **Test inflation:** tests whose expected values come from the implementation, tests that pin internal details rather than contracts, tests against threats with no evidence behind them, test count treated as progress, or checks repeated or broadened without a new change. **Instead:** test contracts and observed failures, using real inputs as fixtures.
- **Instruction inflation:** responding to a model's failure by adding instructions, rules or schema to its prompt, or letting a prompt or schema grow with the size of the input. **Instead:** fix the input, split the task, or move the deterministic part into code (L2).
- **False victory:** declaring a fix done without a run on real input of the affected path, or with the cause still unnamed. A run that only shows the system starts does not count. **Instead:** apply L5, then L6.
- **Convenient reading:** reinterpreting a requirement or criterion so that a result or a test passes. **Instead:** treat the conflict as a requirement defect (§1.2): build what satisfies every reading when each is required behaviour, or get an unambiguous wording from its owner.
- **Unproven check:** accepting a test or check that also passes on the defective code, or that has never been seen to fail. **Instead:** run it on the old revision and see it fail. If it passes there, it proves nothing until it has the case that separates the two.
- **Acceptance erosion:** weakening, deleting or re-aiming a test or criterion to obtain a pass. **Instead:** fix the implementation. A stale test is repaired by making its fixture valid, with its assertions unchanged.
- **Oversized correction:** a large change for a small obligation. **Instead:** make the smallest coherent correction. A diff large against its obligation is a spiral signal (§4.1).
- **Version accumulation:** parallel versions, branches or compatibility layers for internal forms that no outside consumer uses. **Instead:** change in place (L4).
- **Recovery towers:** layered retries, fallbacks or repair passes for conditions that are normal domain outcomes. **Instead:** represent the condition as a value (L3), and use at most one bounded retry for transient faults.
- **Coupling gates:** independent results that wait on each other or fail together. **Instead:** let dependencies follow the domain (L3).
- **Speculative generality:** features, options, configuration, abstractions, layers or service boundaries without a present need, including an abstraction with a single implementation, a wrapper that only passes calls through, sharing extracted before reuse has repeated, or splitting by size instead of by responsibility. **Instead:** build for the need in front of you, and extract once reuse has been demonstrated.
- **Reinvention:** writing what the codebase, standard library, platform or an installed dependency already provides, or adding a dependency for what a few lines can do. **Instead:** apply L2's order.
- **Review inflation:** findings with no concrete failing case, review that adds requirements or scope or otherwise moves the finish line, or fix-and-review cycles that never end. **Instead:** a review establishes violations of fixed criteria, each with a concrete case (§4.2); optional items go to a backlog.

---

## 4. Spiral signals and review lens

### 4.1 Signals

Any one of these signals means a spiral may be forming. When one appears, stop adding, name the failure class and its cause, and trace every mechanism involved back to the problem before changing anything else:

1. A change is justified by an earlier fix or by another mechanism rather than by the problem.
2. A failure survives two fixes, or a class of failure comes back after being declared fixed or returns in a later review. On its second appearance, treat it as a class at its source.
3. Something grows (code, states, branches, prompts, schemas, tests) in response to a failure whose cause has not been named.
4. Internal signals pass while real runs fail.
5. Effort goes mainly into the system's own machinery rather than into the problem's outcomes.
6. A fix needs special cases that interact with each other, which means the mechanism itself is wrong.
7. A diff is large against the obligation it answers.
8. A check passes on the defective code, or has never been seen to fail.
9. A requirement, criterion or test is about to change so that a result passes.
10. A derived artifact (a document, list or snapshot restating the system) is invalidated by every change, or a loop or gate repeats for one class of finding.

### 4.2 Review lens

The subject of a review is a diff, a plan or the current state of the system. Apply the two tests to it:

1. **Establish the problem.** Identify the objective, real inputs, stakes and done criterion (L1). If these cannot be established, report that first.
2. **Trace.** Apply the trace test to every mechanism the subject adds or changes, and to the existing mechanisms it relies on.
3. **Check for missing variety.** Look for things the domain actually varies on that have no handling.
4. **Check reality.** Determine what real input showed that this works. Name the nearest counterfeit of each claimed property and check that the evidence excludes it.
5. **Scan.** Check the subject against §3 and §4.1.

The reviewer must not demand anything that does not trace to the problem, and must not demand removal of anything that does. A finding names a concrete case on a supported path and what it leads to: a wrong outcome or unjustified cost.

### 4.3 Findings

```
PROBLEM: one sentence each: objective, real inputs, stakes, done criterion
FINDINGS (most impactful first):
  - where: <location of the mechanism>
    case: <the input or situation on a supported path>
    test: TRACE-INWARD | MISSING-VARIETY | NO-REAL-EVIDENCE | VETO:<name> | SIGNAL:<n>
    why: <what it traces to, or what is missing>
    action: REMOVE | ADD | MOVE | MERGE | VERIFY, plus the concrete step
```
