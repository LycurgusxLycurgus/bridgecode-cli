import { createHash } from "node:crypto";
import { readFile, realpath, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const PACKAGE_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const METADATA_PATH = ".bridgecode/installation.json";
export const SCHEMA_VERSION = 2;
export const HOOK_PATH = ".codex/hooks/bridgecode-turn.mjs";
export const SPECIALISTS = ["best-agent", "taste", "design", "writing", "copywriting", "monoprompting"];
export const PAYLOAD_PATHS = ["AGENTS.md", "README_HUMAN.txt", ...SPECIALISTS.map(n => `bridgecode/${n}.md`)];
export const sha256 = value => createHash("sha256").update(value).digest("hex");
export const toPosixPath = value => value.split(path.sep).join("/");

export function validateRelativePath(value, label = "path") {
  if (typeof value !== "string" || !value || /[\x00-\x1f]/.test(value)) throw new Error(`Unsafe ${label}`);
  const p = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(p) || p.includes(":") || p.split("/").some(x => !x || x === "." || x === ".." || /[. ]$/.test(x) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(x))) throw new Error(`Unsafe ${label}: ${value}`);
  return p;
}
export function resolveInside(root, relative, label = "path") {
  const safe = validateRelativePath(relative, label);
  const target = path.resolve(root, ...safe.split("/"));
  const rel = path.relative(path.resolve(root), target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Unsafe ${label}: ${relative}`);
  return target;
}
export async function safeTarget(root, relative) {
  const target = resolveInside(root, relative);
  let cursor = path.resolve(root);
  for (const part of validateRelativePath(relative).split("/")) {
    cursor = path.join(cursor, part);
    const info = await lstat(cursor).catch(e => { if (e.code === "ENOENT") return null; throw e; });
    if (!info) break;
    if (info.isSymbolicLink()) throw new Error(`Linked path is unsupported: ${relative}`);
    const actual = await realpath(cursor);
    const rel = path.relative(root, actual);
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`Resolved path escapes project: ${relative}`);
    if (cursor !== target && !info.isDirectory()) throw new Error(`Parent is not a directory: ${relative}`);
    if (cursor === target && !info.isFile()) throw new Error(`Target is not a regular file: ${relative}`);
  }
  return target;
}
export async function readOptional(root, relative) {
  return readFile(await safeTarget(root, relative)).catch(e => { if (e.code === "ENOENT") return null; throw e; });
}
export async function assertProjectDirectory(project) {
  const root = await realpath(path.resolve(project));
  if (!(await lstat(root)).isDirectory()) throw new Error("Project is not a directory");
  return root;
}
export function assertHashMap(map, label) {
  if (!map || typeof map !== "object" || Array.isArray(map)) throw new Error(`Invalid ${label}`);
  const keys = new Set();
  for (const [p,h] of Object.entries(map)) {
    if (validateRelativePath(p, label) !== p || keys.has(p.toLowerCase()) || !/^[a-f0-9]{64}$/.test(h)) throw new Error(`Invalid ${label}: ${p}`);
    keys.add(p.toLowerCase());
  }
}
export async function loadPackageContext(packageRoot = PACKAGE_ROOT) {
  const root = await assertProjectDirectory(packageRoot);
  const packageJson = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(await readFile(path.join(root, "payload-manifest.json"), "utf8"));
  if (packageJson.name !== "@bridgecode/cli" || manifest.package !== packageJson.name || manifest.version !== packageJson.version || manifest.schemaVersion !== SCHEMA_VERSION) throw new Error("Payload manifest identity/version/schema mismatch");
  assertHashMap(manifest.files, "manifest path");
  for (const p of PAYLOAD_PATHS) if (!Object.hasOwn(manifest.files,p)) throw new Error(`Required payload absent: ${p}`);
  // Future payloads may add ordinary paths; repository ownership is checked separately.
  for (const p of Object.keys(manifest.files)) if (/^(?:\.git|\.agents|\.codex|\.bridgecode|agentic)(?:\/|$)/i.test(p)) throw new Error(`Reserved payload path: ${p}`);
  await verifyPayload(root, manifest);
  const hook = await readFile(path.join(root, "hooks/bridgecode-turn.mjs"));
  if (sha256(hook) !== manifest.hookHash) throw new Error("Hook payload checksum mismatch");
  return {packageRoot:root, packageJson, manifest, hook};
}
export async function verifyPayload(root, manifest) {
  assertHashMap(manifest.files, "manifest path");
  for (const [p,h] of Object.entries(manifest.files)) {
    const bytes = await readOptional(root,p);
    if (!bytes || sha256(bytes) !== h) throw new Error(`Payload checksum mismatch: ${p}`);
  }
}
export async function readPayloadFile(context,p) {
  if (!Object.hasOwn(context.manifest.files,p)) throw new Error(`Unmanaged payload: ${p}`);
  return readFile(await safeTarget(context.packageRoot,p));
}
export async function legacyContext(packageRoot = PACKAGE_ROOT) {
  const old = JSON.parse(await readFile(path.join(packageRoot,"legacy/4.1.0.json"),"utf8"));
  return { ...old, hashes: Object.fromEntries(Object.entries(old.files).map(([p,s]) => [p,sha256(Buffer.from(s))])) };
}
