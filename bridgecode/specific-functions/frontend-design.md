# FRONTEND DESIGN — External Base-Frontend Process

Use this process when a new visual language, serious redesign, product-defining interface, new component family, or distinctive frontend is part of the goal. Codex owns product and backend truth, UX clarification, technical contracts, handoff preparation, integration, seam repair, real browser/computer validation, and durable design memory. An external design model owns the complete base frontend design and implementation.

Small maintenance may remain with Codex when `agentic/design/DESIGN.md` already documents the working design system and the requested change reuses its components, tokens, layout grammar, interaction patterns, and visual stance. Return to this process when the change would invent a new page language, major composition, component family, or design foundation.

## Design-Direction Constitution

When the user supplies a design, mockup, style guide, brand system, or clear visual direction, treat it as binding design evidence. Translate it into the required package without replacing it with Bridgecode’s taste. Resolve accessibility, feasibility, and product-contract conflicts explicitly; do not activate alternative stances merely to be creative.

When the user supplies no design direction, research the product’s purpose, users, content, operating environment, real-world materials, instruments, artifacts, vocabulary, and interaction demands. Evaluate four genuinely distinct stances:

- **Common-probability:** the strongest conventional product-fitting solution, used only when convention improves clarity and use rather than reproducing a generic template.
- **Anti-probability:** a deliberate reversal of the most likely default, used only when the reversal corrects a real assumption or hierarchy problem.
- **Creative-one:** a product-grounded synthesis derived from the subject, workflow, or operating environment rather than common interface styling.
- **Creative-two:** an independently conceived product-grounded synthesis that does not remix creative-one or the first two stances.

Select the direction through Best-Agent judgment and the active processflow’s Q&A contract. Choose the stance that best improves comprehension, usability, emotional fit, memorability, and product identity. Novelty is valuable only when it carries product meaning.

## 1) Extract Technical Truth

Inspect the repo before preparing design input. Create or update `agentic/design/CODEX-CONTRACT.md` as Codex’s private integration source of truth. Keep it compact and current. Capture only facts needed to preserve the app: purpose and runtime; relevant files and commands; routes and navigation; API, domain, state, persistence, authentication, and configuration contracts; events, selectors, test hooks, exports, and integration requirements; primary, secondary, admin/debug, empty, loading, error, success, and destructive flows; accessibility and responsive risks; real-content stressors; and the selected code-only or code-plus-assets mode.

Do not send this technical contract to the external designer. The external model needs product truth and design truth; Codex uses implementation truth to integrate the result without leaking weak existing hierarchy or backend machinery into the design.

## 2) Define the UX Surface

When the product flow is not already obvious from supplied design evidence, Codex may create or update a semantic surface frontend. A surface frontend is plain, accessible HTML that makes information hierarchy, navigation, editable values, actions, confirmations, and important states inspectable. It has no authored design language: no brand styling, decorative composition, signature visual system, or generic component polish. Its purpose is to expose what users must understand and do so the design model can solve the interface rather than invent the product.

Keep the surface in the real frontend only when it is a useful implementation foundation. Otherwise represent it compactly in the handoff and remove temporary surface files after the returned frontend is integrated.

## 3) Choose Code-Only or Code-Plus-Assets

Choose **code-only** when layout, typography, color, spacing, CSS effects, SVG, canvas, icons, motion, responsive composition, and procedural shapes can carry the product identity. Choose **code-plus-assets** when bespoke illustrations, mascots, maps, sprites, scenes, symbolic imagery, textured materials, product imagery, or branded diagrams carry meaning that code-native UI cannot express efficiently.

The choice follows product need rather than decoration. When code-plus-assets is selected, generate or obtain coherent production assets under `agentic/design/assets/`, document their roles, dimensions or responsive behavior, and accessibility treatment, and remove unused or superseded variants.

## 4) Build the Mandatory Three-Image Package

Every serious external frontend pass receives exactly three initial reference images under `agentic/design/references/`. Generate or update them even when the user supplied a direction; in that case they faithfully translate the supplied design into a consistent implementation reference. The visible titles and paths are fixed:

1. `design-style.png`, visibly titled **Design Style Guide**, defines the product-specific visual world: palette, typography voice, material and surface behavior, shape language, density, contrast, icon or imagery character, motion feeling, and the chosen or supplied stance.
2. `design-system.png`, visibly titled **Design System Guide**, defines implementation grammar: layout, navigation, typography roles, controls, forms, tables or data displays, panels, feedback, focus, disabled/loading/empty/error/success/destructive states, responsive rules, and accessibility behavior.
3. `representative-view.png`, visibly titled **Representative Interface View**, applies the first two references to the most important real product screen using realistic content and enough state complexity to reveal the primary interaction model.

