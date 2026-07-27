# Changelog

All notable Bridgecode CLI changes are recorded here. Versions follow semantic
versioning. Every release changes the package version, updates this changelog,
regenerates `payload-manifest.json`, passes the full fixture and tarball
regression block, and is published by exact version.

## 4.1.0

- Initial public `@bridgecode/cli` release.
- Installs the complete Bridgecode 4.1 router and processflow payload.
- Preserves unrelated instructions and Specific Repo Rules through bounded,
  checksummed, rollback-safe transactions.
- Adds exact-version install, dry-run update, doctor, Claude/custom harness
  bootstraps, manual 4.1 adoption, and integrity/conflict checks.
