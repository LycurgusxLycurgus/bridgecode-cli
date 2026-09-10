# Bridgecode architecture

Bridgecode has two layers: Markdown directs agent behavior; a dependency-free Node CLI installs and verifies that policy. The CLI does not run processflows or certify model compliance. The authoring source is the sibling `codex_condensation/`; `scripts/sync-payload.mjs` copies it into this independently versioned npm repository. The root core is permanent context; six specialists load before the actions they govern. Project memory is repository-owned and remains outside the installed package core.

## Maintained-file map

```text
codex_package/
├── AGENTS.md                     Permanent policy, routing, acceptance, memory, specialist triggers
├── README.md                     Agent install/update contract, commands, ownership, release limits
├── README_HUMAN.txt               Compact human operating guide (synced from source)
├── CHANGELOG.md                  Release changes and compatibility boundaries
├── LICENSE                       MIT license
├── package.json                  CLI entry, Node requirement, scripts, explicit npm allowlist
├── payload-manifest.json         Generated canonical policy and hook hashes
├── .gitattributes                Checkout line-ending policy
├── .gitignore                    Excludes caches, archives, secrets, release output, private note
├── .github/workflows/publish.yml Tag/version gate, regression, exact-artifact publication
├── bin/bridgecode.mjs            Executable dispatch into src/cli.mjs
├── bridgecode/
│   ├── best-agent.md             Evidence, hard-to-vary mechanisms, perspective transfer
│   ├── taste.md                  Task-local defaults, exclusion, stances, minimal amalgams
│   ├── design.md                 Direct frontend authorship, three references, UI validation
│   ├── writing.md                Reader progression, factual fidelity, unslop critique
│   ├── copywriting.md            Customer outcome, credible value, useful product language
│   └── monoprompting.md          Self-contained reusable instruction contracts
├── hooks/bridgecode-turn.mjs     Source of the installed bounded heartbeat/recovery hook
├── legacy/4.1.0.json             Exact old payload strings for trusted migration validation
├── src/
│   ├── cli.mjs                   Argument parsing and install/update/doctor/recover dispatch
│   ├── install.mjs               Shared lifecycle projection, ownership checks, mutation plan
│   ├── update.mjs                Update entry into the shared lifecycle
│   ├── manifest.mjs              Package identity, checksums, complete paths, safeTarget
│   ├── verification.mjs          Canonical release comparison and root-only instruction budget
│   ├── repo-rules.mjs            Versioned core markers, exact legacy-rule extraction/preservation
│   ├── instructions.mjs          Bounded cross-harness bootstrap parsing/replacement
│   ├── hooks.mjs                 Owned hook-entry merge preserving unrelated configuration
│   ├── transaction.mjs           Journal, preconditions, per-file replacement, guarded recovery
│   └── doctor.mjs                Read-only integrity checks, warnings, explicit evidence limits
├── scripts/
│   ├── sync-payload.mjs          Authoring-source copy and clean obsolete-source retirement
│   ├── build-manifest.mjs        Deterministic release hash generation
│   └── test-release.mjs          Pack once, test artifact, optionally retain that same archive
├── test/
│   ├── helpers.mjs               Disposable project/release fixtures and byte-hash snapshots
│   ├── lifecycle.test.mjs        Real install/update, migrations, bootstraps, memory preservation
│   ├── safety.test.mjs           Conflicts, canonical tampering, containment, rollback/recovery
│   ├── hooks.test.mjs            Actual installed script with event input; protocol validation
│   ├── policy.test.mjs           Source parity and static policy anchors; not behavioral proof
│   └── tarball.test.mjs          Exact npm artifact lifecycle and package allowlist
└── agentic/
    ├── analysis.md              Active checklist, validation/review evidence, next action
    ├── architecture.md          This maintained implementation map
    └── primitives-private.md    Private explanatory audit; gitignored and excluded from npm
```

Old local `.tgz` files are ignored release artifacts, not current source. Disposable test repositories, npm caches, and simulated releases live under OS temporary directories and are cleaned by their creating tests. The separately requested private primitives note is gitignored and excluded from npm; it is not runtime guidance.

## Installation flow and ownership

