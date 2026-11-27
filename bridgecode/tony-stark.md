---
name: auto-llm-engineering
description: Engineer software so autonomous coding agents can understand, implement, verify, correct, and maintain it without human coding or routine supervision. Use when designing, implementing, debugging, testing, reviewing, or maintaining software and its agent development harness.
version: 2.1
---

# Auto-LLM-Engineering

**Guiding question:** What properties must software and its development environment have for an LLM to implement, understand, verify, correct, and extend that software reliably without human engineering intervention?

This skill establishes one governing principle, four corollaries, five tests, and the laws and techniques derived from them. It applies to prototypes and production systems alike: the requirement for autonomous correctability stays fixed, while verification depth, safeguards, and execution procedures scale with the actual task, uncertainty, and consequences. Additional engineering machinery is justified only when it makes the required work more understandable, verifiable, correctable, or safely recoverable.

The agent's own default practices are the first threat to correctability: it adds where it should delete, fixes details where it should look at the whole, and satisfies the measure where it should satisfy the goal. Apply every law and technique below against these defaults first: step back before building, make the smallest coherent correction, and accept a check only after it has been seen to fail on the defect.

---

## 1. Foundation

### 1.1 The Principle: Autonomous Correctability

> **Engineer software and its development environment so that an authorized agent can establish what should happen, understand the relevant implementation, discover consequential errors, correct their causes, and independently verify the result without depending on the original author's knowledge or judgment.**

A successful first implementation is insufficient if subsequent agents cannot diagnose, modify, or verify it. Correctability requires inspectable behavior, meaningful boundaries, explicit invariants, actionable failure evidence, and a way to test corrections against the actual requirements. The objective is not error-free generation but a system capable of discovering and correcting errors, and making verified corrections endure.

Autonomy is bounded by available evidence, tools, and authority. Where the agent cannot establish correctness or act safely, it preserves the unresolved condition instead of inventing certainty, silently changing the contract, or exceeding its authorization.

**The correctability test.** Can an authorized agent establish what this must accomplish, understand the relevant code, select reliable tools and representations, detect and localize important errors, repair their causes, and independently establish whether the result satisfies the contract?

| Answers that support autonomous correction | Answers that leave correction dependent or unverified |
|---|---|
| Required behavior and invariants are traceable to a contract and evidence. | The agent must guess what success means or silently reshape the contract. |
| Relevant code and dependencies can be inspected through coherent boundaries. | A local problem requires reconstructing unrelated internals and hidden state. |
| Tools and independent checks can expose consequential errors. | The implementer’s confidence, passing proxies, or agreement are the only evidence. |
| Unfamiliar requirements can be expressed and checked in a reliable representation. | The agent guesses unfamiliar mechanisms or substitutes familiarity for problem fit. |
| Authorized changes can be resumed or recovered after failure. | Failed execution destroys state or creates unbounded external effects. |

**Proportionality of correction.** Missing contracts, relevant context, verification, or recovery mechanisms can prevent reliable autonomous work; supply what is necessary at the responsible boundary. Redundant scaffolding, reviews, abstractions, or documentation can instead increase coordination and failure surface without improving correction; remove or consolidate them. Judge both decisions by whether they improve the agent's ability to understand, verify, repair, or safely recover the required behavior, without sacrificing necessary safeguards.

**How failures compound.** When a defect remains unexplained, repeated patches, broader prompts, and new verification machinery can mask the cause while adding more failure surface. Correctability instead requires evidence that locates the responsible cause and a validated correction that does not depend on the original author remembering the incident.

**Where this comes from:**

**Primary software-engineering foundations**

**C. A. R. Hoare, *An Axiomatic Basis for Computer Programming* (1969).** Preconditions, operations, and postconditions allow program correctness to be expressed independently of the programmer's confidence. The relevant insight is to state what must hold, then establish whether the program satisfies it.

**Leslie Lamport, *Specifying Systems* (2002).** Specifications describe states, transitions, and temporal properties. Correctness includes not only what a function returns, but what can or must happen across sequences of operations, especially with concurrency and persistent state.

**David Parnas, *On the Criteria To Be Used in Decomposing Systems into Modules* (1972).** Modules should hide design decisions likely to change behind stable interfaces. A change should not demand knowledge of unrelated internals. This makes reasoning, modification, and verification more local.

Hoare and Lamport ground **Verifiable Contracts**; Parnas grounds **Local Comprehensibility**. These are software-engineering foundations, not guarantees that any particular specification, architecture, or test suite is correct.

**Borrowed epistemological foundations**

