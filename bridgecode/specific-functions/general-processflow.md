# GENERAL PROCESSFLOW — ROBUST Delivery

ROBUST is the full Bridgecode 4.1 sequence for work whose uncertainty, consequence, or coordination cost makes compression risky. It turns research and user alignment into one production checklist, executes the entire checklist, reviews the working result against the same standard, and condenses current architecture and prevention memory.

## Selection Constitution

Choose ROBUST from underlying conditions, not a catalog label. It fits when the correct result depends on knowledge that must be discovered, user choices that materially change the contract, architecture or design that must be stabilized, several technical boundaries that must move together, or failure consequences that justify in-depth review. New applications, large features, broad refactors, migrations, serious frontend work, security-sensitive changes, unfamiliar integrations, and comprehensive remediation are examples because they often contain those conditions. Another task with the same uncertainty or consequence also belongs here even if it does not resemble an example.

Use ROBUST when the full sequence reduces expected rework or protects a high-cost boundary. Use LEAN when the repo already contains the answer, the contract is stable, the affected path is narrow, and a targeted regression can prove the result. Do not select ROBUST for ceremonial thoroughness, and do not select LEAN merely because the user used words such as “small,” “quick,” or “simple.” Inspect first when the label and repo reality disagree.

Before major action, publish the `BRIDGECODE_FLOW` declaration from `AGENTS.md`. Explain why ROBUST fits. ROBUST normally declares every stage `FULL`, Q&A as `FULL/PAUSE`, and condensation as `CHECK`; each stage still needs its own evidence-based `WHY`. If research changes the flow, publish the revised declaration.

## Canonical Working State

Use `agentic/analysis.md` when the flow needs written state across stages. It is the one evolving ledger for the active goal, research, Q&A answers, production checklist, execution status, and review findings. Replace stale content and merge new truth; do not create separate `research.md`, `plan.md`, `review.md`, or task-named analysis files. A useful shape is:

```md
# Active Work

## Goal and Current State
## Research and Evidence
## User Decisions
## Production Checklist
## Execution Status
## Review and Regression Result
## Remaining Work
```

The headings are optional. Preserve information because it changes execution, not because a template contains a field.

## 1) Research — FULL

Research begins with Best-Agent judgment. Establish the real user outcome, the current repo truth, the assumption most likely to invalidate direct execution, the highest-cost failure to prevent, the likely correction to a naive first attempt, and the smallest evidence set that will let Q&A address decisions rather than missing facts.

Inspect the user’s prompt, named documents, existing repo rules, `agentic/analysis.md`, durable design memory, manifests, entry points, relevant contracts, tests, current failures, and the smallest real runtime path. For repo-local mechanisms, prefer code evidence and direct probes. For unfamiliar, external, current, version-sensitive, legal, security, deployment, standards, or platform behavior, use canonical current sources and record the mechanism and the consequence for this build. Triangulate only when source ambiguity or impact warrants it. Stop when more research would not change the questions, plan, implementation, or validation.

Research should produce a compact synthesis: known truths, material unknowns, constraints, relevant evidence, architecture or mechanism implications, and the questions the user must decide. For frontend work, also determine whether the user supplied a binding design direction, whether a semantic surface would clarify UX, and whether the design language should be code-only or code-plus-assets. Preserve source locators only when future execution or credibility depends on them.

Research does not ask the user to supply facts the harness can inspect or verify. It also does not silently decide preferences, permissions, product tradeoffs, or irreversible scope choices that belong to the user.

## 2) Q&A — FULL/PAUSE

ROBUST always pauses after research. Ask one compact, high-leverage batch built from the remaining contract decisions. Each question must change scope, architecture, product behavior, UX, evidence requirements, privacy/security, dependency tolerance, deployment, design direction, validation, or definition of done. Give two or three concrete options when an option space exists, explain the implementation consequence, mark the recommended answer and its mechanism, and allow a custom response.

When research leaves no unresolved decision, present the proposed contract, selected recommendations, material assumptions, and definition of done, then ask the user to confirm or correct them. Do not manufacture low-value questions merely to create an interview. The required pause protects consent and contract alignment; the researched proposal keeps that pause efficient.

Wait for the answer. Merge the answers into `agentic/analysis.md`, replacing superseded assumptions. If the answers expose a new external unknown, return to research and publish the changed stage reason before asking again. The Q&A stage is complete when planning can proceed without guessing user intent.

## 3) Plan — FULL

Produce one production checklist that is both the execution contract and the later review rubric. Choose a decisive implementation path rather than presenting option sprawl after the user has stabilized the contract. The plan should state the goal and user-visible result; current repo truth and contracts to preserve; non-goals; `{files, approximate LOC/file, dependencies}`; coherent vertical slices; boundary inputs, outputs, validation, errors, state, persistence, security, privacy, and observability; deterministic run commands; relevant accessibility and responsive behavior; all checks that must be written; one final real regression block; risks; and objective pass/fail criteria.

