# Bridgecode CLI

> **Agent execution contract:** A terminal-enabled agent must read this entire
> README, inspect the target repository, and execute the applicable procedure.
> Do not stop after describing commands. Preserve existing instructions and
> stop before writing when ownership, markers, hashes, or Specific Repo Rules
> cannot be determined unambiguously.

`@bridgecode/cli` installs and maintains Bridgecode 4.1 as repo-local
instructions. It runs through `npx`, has no runtime dependencies, and never
adds itself to a target repository's `package.json` or lockfile. Node 22 or
newer is required.

## Agent installation prompt

```text
Read this README completely. Inspect the target repository's AGENTS.md,
CLAUDE.md, and any custom instruction files before writing. Run the exact
Bridgecode 4.1.0 install command with --dry-run first. If it reports no
conflict, install the exact documented version, then run doctor. Preserve all
existing instructions outside Bridgecode's bounded blocks. Stop without
writing if ownership, markers, or hashes are ambiguous. After doctor passes,
tell me to start a fresh task/session because instruction discovery happens at
task/session start.

npx -y @bridgecode/cli@4.1.0 install --project . --dry-run
npx -y @bridgecode/cli@4.1.0 install --project .
npx -y @bridgecode/cli@4.1.0 doctor --project .
```

## Agent update prompt

```text
Read this README completely. Inspect the current Bridgecode installation and
run the target exact version's update with --dry-run before the real update.
The entire Specific Repo Rules block—including Architecture and every
prevention rule—is repository-owned state. Preserve it byte-for-byte: do not
erase, regenerate, summarize, reorder, normalize line endings, or reinterpret
it. Stop before any write if extraction is missing, duplicated, malformed, or
ambiguous, or if a package-managed file was modified. After update, run doctor
with the same exact package version and tell me to start a fresh task/session.

npx -y @bridgecode/cli@<target-version> update --project . --dry-run
npx -y @bridgecode/cli@<target-version> update --project .
npx -y @bridgecode/cli@<target-version> doctor --project .
```

## Direct commands

Install and verify 4.1.0:

```sh
npx -y @bridgecode/cli@4.1.0 install --project . --dry-run
npx -y @bridgecode/cli@4.1.0 install --project .
npx -y @bridgecode/cli@4.1.0 doctor --project .
```

Update to an exact future version:

```sh
npx -y @bridgecode/cli@<target-version> update --project . --dry-run
npx -y @bridgecode/cli@<target-version> update --project .
npx -y @bridgecode/cli@<target-version> doctor --project .
```

The install and update commands always print a restart reminder. Open a new
task/session afterward; Codex discovers applicable `AGENTS.md` files when a
task/session begins.

## Files and ownership

Installation changes only these locations:

- `AGENTS.md`: canonical, complete Bridgecode router plus repository memory.
- `bridgecode/`: package-managed processflow instructions.
- `README_HUMAN.txt`: package-managed human quick guide.
- `.bridgecode/installation.json`: compact version, schema, target, and hash
  metadata. It never duplicates Specific Repo Rules.
- `CLAUDE.md` or explicitly selected custom files: only a bounded bootstrap.

The package owns its marked `AGENTS.md` section, the bounded bootstrap blocks,
the `bridgecode/` payload, `README_HUMAN.txt`, and installation metadata.
Everything outside its markers belongs to the repository. Specific Repo Rules
are a deliberate exception inside the managed installation: their body is
repository-owned evolving memory and is transplanted byte-for-byte on update.

If no `AGENTS.md` exists, install creates it. If an unrelated file exists,
install appends a bounded Bridgecode section without changing preceding bytes.
If marked Bridgecode exists, only its managed range is replaced. An unmarked,
manually copied Bridgecode 4.1 file is adopted when its known router structure
matches exactly; its Specific Repo Rules are retained. Ambiguous or malformed
files stop the operation before any write.

## Other instruction harnesses

Root `AGENTS.md` always remains canonical and complete. Register a small
bootstrap for Claude, both recognized harnesses, automatic detection, no extra
harness, or one or more safe repository-relative custom files:

```sh
npx -y @bridgecode/cli@4.1.0 install --project . --instruction-files auto
npx -y @bridgecode/cli@4.1.0 install --project . --instruction-files claude
npx -y @bridgecode/cli@4.1.0 install --project . --instruction-files both
npx -y @bridgecode/cli@4.1.0 install --project . --instruction-files none
npx -y @bridgecode/cli@4.1.0 install --project . --instruction-file GEMINI.md
```

Custom paths must be safe, relative paths inside the project. Bootstrap blocks
tell the harness to read root `AGENTS.md`; they do not duplicate repository
rules. Repeated installs and updates do not duplicate blocks.

## Dry-run, doctor, conflicts, and rollback

Dry-run performs payload verification, ownership parsing, hash checks, path
checks, rule extraction, and transaction planning with zero writes. Doctor
checks version/schema, payload hashes, marker uniqueness, repository-rule
structure, required files, bootstrap integrity, instruction loading, and the
Codex instruction-size allowance.

The default Codex combined `AGENTS.md` allowance is 32 KiB. Doctor reports the
measured size and reads `project_doc_max_bytes` from the user's Codex config
when configured. It never edits `.codex/config.toml`. If the limit is near or
exceeded, remove unrelated applicable instruction bulk or manually raise the
configured allowance, then rerun doctor.

Updates stop on a modified package-managed file, checksum mismatch, unsafe
manifest path, missing/duplicate/malformed marker, ambiguous manual adoption,
or repository rules whose first populated rule is not `Architecture:`. All
preflight failures produce zero writes. A write or post-write doctor failure
restores every original file and removes transaction residue.

After a successful update, deliberate rollback uses the previous exact npm
version:

```sh
npx -y @bridgecode/cli@<previous-version> update --project . --dry-run
npx -y @bridgecode/cli@<previous-version> update --project .
npx -y @bridgecode/cli@<previous-version> doctor --project .
```

## Local development and testing

```sh
npm run build:manifest
npm test
npm pack --dry-run
npm pack
```

Then run the actual tarball regression from an absolute tarball path:

```sh
BRIDGECODE_TARBALL=/absolute/path/bridgecode-cli-4.1.0.tgz npm run test:tarball
```

On PowerShell:

```powershell
$env:BRIDGECODE_TARBALL = (Resolve-Path .\bridgecode-cli-4.1.0.tgz)
npm run test:tarball
Remove-Item Env:\BRIDGECODE_TARBALL
```

The tarball test invokes the packed CLI in clean temporary repositories,
performs install/update/doctor behavior, and removes fixtures. Inspect
`npm pack --dry-run --json` before release; only the `files` allowlist in
`package.json` should ship.

## Publishing and version policy

Before every release: update the version and changelog, regenerate the
manifest, run the full tests, inspect `npm pack --dry-run`, create the actual
tarball, pass the tarball regression, confirm npm authentication and
organization access, and publish exact public contents.

Preferred releases use the included GitHub Actions workflow with npm trusted
publishing and OIDC provenance. Configure the npm trusted publisher for the
GitHub repository and workflow, then create the matching version tag. A manual
first release requires interactive `npm login` and explicit authorization:

```sh
npm publish --access public --provenance
```

After publication, install the exact public version in a fresh temporary
repository and rerun doctor. Patch versions repair compatible behavior, minor
versions add compatible lifecycle capability, and major versions may change
installation or ownership contracts. Every published version remains an exact
rollback target.
