---
card: accept
state: ACCEPT
role: root
loads: status, in ACCEPT
---
Deliver the gated commit and let the user decide.
1. `{{cmd}} report --final`, then tell the user: what changed, the final tables per goal (CORE and NON-CORE established over required, Backlog), the branch `bc/<slug>` at the gated commit, the vetoes and the backlog left, anything recorded as unwitnessed or as requested. When the status line shows a git store, say where the work is: the files on disk are the result, their own `.git` sees them as uncommitted changes, and the task's commits are in `.bridgecode/git` (`{{cmd}} git log`).
2. Resolve every rubric proposal and ambiguity a reviewer raised: `{{cmd}} resolve <n> "<applied at DEFINE | dismissed: reason>"`. An open ambiguity on a required criterion holds acceptance.
3. Ask: accept, or feedback (`{{cmd}} question`, then `{{cmd}} answer "<their words>"`).
4. Accepted → `{{cmd}} advance CONDENSE` (HEAD must be the gated commit). Feedback → `{{cmd}} advance DEFINE` (a changed finish line) or `{{cmd}} advance EXPLORE` (a different way to the same one).
The task branch is merged only when the user asks.
