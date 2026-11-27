import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { installBridgecode } from "../src/install.mjs";
import { inspectInstallation } from "../src/doctor.mjs";
import { fixture, PACKAGE_ROOT } from "./helpers.mjs";

const CONFORMING={
 "agentic/rubric.md":"TOKENS_USED: ~120\n## Goals\n### G1 Export\n- G1.C1 | CORE | tags: law | The exporter writes one row per order for orders in the import window, seen in out.csv | scope: imported orders | unsupported: rejected with a reason | evidence: out.csv compared with the import\n## Drop\n## Vetoes\n## Backlog\n",
 "agentic/spec.md":"TOKENS_USED: ~60\n## Intent\nExport orders.\n## Inputs\n## Behaviour\n## Outputs\n## Constraints\n## Directions\n## Open decisions\n",
 "agentic/architecture.md":"TOKENS_USED: ~80\n## Overview\nNode 22.\n## Tree\n## Decisions\n## Vetoes\n## Budgets\n## Harness\n## Unverified rules\n",
};
async function project(t,edition,overrides={}){
 const root=await fixture(t);await installBridgecode({project:root,packageRoot:PACKAGE_ROOT,edition});
 await mkdir(path.join(root,"agentic"));
 for(const [p,s]of Object.entries({...CONFORMING,...overrides}))await writeFile(path.join(root,p),s);
 return inspectInstallation({project:root,packageRoot:PACKAGE_ROOT});
}
const shape=r=>r.warnings.filter(w=>w.startsWith("agentic/")||w.startsWith("AGENTS.md holds"));
test("a conforming memory set passes the shape check",async t=>{
 const r=await project(t,"codex");assert.equal(r.ok,true);assert.deepEqual(shape(r),[]);
});
const cases={
 "an appended section":["agentic/architecture.md",CONFORMING["agentic/architecture.md"]+"## History\n- changed\n",/outside the template History/],
 "a reordered section":["agentic/spec.md",CONFORMING["agentic/spec.md"].replace("## Inputs\n## Behaviour\n","## Behaviour\n## Inputs\n"),/reordered/],
 "a missing token line":["agentic/rubric.md",CONFORMING["agentic/rubric.md"].replace("TOKENS_USED: ~120\n",""),/TOKENS_USED/],
 "a rubric line without its class":["agentic/rubric.md",CONFORMING["agentic/rubric.md"].replace("| CORE | tags","| VITAL | tags"),/CORE\/NON-CORE class/],
 "a rubric line with an unknown tag":["agentic/rubric.md",CONFORMING["agentic/rubric.md"].replace("tags: law","tags: fancy"),/unknown: fancy/],
};
for(const [name,[file,text,pattern]] of Object.entries(cases))test("doctor warns on "+name,async t=>{
 const r=await project(t,"codex",{[file]:text});
 assert.equal(r.ok,true,"shape drift warns; it does not fail integrity");
 assert.equal(shape(r).length,1,shape(r).join("\n"));assert.match(shape(r)[0],pattern);
});
test("doctor warns when hooks are disabled",async t=>{
 const root=await fixture(t);await installBridgecode({project:root,packageRoot:PACKAGE_ROOT,edition:"claude",hooks:false});
 const r=await inspectInstallation({project:root,packageRoot:PACKAGE_ROOT});
 assert.ok(r.warnings.some(w=>/Hooks are disabled/.test(w)),r.warnings.join("\n"));
});
test("doctor warns on a Bridgecode block in AGENTS.md under exp",async t=>{
 const r=await project(t,"exp",{"AGENTS.md":"# Team\n<!-- bridgecode:managed:start version=\"4.3.2\" schema=\"2\" -->\nold core\n<!-- bridgecode:managed:end -->\n"});
 assert.equal(shape(r).length,1);assert.match(shape(r)[0],/AGENTS\.md holds an orchestration block/);
});
