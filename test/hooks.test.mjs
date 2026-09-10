import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { installBridgecode } from "../src/install.mjs";
import { fixture, PACKAGE_ROOT } from "./helpers.mjs";
test("installed hook emits bounded heartbeat, compact recovery, and explicit fallback",async t=>{
 const root=await fixture(t);await installBridgecode({project:root,packageRoot:PACKAGE_ROOT});
 const run=e=>{const r=spawnSync(process.execPath,[path.join(root,".codex/hooks/bridgecode-turn.mjs")],{input:JSON.stringify({cwd:root,...e}),encoding:"utf8",cwd:root});assert.equal(r.status,0);return r.stdout?JSON.parse(r.stdout):null;};
 const heart=run({hook_event_name:"UserPromptSubmit"}).hookSpecificOutput;
 assert.equal(heart.hookEventName,"UserPromptSubmit");assert.ok(heart.additionalContext.length<1000);
 const compact=run({hook_event_name:"SessionStart",source:"compact"}).hookSpecificOutput;
 assert.match(compact.additionalContext,/Operating contract/);assert.match(compact.additionalContext,/REPLAN/);
 assert.equal(run({hook_event_name:"SessionStart",source:"startup"}),null);
 assert.equal(run({hook_event_name:"Stop"}),null);
 const p=path.join(root,"AGENTS.md");await writeFile(p,(await readFile(p,"utf8")).replace("Operating contract","Altered contract"));
 assert.match(run({hook_event_name:"UserPromptSubmit"}).systemMessage,/integrity mismatch/);
});
