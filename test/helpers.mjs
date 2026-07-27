import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const MANAGED_PATHS = [
  "AGENTS.md",
  "README_HUMAN.txt",
  "bridgecode/general-functions.md",
  "bridgecode/specific-functions/frontend-design.md",
  "bridgecode/specific-functions/general-processflow.md",
  "bridgecode/specific-functions/monoprompting.md",
  "bridgecode/specific-functions/specific-processflow.md",
];

export async function fixture(t, prefix = "bridgecode-test-") {
  const root = await mkdtemp(path.join(os.tmpdir(), prefix));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

export async function snapshot(root) {
  const result = {};
  async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) await walk(absolute);
      else {
        const bytes = await readFile(absolute);
        result[relative] = createHash("sha256").update(bytes).digest("hex");
      }
    }
  }
  await walk(root);
  return result;
}

export async function simulatedPackage(t, version = "4.2.0") {
  const root = await fixture(t, "bridgecode-package-");
  for (const relativePath of MANAGED_PATHS) {
    await cp(path.join(PACKAGE_ROOT, relativePath), path.join(root, relativePath), {
      recursive: true,
    });
  }
  const packageJson = JSON.parse(await readFile(path.join(PACKAGE_ROOT, "package.json"), "utf8"));
  packageJson.version = version;
  await writeFile(path.join(root, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`);
  const changedPath = path.join(root, "bridgecode/general-functions.md");
  const changed = await readFile(changedPath, "utf8");
  await writeFile(changedPath, `${changed}\n<!-- simulated ${version} -->\n`);
  await writeManifest(root, packageJson.name, version);
  return root;
}

export async function writeManifest(root, packageName = "@bridgecode/cli", version = "4.1.0") {
  const files = {};
  for (const relativePath of MANAGED_PATHS) {
    const bytes = await readFile(path.join(root, relativePath));
    files[relativePath] = createHash("sha256").update(bytes).digest("hex");
  }
  await writeFile(
    path.join(root, "payload-manifest.json"),
    `${JSON.stringify({ package: packageName, version, schemaVersion: 1, files }, null, 2)}\n`,
  );
}
