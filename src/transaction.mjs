import { randomBytes } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveInside } from "./manifest.mjs";

async function exists(target) {
  return Boolean(await stat(target).catch(() => null));
}

async function replaceFile(target, bytes) {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(
    path.dirname(target),
    `.bridgecode-${process.pid}-${randomBytes(6).toString("hex")}.tmp`,
  );
  await writeFile(temporary, bytes);
  try {
    await rename(temporary, target);
  } catch (error) {
    if (await exists(target)) {
      await unlink(target);
      await rename(temporary, target);
    } else {
      throw error;
    }
  } finally {
    await rm(temporary, { force: true }).catch(() => {});
  }
}

export async function applyTransaction(
  projectRoot,
  changes,
  { postCheck, failAfterWrites = Number(process.env.BRIDGECODE_TEST_FAIL_AFTER_WRITES ?? 0) } = {},
) {
  const transactionRoot = await mkdtemp(path.join(os.tmpdir(), "bridgecode-transaction-"));
  const prepared = [];
  const createdDirectories = new Set();
  try {
    for (let index = 0; index < changes.length; index += 1) {
      const change = changes[index];
      const target = resolveInside(projectRoot, change.path, "transaction path");
      const original = await readFile(target).catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      const backup = path.join(transactionRoot, `${index}.backup`);
      const staged = path.join(transactionRoot, `${index}.staged`);
      let directory = path.dirname(target);
      while (directory !== projectRoot && directory.startsWith(`${projectRoot}${path.sep}`)) {
        if (!(await exists(directory))) createdDirectories.add(directory);
        directory = path.dirname(directory);
      }
      if (original !== null) await writeFile(backup, original);
      if (change.content !== null) await writeFile(staged, change.content);
      prepared.push({ ...change, target, original, backup, staged });
    }

    let writes = 0;
    for (const change of prepared) {
      if (change.content === null) {
        await rm(change.target, { force: true });
      } else {
        await replaceFile(change.target, await readFile(change.staged));
      }
      writes += 1;
      if (failAfterWrites > 0 && writes >= failAfterWrites) {
        throw new Error(`Simulated interruption after ${writes} writes`);
      }
    }
    if (postCheck) await postCheck();
  } catch (error) {
    for (const change of [...prepared].reverse()) {
      if (change.original === null) {
        await rm(change.target, { force: true }).catch(() => {});
      } else {
        await replaceFile(change.target, await readFile(change.backup)).catch(() => {});
      }
    }
    for (const directory of [...createdDirectories].sort((a, b) => b.length - a.length)) {
      await rmdir(directory).catch(() => {});
    }
    throw new Error(`Bridgecode transaction rolled back: ${error.message}`, { cause: error });
  } finally {
    await rm(transactionRoot, { recursive: true, force: true });
  }
}
