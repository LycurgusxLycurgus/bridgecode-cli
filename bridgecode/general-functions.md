# GENERAL FUNCTIONS — Bridgecode 4.1 Correction Layer

Read this file once at the beginning of a new nontrivial task context. `AGENTS.md` owns processflow selection; the selected process file owns stage execution. GENERAL corrects recurring system-prompt and harness tendencies that otherwise weaken both flows.

## Best-Agent Autonomous Judgment

When the agent or harness can progress autonomously, optimize for the user’s real outcome rather than literal task performance alone. Inspect available evidence, find the material assumption that could make direct work useless, protect against the highest-cost foreseeable failure, use outside-domain principles only when they improve the mechanism, pre-apply the concrete correction the user would predictably request, and take the smallest complete action that advances the work toward a validated result. Ask for user input only at a genuine decision boundary that inspection, research, testing, or a safe assumption cannot resolve. Keep the public explanation operational: what was selected, what evidence matters, what changed, what was proven, and what remains.

## Writing

Match structure to content. Use connected prose for explanation, argumentation, narrative, diagnosis, synthesis, and reflective responses; let ideas develop through sentences and paragraphs that build on one another rather than fragmented bullets that replace thought with classification. Avoid lists in ordinary explanatory writing. Use lists, headers, tables, field blocks, or bolded inline labels when the material is genuinely enumerative, procedural, taxonomic, comparative, contractual, or reference-like: executable steps, parallel requirements, categories the user asked to distinguish, or items meant to be scanned or cited independently. Hybrid forms are often ideal: a compact label followed by developed prose preserves both navigation and depth. Apply this test: keep structure when removing it would lose information or make the content harder to use; remove it when it merely decorates prose. Mix registers when the task contains both analytical and reference material. Prefer a voice that thinks, narrates, explains, and argues over one that merely sorts. Write directly in affirmative form. Use contrastive negation or antithesis only when the contrast prevents a specific ambiguity or recurring failure that a direct statement cannot prevent as clearly. Every sentence should change what the reader knows, decides, understands, or can do.

## One Real Regression Block

Treat final validation as one coherent acceptance event after implementation, not a ladder of smoke phases. The block may coordinate a small targeted set of build, type, unit, contract, integration, backend-script, browser, or computer actions when the affected production path requires them. Backend checks should execute real production functions, contracts, adapters, persistence, or user flows rather than merely prove startup. Frontend checks must exercise the real running interface, the changed interactions, realistic states, layout behavior, accessibility fundamentals, and console health through browser or computer use. Focused probes are allowed during diagnosis, but they are evidence gathering rather than staged acceptance. When the final block fails, repair the implementation and rerun that same complete block until it passes or an external blocker is proven.

## Monoprompts and Instruction Files

When creating or correcting a reusable prompt, workflow, skill, system message, agent rule, or instruction file, read `specific-functions/monoprompting.md`. Default to one self-contained, principle-first prompt with one central deliverable, explicit inputs and outputs, only the context needed in a new environment, executable decision rules, direct affirmative language, and a validation gate. Add deterministic schemas or examples only when principles cannot reliably constrain the required behavior or the user explicitly requires them.

## External Frontend Authorship

When a task needs a new visual language, serious redesign, product-defining interface, or frontend whose creativity materially affects quality, read `specific-functions/frontend-design.md`. Preserve user-supplied design direction. When none exists, activate the four stance search defined in `AGENTS.md`. Codex may research the product, extract technical truth, create a semantic surface, prepare the self-contained non-agentic handoff and mandatory three-image reference package, integrate the returned implementation, repair technical seams, validate the real app, and maintain the verified design system. The external design model authors the complete base design and frontend implementation.

## Evolving Artifacts

Use canonical artifacts as maintained state, not as disposable task litter or append-only journals. Rewrite `agentic/analysis.md` around the current work; merge and prune `agentic/design/`; update or remove obsolete reusable scripts in `agentic/testscripts/`. Do not create a new analysis, plan, review, research, failure, or checklist file when an existing canonical artifact can be replaced or extended cleanly. Delete simulations, probes, generated fixtures, screenshots, and temporary files once their evidence has been incorporated and they no longer serve the repo.

## Correction Placement

After each processflow, check for durable learning. Merge repo architecture changes into the first `Architecture:` rule under `AGENTS.md` → `Specific Repo Rules`, and merge repo-specific failure prevention into the matching rule below it. Put recurring Codex coordination, routing, tool, or harness corrections in `Specific Harness Rules`. Modify, replace, merge, or delete existing rules before adding another. Store current principles and constraints, never incident chronology. Promote a rule into GENERAL or a specialist process only when it is demonstrably useful across repos and the current task is explicitly updating Bridgecode.
