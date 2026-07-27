# SPECIFIC PROCESSFLOW — LEAN Delivery

LEAN is the adaptive Bridgecode 4.1 sequence for work whose goal, mechanism, affected contracts, and validation path are already sufficiently known. It deliberately decides which stages are rapid and which are skipped, then completes the selected scope without lowering engineering quality. Condensation is always checked.

## Best-Agent Preflight

Inspect enough prompt and repo evidence to verify that LEAN is justified. Establish the real user outcome, current behavior, affected boundary, likely failure cost, smallest complete change or assessment, and real validation path. Apply the correction the user would predictably request after a naive attempt. If this preflight reveals a decision, unknown, or structural risk that needs full treatment, select ROBUST before modifying the repo.

Choose one profile:

- `PATCH` changes a stable local behavior, implements a defined checklist item, performs a behavior-preserving local refactor, updates documentation, or corrects a scoped instruction.
- `DEBUG` reproduces, isolates, repairs, and regression-protects broken or unexpected behavior.
- `ASSESS` inspects, reviews, validates, explains, or produces another read-only evidence-backed deliverable.

The profiles bound the process; they do not replace judgment. A local task that develops cross-boundary consequences escalates. A large file change can remain LEAN when its contract and validation are stable, while a one-line change can require ROBUST when it changes an irreversible or poorly understood boundary.

## Declare Stage Depth Before Action

Publish the `BRIDGECODE_FLOW` declaration from `AGENTS.md` before major action. Explain why LEAN and the selected profile fit, then give each stage its own concise, evidence-based `WHY`. Do not append a separate general reason. Select depths with these rules.

**Research** is `SKIP` when relevant truth is already established in the prompt, repo, or current task state. It is `RAPID` for a targeted repo scan, reproducer, or direct probe. External, unfamiliar, current, or contested mechanisms that determine correctness normally escalate to ROBUST.

**Q&A** is `SKIP` when the user’s intent and affected contract are clear after any selected research. It is `RAPID/PAUSE` for the smallest unresolved decision-changing question or compact batch. If several user decisions or a product contract must be stabilized, escalate to ROBUST. LEAN never asks the user for evidence the harness can inspect.

**Plan** is `RAPID` for a brief inline checklist naming behavior, files, contracts, risks, the real regression path, and pass/fail. It may be `SKIP` only for a direct answer, read-only observation, or exact one-step continuation whose execution and validation are already explicit. Code changes normally receive at least a rapid plan.

**Execute** is `TARGETED` for a complete local change, reproduction and repair, or focused evidence collection. It is `N/A` only when the user’s requested output requires no repo or environment action. Targeted means narrow in scope, not partial in quality.

**Review** is `RAPID` for a focused contract check and the final real regression block. It may be `SKIP` only for a response with no modified state and no material factual or analytical risk. Any code, config, runtime, or frontend change receives review and real validation.

**Condense** is always `CHECK`. State what architecture, prevention memory, or canonical artifact might need merging, even when the expected result is no write.

If new evidence changes a depth, publish a revised declaration before continuing.

## PATCH Profile

Inspect the target files and adjacent contracts. Write a rapid checklist unless the declaration justifies skipping it. Implement the smallest complete vertical change, keep validation and errors next to the behavior they protect, preserve unrelated user changes, and update or add durable regression coverage when the behavior can recur. Avoid broad cleanup unless it is required for correctness or locality inside the selected scope.

After implementation, run the declared real regression block once. It may be a small targeted set, but it must exercise the affected production behavior rather than startup alone. For browser-visible changes, use the running app through browser or computer interaction. Repair failures and rerun the same block.

## DEBUG Profile

Reproduce before editing when possible. Classify the failing boundary—environment, dependency, configuration, contract, state, timing, resource, filesystem, network, data, security, or test/production divergence—and gather the smallest evidence that distinguishes hypotheses. Form one hypothesis, change one variable, apply the smallest local repair, and add a durable regression guard when useful.

Focused reproductions and instrumentation are diagnostic evidence. Final acceptance still uses the broader declared real regression block after the repair. Clean temporary logging, probes, fixtures, and screenshots once their evidence is incorporated. After two focused failed repairs, an unknown external mechanism, or evidence of structural mismatch, stop retrying and escalate to ROBUST with the collected evidence.

## ASSESS Profile

Inspect the smallest evidence set that can support the requested judgment. Ground repo findings in files, commands, tests, runtime behavior, or browser/computer observations. Ground external or version-sensitive claims in current canonical evidence; escalate when the needed research becomes substantial. Separate observed fact, supported inference, and unresolved assumption when the distinction changes the conclusion.

Use connected prose for the diagnosis or explanation. Use structured findings only when severity, comparison, mapping, or an actionable checklist benefits from independent entries. If the user asked for fixes as well as assessment and the remediation is locally stable, publish a revised `LEAN/PATCH` declaration and continue. If the assessment reveals architecture, product, design, security, migration, or multi-boundary decisions, escalate to ROBUST.

## Canonical Artifacts

Do not create an artifact for a brief LEAN task unless written state improves execution or future work. When one is useful, update the canonical location. Replace stale content in `agentic/analysis.md` with the current goal, evidence, rapid checklist, result, and remaining work. Merge durable design changes into `agentic/design/`. Update reusable real-regression instructions in `agentic/testscripts/`. Do not leave task-named analysis, plan, debug, review, simulation, or screenshot artifacts behind.

## Condensation Gate

After every profile, inspect `Specific Repo Rules`. If the repo has no populated rules and the process established meaningful architecture, create the first rule as `Architecture: <dense current architecture>`. If that rule exists and architecture changed, merge the current truth into it and remove obsolete statements. Below it, merge only durable repo-specific prevention principles into their corresponding rules. Put recurring Codex, routing, tool, or harness behavior in `Specific Harness Rules`. Correction memory evolves by merging, replacing, and deleting; it never accumulates incidents.

Also inspect canonical artifacts for stale state. Replace completed analysis with remaining work or a short no-active-work state, update design and reusable regression memory, and delete temporary execution residue. If architecture, prevention rules, artifacts, and remaining work are already accurate, write nothing and report that the condensation check found no merge.

## Completion Handoff

Report the chosen LEAN profile and the actual reason for every stage depth. Lead with the outcome. Explain the affected behavior or evidence, the real regression result when state changed, any repair or remaining risk, and what condensation merged or why it correctly wrote nothing. Do not turn the handoff into a file inventory.
