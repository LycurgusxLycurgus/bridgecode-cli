import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { inspectInstallation } from "../src/doctor.mjs";
import { installBridgecode } from "../src/install.mjs";
import { parseBootstrap } from "../src/instructions.mjs";
import { parseManagedAgents, buildLegacyAgents, splitCanonicalAgents } from "../src/repo-rules.mjs";
import { sha256 } from "../src/manifest.mjs";
import { updateBridgecode } from "../src/update.mjs";
import { fixture, PACKAGE_ROOT, simulatedPackage, snapshot, legacyFiles, MANAGED_PATHS } from "./helpers.mjs";
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
 assert.ok((await readFile(path.join(root,"AGENTS.md"),"utf8")).startsWith(text));
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
 assert.equal(parsed.rules,rules);assert.equal(parsed.schema,2);
 assert.equal((await snapshot(root))["bridgecode/general-functions.md"],undefined);
 const pkg=await simulatedPackage(t);
 await updateBridgecode({project:root,packageRoot:pkg});
 parsed=parseManagedAgents(await readFile(path.join(root,"AGENTS.md"),"utf8"));
 assert.equal(parsed.rules,rules);assert.equal(parsed.version,"4.3.1");
 // Reconciliation is repository-owned: deleting one resolved rule does not invalidate the core.
 const current=await readFile(path.join(root,"AGENTS.md"),"utf8");
 await writeFile(path.join(root,"AGENTS.md"),current.replace(rules,"- Remaining unresolved rule"));
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
