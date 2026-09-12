import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inspectInstallation } from "../src/doctor.mjs";
import { installBridgecode } from "../src/install.mjs";
import { parseBootstrap } from "../src/instructions.mjs";
import { parseManagedAgents, buildLegacyAgents, splitCanonicalAgents, pendingRulesBlock, parseRules } from "../src/repo-rules.mjs";
import { sha256 } from "../src/manifest.mjs";
import { updateBridgecode } from "../src/update.mjs";
import { fixture, PACKAGE_ROOT, simulatedPackage, snapshot, legacyFiles, MANAGED_PATHS, package430 } from "./helpers.mjs";
const options=root=>({project:root,packageRoot:PACKAGE_ROOT});
test("install, doctor, true no-op update and projected dry-run",async t=>{
 const root=await fixture(t);const before=await snapshot(root);
 const dry=await installBridgecode({...options(root),dryRun:true});
 assert.ok(dry.changes.length);assert.deepEqual(await snapshot(root),before);
 assert.equal((await installBridgecode(options(root))).verified,true);
 const installed=await snapshot(root);
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
 assert.deepEqual(await snapshot(root),installed);
 assert.equal((await inspectInstallation(options(root))).ok,true);
});
test("unrelated instructions and custom bootstraps preserve outside bytes",async t=>{
 const root=await fixture(t);const text="# Existing\r\n\r\nKeep π and spacing.  \r\n";
 await writeFile(path.join(root,"AGENTS.md"),text);
 await writeFile(path.join(root,"CLAUDE.md"),text);
 await installBridgecode({...options(root),instructionFiles:"both",instructionFile:["docs/HARNESS.md"]});
 const agents=await readFile(path.join(root,"AGENTS.md"),"utf8");
 assert.equal(parseManagedAgents(agents).start,0);assert.ok(agents.endsWith(text));
 for(const p of ["CLAUDE.md","docs/HARNESS.md"])assert.ok(parseBootstrap(await readFile(path.join(root,p),"utf8")));
 await updateBridgecode(options(root));
 assert.ok((await readFile(path.join(root,"CLAUDE.md"),"utf8")).startsWith(text));
});
test("current unmarked source adopts without pending rules",async t=>{
 const root=await fixture(t);
 for(const p of MANAGED_PATHS){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),await readFile(path.join(PACKAGE_ROOT,p)));}
 const out=await installBridgecode(options(root));assert.equal(out.migrationPending,false);
});
for(const marked of [false,true])test("4.1 "+(marked?"managed":"unmarked")+" migration preserves mixed-EOL Unicode rules and retires old files",async t=>{
 const root=await fixture(t),files=await legacyFiles();
 const rules="- Prevention before architecture is preserved.\r\n- Architecture: café → 東京\n  - nested \u{1F680}\r\n  ```text\n  <!-- harmless -->\r\n  ```";
 const canonical=files["AGENTS.md"];
 const agents=marked?buildLegacyAgents(canonical,"4.1.0",rules):splitCanonicalAgents(canonical).prefix+rules+"\n";
 await writeFile(path.join(root,"AGENTS.md"),agents);
 for(const [p,s]of Object.entries(files)){if(p==="AGENTS.md")continue;await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);}
 if(marked){
  await mkdir(path.join(root,".bridgecode"));
  const managedFiles=Object.fromEntries(Object.entries(files).filter(([p])=>p!=="AGENTS.md").map(([p,s])=>[p,sha256(s)]));
  await writeFile(path.join(root,".bridgecode/installation.json"),JSON.stringify({package:"@bridgecode/cli",version:"4.1.0",schemaVersion:1,managedFiles,agents:{path:"AGENTS.md",managedHash:parseManagedAgents(agents).managedHash},instructionMode:"auto",instructionFiles:[],bootstraps:{}}));
 }
 const out=await installBridgecode(options(root));assert.equal(out.migrationPending,true);
 let parsed=parseManagedAgents(await readFile(path.join(root,"AGENTS.md"),"utf8"));
 assert.equal(parsed.rules,"");assert.equal(parsed.schema,2);
 const memory=await readFile(path.join(root,"agentic/architecture.md"),"utf8");
 assert.ok(memory.includes(rules));assert.match(memory,/remain binding/);
 assert.equal((await snapshot(root))["bridgecode/general-functions.md"],undefined);
 const pkg=await simulatedPackage(t);
 await updateBridgecode({project:root,packageRoot:pkg});
 parsed=parseManagedAgents(await readFile(path.join(root,"AGENTS.md"),"utf8"));
 assert.equal(parsed.rules,"");assert.equal(parsed.version,"4.3.2");
 assert.equal(await readFile(path.join(root,"agentic/architecture.md"),"utf8"),memory);
 // Reconciliation is repository-owned: deleting one resolved rule does not invalidate the core.
 await writeFile(path.join(root,"agentic/architecture.md"),memory.replace(rules,"- Remaining unresolved rule"));
 assert.equal((await inspectInstallation({project:root,packageRoot:pkg})).ok,true);
});
test("next-release failure restores all original bytes",async t=>{
 const root=await fixture(t);await installBridgecode(options(root));const before=await snapshot(root);
 const pkg=await simulatedPackage(t);
 await assert.rejects(updateBridgecode({project:root,packageRoot:pkg,transactionFailAfterWrites:2}),/rolled back.*Simulated interruption/s);
 assert.deepEqual(await snapshot(root),before);
});
test("architecture and other project memory are never replaced by an update",async t=>{
 const root=await fixture(t);await installBridgecode(options(root));await mkdir(path.join(root,"agentic"));
 const architecture="# Architecture\r\nVerified ownership → src/main.mjs\r\n",analysis="Another active task\n";
 await writeFile(path.join(root,"agentic/architecture.md"),architecture);await writeFile(path.join(root,"agentic/analysis.md"),analysis);
 await updateBridgecode({project:root,packageRoot:await simulatedPackage(t)});
 assert.equal(await readFile(path.join(root,"agentic/architecture.md"),"utf8"),architecture);
 assert.equal(await readFile(path.join(root,"agentic/analysis.md"),"utf8"),analysis);
});
test("hook configuration preserves unrelated hooks and supports disabling",async t=>{
 const root=await fixture(t);await mkdir(path.join(root,".codex"));
 const custom={hooks:[{type:"command",command:"echo custom"}]};
 await writeFile(path.join(root,".codex/hooks.json"),JSON.stringify({customKey:true,hooks:{UserPromptSubmit:[custom]}}));
 await installBridgecode(options(root));
 let c=JSON.parse(await readFile(path.join(root,".codex/hooks.json")));
 assert.deepEqual(c.hooks.UserPromptSubmit[0],custom);assert.equal(c.customKey,true);
 await updateBridgecode({...options(root),hooks:false});
 c=JSON.parse(await readFile(path.join(root,".codex/hooks.json")));
 assert.deepEqual(c.hooks.UserPromptSubmit,[custom]);
 assert.equal((await inspectInstallation(options(root))).ok,true);
});
for(const existingMemory of [false,true])test("4.3.0 rule transfer: dry-run, rollback, ordering, hooks and idempotence; existing memory="+existingMemory,async t=>{
 const root=await fixture(t),oldPackage=await package430(t);
 await installBridgecode({project:root,packageRoot:oldPackage,instructionFiles:"both"});
 const original=await readFile(path.join(root,"AGENTS.md"),"utf8");
 const prefix="# Local instructions\r\nKeep this prefix.  \r\n",suffix="\n## Other instructions\nKeep this suffix.\n";
 const rules="- Preserve café → 東京.\r\n- Unresolved: enforce boundary X.\n";
 await writeFile(path.join(root,"AGENTS.md"),prefix+original+pendingRulesBlock(rules)+suffix);
 const architecture="# Existing architecture\r\nVerified map remains.  \r\n";
 if(existingMemory){await mkdir(path.join(root,"agentic"));await writeFile(path.join(root,"agentic/architecture.md"),architecture);}
 const before=await snapshot(root);
 const dry=await updateBridgecode({...options(root),dryRun:true});
 assert.ok(dry.changes.some(c=>c.path==="agentic/architecture.md"));assert.deepEqual(await snapshot(root),before);
 await assert.rejects(updateBridgecode({...options(root),transactionFailAfterWrites:2}),/rolled back/);
 assert.deepEqual(await snapshot(root),before,"both AGENTS and architecture restored");
 const result=await updateBridgecode(options(root));assert.equal(result.migrationPending,true);
 const agents=await readFile(path.join(root,"AGENTS.md"),"utf8"),memory=await readFile(path.join(root,"agentic/architecture.md"),"utf8");
 assert.equal(parseManagedAgents(agents).start,0);assert.equal(parseRules(agents),null);
 assert.ok(agents.includes(prefix)&&agents.includes(suffix));assert.ok(agents.indexOf(prefix)<agents.indexOf(suffix));
 assert.ok(!agents.includes("memory migration is incomplete"));
 assert.ok(memory.includes(rules));assert.match(memory,/remain binding.*implementation status is unverified/s);
 if(existingMemory)assert.ok(memory.startsWith(architecture));
 const after=await snapshot(root);assert.equal((await updateBridgecode(options(root))).changes.length,0);assert.deepEqual(await snapshot(root),after);
 assert.equal((await inspectInstallation(options(root))).ok,true);
});
test("plain repo-rule sections migrate while unrelated blocks and fenced examples remain",async t=>{
 const root=await fixture(t);
 const before="# Local\nKeep.\n\n~~~md\n## Repo rules\nExample only.\n~~~\n";
 const rules="## Repo rules\n- Real constraint.\n### Detail\nKeep details.\n";
 const after="## Deployment\nKeep deployment.\n";
 await writeFile(path.join(root,"AGENTS.md"),before+rules+after);
 await installBridgecode(options(root));
 const agents=await readFile(path.join(root,"AGENTS.md"),"utf8"),memory=await readFile(path.join(root,"agentic/architecture.md"),"utf8");
 assert.ok(agents.includes(before)&&agents.includes(after));assert.ok(!agents.includes("Real constraint"));
 assert.ok(memory.includes(rules));assert.ok(!memory.includes("Example only"));
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
});
test("unmarked canonical 4.3 core with surrounding instructions upgrades safely",async t=>{
 const root=await fixture(t),old=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"legacy/4.3.0.json"),"utf8"));
 for(const [p,s]of Object.entries(old.files)){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);}
 const prefix="# Local prefix\r\nKeep first.\r\n",suffix="\n## Repo rules\n- Keep data safe.\n## Custom\nKeep last.\n";
 await writeFile(path.join(root,"AGENTS.md"),prefix+old.files["AGENTS.md"].replaceAll("\r\n","\n").replaceAll("\n","\r\n")+suffix);
 await updateBridgecode(options(root));
 const agents=await readFile(path.join(root,"AGENTS.md"),"utf8");
 assert.equal(parseManagedAgents(agents).start,0);assert.ok(agents.includes(prefix));assert.ok(agents.includes("## Custom\nKeep last."));
 assert.ok((await readFile(path.join(root,"agentic/architecture.md"),"utf8")).includes("- Keep data safe."));
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
});
test("unmarked 4.1 preserves legacy plus external rules and peer sections through dry-run, rollback and update",async t=>{
 const root=await fixture(t),files=await legacyFiles();
 const rules="- Preserve repository behavior.\r\n~~~md\n## Example heading\n~~~\n### Rule detail\nKeep detail.\n";
 const outside="## Deployment\r\nKeep deployment.  \r\n\n# Team\nKeep team guidance.\n";
 const externalRule="- Separate marked constraint B.\r\n";
 const external="<!-- bridgecode:repo-rules:start -->\n"+externalRule+"\n<!-- bridgecode:repo-rules:end -->";
 await writeFile(path.join(root,"AGENTS.md"),splitCanonicalAgents(files["AGENTS.md"]).prefix+rules+"\n"+outside.replace("\n# Team",external+"\n# Team"));
 const before=await snapshot(root);
 await updateBridgecode({...options(root),dryRun:true});assert.deepEqual(await snapshot(root),before);
 await assert.rejects(updateBridgecode({...options(root),transactionFailAfterWrites:2}),/rolled back/);assert.deepEqual(await snapshot(root),before);
 await updateBridgecode(options(root));
 const agents=await readFile(path.join(root,"AGENTS.md"),"utf8"),memory=await readFile(path.join(root,"agentic/architecture.md"),"utf8");
 assert.ok(agents.endsWith(outside));assert.equal(parseManagedAgents(agents).start,0);
 assert.ok(memory.includes(rules));assert.ok(!memory.includes("Keep deployment"));
 assert.ok(memory.includes(externalRule));assert.equal(parseRules(agents),null);
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
});
test("fresh install transfers external rule markers immediately and update is a no-op",async t=>{
 const root=await fixture(t),rules="- Constraint before any Bridgecode core.\r\n";
 const before="# Before\nKeep before.\n",after="\n## After\nKeep after.\n";
 const markers="<!-- bridgecode:repo-rules:start -->\n"+rules+"\n<!-- bridgecode:repo-rules:end -->";
 await writeFile(path.join(root,"AGENTS.md"),before+markers+after);
 await installBridgecode(options(root));
 const agents=await readFile(path.join(root,"AGENTS.md"),"utf8"),memory=await readFile(path.join(root,"agentic/architecture.md"),"utf8");
 assert.equal(parseRules(agents),null);assert.ok(agents.includes(before+after));assert.ok(memory.includes(rules));
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
});