**Karl Popper, *The Logic of Scientific Discovery* (1934; English edition 1959).** Claims should be exposed to criticism capable of finding errors, rather than tested only through confirming examples.

**David Deutsch, *The Beginning of Infinity* (2011).** Knowledge grows through conjecture, criticism, and error correction. Engineering failures should improve explanations and correction mechanisms, not merely produce patches that hide the same problem.

These perspectives explain why independent criticism matters. They remain subordinate to actual software specifications, runtime evidence, and valid proofs. Empirical tests and formal proofs provide different, limited forms of evidence; neither establishes more than its inputs, assumptions, and checked properties warrant.

### 1.2 The Corollary: Verifiable Contracts

> **Make correctness independently checkable.**

Express required behavior as observable contracts, properties, or invariants. Choose verification methods according to what they can establish: types and static checks, executable behavioral tests, real-system observation, model checking, or formal proofs. A *verification law* states a required property independently of implementation; its checking mechanism may be executable or formal. A proof of an inadequate law does not establish the intended behavior.

### 1.3 The Corollary: Local Comprehensibility

> **Make reasoning and correction local.**

Place related behavior, state, interfaces, and verification evidence within coherent boundaries. Make dependencies explicit and conceal irrelevant internals. Minimize the unrelated context and hidden coordination needed to understand a change, trace its effects, or verify it. Locality is not a file-size quota or a demand for maximal fragmentation.

### 1.4 The Corollary: Capability Alignment

> **Make the task accessible to the agent's reliable capabilities.**

Prefer suitable, well-supported technologies and representations that the available agent can use effectively. When required technology is unfamiliar, use the **Rosetta Technique**: express the problem in a representation the agent can reason about reliably, then translate it to the target through authoritative references and executable feedback. The familiar representation may be code, pseudocode, prose, mathematical properties, or state transitions. Familiarity helps choose a reasoning path; it does not override requirements or prove competence.

### 1.5 The Corollary: Recoverable Autonomy

> **Make correction safe and sustainable.**

Keep engineering actions inspectable and recoverable across failures, interruptions, and retries. Preserve enough state and evidence to resume, isolate independently changeable work, control shared mutation, and protect consequential side effects. Autonomy proceeds within authorization, with precise blockers where safe progress is impossible.

### 1.6 The tests every decision must pass

1. **Correctability test (A):** Can an authorized agent understand the obligation, correct consequential errors, and establish the result independently? If not, locate the missing capability or evidence (§1.1).
2. **Verifiability test (V):** What contract property must hold, and which independent check could reveal its violation? If the check does not establish the claimed property, improve the law or verifier (§1.2).
3. **Locality test (L):** Can the responsible behavior, dependencies, and effects be understood and corrected without reconstructing unrelated code? If not, clarify boundaries or reduce hidden coordination (§1.3).
4. **Capability test (C):** Does the agent have a suitable representation, reliable references, and target-environment feedback for this work? If not, apply Rosetta and verify the translation rather than guessing (§1.4).
5. **Recovery test (R):** Can the authorized change be inspected, retried, or restored safely after interruption or failure? If not, establish proportionate control and recovery before consequential execution (§1.5).

When a test fails, improve the missing contract, boundary, representation, verification method, evidence, or recovery path. Add a mechanism only when it materially improves the failed capability under the task's conditions; otherwise omit or consolidate it. Each law applies these tests to a recurring engineering decision; a law that cannot be traced to them does not belong here.

---

## 2. Laws

Each law applies the foundation tests: **A** (Autonomous Correctability), **V** (Verifiable Contracts), **L** (Local Comprehensibility), **C** (Capability Alignment), and **R** (Recoverable Autonomy). The tests remain fixed at every project scale; their implementation depth follows the actual requirements, uncertainty, and consequences. Do not turn an illustrative mechanism into a universal ceremony.

**L1. Ground and preserve the contract. (V)** Establish the intended outcome, affected behavior, domain states, constraints, acceptance conditions, and protected invariants from the task and repository evidence. Inspect relevant code and real operating conditions before inventing a design. Challenge contradictions or consequential assumptions. Do not silently change requirements or weaken established acceptance evidence to make an implementation pass.

**L2. Model the domain and place responsibilities correctly. (V, L)** Represent valid states, transitions, inputs, outputs, and meaningful failures at their responsible boundaries. Use suitable types, validation, and explicit interfaces. Place deterministic transformations in deterministic mechanisms and semantic judgment where judgment is needed. One failure should affect only behavior that genuinely depends on it. Avoid unsupported states, cascading gates, and components that mainly compensate for responsibilities assigned to the wrong place.

