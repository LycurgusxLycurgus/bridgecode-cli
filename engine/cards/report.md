---
card: report
state: CONDENSE
role: root
loads: status, in CONDENSE
---
Field reports correct Bridgecode, the way steering corrects a project. Write one only once its subject is settled: after a task that needed BREAK, EXPLORE or a re-define has passed, or when a way to reach a result in fewer loops was confirmed by the task's outcome. At most one per task.
- Project-neutral: no code, paths, names, secrets or business details.
- What failed or was found, and how; what worked, and why; which rules were applied late or not at all, read from `agentic/tasks/<slug>/log.jsonl`, not recalled.
- One proposed change (a LAW, NOISE_VETO or SIGNALS entry, a card, a guard or a trigger) tied to observed evidence, never to a model's self-report; prefer deleting or sharpening an existing entry; say whether an existing entry already covered it, and name the target file.
Save it to `.bridgecode/reports/<date>-<slug>.md`, show it to the user, and file it with `gh issue create` on the Bridgecode repository only on their yes.
