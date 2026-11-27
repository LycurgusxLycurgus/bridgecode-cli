---
card: explore
state: EXPLORE
role: root
loads: status, in EXPLORE
---
Choose how to build when the shape or the mechanism is unclear. The scope is the unsettled part only: a mechanism, a part of the product, or the definition itself. Do not explore when an existing sound mechanism already settles the choice.
1. PREVENT: your full step back, about a page, from scratch (`{{cmd}} stepback full --targets <IDs> "<…>"`), naming what is unsettled and why no cheap check separates the candidates. Each explorer's option is its own one-block.
2. Options: 2–4 that differ in mechanism, not detail. `{{cmd}} call explorer` once per option (each a fresh explorer in its own worktree from BEST); append the option's brief, the affected criteria and the vetoed options as forbidden. Launch them together and wait for all in this turn.
3. Real runs: run every option yourself on real input (`{{cmd}} run --cwd <its worktree> -- <command>`); an option without a passing run is not eligible.
4. Blind judging: `{{cmd}} call reviewer` (as many as roles.json assigns), append every option's worktree under its call id, then `{{cmd}} judge explore <reviewer-ids> --options <explorer-ids>`. Settle every NOT_MET with `{{cmd}} reproduce`.
5. Choose by the merge card among the eligible: `{{cmd}} winner <id>` (or `<a>,<b>` for an amalgam, judged again). Losers become vetoes.
6. The winner is the one-shot: commit it on HEAD, `{{cmd}} run -- <command>`, then `{{cmd}} advance LOOP`; the next-shot moves it into the architecture's layout (and, under Rosetta, the target representation) with its real-run outputs as the oracle.
When the open choice is one of taste (expression, experience, form, identity), the options are candidate directions and the user judges them, not a reviewer. If no option is good: full step back with the evidence, then a re-define (`{{cmd}} blocked "<…>"`).
