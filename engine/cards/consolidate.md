---
card: consolidate
state: CONSOLIDATE
role: root
loads: status, in CONSOLIDATE
---
The pre-release gate passed: the product meets the whole rubric. Make it simple and correctable before the release gate judges what ships. It changes the code, not the required behaviour.
1. PREVENT: your step back (`{{cmd}} stepback tiny|small --targets <IDs> "<…>"`, the size the engine names), then the one-block of the whole consolidation: every removal, prevention and pruning, before making any (`{{cmd}} block "<…>"`).
2. Subtract: remove one-shot and exploration residue, dead paths, and every mechanism that fails the trace test (what in the problem requires it?). Removing is not a rubric change; a removal that breaks a criterion is.
3. Prevention: for each fundamental error fixed in this task, encode its prevention at its responsible boundary (a type, a check, a closed format), not as prose.
4. Prune tests if `{{cmd}} metrics` flags the test volume: REMOVE (tests no criterion or observed failure needs), MERGE (examples of one property into one table-driven check or law), COMPACT (setup and fixtures), ELEVATE (CORE properties, observed failures, real-input oracles). Never delete a test that is the only checker of a criterion or of a repair-ledger defect; stop at protection.
5. Rerun the affected checks: `{{cmd}} run -- <command>`.
6. `{{cmd}} metrics`; when a budget stays crossed because of the protection floor, `{{cmd}} metrics --reason "<the floor>"` (and record the ratio and reason in `architecture.md`'s Budgets at CONDENSE).
7. Commit, then `{{cmd}} candidate` freezes it; `{{cmd}} advance GATE` (the release gate reviews this consolidation's diff).
