import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { execFileSync } from "node:child_process";
import { PACKAGE_ROOT, MANAGED_PATHS } from "./helpers.mjs";
test("source and package instructions are byte-identical",async t=>{
 try { await access(path.join(PACKAGE_ROOT,"../codex_condensation")); } catch(e) { if(e.code!=="ENOENT")throw e; t.skip("Standalone package checkout: source synchronization runs in the authoring workspace");return; }
 for(const p of MANAGED_PATHS)assert.deepEqual(await readFile(path.join(PACKAGE_ROOT,p)),await readFile(path.join(PACKAGE_ROOT,"../codex_condensation",p)),p);
});
test("policy contract anchors remain present (static checks, not behavioral certification)",async()=>{
 const core=await readFile(path.join(PACKAGE_ROOT,"AGENTS.md"),"utf8");
 for(const fragment of ["Person","Core","Magnum Opus","distinct responsibility","request_user_input_async","dependent actions wait","second REPLAN","when the cause is structural","Never discard an unmapped rule","same active model and reasoning effort","no inherited conversation"])
 assert.ok(core.includes(fragment),fragment);
 assert.doesNotMatch(core,/ROBUST.*always stop/i);
 for(const name of ["best-agent","taste","design","writing","copywriting","monoprompting"])assert.ok(core.includes("bridgecode/"+name+".md"));
 const design=await readFile(path.join(PACKAGE_ROOT,"bridgecode/design.md"),"utf8");
 assert.match(design,/three/i);assert.match(design,/Taste|taste/);
});
test("publish workflow resolves the exact artifact version without publishing",async()=>{
 const workflow=await readFile(path.join(PACKAGE_ROOT,".github/workflows/publish.yml"),"utf8");
 const expression=/node -p '([^']+)'/.exec(workflow)?.[1];
 assert.ok(expression,"Expected exact artifact version expression");
 const actual=execFileSync(process.execPath,["-p",expression],{cwd:PACKAGE_ROOT,encoding:"utf8"}).trim();
 const pkg=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"package.json"),"utf8"));
 assert.equal(actual,pkg.version);
 assert.ok(workflow.includes("npm run test:release -- --output release"));
 assert.ok(workflow.includes('npm publish "./release/bridgecode-cli-'));
 assert.ok(workflow.includes("GITHUB_REF_NAME"));
});
test("entry and task-board lifecycle have explicit policy gates (static, not model execution)",async()=>{
 const core=await readFile(path.join(PACKAGE_ROOT,"AGENTS.md"),"utf8");
 for(const anchor of ["Start the first public response with","BRIDGECODE_ROUTE: ROBUST","BRIDGECODE_ROUTE: LEAN / PATCH|DEBUG|ASSESS","Before task-directed research, questions, implementation, or deliverables","its first content block applies all three Best-Agent moves","Revalidate all three moves on follow-ups","Read-only/no-file-write requests","Disclose unavailable storage","delete analysis.md when no active work remains","Do not append turn logs","retain unresolved requirements there"])
 assert.ok(core.includes(anchor),anchor);
 assert.ok(core.indexOf("**Every-turn entry gate.**")<core.indexOf("**Research.**"));
 assert.doesNotMatch(core,/Before major action|full stage accounting when requested|Legacy rules temporarily retained/);
 const specialist=await readFile(path.join(PACKAGE_ROOT,"bridgecode/best-agent.md"),"utf8");
 assert.ok(specialist.includes("Follow AGENTS.md's every-turn entry gate"));
 assert.ok(specialist.includes("Revalidate the diagnostic every turn"));
});
