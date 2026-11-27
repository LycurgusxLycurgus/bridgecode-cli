import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fixture, snapshot, PAYLOAD_PATHS, EDITION_LIST } from "./helpers.mjs";
test("exact packed artifact: allowlist, then install, no-op update, doctor and zero-write dry-run in every edition",async t=>{
 const tarball=process.env.BRIDGECODE_TARBALL;
 assert.ok(tarball,"Use npm run test:release; exact artifact is mandatory, never skipped");
 assert.ok((await stat(tarball)).isFile());
 const names=JSON.parse(process.env.BRIDGECODE_PACK_FILES||"[]");
 for(const p of [...PAYLOAD_PATHS,"package.json","bin/bridgecode.mjs","hooks/bridgecode-turn.mjs","src/metrics.mjs","src/extensions.mjs","legacy/4.1.0.json","legacy/4.3.0.json","legacy/4.3.1.json","legacy/4.3.2.json"])assert.ok(names.includes(p),p);
 assert.equal(names.some(p=>/^(test|scripts|agentic|\.github)\//.test(p)||/primitives|\.npmrc|package-lock/.test(p)),false);
 const host=await fixture(t,"bridgecode-artifact-host-");
 const npm=process.env.npm_execpath;assert.ok(npm);
 execFileSync(process.execPath,[npm,"install","--prefix",host,"--ignore-scripts","--no-audit","--no-fund","--package-lock=false",tarball],{encoding:"utf8"});
 const cli=path.join(host,"node_modules/@bridgecode/cli/bin/bridgecode.mjs");
 for(const edition of EDITION_LIST){
  const root=await fixture(t,"bridgecode-artifact-project-");
  const invoke=(...args)=>JSON.parse(execFileSync(process.execPath,[cli,...args,"--project",root,"--json"],{encoding:"utf8"}));
  const extensions=edition==="codex"?[]:["--extension","cloop:town","--extension","cheapgpt:cheap"];
  const before=await snapshot(root);assert.ok(invoke("install","--edition",edition,...extensions,"--dry-run").changes.length);assert.deepEqual(await snapshot(root),before);
  assert.equal(invoke("install","--edition",edition,...extensions).verified,true);
  const installed=await snapshot(root);assert.equal(invoke("update").changes.length,0);assert.deepEqual(await snapshot(root),installed);
  assert.equal(invoke("doctor").ok,true,edition);
  assert.ok(invoke("metrics").production);
 }
});
