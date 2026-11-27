import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inspectInstallation } from "../src/doctor.mjs";
import { installBridgecode, uninstallBridgecode, formatLifecycleSummary } from "../src/install.mjs";
import { parseManagedAgents, buildLegacyAgents, splitCanonicalAgents, pendingRulesBlock, parseRules } from "../src/repo-rules.mjs";
import { sha256, payloadMap } from "../src/manifest.mjs";
import { updateBridgecode } from "../src/update.mjs";
import { fixture, PACKAGE_ROOT, simulatedPackage, snapshot, legacyFiles, legacyInstall, EDITION_LIST, read } from "./helpers.mjs";
const options=root=>({project:root,packageRoot:PACKAGE_ROOT});

for(const edition of EDITION_LIST)test(edition+": install, doctor, true no-op update and projected dry-run",async t=>{
 const root=await fixture(t);const before=await snapshot(root);
 const dry=await installBridgecode({...options(root),edition,dryRun:true});
 assert.ok(dry.changes.length);assert.deepEqual(await snapshot(root),before);
 assert.equal((await installBridgecode({...options(root),edition})).verified,true);
 if(edition!=="codex")assert.equal((await snapshot(root))["AGENTS.md"],undefined,"claude editions never write AGENTS.md");
 const installed=await snapshot(root);
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
 assert.deepEqual(await snapshot(root),installed);
 assert.equal((await inspectInstallation(options(root))).ok,true);
});
for(const edition of EDITION_LIST)test(edition+": 4.3.2 to 4.6 preserves memory and unrelated content; dry-run, rollback and uninstall leave bytes intact",async t=>{
 const root=await fixture(t);await legacyInstall(root,"4.3.2",{bootstraps:edition==="codex"?["CLAUDE.md"]:[]});
 const suffix="\n## Team notes\nKeep these bytes.  \r\n";
 await writeFile(path.join(root,"AGENTS.md"),(await read(root,"AGENTS.md"))+suffix);
 await mkdir(path.join(root,"agentic"));
 const memory={"agentic/architecture.md":"# Architecture\r\nVerified map → src/main.mjs\r\n","agentic/rubric.md":"TOKENS_USED: ~1\n## Goals\n","agentic/analysis.md":"Paused task\n"};
 for(const [p,s]of Object.entries(memory))await writeFile(path.join(root,p),s);
 const before=await snapshot(root);
 if(edition==="codex"){
  await updateBridgecode({...options(root),dryRun:true});assert.deepEqual(await snapshot(root),before);
  await assert.rejects(updateBridgecode({...options(root),transactionFailAfterWrites:3}),/rolled back/);assert.deepEqual(await snapshot(root),before);
  assert.match(formatLifecycleSummary(await updateBridgecode(options(root))),/run the Bridgecode adoption task/);
  assert.equal((await updateBridgecode(options(root))).adoption,false,"no adoption line from a 4.6 installation");
  assert.ok((await read(root,"AGENTS.md")).endsWith(suffix));
  assert.equal(parseManagedAgents(await read(root,"AGENTS.md")).version,"4.6.0");
  assert.equal(await read(root,"CLAUDE.md").catch(()=>null),null,"the 4.3 bootstrap is retired");
 }else{
  for(const fn of [installBridgecode,updateBridgecode])await assert.rejects(fn({...options(root),edition}),/uninstall/);
  assert.deepEqual(await snapshot(root),before,"an edition change is refused before writes");
  await uninstallBridgecode({...options(root),dryRun:true});assert.deepEqual(await snapshot(root),before);
  await assert.rejects(uninstallBridgecode({...options(root),transactionFailAfterWrites:2}),/rolled back/);assert.deepEqual(await snapshot(root),before);
  await uninstallBridgecode(options(root));
  assert.equal(await read(root,"AGENTS.md"),suffix,"only the managed core leaves AGENTS.md");
  await installBridgecode({...options(root),edition});
  assert.equal(parseManagedAgents(await read(root,"CLAUDE.md")).version,"4.6.0");
  assert.ok(!(await read(root,"AGENTS.md")).includes("bridgecode:"));
 }
 for(const [p,s]of Object.entries(memory))assert.equal(await read(root,p),s,p);
 assert.equal((await inspectInstallation(options(root))).ok,true);
 const after=await snapshot(root);assert.equal((await updateBridgecode(options(root))).changes.length,0);assert.deepEqual(await snapshot(root),after);
});
test("caches, reports, config and agentic/ are outside the owned set",async t=>{
 const root=await fixture(t);await installBridgecode(options(root));
 const extra={".bridgecode/metrics.json":"{\"crossed\":[]}\n",".bridgecode/config.json":"{}\n",".bridgecode/reports/2026-11-17-x.md":"report\n","agentic/rubric.md":"TOKENS_USED: ~1\n","agentic/default-styles.md":"## m · writing\nuncalibrated\n","agentic/tasks/demo/state.json":"{}\n"};
 for(const [p,s]of Object.entries(extra)){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);}
 assert.equal((await inspectInstallation(options(root))).ok,true);
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
 await uninstallBridgecode(options(root));
 for(const [p,s]of Object.entries(extra))assert.equal(await read(root,p),s,p);
 assert.deepEqual(Object.keys(await snapshot(root)).sort(),Object.keys(extra).sort(),"uninstall removes exactly what Bridgecode created");
});
test("uninstall restores a project that had its own instructions and hooks",async t=>{
 const root=await fixture(t),text="# Mine\r\nKeep π.\r\n",settings={model:"x",env:{A:"1"},hooks:{UserPromptSubmit:[{hooks:[{type:"command",command:"echo mine"}]}]},permissions:{allow:["Bash(npm test:*)"]}};
 await writeFile(path.join(root,"CLAUDE.md"),text);await mkdir(path.join(root,".claude"));await writeFile(path.join(root,".claude/settings.json"),JSON.stringify(settings));
 const before=await snapshot(root);
 await installBridgecode({...options(root),edition:"exp",extensions:["cloop:high"]});
 const merged=JSON.parse(await read(root,".claude/settings.json"));
 assert.deepEqual([merged.model,merged.env,merged.hooks.UserPromptSubmit[0]],[settings.model,settings.env,settings.hooks.UserPromptSubmit[0]]);
 assert.deepEqual(merged.permissions.allow,["Bash(npm test:*)","Bash(codex exec:*)"]);assert.equal(merged.hooks.SessionStart[0].matcher,"compact");
 assert.ok((await read(root,"CLAUDE.md")).endsWith(text));
 await uninstallBridgecode(options(root));
 assert.equal(await read(root,"CLAUDE.md"),text);
 assert.deepEqual(JSON.parse(await read(root,".claude/settings.json")),settings);
 assert.deepEqual(Object.keys(await snapshot(root)).sort(),Object.keys(before).sort());
});
test("current unmarked source adopts without pending rules",async t=>{
 const root=await fixture(t);
 for(const [target,source]of Object.entries({...payloadMap("codex"),"AGENTS.md":"editions/codex/AGENTS.md"})){await mkdir(path.dirname(path.join(root,target)),{recursive:true});await writeFile(path.join(root,target),await readFile(path.join(PACKAGE_ROOT,source)));}
 const out=await installBridgecode(options(root));assert.equal(out.migrationPending,false);assert.equal(out.agentsMode,"adopt current source");
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
 let parsed=parseManagedAgents(await read(root,"AGENTS.md"));
 assert.equal(parsed.rules,"");assert.equal(parsed.schema,2);
 const memory=await read(root,"agentic/architecture.md");
 assert.ok(memory.includes(rules));assert.match(memory,/remain binding/);
 assert.equal((await snapshot(root))["bridgecode/general-functions.md"],undefined);
 const pkg=await simulatedPackage(t);
 await updateBridgecode({project:root,packageRoot:pkg});
 parsed=parseManagedAgents(await read(root,"AGENTS.md"));
 assert.equal(parsed.rules,"");assert.equal(parsed.version,"4.6.1");
 assert.equal(await read(root,"agentic/architecture.md"),memory);
 // Reconciliation is repository-owned: deleting one resolved rule does not invalidate the core.
 await writeFile(path.join(root,"agentic/architecture.md"),memory.replace(rules,"- Remaining unresolved rule"));
 assert.equal((await inspectInstallation({project:root,packageRoot:pkg})).ok,true);
});
for(const edition of EDITION_LIST)test(edition+": next-release failure restores all original bytes",async t=>{
 const root=await fixture(t);await installBridgecode({...options(root),edition,extensions:edition==="codex"?[]:["cloop:town"]});const before=await snapshot(root);
 const pkg=await simulatedPackage(t);
 await assert.rejects(updateBridgecode({project:root,packageRoot:pkg,transactionFailAfterWrites:2}),/rolled back.*Simulated interruption/s);
 assert.deepEqual(await snapshot(root),before);
 await updateBridgecode({project:root,packageRoot:pkg});
 assert.equal((await inspectInstallation({project:root,packageRoot:pkg})).ok,true);
});
test("hook configuration preserves unrelated hooks and supports disabling",async t=>{
 const root=await fixture(t);await mkdir(path.join(root,".codex"));
 const custom={hooks:[{type:"command",command:"echo custom"}]};
 await writeFile(path.join(root,".codex/hooks.json"),JSON.stringify({customKey:true,hooks:{UserPromptSubmit:[custom]}}));
 await installBridgecode(options(root));
 let c=JSON.parse(await read(root,".codex/hooks.json"));
 assert.deepEqual(c.hooks.UserPromptSubmit[0],custom);assert.equal(c.customKey,true);
 await updateBridgecode({...options(root),hooks:false});
 c=JSON.parse(await read(root,".codex/hooks.json"));
 assert.deepEqual(c.hooks.UserPromptSubmit,[custom]);
 assert.equal((await inspectInstallation(options(root))).ok,true);
});
for(const previousVersion of ["4.3.0","4.3.1","4.3.2"])for(const existingMemory of [false,true])test(previousVersion+" rule transfer: dry-run, rollback, ordering, hooks and idempotence; existing memory="+existingMemory,async t=>{
 const root=await fixture(t);await legacyInstall(root,previousVersion,{bootstraps:["CLAUDE.md"]});
 const original=await read(root,"AGENTS.md");
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
 const agents=await read(root,"AGENTS.md"),memory=await read(root,"agentic/architecture.md");
 assert.equal(parseManagedAgents(agents).start,0);assert.equal(parseRules(agents),null);
 assert.ok(agents.includes(prefix)&&agents.includes(suffix));assert.ok(agents.indexOf(prefix)<agents.indexOf(suffix));
 assert.ok(!agents.includes("memory migration is incomplete"));
 assert.ok(memory.includes(rules));assert.match(memory,/remain binding.*implementation status is unverified/s);
 if(existingMemory)assert.ok(memory.startsWith(architecture));
 assert.equal(await read(root,"CLAUDE.md").catch(()=>null),null);
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
 const agents=await read(root,"AGENTS.md"),memory=await read(root,"agentic/architecture.md");
 assert.ok(agents.includes(before)&&agents.includes(after));assert.ok(!agents.includes("Real constraint"));
 assert.ok(memory.includes(rules));assert.ok(!memory.includes("Example only"));
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
});
for(const previousVersion of ["4.3.0","4.3.1","4.3.2"])test("unmarked canonical "+previousVersion+" core with surrounding instructions upgrades safely",async t=>{
 const root=await fixture(t),old=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"legacy/"+previousVersion+".json"),"utf8"));
 for(const [p,s]of Object.entries(old.files)){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);}
 const prefix="# Local prefix\r\nKeep first.\r\n",suffix="\n## Repo rules\n- Keep data safe.\n## Custom\nKeep last.\n";
 await writeFile(path.join(root,"AGENTS.md"),prefix+old.files["AGENTS.md"].replaceAll("\r\n","\n").replaceAll("\n","\r\n")+suffix);
 await updateBridgecode(options(root));
 const agents=await read(root,"AGENTS.md");
 assert.equal(parseManagedAgents(agents).start,0);assert.ok(agents.includes(prefix));assert.ok(agents.includes("## Custom\nKeep last."));
 assert.ok((await read(root,"agentic/architecture.md")).includes("- Keep data safe."));
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
 const agents=await read(root,"AGENTS.md"),memory=await read(root,"agentic/architecture.md");
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
 const agents=await read(root,"AGENTS.md"),memory=await read(root,"agentic/architecture.md");
 assert.equal(parseRules(agents),null);assert.ok(agents.includes(before+after));assert.ok(memory.includes(rules));
 assert.equal((await updateBridgecode(options(root))).changes.length,0);
});
