import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { installBridgecode } from "../src/install.mjs";
import { EDITIONS } from "../src/manifest.mjs";
import { fixture, PACKAGE_ROOT } from "./helpers.mjs";

const crossed=["test volume 95% of production LOC (> 90%): run the prune pass toward 30% at the next CONSOLIDATE","agentic/architecture.md ~31000 tokens (> 30k): distill toward 9k at the next CONDENSE"];
const alerts=["agentic/spec.md ~20000 tokens (alert band 18k-30k): one line per entry, remove before adding"];
const git=(root,...args)=>{const r=spawnSync("git",["-c","user.name=t","-c","user.email=t@localhost",...args],{cwd:root,encoding:"utf8"});assert.equal(r.status,0,r.stderr);return r.stdout;};
for(const [edition,extensions] of [["codex",[]],["codex",["cloop:high","cheapgpt:cheap-100"]],["claude",["cheapgpt:cheap","cloop:town"]],["exp",["cloop:high","cheapgpt:cheap"]]])
test(`${edition} hook with ${extensions.length?extensions.join("+"):"no extension"}: reminder, the active task's status line, the prompt recorded, compact recovery and fallback`,async t=>{
 const root=await fixture(t);await installBridgecode({project:root,packageRoot:PACKAGE_ROOT,edition,extensions});
 const script=path.join(root,EDITIONS[edition].hookPath);
 const run=e=>{const r=spawnSync(process.execPath,[script],{input:JSON.stringify({cwd:root,...e}),encoding:"utf8",cwd:root});assert.equal(r.status,0);return r.stdout?JSON.parse(r.stdout):null;};
 const plain=run({hook_event_name:"UserPromptSubmit",prompt:"hello"}).hookSpecificOutput.additionalContext;
 assert.ok(!plain.includes("Active task:"),"no task, no status line");
 await mkdir(path.join(root,".bridgecode"),{recursive:true});await writeFile(path.join(root,".bridgecode/metrics.json"),JSON.stringify({crossed,alerts}));
 // An active FOCUSED task: the hook prints its status line and records the user's words in its log.
 await writeFile(path.join(root,"app.txt"),"v1\n");git(root,"init","-q");git(root,"add","app.txt");git(root,"commit","-q","-m","base");
 const init=spawnSync(process.execPath,[".bridgecode/engine/engine.mjs","init","FOCUSED","demo","a demo task"],{cwd:root,encoding:"utf8"});assert.equal(init.status,0,init.stdout+init.stderr);
 const heart=run({hook_event_name:"UserPromptSubmit",prompt:"yes, keep the CSV format"}).hookSpecificOutput;
 assert.equal(heart.hookEventName,"UserPromptSubmit");
 assert.ok(heart.additionalContext.length<=2000,`${heart.additionalContext.length} characters`);
 for(const anchor of ["BRIDGECODE: <DIRECT|ASSESS|FOCUSED|FULL>","node .bridgecode/engine/engine.mjs","never route around it","never edit agentic/tasks/ by hand"])assert.ok(heart.additionalContext.includes(anchor),anchor);
 assert.match(heart.additionalContext,/Active task: BRIDGECODE demo: FOCUSED · (ADOPT|DEFINE) .*cards: /);
 const log=(await readFile(path.join(root,"agentic/tasks/demo/log.jsonl"),"utf8")).trim().split("\n").map(l=>JSON.parse(l));
 assert.ok(log.some(l=>l.ev==="prompt"&&l.text==="yes, keep the CSV format"&&l.digest),"the prompt is in the task's log");
 const state=JSON.parse(await readFile(path.join(root,".bridgecode/installation.json"),"utf8"));
 for(const e of state.extensions)assert.ok(heart.additionalContext.includes(e.turnLine),e.id);
 // Over the bound, alert details go first and crossing details second; base, task and extension lines always stay.
 for(const c of crossed)assert.ok(heart.additionalContext.includes("Budget crossed: "+c),c);
 if(heart.additionalContext.includes("Budget alerts: 1;"))assert.ok(!heart.additionalContext.includes("Budget alert: "));
 else assert.ok(heart.additionalContext.includes("Budget alert: "+alerts[0]));
 const compact=run({hook_event_name:"SessionStart",source:"compact"}).hookSpecificOutput.additionalContext;
 if(edition==="codex")assert.match(compact,/BRIDGECODE RECOVERY[\s\S]*## FLOW[\s\S]*END_SIGNALS/);
 else assert.ok(!compact.includes("BRIDGECODE RECOVERY"),"Claude Code re-reads CLAUDE.md; compaction gets only the reminder");
 assert.equal(run({hook_event_name:"SessionStart",source:"startup"}),null);
 assert.equal(run({hook_event_name:"Stop"}),null);
 const p=path.join(root,EDITIONS[edition].instruction);await writeFile(p,(await readFile(p,"utf8")).replace("## LAWS","## Altered"));
 assert.match(run({hook_event_name:"UserPromptSubmit"}).systemMessage,/integrity mismatch/);
});
