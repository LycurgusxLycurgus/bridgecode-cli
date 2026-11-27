BRIDGECODE 4.6 — QUICK GUIDE — codex edition (Codex, AGENTS.md)

Tell your agent the outcome you want. Bridgecode picks one of four routes and states it on the first line of its reply:

  DIRECT   a one-line fix or a known operation: done and checked, nothing else.
  ASSESS   a review or an analysis: a judgment with evidence, no changes.
  FOCUSED  a feature whose mechanism is known: the agent judges its own loops from real runs, and fresh reviewers judge the two gates.
  FULL     anything uncertain, risky, taste-heavy or driven by model output: exploration, and fresh reviewers at every step.

THE ENGINE

FOCUSED and FULL work runs through a small engine in .bridgecode/engine/. It knows which step the task is in, tells the agent what that step needs, and refuses to skip a step the method requires: a review, a step back after a failed attempt, a real run, or your answer to a question that is yours. It runs the checks itself and records what happened, so a claim in a report is something that ran. Each task gets its own branch (bc/<task>) and its own record in agentic/tasks/<task>/, removed when the task is done.

THE FINISH LINE

The agent first writes a rubric with you: one property per criterion, each tagged CORE (the vital few) or NON-CORE, each checked against real cases before it is frozen. Only that step, or a re-definition with you, changes it. You answer the decisions that are yours (goals, rubric changes, anything irreversible or public) in a short table with a recommendation; everything obvious and reversible it decides and logs.

THE WORK

Each stage starts with one self-contained attempt that should land most of it, then closes the rest one behaviour at a time. Every claim rests on a real run, and nobody grades their own work. When something resists repair, the agent steps back instead of trying again: first on its own, then with fresh loop-breakers, then with you. If nothing is left to try, it stops and tells you exactly what is missing. After every check you get one status line, a table per goal and the next action.

MEMORY

agentic/rubric.md is the finish line, agentic/spec.md what the product does, agentic/architecture.md how the code does it, and agentic/default-styles.md the model's taste defaults. The installer never overwrites agentic/. The engine measures test volume and memory size and tells the agent when a budget is crossed.

TASTE

Writing, copy, frontend design and image generation start from the root model's own default style. The first time one of them matters, the agent asks your permission to calibrate it: it gives you a prompt to run in a fresh chat with the same model and paste back. Say no and it uses a labeled self-named default instead.

EXTENSIONS

Without extensions every role is your current model. The cheapGPT extension (cheap, cheap-100) gives the building to cheaper models; the cLoop extension (town, high) gives planning, judging, loop-breaking and exploring to a two-model council. They work alone or together, and only change who runs each role. In this edition they use gpt-6.1-sol, gpt-6.1-terra, gpt-6-luna and gpt-6-astra as native Codex sub-agents. Install them with --extension.

HOOKS AND FILES

AGENTS.md holds the whole policy; bridgecode/ holds the specialists; .bridgecode/engine/ holds the engine, its flow, its cards and the role assignment. The Codex hooks in .codex/hooks.json show the task's status line every turn, record your messages so the engine can check that a decision really came from you, and restore the policy after compaction. Trust the project and review /hooks once. Start a fresh session after installing or updating.
