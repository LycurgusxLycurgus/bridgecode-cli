import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fixture } from "./helpers.mjs";

const tarball = process.env.BRIDGECODE_TARBALL;

test(
  "actual generated tarball installs, updates idempotently, and passes doctor",
  { skip: !tarball },
  async (t) => {
    const tarballInfo = await stat(tarball);
    assert.ok(tarballInfo.isFile());
    const root = await fixture(t, "bridgecode-tarball-");
    const npmCli = process.env.npm_execpath;
    assert.ok(npmCli, "npm_execpath is required when tests run through npm");
    const invoke = (...args) =>
      execFileSync(
        process.execPath,
        [npmCli, "exec", "--yes", "--package", tarball, "--", "bridgecode", ...args, "--project", root],
        { encoding: "utf8" },
      );
    const dryRun = invoke("install", "--dry-run");
    assert.match(dryRun, /zero writes/);
    const install = invoke("install");
    assert.match(install, /Doctor passed/);
    const before = await readFile(path.join(root, "AGENTS.md"));
    const update = invoke("update");
    assert.match(update, /idempotent/);
    assert.deepEqual(await readFile(path.join(root, "AGENTS.md")), before);
    const doctor = invoke("doctor");
    assert.match(doctor, /Doctor passed/);
  },
);
