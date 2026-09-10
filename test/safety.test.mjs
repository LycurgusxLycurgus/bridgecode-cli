import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { installBridgecode } from "../src/install.mjs";
import { inspectInstallation } from "../src/doctor.mjs";
import { loadPackageContext, sha256, validateRelativePath } from "../src/manifest.mjs";
import { parseManagedAgents } from "../src/repo-rules.mjs";
import { buildBootstrap } from "../src/instructions.mjs";
import { updateBridgecode } from "../src/update.mjs";
import { applyTransaction, recoverTransaction, JOURNAL } from "../src/transaction.mjs";
import { fixture, PACKAGE_ROOT, simulatedPackage, snapshot, legacyFiles } from "./helpers.mjs";
const options=root=>({project:root,packageRoot:PACKAGE_ROOT});
for(const unsafe of ["../escape","C:/x","aux.txt","foo./x","a//b","a:stream","a/../b"])
 test("unsafe path "+unsafe,()=>assert.throws(()=>validateRelativePath(unsafe)));
for(const text of ['<!-- bridgecode:managed:start version="4.1.0" schema="1" -->\n','<!-- bridgecode:managed:end -->'])
 test("malformed markers fail before writes: "+text,async t=>{
 const root=await fixture(t);await writeFile(path.join(root,"AGENTS.md"),text);const before=await snapshot(root);
 await assert.rejects(installBridgecode(options(root)),/markers|malformed/);assert.deepEqual(await snapshot(root),before);
});
for(const kind of ["changed-file","missing-coverage","forged-core-hash","forged-file-hash"])
 test("doctor and no-op update reject "+kind,async t=>{
 const root=await fixture(t);await installBridgecode(options(root));
 const p=path.join(root,".bridgecode/installation.json"),m=JSON.parse(await readFile(p));
 if(kind==="missing-coverage")delete m.managedFiles["bridgecode/writing.md"];
 else if(kind==="forged-core-hash"){
 const a=path.join(root,"AGENTS.md"),s=(await readFile(a,"utf8")).replace("Operating contract","Tampered contract");
 await writeFile(a,s);m.agents.managedHash=parseManagedAgents(s).managedHash;
 }else{await writeFile(path.join(root,"bridgecode/writing.md"),"tampered");if(kind==="forged-file-hash")m.managedFiles["bridgecode/writing.md"]=sha256("tampered");}
 await writeFile(p,JSON.stringify(m));const before=await snapshot(root);
 assert.equal((await inspectInstallation(options(root))).ok,false);
 await assert.rejects(updateBridgecode(options(root)));
 assert.deepEqual(await snapshot(root),before);
});
test("new payload collision and payload tampering make zero writes",async t=>{
 const root=await fixture(t);await mkdir(path.join(root,"bridgecode"));await writeFile(path.join(root,"bridgecode/writing.md"),"user owned");
 const before=await snapshot(root);await assert.rejects(installBridgecode(options(root)),/conflicts/);assert.deepEqual(await snapshot(root),before);
 const pkg=await simulatedPackage(t);await writeFile(path.join(pkg,"README_HUMAN.txt"),"tampered");
 await assert.rejects(loadPackageContext(pkg),/checksum/);
});
test("symlink or junction escape is refused",async t=>{
 const root=await fixture(t),outside=await fixture(t);
 await symlink(outside,path.join(root,"bridgecode"),process.platform==="win32"?"junction":"dir");
 const before=await snapshot(outside);
 await assert.rejects(installBridgecode(options(root)),/symbolic|symlink|link/i);
 assert.deepEqual(await snapshot(outside),before);
});
test("oversized dry-run and traversal have zero writes",async t=>{
 const root=await fixture(t);await writeFile(path.join(root,"AGENTS.md"),"x".repeat(33000));const before=await snapshot(root);
 await assert.rejects(installBridgecode({...options(root),dryRun:true}),/budget/);
 await assert.rejects(installBridgecode({...options(root),instructionFile:["../CLAUDE.md"]}),/Unsafe/);
 assert.deepEqual(await snapshot(root),before);
});
test("post-check failure rolls back; failed rollback keeps recoverable journal",async t=>{
 const root=await fixture(t);await writeFile(path.join(root,"owned"),"before");
 await assert.rejects(applyTransaction(root,[{path:"owned",content:Buffer.from("after")}],{postCheck:async()=>{throw new Error("postcheck");}}),/rolled back/);
 assert.equal(await readFile(path.join(root,"owned"),"utf8"),"before");
 await assert.rejects(applyTransaction(root,[{path:"owned",content:Buffer.from("after")}],{postCheck:async()=>{await writeFile(path.join(root,"owned"),"external");throw new Error("failure");}}),/journal retained/);
 assert.equal(await readFile(path.join(root,"owned"),"utf8"),"external");
 assert.ok(await readFile(path.join(root,JOURNAL)));
 await writeFile(path.join(root,"owned"),"after");
 assert.equal((await recoverTransaction(root)).recovered,true);
 assert.equal(await readFile(path.join(root,"owned"),"utf8"),"before");
});
test("precondition conflict refuses mutation",async t=>{
 const root=await fixture(t);await writeFile(path.join(root,"owned"),"now");
 await assert.rejects(applyTransaction(root,[{path:"owned",content:Buffer.from("after")}],{preconditions:{owned:sha256("old")}}),/Concurrent modification/);
 assert.equal(await readFile(path.join(root,"owned"),"utf8"),"now");
});
test("unowned bootstraps and case-aliased reserved targets are refused",async t=>{
 const root=await fixture(t);await writeFile(path.join(root,"CLAUDE.md"),buildBootstrap("4.3.0"));
 const before=await snapshot(root);
 await assert.rejects(installBridgecode(options(root)),/Unrecorded bootstrap/);
 assert.deepEqual(await snapshot(root),before);
 const clean=await fixture(t);
 for(const p of [".CODEX/config.toml","AGENTIC/architecture.md","agents.md",".git/config",".GIT/config",".agents/instructions.md"]){
  await assert.rejects(installBridgecode({...options(clean),instructionFile:[p]}),/reserved|alias/i);
  assert.deepEqual(await snapshot(clean),{});
 }
});
test("new release path conflicts stop before writes even when bytes match",async t=>{
 const root=await fixture(t);await installBridgecode(options(root));
 await writeFile(path.join(root,"new-file.md"),"repository owned");
 const pkg=await simulatedPackage(t),mp=path.join(pkg,"payload-manifest.json"),m=JSON.parse(await readFile(mp));
 await writeFile(path.join(pkg,"new-file.md"),"new release");m.files["new-file.md"]=sha256("new release");await writeFile(mp,JSON.stringify(m));
 const before=await snapshot(root);
 await assert.rejects(updateBridgecode({project:root,packageRoot:pkg}),/conflicts/);
 assert.deepEqual(await snapshot(root),before);
 await writeFile(path.join(root,"new-file.md"),"new release");const identical=await snapshot(root);
 await assert.rejects(updateBridgecode({project:root,packageRoot:pkg}),/conflicts/);
 assert.deepEqual(await snapshot(root),identical);
});
test("additional malformed bootstrap markers make doctor and update fail without writes",async t=>{
 const root=await fixture(t);await installBridgecode({...options(root),instructionFiles:"claude"});
 const p=path.join(root,"CLAUDE.md"),valid=await readFile(p,"utf8");
 for(const suffix of ["<!-- bridgecode:bootstrap:start broken -->","<!-- bridgecode:bootstrap:end broken -->"]){
  await writeFile(p,valid+"\n"+suffix);const before=await snapshot(root);
  assert.equal((await inspectInstallation(options(root))).ok,false);
  await assert.rejects(updateBridgecode(options(root)),/markers/);
  assert.deepEqual(await snapshot(root),before);
 }
});
test("reserved payload and forged installed bootstrap paths are rejected",async t=>{
 const pkg=await simulatedPackage(t),mp=path.join(pkg,"payload-manifest.json"),manifest=JSON.parse(await readFile(mp));
 manifest.files[".git/config"]=sha256("x");await writeFile(mp,JSON.stringify(manifest));
 await assert.rejects(loadPackageContext(pkg),/Reserved payload/);
 const root=await fixture(t);await installBridgecode(options(root));
 const statePath=path.join(root,".bridgecode/installation.json"),state=JSON.parse(await readFile(statePath));
 state.instructionFiles=[".git/config"];state.bootstraps={".git/config":sha256(buildBootstrap("4.3.0"))};
 await writeFile(statePath,JSON.stringify(state));const before=await snapshot(root);
 await assert.rejects(updateBridgecode(options(root)),/Reserved bootstrap/);
 assert.equal((await inspectInstallation(options(root))).ok,false);assert.deepEqual(await snapshot(root),before);
});
test("edited obsolete legacy instructions are preserved and block migration",async t=>{
 const root=await fixture(t),files=await legacyFiles();
 for(const [p,s]of Object.entries(files)){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);}
 await writeFile(path.join(root,"bridgecode/general-functions.md"),"local changes must survive");
 const before=await snapshot(root);
 await assert.rejects(installBridgecode(options(root)),/Retired managed file was modified/);
 assert.deepEqual(await snapshot(root),before);
});
test("unknown version and edited hook entry are diagnosed without writes",async t=>{
 const root=await fixture(t);await installBridgecode(options(root));
 const p=path.join(root,".codex/hooks.json"),c=JSON.parse(await readFile(p));
 c.hooks.UserPromptSubmit[0].hooks[0].timeout=99;await writeFile(p,JSON.stringify(c));
 const before=await snapshot(root);assert.equal((await inspectInstallation(options(root))).ok,false);
 await assert.rejects(updateBridgecode(options(root)),/hook entry conflict/);assert.deepEqual(await snapshot(root),before);
 const clean=await fixture(t);await installBridgecode(options(clean));
 const mp=path.join(clean,".bridgecode/installation.json"),m=JSON.parse(await readFile(mp));m.version="4.2.7";await writeFile(mp,JSON.stringify(m));
 const state=await snapshot(clean);await assert.rejects(updateBridgecode(options(clean)),/trusted migration snapshot/);assert.deepEqual(await snapshot(clean),state);
});
