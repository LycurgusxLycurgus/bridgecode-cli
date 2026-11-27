---
card: ask
state: ASK
role: root
rung: redefine
loads: status, in ASK
---
The user decides here: a re-define, a blocker, or a choice only they can make, asked in their terms (L9).
- BLOCKED, or the ladder's last rung: report the candidate (BEST), the reproducible remaining cases, what is needed, and the options: EXPLORE (genuinely different approaches, each with the run that would decide it) and RESEARCH (precise questions, missing evidence, candidate sources). The record and the temporary folder stay until the problem is solved.
- A re-define asks the user twice, and each message says which decision it is:
  1. Their comment: what was tried, what keeps failing and why it matters to them, in plain words, with the options, your recommendation and current behaviour from a run (`{{cmd}} question "<…>"`). Say that their reply feeds a new plan they will see before anything is built. Record the reply: `{{cmd}} answer "<their words>"`.
  2. Their decision on the plan: the loop-breakers re-plan from the comment (the break card), and the new definition is written as one block (`{{cmd}} block "<…>"`); show the plan itself in plain words, marking what differs from their comment and anything it newly commits to (when nothing material differs, say so), and say that a yes starts the build. Record the reply: `{{cmd}} approve "<their words>"`; then `{{cmd}} advance DEFINE` (or EXPLORE, as approved).
- Prefer subtraction: a rubric change counts as zero progress, and resolving a conflict that changes an approved outcome is the user's call, with options, pros and cons, and a recommendation. First decide whether a conflicting test is simply stale.
- The user may also stop the task: `{{cmd}} advance STOPPED` after their answer.