`prepareLifecycle` loads and validates the release, reads current target state into preconditions, verifies any prior installation against its trusted canonical snapshot, then projects every intended write/removal in memory. It checks the projected final state before dry-run can succeed. Real execution serializes mutation using an exclusively created journal, rechecks observations, applies changes, and verifies the actual result. A no-op still invokes actual verification.

The managed AGENTS schema-2 block is immutable during ordinary project work. Unrelated prefix/suffix bytes and legacy rule bodies remain repository-owned. `parseManagedAgents`, `adoptLegacy`, and `pendingRulesBlock` preserve rule-body bytes while moving known 4.1 rules outside the core. Semantic reconciliation is an agent task: verify code and protection, record their locations in the target project's architecture, remove the resolved rule. Unresolved rules remain visible and urgent. The CLI reports installation integrity and migration completion separately; it never invents code changes from rule text.

`verifyInstalled` compares the complete expected set, actual bytes, bootstrap blocks, and hook entries with a trusted release. Editing metadata hashes cannot legitimize a changed canonical file. Future versions require explicit trusted snapshots for supported predecessors. `.bridgecode/installation.json` stores the real project root because installed hook commands use an absolute path; moving a project requires explicit reconciliation. This intentionally has no speculative automatic relocation or downgrade mechanism.

## Corrections and regression protection

`manifest.safeTarget` rejects symlink/junction components and non-file targets before file access. Normalized relative paths reject traversal, device names, stream separators, and cross-platform aliases. `prepareLifecycle` reserves Git/agent configuration and memory/hook/state paths case-insensitively, rejects newly introduced paths already owned by the repository even when their bytes match, and retires only unchanged previously owned files. Identical-byte adoption is limited to recognized current-source installation. Marker parsers reject extra malformed tokens beside valid blocks. These mechanisms replace lexical-containment and permissive ownership assumptions. `safety.test.mjs` covers linked parents, traversal, aliases, collisions, malformed markers, edited retired files, and modified canonical content. These checks reduce accidental races; they are not a security boundary against an adversary changing filesystem entries between system calls.

`verification.verifyInstalled` replaces self-consistent-but-untrusted metadata checks with canonical comparison and exact expected-key coverage. `instructionBudget` measures only root AGENTS.md at 32,768 bytes; host/global layering is explicitly unverified. The lifecycle test uses mixed LF/CRLF Unicode rules; legacy canonical EOL detection uses the managed opening line, so line endings inside mutable rules cannot change canonical reconstruction.

`transaction.applyTransaction` records originals and intended hashes in `.bridgecode/transaction.json`, checks preconditions, and runs post-verification. `recoverTransaction` restores only unchanged originals or known transaction output, retains the journal on outside edits or failed restoration, and refuses recovery while another recorded owner may be alive. It removes only recorded empty directories after successful recovery. `safety.test.mjs` exercises post-check failure, rollback, preserved outside edits, retryable recovery, and precondition conflict. Multi-file updates are journaled, not filesystem-atomic; do not erase failed-recovery material.

`hooks.mergeHooks` owns only recorded Bridgecode entries and its script; other hook entries/keys survive. The hook validates project/core identity, emits a short UserPromptSubmit reminder, and returns bounded core guidance for compact SessionStart. Its script fixtures verify JSON output and fallback, not host trust or live delivery. Hook context follows the [official hook contract](https://learn.chatgpt.com/docs/hooks). Fresh review uses native model/effort inheritance only when no overriding configuration changes it, as described in [official subagent configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents); never report settings from a different task or a configured default as the actual active settings.

## Run and release

From this package directory: `npm run sync:payload` in the paired authoring workspace; `npm run build:manifest`; `npm test`; `npm run test:release`. The final command creates one archive, tests its actual executable, checks the allowlist, and cleans fixtures. `-- --output release` retains the exact tested archive for an authorized publish. The tag-gated workflow publishes that artifact after checks; local implementation does not publish. A standalone checkout explicitly skips only the unavailable sibling-source parity check, not release-artifact testing.

Tests establish deterministic lifecycle and hook-protocol behavior. Policy walkthroughs and static anchors do not establish improved coding performance; matched agent tasks and live trusted-host sessions would be separate evidence.
