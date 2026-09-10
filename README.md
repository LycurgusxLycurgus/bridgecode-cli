# Bridgecode 4.3

Bridgecode gives terminal-enabled agents a compact operating policy, on-demand specialists, and repository memory grounded in verified code. `@bridgecode/cli` installs it locally with Node 22+ and no runtime dependencies. It does not add dependencies or lockfiles to your project. The short human guide is [README_HUMAN.txt](README_HUMAN.txt).

**For agents:** read this README completely and inspect the target project before acting. Execute installation or update only when the user requests it. Preserve repository-owned content; stop on ambiguous ownership or integrity failures. Use the same exact package version for the dry-run, operation, and doctor. These commands become available on npm after 4.3.0 is published.

## Copy into your agent: install

```text
Install Bridgecode 4.3.0 in this repository. Read the package README completely,
inspect existing instructions and hooks, and run the commands below in order.
Proceed from dry-run only if projected verification passes. Preserve unrelated
instructions, hooks, and repository memory. Report any conflict without
overwriting it. After installation, read the complete root AGENTS.md and every
specialist it triggers for the current work; follow that policy within your
host's instruction hierarchy. Explain any pending legacy-rule migration.
Tell me to start a fresh task and, for Codex, review/trust the project hooks.

npx -y @bridgecode/cli@4.3.0 install --project . --dry-run
npx -y @bridgecode/cli@4.3.0 install --project .
npx -y @bridgecode/cli@4.3.0 doctor --project .
```

## Copy into your agent: update

```text
Update this repository to Bridgecode 4.3.0. Read the package README completely.
Run the following exact-version dry-run, update, and doctor. Preserve all legacy
repo rules byte-for-byte during installation, along with unrelated instructions,
hooks, and agentic/ memory. Stop on integrity or ownership conflicts.

After upgrading, flag unresolved legacy rules as urgent. Verify implemented rules
against code/tests/constraints, document their responsible locations in
agentic/architecture.md, and then remove those resolved rules from AGENTS.md.
Keep every unresolved rule visible. Implement causal corrections only within the
authorized project task; request direction for work outside that scope. A code
fix may remove the cause; an architectural change is appropriate when the cause
is structural. Verify and document corrections before removing their rules.
Report installation integrity separately from memory-migration completion and
live hook delivery. Tell me to start a fresh task after updating.

npx -y @bridgecode/cli@4.3.0 update --project . --dry-run
npx -y @bridgecode/cli@4.3.0 update --project .
npx -y @bridgecode/cli@4.3.0 doctor --project .
```

## What is installed

`AGENTS.md` contains one package-owned core. The six files in `bridgecode/` provide Best Agent, Taste, design, writing, copywriting, and monoprompting; the core selects them when needed. `README_HUMAN.txt` is the human guide. `.bridgecode/installation.json` records the complete owned set, version, hashes, and hook registration.

Codex hooks are enabled by default: `.codex/hooks/bridgecode-turn.mjs` and two entries merged into `.codex/hooks.json`. UserPromptSubmit supplies a short per-turn reminder; SessionStart with source `compact` supplies bounded core recovery. Existing unrelated hook entries remain intact. Review and trust the project hooks in the host. Registration proves configuration, not live delivery or model compliance. Hooks do not grant permissions or override host instructions. The fallback is direct reading of AGENTS.md and relevant memory.

Use `--no-hooks` for other harnesses or unsupported hook environments. Use `--instruction-files claude|both|auto|agents|none` or repeatable `--instruction-file GEMINI.md` to register a bounded bootstrap. Root AGENTS.md is always installed. Custom paths must be safe, relative, non-reserved locations. Existing instructions outside the marked bootstrap are preserved.

`agentic/analysis.md` holds current decisions, checklist, evidence, review status, and next action. `agentic/architecture.md` maps the implemented system, responsible files, constraints, and regression protection. Agents create and maintain these during authorized project work. The installer never overwrites them. Design memory uses `agentic/design/DESIGN.md`; runtime assets stay at the project's explicit asset location.

## Updating older repositories

This release supports the packaged canonical 4.1.0 installation and exact unmarked 4.1 source, including populated legacy rules. Unknown or locally changed core instructions require explicit reconciliation; the CLI will not guess their identity. Legacy rules move outside the package-owned block without changing their body bytes or ordering. They remain editable and binding until reconciled. Obsolete instruction files are removed only when their recorded, trusted release contents are unchanged. Other files are left alone.

The CLI preserves lessons mechanically. The agent performs semantic migration against current code and acceptance evidence. Installation can pass while memory migration remains incomplete; both the CLI and doctor report this distinction.

Each future release must include trusted migration snapshots for the versions it supports. Unknown versions are refused. Older CLIs cannot be assumed to understand newer schemas: downgrading is not an automatic rollback mechanism. Keep version-control backups for deliberate release rollback and plan its memory reconciliation.

## Verification and recovery

Dry-run verifies canonical payload checksums, complete ownership metadata, markers, path containment, conflicts, and the projected final installation with zero writes. Doctor checks the actual installation against the exact release, including when an update makes no changes. Editable metadata alone cannot redefine canonical content. Both reject linked managed paths and ownership collisions.

Doctor measures the root AGENTS.md against a conservative 32,768-byte budget only. It does not certify global, ancestor, override, or nested instruction discovery, host settings, live hooks, or model behavior. Inspect host-specific layering separately; do not delete repository rules to pass this check.

Writes use a journal, precondition checks, and per-file atomic replacement. Multi-file writes are not filesystem-atomic. A detected failure attempts rollback; if recovery cannot safely finish, the journal and original bytes remain in `.bridgecode/transaction.json`. Preserve that file. After confirming no transaction owner is running, use:

```sh
npx -y @bridgecode/cli@4.3.0 recover --project .
```

Recovery refuses targets changed outside the transaction and retains evidence for manual reconciliation. Run doctor with the restored installation's exact version afterward. `--json` provides machine-readable success/doctor results. Conflicts exit nonzero and never silently force an overwrite. Absolute hook command paths bind installations to their location; moving a project requires explicit hook/metadata reconciliation.

## Development and release

In the authoring workspace, edit `../codex_condensation` and run `npm run sync:payload`. A standalone package checkout can edit its bundled payload directly. Keep the authoritative source synchronized before the next authoring release.

```sh
npm run build:manifest
npm test
npm run test:release
```

The release test packs once, installs that exact artifact into a disposable host, invokes its CLI in a disposable repository, checks its allowlist, and removes its fixtures and npm cache. Missing artifact inputs fail rather than skipping the artifact check. Source-sync checks are explicitly unavailable in a standalone checkout; lifecycle and artifact checks still run.

To retain the exact verified artifact for publication, run `npm run test:release -- --output release`. The tag-gated workflow tests and publishes that artifact. Configure npm authentication/trusted publishing for your repository before an explicitly authorized release. Match `v4.3.0` to package version `4.3.0`; never publish an untested rebuild. After publication, verify the exact registry version in a disposable project. This implementation does not itself publish.

The package allowlist excludes tests, development scripts, workflow, project memory, private primitives notes, and secrets. The private primitives document is an authoring hypothesis, not runtime policy.