**L3. Localize features, dependencies, and changes. (L)** Keep coherent behavior and its relevant contracts, tests, and operational context discoverable together. Prefer feature-oriented modules and stable, narrow interfaces when they reduce reasoning cost; isolate external complexity. Make dependency direction enforceable where useful. Avoid both opaque monoliths and unnecessary file or abstraction proliferation. Favor existing suitable mechanisms and repair defects at their source.

**L4. Align capability with the target, then verify the translation. (C)** For new work, choose technologies by problem fit, existing project constraints, ecosystem reliability, and demonstrable agent effectiveness. Do not replace an appropriate existing stack merely because another is more familiar. When knowledge is uncertain, apply Rosetta to separate the logic from unfamiliar syntax or APIs, consult current authoritative references, and check the result in the target environment. Treat self-assessed familiarity as a hypothesis, not evidence.

**L5. Make acceptance independently falsifiable. (V)** Derive expected behavior from the contract, not from the implementation under test. Run checks that could expose realistic defects, including actual integration and user-facing behavior when relevant. Keep an independent acceptance oracle or reviewer perspective for consequential changes. Do not equate compilation, mocks, green test counts, model agreement, or a passing formal proof with properties those checks never established. Change verification laws only for justified contract changes, not to conceal failures.

**L6. Correct causes and turn recurrent errors into structure. (V, L)** Reproduce or otherwise establish a consequential defect; trace it to the responsible boundary and test the causal hypothesis. When a pattern recurs, prefer an enforceable correction in contracts, types, architecture, lint rules, or tests over stacking instructions or downstream patches. Verify that the protection detects the original error class. Record durable architectural knowledge only after a correction or prevention is verified.

**L7. Make autonomous actions controlled and recoverable. (R)** Operate inside authorized scope with appropriate isolation, credentials, backups, rollback, and explicit control of irreversible effects. Design retryable state changes to recognize prior work and recover from interruption; avoid concurrent writers to the same mutable targets unless ownership or synchronization is enforced. Keep checkpoints and validation evidence sufficient to recover, not a ceremonial audit trail.

**L8. Advance in coherent, verifiable increments. (V, L, C, R)** Scale planning, checks, reviews, and parallel agents to risk and uncertainty. Complete behavior, boundaries, and necessary verification together; verify consequential increments before building dependent work and finish with integration evidence. Preserve concise active task state across sessions and durable verified repository knowledge separately. Stop at verified completion or an evidence-backed blocker, rather than repeating unproductive cycles.

---

## 3. NOISE_VETO

These patterns are vetoed. Each names the failure and the correction required by its law.

- **Self-confirming verification:** Derive expected results solely from the code being tested, replace real checks with mocks or model agreement, measure progress by test count, or accept a regression test that was never seen to fail on the defective revision. **Instead:** Test required behavior with a credible independent oracle (L5).
- **Acceptance erosion:** Delete, weaken, or reinterpret valid tests, invariants, laws, or requirements merely to obtain a pass. **Instead:** Correct the implementation or justify an explicit contract change (L1, L5).
- **Patch and instruction inflation:** Respond to unexplained failures by stacking prompts, validators, retry layers, versions, or patches. **Instead:** Test the causal premise and correct the responsible boundary (L2, L6).
- **Speculative architecture:** Add services, dependencies, wrappers, abstractions, compatibility branches, or tooling without a concrete requirement or demonstrated reduction in risk or operating cost. **Instead:** Prefer suitable existing mechanisms; introduce new ones only when they improve local understanding, verification, or safe execution (L3, L7, L8).
- **Context fragmentation:** Scatter one behavior across unnecessary files, hidden global state, or implicit interfaces, or impose arbitrary file-length limits in place of comprehension. **Instead:** Group coherent responsibilities behind explicit, inspectable boundaries (L3).
- **Familiarity over fit:** Choose an unsuitable stack, rewrite a suitable existing one, or guess unfamiliar APIs because a different representation feels easier. **Instead:** Use Rosetta and actual target checks (L4).
- **Verification theater:** Claim a proof from a law written only in prose, infer implementation correctness from a proof of an incomplete model, or impose formal verification where it adds no justified assurance. **Instead:** Match verification claims and methods to the actual required property (L5).
- **Workflow inflation:** Mandate extra agents, alternative designs, documentation, review rounds, or ceremonies without a distinct contribution to correctness, safety, or maintainability. **Instead:** Scale execution to the risk and uncertainty (L8).
- **Unsafe autonomy:** Allow concurrent mutation without ownership, silently cross authorization boundaries, or repeat consequential actions without state inspection and recovery protection. **Instead:** Enforce authorized, recoverable state changes (L7).
- **Memory inflation:** Turn every local mistake into permanent instructions, creating duplicate or obsolete rules. **Instead:** Preserve only durable, verified guidance (L6, L8).

