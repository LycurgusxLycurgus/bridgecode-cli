import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const METADATA_PATH = ".bridgecode/installation.json";
export const SCHEMA_VERSION = 1;

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

export function validateRelativePath(value, label = "path") {
  if (typeof value !== "string" || value.length === 0 || value.includes("\0")) {
    throw new Error(`${label} must be a non-empty relative path`);
  }
  const portable = value.replaceAll("\\", "/");
  if (
    path.posix.isAbsolute(portable) ||
    /^[A-Za-z]:/.test(portable) ||
    portable === "." ||
    portable.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe ${label}: ${value}`);
  }
  return portable;
}

export function resolveInside(root, relativePath, label = "path") {
  const safe = validateRelativePath(relativePath, label);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, ...safe.split("/"));
  const prefix = `${resolvedRoot}${path.sep}`;
  if (!resolved.startsWith(prefix)) {
    throw new Error(`Unsafe ${label}: ${relativePath}`);
  }
  return resolved;
}

export async function assertProjectDirectory(projectRoot) {
  const resolved = path.resolve(projectRoot);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isDirectory()) {
    throw new Error(`Project directory does not exist: ${resolved}`);
  }
  return realpath(resolved);
}

export async function loadPackageContext(packageRoot = PACKAGE_ROOT) {
  const packageJson = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8"));
  const manifest = JSON.parse(
    await readFile(path.join(packageRoot, "payload-manifest.json"), "utf8"),
  );
  if (packageJson.name !== "@bridgecode/cli") {
    throw new Error(`Unexpected package identity: ${packageJson.name}`);
  }
  if (manifest.package !== packageJson.name || manifest.version !== packageJson.version) {
    throw new Error("Payload manifest identity/version does not match package.json");
  }
  if (manifest.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported payload manifest schema: ${manifest.schemaVersion}`);
  }
  await verifyPayload(packageRoot, manifest);
  return { packageRoot, packageJson, manifest };
}

export async function verifyPayload(packageRoot, manifest) {
  const entries = Object.entries(manifest.files ?? {});
  if (entries.length === 0) {
    throw new Error("Payload manifest contains no files");
  }
  for (const [relativePath, expectedHash] of entries) {
    const target = resolveInside(packageRoot, relativePath, "manifest path");
    const bytes = await readFile(target).catch(() => null);
    if (!bytes) {
      throw new Error(`Payload file is missing: ${relativePath}`);
    }
    const actualHash = sha256(bytes);
    if (actualHash !== expectedHash) {
      throw new Error(
        `Payload checksum mismatch for ${relativePath}: expected ${expectedHash}, got ${actualHash}`,
      );
    }
  }
}

export async function readPayloadFile(context, relativePath) {
  const safe = validateRelativePath(relativePath, "payload path");
  if (!Object.hasOwn(context.manifest.files, safe)) {
    throw new Error(`Payload path is not managed: ${safe}`);
  }
  return readFile(resolveInside(context.packageRoot, safe, "payload path"));
}
