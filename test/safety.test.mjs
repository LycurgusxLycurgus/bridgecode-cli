import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { installBridgecode } from "../src/install.mjs";
import { loadPackageContext } from "../src/manifest.mjs";
import { updateBridgecode } from "../src/update.mjs";
import {
  fixture,
  MANAGED_PATHS,
  PACKAGE_ROOT,
  simulatedPackage,
  snapshot,
  writeManifest,
} from "./helpers.mjs";

const malformedCases = [
  {
    name: "missing managed end",
    text: '<!-- bridgecode:managed:start version="4.1.0" schema="1" -->\n',
  },
  {
    name: "duplicate managed starts",
    text:
      '<!-- bridgecode:managed:start version="4.1.0" schema="1" -->\n' +
      '<!-- bridgecode:managed:start version="4.1.0" schema="1" -->\n' +
      "<!-- bridgecode:managed:end -->\n",
  },
  {
    name: "missing repository-rules markers",
    text:
      '<!-- bridgecode:managed:start version="4.1.0" schema="1" -->\n' +
      "<!-- bridgecode:managed:end -->\n",
  },
];

for (const scenario of malformedCases) {
  test(`malformed marker failure has zero writes: ${scenario.name}`, async (t) => {
    const root = await fixture(t);
    await writeFile(path.join(root, "AGENTS.md"), scenario.text);
    const before = await snapshot(root);
    await assert.rejects(
      installBridgecode({ project: root, packageRoot: PACKAGE_ROOT }),
      /markers|malformed/,
    );
    assert.deepEqual(await snapshot(root), before);
  });
}

test("populated rules without Architecture first stop before writes", async (t) => {
  const root = await fixture(t);
  const canonical = await readFile(path.join(PACKAGE_ROOT, "AGENTS.md"), "utf8");
  await writeFile(
    path.join(root, "AGENTS.md"),
    canonical.replace("- \n", "- Prevention: first\n- Architecture: later\n"),
  );
  const before = await snapshot(root);
  await assert.rejects(
    installBridgecode({ project: root, packageRoot: PACKAGE_ROOT }),
    /Architecture is not the first/,
  );
  assert.deepEqual(await snapshot(root), before);
});

test("unsafe payload manifest paths are rejected", async (t) => {
  const packageRoot = await simulatedPackage(t);
  const manifestPath = path.join(packageRoot, "payload-manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.files["../escape.md"] = "0".repeat(64);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await assert.rejects(loadPackageContext(packageRoot), /Unsafe manifest path/);
});

test("payload checksum mismatch is rejected before target writes", async (t) => {
  const project = await fixture(t);
  const packageRoot = await simulatedPackage(t);
  await writeFile(path.join(packageRoot, "README_HUMAN.txt"), "tampered payload");
  const before = await snapshot(project);
  await assert.rejects(
    installBridgecode({ project, packageRoot }),
    /Payload checksum mismatch/,
  );
  assert.deepEqual(await snapshot(project), before);
});

test("custom instruction path traversal is rejected with zero writes", async (t) => {
  const root = await fixture(t);
  const before = await snapshot(root);
  await assert.rejects(
    installBridgecode({
      project: root,
      packageRoot: PACKAGE_ROOT,
      instructionFile: ["../CLAUDE.md"],
    }),
    /Unsafe instruction path/,
  );
  assert.deepEqual(await snapshot(root), before);
});

test("npm package file allowlist has no tests, scripts, workflow, or secrets", () => {
  const npmCli = process.env.npm_execpath;
  assert.ok(npmCli, "npm_execpath is required when tests run through npm");
  const output = execFileSync(process.execPath, [npmCli, "pack", "--dry-run", "--json"], {
    cwd: PACKAGE_ROOT,
    encoding: "utf8",
  });
  const result = JSON.parse(output)[0];
  const names = result.files.map((file) => file.path);
  for (const required of [
    "package.json",
    "AGENTS.md",
    "README.md",
    "README_HUMAN.txt",
    "payload-manifest.json",
    "bin/bridgecode.mjs",
  ]) {
    assert.ok(names.includes(required), `${required} should be packed`);
  }
  assert.equal(
    names.some((name) => /^(?:test|scripts|\.github)\//.test(name)),
    false,
  );
  assert.equal(names.some((name) => /(?:^|\/)\.npmrc$|package-lock\.json$/.test(name)), false);
  for (const managedPath of MANAGED_PATHS) assert.ok(names.includes(managedPath));
});