The three images are a single source-of-truth package, not generic moodboards. Use legible labels, plausible data, accessible contrast, coherent hierarchy, realistic density, and the product’s actual concepts. The representative view must show what the real app needs to make understandable and actionable. Avoid reference imagery that can be swapped onto another product without losing meaning.

## 5) Create One Self-Contained Handoff

Create or replace `agentic/design/FRONTEND-HANDOFF.md`. This is the only text file sent to the external design model. Write it for a non-agentic model by default so it works when the recipient sees only this file and the attached images; the same handoff should remain usable by an agentic model. It must contain both the reusable design instructions and all repo-specific product information needed for this design pass.

The handoff describes, in product language, the product name and purpose, users and skill level, operating context, core loop, first and repeated use, content types, navigation expectations, main actions, required surfaces, normal and advanced/debug experiences, empty/loading/error/success/destructive states, accessibility expectations, density, emotional direction, user-supplied design constraints or selected stance, code-only or code-plus-assets mode, required assets, and the three attached references. Use domain vocabulary users need. Exclude code, pseudo-code, endpoint names, selectors, storage keys, function or class names, file-level backend instructions, test hooks, and weak current-frontend implementation details.

The handoff must select one output contract explicitly:

**Single implementation package.** Request one complete, self-contained frontend file or package when the external model cannot know the repo structure reliably or when Codex should deconstruct and integrate the result. Require all components, styles, states, interactions, and asset usage needed to make the design complete.

**Destination-labeled implementation blocks.** Request a series of complete blocks with exact intended destinations when the repo structure can be described safely and the returned blocks can be applied verbatim. Codex applies them verbatim unless a block conflicts with current repo contracts, security, accessibility, runtime behavior, or another explicit user requirement; conflict repairs must preserve the returned design language.

An agentic external model may edit the repo directly when its environment permits, but the handoff remains self-contained and requires complete implementation rather than an explanation, concept, moodboard, static mock, or disconnected demo. It should ask for a result that can become the real app.

## 6) Integrate Without Redesigning

After the external model returns the complete base frontend, Codex reads the private `CODEX-CONTRACT.md`, the handoff, all three images, optional assets, the existing repo, and the returned implementation. Treat the returned implementation plus the references as design truth and the Codex contract plus real backend as technical truth.

Place the returned package or complete blocks into the real app. Preserve returned structure and design decisions while wiring real routes, data, events, forms, storage, authentication, state, validation, error handling, selectors, exports, test hooks, admin/debug surfaces, and assets. Replace fake content with real data or explicit realistic states. Repair integration seams locally: imports, names, bindings, file placement, overflow, long content, state transitions, keyboard behavior, focus, asset sizing, and responsive assumptions. Request a corrected external implementation when the missing piece requires design authorship rather than technical integration.

Codex must not rebuild the result around the old weak frontend, introduce generic filler components, or silently simplify the external design. When a technical conflict requires visible change, preserve the product intent and record the resolved rule in the working design memory.

## 7) Validate the Real Frontend Once

After integration is complete, run one real regression block through the actual application. Combine the minimum backend commands and browser/computer interactions needed to prove the affected production path. Exercise primary interactions; relevant secondary, advanced, and debug surfaces; realistic empty/loading/error/success/destructive states; keyboard navigation and visible focus; responsive layouts; scroll and overflow; fixed bars and panels; text wrapping; asset loading; and console health at the depth the product requires.

Compare the working result against the user-supplied direction or selected stance and all three images. Confirm that the design system and visual language are present across real states, not only the representative screen. If anything fails, repair the integration and rerun the same complete block.

## 8) Condense Verified Design Memory

Only after the regression block passes, create or update `agentic/design/DESIGN.md` from the actual working implementation. Record the current frontend structure, state and data ownership, backend seams, implemented tokens and exact values, typography, layout grammar, component roles, interaction conventions, responsive and accessibility behavior, empty/loading/error/success/destructive states, asset relationships, extension rules, and visual stance. Preserve exact names and values where paraphrase would make future maintenance drift.

Treat `agentic/design/` as evolving current truth. Replace stale contract and handoff content on the next serious pass, update the three references rather than accumulating versioned copies, remove unused assets, and merge design changes into `DESIGN.md`. The verified code is operational truth; the images preserve visual intent. Future Codex maintenance extends this documented system until the task requires a new external design pass.

## Quality Gate

The process is complete only when technical truth is captured privately; the handoff is self-contained and non-agentic by default; code-only versus code-plus-assets is explicit; the three correctly titled images exist; the external model returns a complete implementable frontend in the requested form; Codex integrates it into the real app without losing backend truth or design identity; the real browser/computer regression block passes; `DESIGN.md` reflects the verified implementation; and obsolete design or simulation artifacts are removed.
