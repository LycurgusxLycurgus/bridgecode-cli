import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
const managedPaths = [
  "AGENTS.md",
  "README_HUMAN.txt",
  "bridgecode/general-functions.md",
  "bridgecode/specific-functions/frontend-design.md",
  "bridgecode/specific-functions/general-processflow.md",
  "bridgecode/specific-functions/monoprompting.md",
  "bridgecode/specific-functions/specific-processflow.md",
];
const files = {};
for (const relativePath of managedPaths) {
  const bytes = await readFile(path.join(packageRoot, ...relativePath.split("/")));
  files[relativePath] = createHash("sha256").update(bytes).digest("hex");
}
const manifest = {
  package: packageJson.name,
  version: packageJson.version,
  schemaVersion: 1,
  files,
};
await writeFile(
  path.join(packageRoot, "payload-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
