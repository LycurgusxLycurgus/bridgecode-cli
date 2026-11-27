---
card: gate
state: GATE
role: root
loads: status, in GATE (pre-release, then release)
---
Certify the product end to end. The engine says which gate this is.
PREVENT first: your step back (`{{cmd}} stepback tiny|small --targets <IDs> "<…>"`, the size the engine names), then the one-block of the gate (`{{cmd}} block "<…>"`): what runs end to end, the suite, what is judged, and on the release gate the consolidation diff to review.
- Pre-release gate (the build is done, before CONSOLIDATE): one end-to-end real run of every feature, CORE and NON-CORE (`{{cmd}} run --e2e -- <command>`), and the full suite once (`{{cmd}} run --suite -- <command>`) on HEAD, then every required criterion judged independently; on an adopted rubric, CORE plus the criteria the task changed or touched. A failure goes back to the build on the current rung: tiny loops on FOCUSED, a next-shot on FULL.
- Release gate (after CONSOLIDATE, on the frozen candidate): the same end-to-end run and suite again, and every required criterion judged; the review packet carries the consolidation diff (removals traced, preventions encoded, no criterion lost). A failure goes back to CONSOLIDATE, or to a loop when a criterion broke.
Violations outside the scope go to the user as one decision (a new task, or the backlog), never into this task's loops.
Then `{{cmd}} call reviewer` (as many as roles.json assigns), append the evidence paths, and `{{cmd}} judge gate <ids>`. Settle every NOT_MET with `{{cmd}} reproduce`.
- Each CORE MET names its probe. A reproduced violation of a required criterion blocks, with no vote and no tie-break. An unreproduced allegation neither blocks nor establishes. Backlog and Drop never block.
- An ambiguity with a separating case is not a violation: the gate can pass, and ACCEPT waits until it is resolved (one implementation that satisfies every reading when each is required, or the user's unambiguous wording).
- The gate report separates reproduced CORE and NON-CORE violations from reading-only or out-of-scope findings, so the user sees what blocks and what does not.
