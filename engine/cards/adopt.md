---
card: adopt
state: ADOPT
role: root
loads: status, in ADOPT (existing code without Bridgecode memory)
---
Adopt the affected area before any work: reverse-derive what exists, so the task builds on the project's real finish line instead of an invented one.
1. PREVENT: your step back over the project (`{{cmd}} stepback tiny|small --targets <IDs> "<…>"`, the size the engine names), then the one-block of what exists: behaviour, layout, checks, and the real path you will run (`{{cmd}} block "<…>"`).
2. Baseline: run the product's real path on HEAD (`{{cmd}} run -- <command>`); what passes now is what the area already establishes.
3. Reverse-derive `agentic/rubric.md`, `spec.md` and `architecture.md` from the code, its history and its tests, in the templates of `bridgecode/memory.md`, applying the trace test to every element: what in the problem requires it? Criteria only a reading can judge start in Backlog. Adoption never raises the criterion count: splits are paid for by merges and removals.
4. Migrate legacy repo rules (an old instruction block, an imported-constraints notice) into `architecture.md`'s Unverified rules, one line each, to reconcile with code and checks as the work touches them.
5. Fit check: say whether the current architecture can reach the rubric, and recommend keep, simplify or replace for the rubric, spec and architecture, with what works on the baseline and which checks protect it.
6. The decision is the user's: `{{cmd}} question "<keep | simplify | replace, with your recommendation and the baseline evidence>"`, their reply, `{{cmd}} answer "<their words>"`, then `{{cmd}} adopt keep|simplify|replace "<what exists, what works, the protected checks>"`.
Evidence already established stays valid unless a change invalidates it; BEST is the adopted commit. Then `{{cmd}} advance DEFINE` for the task's own delta.