Scale the checklist to the product without lowering its quality. A one-file implementation may need only a short checklist, but it still needs explicit behavior, failure handling, and a real acceptance path. A complex implementation needs more checklist items because it has more boundaries, not because detail is inherently valuable.

When frontend quality matters, create two coordinated checklist portions. The first covers backend truth and, when useful, a semantic surface frontend: plain, accessible HTML that exposes information hierarchy, editable controls, navigation, primary actions, and empty/loading/error/success/destructive states without defining visual design. The second invokes `frontend-design.md` and covers the external design handoff, mandatory reference images, returned implementation form, integration seams, accessibility, responsive behavior, and browser/computer validation.

Write or replace the active checklist in `agentic/analysis.md`. Do not fragment one delivery into unrelated plan files. Planning is complete when every execution item and validation gate is explicit enough to perform without re-architecting.

## 4) Execute — FULL

Execute the checklist as one coherent implementation block. Verify that the repo still matches its assumptions, then implement every vertical slice, contract, validation boundary, error path, state, integration, production test, and operational requirement in the checklist. Keep code local and explicit, preserve existing behavior outside the authorized scope, and use dependencies only where they materially improve correctness or delivery.

For frontend work, Codex may implement backend behavior and the semantic surface, prepare the design package, and integrate the external model’s complete implementation. Codex does not fill a missing visual language with generic UI. Apply returned whole files or complete destination-labeled blocks verbatim unless they conflict with repo contracts, then make the smallest integration repair that preserves both technical truth and the selected design direction.

Focused probes, compiler feedback, or reproductions may guide execution. They do not replace final acceptance. Continue until every checklist item is implemented, every planned durable test or testscript is written, obsolete code and temporary probes are cleaned, and the real regression block is ready to run. If execution discovers a user-dependent contract change, stop at that boundary and return to Q&A; if it discovers a major architectural unknown, return to research or planning and revise the public stage reasons.

## 5) Review — FULL

Review starts with the one real regression block defined by the checklist. Run the minimum coordinated commands and production interactions that exercise the complete affected path. Backend checks invoke real functions, contracts, adapters, persistence, or service boundaries. Frontend checks run the actual app through browser or computer use and exercise the affected interactions, realistic states, keyboard access, visible focus, responsive layout, overflow, asset loading, and console health at the depth relevant to the change.

Then perform a fresh production review against the same checklist. Confirm behavior and contract fidelity, error recovery, security/privacy, dependency discipline, feature locality, observability, deterministic setup, maintainability, realistic data and state coverage, and—for UI—accessibility, responsiveness, product specificity, user-supplied design fidelity, and preservation of the external design language. Findings must be evidence-backed and prioritized by user or production impact.

Repair every finding required for the agreed definition of done. When a repair changes implementation after the regression block, rerun the same complete block. When review exposes a flaw in the contract or architecture, update the checklist and return to the necessary stage instead of patching around it. Review is complete only when the checklist passes, the user’s goal is achieved, and remaining assumptions or external blockers are explicit.

## 6) Condense — CHECK

Always inspect whether the processflow changed durable understanding. Never assume that condensation is unnecessary, and never write memory merely because the stage exists.

Under `AGENTS.md` → `Specific Repo Rules`, the first populated rule must be one dense `Architecture:` rule describing the repo’s current system shape: runtime, principal slices or boundaries, sources of truth, important data flow, frontend delivery model when relevant, and real validation path. Create it after the first meaningful processflow. Whenever architecture changes, merge the new truth into that same rule and remove superseded statements.

Write repo-specific prevention rules below the architecture rule only for lessons that should change future execution: local contract traps, dependency constraints, runtime semantics, test requirements, design restrictions, or corrected failure patterns likely to recur. Merge by subject, improve an existing rule before adding one, remove obsolete rules, and state the desired future behavior rather than incident history. Put general Codex, routing, tool, or harness corrections in `Specific Harness Rules`.

Maintain canonical artifacts as part of condensation. Replace completed `agentic/analysis.md` content with the current remaining work or a short no-active-work state. Merge verified frontend truth into `agentic/design/DESIGN.md`; replace superseded handoffs, references, and assets; update reusable real-regression scripts; and delete simulations, probes, screenshots, fixtures, and temporary files once their evidence is incorporated. A processflow that changes no durable architecture, prevention rule, artifact, or remaining-work state correctly writes nothing beyond recording that the check was performed in the handoff.

## Completion Handoff

Report the processflow and each stage’s actual depth and reason, without repeating private reasoning. Explain the result in connected prose: what the user can now do, which important contracts changed or were preserved, how the real regression block exercised production behavior, what review repaired, what memory was merged, and which remaining assumption or obstacle matters next. Mention files and commands only when they help verification or continuation.