---

## 4. Techniques

Use these techniques when their trigger occurs; they are not mandatory stages for every change. Their depth follows uncertainty and stakes.

### 4.1 Representation-independent Verification Laws

A **Verification Law** is a durable, implementation-independent claim about required behavior. Express the law first in the representation in which its meaning is clearest, then use Rosetta to realize an appropriate check in the codebase's actual language and toolchain. This borrows the *specification-first* idea from languages such as Bend2, without requiring every project to adopt Bend2 or formal proofs.

For a law, establish only the information the property needs:

- **Scope and assumptions:** which inputs, states, operations, and environmental conditions are covered.
- **Property:** what must always hold, what outcome must follow, or what prohibited state must never occur.
- **Evidence and checker:** how a violation could be detected, and what the chosen method actually guarantees.

**Behavioral Law:** Implement the property as an executable test, property-based check, integration probe, runtime invariant, or other appropriate behavioral verifier. Derive expected outcomes independently of the implementation. Use representative real interactions when relevant; prove the check can detect a plausible violation when economical. Passing establishes the exercised cases or the guarantees of the employed checker, not universal correctness by declaration.

**Formal Law:** Express the property in a precise mathematical or machine-checkable specification, with explicit assumptions. Use a proof assistant, dependent type system, model checker, SMT solver, or another suitable formal method. Distinguish an exhaustive proof within a stated model from bounded exploration. Verify that the model and verified implementation boundaries correspond to the actual code; a correct proof of a weak, obsolete, or disconnected property is insufficient.

**Maintenance rule:** Keep laws and their checkers synchronized with justified changes to real behavior. Do not silently weaken them to accommodate code. Prefer a small set of load-bearing laws over a large inventory of tautologies or implementation-specific assertions. Use formal laws when the consequences or state space justify their additional construction and maintenance cost.

### 4.2 Making correction durable

After preventing or fixing a *fundamental, structural, or architectural* error, verify the correction and encode prevention at the nearest responsible boundary through an applicable type, contract, test, architecture rule, or tool-enforced check. Record confirmed, durable architectural knowledge when it helps subsequent agents apply that protection. Do not document a hypothesis as an established rule or write a new architectural lesson for every routine bug.

---

## 5. Failure Prevention and Review

### 5.1 Signals

Investigate when: the same defect class survives successive repairs; verification passes while real behavior fails; a fix depends on accumulating previous fixes; a small change requires reconstructing unrelated modules; a required law has no credible checker; a reviewer cannot establish the relevant cause; or autonomous work is repeatedly lost, duplicated, or unsafe to resume. These are investigation triggers, not automatic evidence that a particular architecture is wrong. When one indicates a consequential loss of correctability, stop repeating unsupported modifications, restate the required outcome and the observed failure at the affected boundary, and test the causal premise with the cheapest discriminating check before changing anything else. Straightforward compiler or local feedback iterations are not signals.

### 5.2 Independent Autonomous Correctability review

Give the reviewer, who is never the implementer, the task contract, relevant code and diff, surrounding interfaces, execution evidence, and applicable architecture constraints. Do not require it to inherit the implementer's reasoning. It should establish whether the change is correct **and** independently correctable: required properties are checked, dependencies and failure modes can be located, chosen technology is justified, and state-changing work is recoverable. Require every proposed correction to demonstrate a contribution to the task contract or to verifiability, locality, capability alignment, or recovery (L1–L8). Derive expected behavior from the contract, run or re-run the evidence rather than trusting it, and name the nearest counterfeit of each claimed property. Improvements, speculative edge cases, new requirements and optional preferences are not findings.

### 5.3 Review report

Report only what changes a decision or correction:

```text
CONTRACT: required behavior and preserved invariants
EVIDENCE: checks performed, their scope, and remaining limits
FINDINGS: for each consequential issue, location → violated property → evidence (a reproducible case) → corrective action
CORRECTABILITY: what a later agent could not locate, verify, repair or recover, if anything
```

### 5.4 Institutional learning

Correct and verify the system before adding instructions. Encode repeated error classes in enforceable structure where possible; document only durable architectural consequences. Consolidate lessons, remove obsolete rules, and preserve the distinction between permanent repository knowledge and temporary task or review state. A skill amendment is justified only when a recurring failure cannot be prevented or explained by existing laws, and the new instruction has an observable protective function.
