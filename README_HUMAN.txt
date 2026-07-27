BRIDGECODE 4.1 — QUICK GUIDE

Bridgecode is a small repo-local instruction system for Codex. It chooses how much process a task needs, completes the work through the repo and available tools, validates real behavior, and keeps the repo’s architecture and learned prevention rules current.

QUICK START

Copy these items into the root of a project:

- AGENTS.md
- bridgecode/
- README_HUMAN.txt if you want this guide nearby

Start a task with:

"Use @AGENTS.md and Bridgecode 4.1 for this task: [your request]."

AGENTS.md loads the shared corrections, selects a processflow, and tells Codex which other file to read. You do not need to choose the route yourself.

THE TWO PROCESSFLOWS

ROBUST runs full research, pauses for user Q&A, creates one production checklist, executes it, performs a production review with one real regression block, and condenses current architecture and prevention memory. It is intended for uncertainty, important user choices, architecture or design work, multiple boundaries, or meaningful production risk.

LEAN adapts the same stages. It declares research, Q&A, planning, and review as rapid or skipped before acting, then uses one of three profiles: PATCH for scoped changes, DEBUG for broken behavior, and ASSESS for read-only review or explanation. It escalates to ROBUST when the task stops being locally understood or safely bounded.

For every nontrivial task, Codex shows why the selected flow fits and gives a short reason for research, Q&A, planning, execution, review, and condensation. It does not append a separate catch-all reason after those specific explanations.

FRONTEND WORK

Codex preserves product and backend truth. New visual languages and serious redesigns go through an external design model. Codex prepares one self-contained handoff and three required visual references, integrates the returned complete frontend, verifies the real app through browser or computer use, and records the verified design system in agentic/design/DESIGN.md. When you provide a design, it controls the direction. When you do not, Bridgecode evaluates four different design stances and selects the strongest product fit.

PROJECT MEMORY

Bridgecode uses a few canonical artifacts instead of leaving task files behind:

- agentic/analysis.md contains only current active research, decisions, checklist, execution state, and remaining work. It is replaced or condensed as work changes.
- agentic/design/ contains current design contracts, handoffs, references, assets, and verified design memory.
- agentic/testscripts/ contains only reusable real-regression instructions.

Temporary simulations, probes, fixtures, screenshots, and duplicate plans are removed after their useful evidence is incorporated.

AGENTS.md is also evolving memory. The first populated repo rule is always a compact description of the current architecture. Later rules prevent repo-specific errors from recurring. Architecture changes and related lessons are merged into existing rules; the section never becomes an incident history.

VALIDATION

Bridgecode accepts completed implementation through one real regression block. A block can contain a small coordinated set of commands and interactions, but it exercises the actual affected production path. Backend work uses real functions, contracts, adapters, or flows. Frontend work uses the running interface. Failures are repaired and the same complete block is rerun.

FILES

AGENTS.md is the always-on context, router, LLM-Friendly Engineering constitution, and correction memory.

bridgecode/general-functions.md contains shared system-prompt corrections for autonomous judgment, writing, validation, artifacts, frontend authorship, prompts, and memory placement.

bridgecode/specific-functions/general-processflow.md defines ROBUST.

bridgecode/specific-functions/specific-processflow.md defines LEAN and its PATCH, DEBUG, and ASSESS profiles.

bridgecode/specific-functions/frontend-design.md defines the external frontend process.

bridgecode/specific-functions/monoprompting.md defines reusable prompt and instruction creation.

GOLDEN RULE

State the outcome you want, tag @AGENTS.md once, and let Bridgecode choose the process depth. ROBUST protects work from missing definition; LEAN protects simple work from unnecessary ceremony. Both finish by validating the real result and checking whether the repo’s current memory should change.
