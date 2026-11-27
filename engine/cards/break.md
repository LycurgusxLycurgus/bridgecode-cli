---
card: break
state: BREAK, ASK
role: root
rung: full
loads: status, in BREAK (rung full) and in ASK (the re-plan)
---
The full step back, taken by fresh eyes because the corrections resisted yours.
In BREAK:
1. `{{cmd}} call loop-breaker` (as many as roles.json assigns); append the affected criteria, the diff against BEST, the real-run evidence, the failed attempts with their saved diffs, and the falsified premises. Label your own theory an unverified hypothesis. Launch them together; wait for all in this turn.
2. PREVENT, per loop-breaker: record each one's step back and one-block from its reply: `{{cmd}} stepback full --call <id> "<its step back>"`, then `{{cmd}} block --call <id> "<its one-block>"`. With two or more, give each the others' hypotheses, anonymized, once, and record what each dropped as refuted.
3. Run the discriminating checks they name. A fault in the rubric goes to a re-define: `{{cmd}} blocked "<the conflict>"`.
4. Each loop-breaker builds one fix on its strongest hypothesis in its own worktree from BEST. Run each fix yourself (`{{cmd}} run --cwd <its worktree> -- <command>`), merge by the merge card, run the merged result on HEAD, commit.
5. `{{cmd}} call reviewer`, then `{{cmd}} judge break <ids>`; the engine gives the outcome and the rung. Failed hypotheses go to `{{cmd}} falsified`.
In ASK (the re-define): the loop-breakers take the full step back with the user's comment and propose a re-plan: the step at fault, what changes, what is removed. Record it with `{{cmd}} stepback replan DEFINE|EXPLORE "<the re-plan>"`, write the new definition whole as one block (`{{cmd}} block "<…>"`), then ask the user's decision on it as the ask card says (the plan in plain words, what differs from their comment). After an approved re-define, the loop-breakers build.