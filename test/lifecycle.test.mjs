import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inspectInstallation } from "../src/doctor.mjs";
import { installBridgecode } from "../src/install.mjs";
import { parseBootstrap } from "../src/instructions.mjs";
import { parseManagedAgents } from "../src/repo-rules.mjs";
import { updateBridgecode } from "../src/update.mjs";
import { fixture, PACKAGE_ROOT, simulatedPackage, snapshot } from "./helpers.mjs";

test("empty repository installation and same-version idempotence", async (t) => {
  const root = await fixture(t);
  const installed = await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  assert.ok(installed.changes.length >= 8);
  const before = await snapshot(root);
  const updated = await updateBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  assert.equal(updated.changes.length, 0);
  assert.deepEqual(await snapshot(root), before);
  assert.equal((await inspectInstallation({ projectRoot: root, packageRoot: PACKAGE_ROOT })).ok, true);
});

test("existing unrelated AGENTS.md is preserved exactly before the managed section", async (t) => {
  const root = await fixture(t);
  const existing = Buffer.from("# Existing\r\n\r\nKeep π and spacing.  \r\n");
  await writeFile(path.join(root, "AGENTS.md"), existing);
  await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  const installed = await readFile(path.join(root, "AGENTS.md"));
  assert.deepEqual(installed.subarray(0, existing.length), existing);
  assert.ok(parseManagedAgents(installed.toString("utf8")));
});

test("unmarked Bridgecode 4.1 adoption preserves empty rules", async (t) => {
  const root = await fixture(t);
  const canonical = await readFile(path.join(PACKAGE_ROOT, "AGENTS.md"));
  await writeFile(path.join(root, "AGENTS.md"), canonical);
  await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  const parsed = parseManagedAgents(await readFile(path.join(root, "AGENTS.md"), "utf8"));
  assert.equal(parsed.rules.trim(), "-");
});

test("unmarked Bridgecode adoption and next-version update preserve complex rules byte-for-byte", async (t) => {
  const root = await fixture(t);
  const canonical = (await readFile(path.join(PACKAGE_ROOT, "AGENTS.md"), "utf8")).replaceAll(
    "\n",
    "\r\n",
  );
  const heading = "## 5) Specific Repo Rules\r\n\r\n";
  const rules = [
    "- Architecture: café → runtime",
    "  - nested: 東京",
    "  - `inline`",
    "- Preserve fences:",
    "  ```text",
    "  <!-- bridgecode-looking but not a marker -->",
    "  ```",
    "",
  ].join("\r\n");
  const unmarked = `${canonical.slice(0, canonical.indexOf(heading) + heading.length)}${rules}`;
  await writeFile(path.join(root, "AGENTS.md"), unmarked);
  await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  const first = parseManagedAgents(await readFile(path.join(root, "AGENTS.md"), "utf8"));
  assert.equal(first.rules, rules.replace(/\r\n$/, ""));

  const nextPackage = await simulatedPackage(t);
  await updateBridgecode({ project: root, packageRoot: nextPackage });
  const second = parseManagedAgents(await readFile(path.join(root, "AGENTS.md"), "utf8"));
  assert.equal(second.rules, first.rules);
  assert.equal(second.version, "4.2.0");
});

test("Claude and custom bootstraps are created once", async (t) => {
  const root = await fixture(t);
  await installBridgecode({
    project: root,
    packageRoot: PACKAGE_ROOT,
    instructionFiles: "both",
    instructionFile: ["docs/HARNESS.md"],
  });
  await updateBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  for (const relativePath of ["CLAUDE.md", "docs/HARNESS.md"]) {
    const text = await readFile(path.join(root, relativePath), "utf8");
    assert.ok(parseBootstrap(text));
    assert.equal((text.match(/bridgecode:bootstrap:start/g) ?? []).length, 1);
    assert.doesNotMatch(text, /Specific Repo Rules/);
  }
});

test("dry-run produces zero writes", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "AGENTS.md"), "unrelated\n");
  const before = await snapshot(root);
  const result = await installBridgecode({
    project: root,
    packageRoot: PACKAGE_ROOT,
    dryRun: true,
  });
  assert.ok(result.changes.length > 0);
  assert.deepEqual(await snapshot(root), before);
});

test("modified managed-file conflict produces zero writes", async (t) => {
  const root = await fixture(t);
  await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  await writeFile(path.join(root, "bridgecode/general-functions.md"), "manual change\n");
  const before = await snapshot(root);
  await assert.rejects(
    updateBridgecode({ project: root, packageRoot: PACKAGE_ROOT }),
    /Managed file conflict/,
  );
  assert.deepEqual(await snapshot(root), before);
});

test("interrupted next-version transaction restores the complete original state", async (t) => {
  const root = await fixture(t);
  await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  const before = await snapshot(root);
  const nextPackage = await simulatedPackage(t);
  await assert.rejects(
    updateBridgecode({
      project: root,
      packageRoot: nextPackage,
      transactionFailAfterWrites: 2,
    }),
    /rolled back.*Simulated interruption/s,
  );
  assert.deepEqual(await snapshot(root), before);
});

test("doctor detects missing and altered managed files", async (t) => {
  const root = await fixture(t);
  await installBridgecode({ project: root, packageRoot: PACKAGE_ROOT });
  await writeFile(path.join(root, "README_HUMAN.txt"), "altered");
  const report = await inspectInstallation({ projectRoot: root, packageRoot: PACKAGE_ROOT });
  assert.equal(report.ok, false);
  assert.ok(report.checks.some((check) => !check.ok && /README_HUMAN/.test(check.name)));
});
