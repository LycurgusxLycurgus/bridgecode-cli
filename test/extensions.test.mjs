import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { cpSync, existsSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { installBridgecode, uninstallBridgecode } from "../src/install.mjs";
import { updateBridgecode } from "../src/update.mjs";
import { inspectInstallation } from "../src/doctor.mjs";
import { run } from "../src/cli.mjs";
import { parseRoles, ROLES } from "../src/extensions.mjs";
import { EXTENSIONS, ROLES_PATH, rolesSource } from "../src/manifest.mjs";
import { fixture, PACKAGE_ROOT, snapshot, EDITION_LIST, read } from "./helpers.mjs";
const options=root=>({project:root,packageRoot:PACKAGE_ROOT});
const PERM="Bash(codex exec:*)";
// The observable installed state: the engine's roles.json, the recorded set and the permission.
async function state(root){
 const s=JSON.parse(await read(root,".bridgecode/installation.json"));
 return {roles:JSON.parse(await read(root,ROLES_PATH)),extensions:s.extensions,permission:s.permission};
}
const owners=roles=>Object.fromEntries(ROLES.map(r=>[r,roles.roles[r]?.[0]?.source??"core"]));

for(const edition of EDITION_LIST)test(edition+": each extension alone and both together give one roles.json whatever the order of adding or removing",async t=>{
 const fresh={};
 for(const set of [["cheapgpt:cheap"],["cloop:town"],["cheapgpt:cheap","cloop:town"]]){
  const root=await fixture(t);await installBridgecode({...options(root),edition,extensions:set});
  fresh[set.join("+")]=await state(root);
  assert.equal((await inspectInstallation(options(root))).ok,true);
  assert.equal((await updateBridgecode(options(root))).changes.length,0,"update keeps the recorded set");
 }
 const both=fresh["cheapgpt:cheap+cloop:town"];
 assert.deepEqual(owners(both.roles),{planner:"cloop-town",reviewer:"cloop-town","loop-breaker":"cloop-town",explorer:"cloop-town","builder-dynamic":"cheapgpt-cheap","builder-mechanical":"cheapgpt-cheap"});
 assert.deepEqual(owners(fresh["cheapgpt:cheap"].roles),{planner:"cheapgpt-cheap",reviewer:"cheapgpt-cheap","loop-breaker":"cheapgpt-cheap",explorer:"core","builder-dynamic":"cheapgpt-cheap","builder-mechanical":"cheapgpt-cheap"});
 assert.equal(owners(fresh["cloop:town"].roles)["builder-dynamic"],"core");
 assert.equal(both.roles.roles.reviewer.length,2,"the council judges with two instances");
 assert.equal(both.roles.edition,edition);
 for(const [first,second] of [["cheapgpt:cheap","cloop:town"],["cloop:town","cheapgpt:cheap"]]){
  const root=await fixture(t);await installBridgecode({...options(root),edition,extensions:[first]});
  await updateBridgecode({...options(root),extensions:[first,second]});
  assert.deepEqual(await state(root),both,"added "+first+" then "+second);
  await updateBridgecode({...options(root),extensions:[second]});
  assert.deepEqual(await state(root),fresh[second],"removed "+first);
  assert.equal((await inspectInstallation(options(root))).ok,true);
 }
 const root=await fixture(t);await installBridgecode({...options(root),edition,extensions:["cloop:town","cheapgpt:cheap"]});
 await updateBridgecode({...options(root),noExtensions:true});
 const none=await state(root);
 assert.deepEqual(none.roles,{edition,extensions:[],roles:{}});assert.deepEqual(none.extensions,[]);
});
test("the shipped roles data: required claims disjoint in every edition, the root never claimed, a source commit and a turn line each",async()=>{
 for(const edition of EDITION_LIST){
  const required={};
  for(const id of EXTENSIONS){
   const parsed=parseRoles(await readFile(path.join(PACKAGE_ROOT,rolesSource(id)),"utf8"),edition,id);
   for(const r of parsed.rows.filter(r=>r.claim==="required"))(required[r.role]??=new Set()).add(id.split("-")[0]);
   assert.ok(!parsed.rows.some(r=>r.role==="root"),"the root is never claimed");
   assert.match(parsed.source.commit,/^[0-9a-f]{40}$/);
   assert.ok(parsed.turnLine.length<=300);
   assert.doesNotMatch(parsed.turnLine,/\b(PASS|ADVANCED|STALLED|BLOCKED|REGRESSION|CavePrompt)\b/,"roles data holds no rules");
  }
  for(const [role,o]of Object.entries(required))assert.equal(o.size,1,`${edition}: ${role} required by ${[...o]}`);
 }
});
test("roles.json is outside the owned set: editing it never fails doctor, and uninstall removes it",async t=>{
 const root=await fixture(t);await installBridgecode({...options(root),edition:"claude",extensions:["cloop:high"]});
 await writeFile(path.join(root,ROLES_PATH),"{}\n");
 assert.equal((await inspectInstallation(options(root))).ok,true);
 await uninstallBridgecode(options(root));
 assert.ok(!Object.keys(await snapshot(root)).some(p=>p.startsWith(".bridgecode/engine/")),"no engine file is left");
});
test("exp: the shared codex exec permission is removed only when Bridgecode added it and nothing needs it",async t=>{
 const root=await fixture(t);await installBridgecode({...options(root),edition:"exp",extensions:["cloop:town","cheapgpt:cheap"]});
 const allow=async()=>JSON.parse(await read(root,".claude/settings.json")).permissions?.allow??[];
 assert.deepEqual(await allow(),[PERM]);
 await updateBridgecode({...options(root),extensions:["cloop:town"]});
 assert.deepEqual(await allow(),[PERM],"cLoop still needs it");
 await updateBridgecode({...options(root),noExtensions:true});
 assert.deepEqual(await allow(),[],"added by Bridgecode and no longer needed");
 assert.equal((await inspectInstallation(options(root))).ok,true);
 const own=await fixture(t);await mkdir(path.join(own,".claude"));
 await writeFile(path.join(own,".claude/settings.json"),JSON.stringify({permissions:{allow:[PERM]}}));
 await installBridgecode({...options(own),edition:"exp",extensions:["cheapgpt:cheap-100"]});
 assert.equal(JSON.parse(await read(own,".bridgecode/installation.json")).permission.added,false,"found, not added");
 await uninstallBridgecode(options(own));
 assert.deepEqual(JSON.parse(await read(own,".claude/settings.json")),{permissions:{allow:[PERM]}},"a pre-existing permission survives uninstall");
});
// Standalones: fixtures are each standalone's real install output (test/fixtures/standalones/README.md).
const FIXTURES=path.join(PACKAGE_ROOT,"test/fixtures/standalones");
async function standalone(t,names){
 const root=await fixture(t);
 for(const n of names)cpSync(path.join(FIXTURES,n),root,{recursive:true});
 const put=async(p,s)=>{await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);};
 // the user's own content around the standalones: memory, task records, a hook and permission of their own
 await put("agentic/rubric.md","# Rubric\n");await put("agentic/tasks/t1/board.md","task\n");
 for(const f of ["AGENTS.md","CLAUDE.md"])if(existsSync(path.join(root,f)))await writeFile(path.join(root,f),await readFile(path.join(root,f),"utf8")+"\n## Later\n\nadded after the install\n");
 await put("cheapgpt/board.md","cheapGPT task record\n");await put("cloop/log.jsonl","{}\n");
 if(names.includes("cloop")){const p=path.join(root,".claude/settings.json"),c=JSON.parse(await readFile(p,"utf8"));
  c.hooks.UserPromptSubmit.push({hooks:[{type:"command",command:"node mine.mjs",statusMessage:"mine"}]});await writeFile(p,JSON.stringify(c,null,2)+"\n");}
 return root;
}
// What each standalone's own uninstaller leaves behind, from the fixtures: the user's text, key, hook and permission.
const LEFT={
 cheapgpt:{"AGENTS.md":"# My project\n\nuser text\n\n## Later\n\nadded after the install\n",".codex/config.toml":'model = "x"\n'},
 cloop:{"CLAUDE.md":"# Mine\n\n## Later\n\nadded after the install\n",".claude/settings.json":JSON.stringify({permissions:{allow:["Bash(ls:*)"]},hooks:{UserPromptSubmit:[{hooks:[{type:"command",command:"node mine.mjs",statusMessage:"mine"}]}]}},null,2)+"\n"},
};
const OWNED=/^(\.cheapgpt\/|\.cloop\/|\.codex\/hooks\/cheapgpt-turn\.mjs$|\.claude\/hooks\/cloop-turn\.mjs$|\.codex\/hooks\.json$)/;
for(const names of [["cheapgpt"],["cloop"],["cheapgpt","cloop"]])test(`standalone ${names.join(" + ")}: install prints the exact removal plan and exits 2 without writing; with --replace-standalones it removes exactly that, verifies, writes nothing of Bridgecode; a re-run installs cleanly`,async t=>{
 const root=await standalone(t,names),before=await snapshot(root);
 const plan=await run(["install","--project",root]);
 assert.equal(plan.code,2);assert.deepEqual(await snapshot(root),before,"the plan changes nothing");
 assert.match(plan.output,/--replace-standalones/);
 for(const n of names){const profile=n==="cheapgpt"?"cheap-100":"town";
  assert.match(plan.output,new RegExp(`${n} \\(${profile}\\)`));assert.match(plan.output,new RegExp(`--extension ${n}:[a-z0-9|-]+ \\(${profile} suggested\\)`));}
 for(const p of Object.keys(before).filter(p=>OWNED.test(p)&&!p.includes("/cards/")))assert.match(plan.output,new RegExp(`(remove|edit) ${p.replace(/\./g,"\\.")}:`),`the plan names ${p}`);
 const dry=await installBridgecode({...options(root),replaceStandalones:true,dryRun:true});
 assert.equal(dry.verified,false);assert.deepEqual(await snapshot(root),before,"a dry run changes nothing");

 const done=await run(["install","--project",root,"--replace-standalones"]);
 assert.equal(done.code,0);
 assert.match(done.output,new RegExp(`^${names.map(n=>`Removed standalone ${n} \\((cheap-100|town)\\)\\.`).join(" ")} Choose the extension and re-run: bridgecode install --project .+ --edition codex\\|claude\\|exp --extension`));
 const after=await snapshot(root),left=Object.assign({},...names.map(n=>LEFT[n]));
 // nothing else removed or changed: every path is either the standalone's (gone), an edited instruction/config (exact text), or untouched
 for(const [p,h] of Object.entries(before)){
  if(Object.hasOwn(left,p))assert.equal(await read(root,p),left[p],`${p} keeps exactly the user's content`);
  else if(OWNED.test(p))assert.equal(after[p],undefined,`${p} is removed`);
  else assert.equal(after[p],h,`${p} is untouched`);
 }
 assert.deepEqual(Object.keys(after).sort(),Object.keys(before).filter(p=>!OWNED.test(p)).sort(),"no file added, none of the user's removed");
 for(const d of [".cheapgpt",".cloop"])assert.equal(existsSync(path.join(root,d)),false);
 assert.equal(existsSync(path.join(root,".bridgecode")),false,"nothing of Bridgecode is written");

 const ext=names.map(n=>n==="cheapgpt"?"cheapgpt:cheap-100":"cloop:town");
 const installed=await installBridgecode({...options(root),edition:names.includes("cloop")?"claude":"codex",extensions:ext});
 assert.equal(installed.verified,true);
 const report=await inspectInstallation(options(root));
 assert.equal(report.ok,true);assert.ok(!report.warnings.some(w=>w.startsWith("Two orchestrators")));
 await assert.rejects(installBridgecode({...options(root),replaceStandalones:true}),/No standalone cheapGPT or cLoop is installed here; run bridgecode install without --replace-standalones/);
});
test("standalone over an installed Bridgecode: update stops with the plan, doctor names --replace-standalones, and the codex permission Bridgecode records is kept",async t=>{
 const root=await fixture(t);await installBridgecode({...options(root),edition:"exp",extensions:["cloop:town"]});
 assert.equal(JSON.parse(await read(root,".bridgecode/installation.json")).permission.added,true);
 cpSync(path.join(FIXTURES,"cloop/.cloop"),path.join(root,".cloop"),{recursive:true});
 const state=await snapshot(root),stopped=await updateBridgecode(options(root));
 assert.equal(stopped.stopped,"standalones");assert.deepEqual(await snapshot(root),state);
 const report=await inspectInstallation(options(root));
 assert.ok(report.warnings.some(w=>w.startsWith("Two orchestrators")&&w.includes("--replace-standalones")&&w.includes("--extension cloop:town")));
 await installBridgecode({...options(root),replaceStandalones:true});
 assert.ok(JSON.parse(await read(root,".claude/settings.json")).permissions.allow.includes(PERM),"Bridgecode's permission stays");
 assert.equal((await inspectInstallation(options(root))).ok,true);
});
test("standalone removal refuses, changing nothing, when its folder holds files it does not install or its markers are malformed",async t=>{
 const root=await standalone(t,["cheapgpt"]);await writeFile(path.join(root,".cheapgpt/notes.md"),"mine\n");
 const before=await snapshot(root);
 await assert.rejects(installBridgecode({...options(root),replaceStandalones:true}),/\.cheapgpt\/ holds files cheapgpt does not install \(\.cheapgpt\/notes\.md\).*move them out of \.cheapgpt\/, then re-run bridgecode install --replace-standalones/);
 assert.deepEqual(await snapshot(root),before);
 const broken=await standalone(t,["cloop"]);await writeFile(path.join(broken,"CLAUDE.md"),"# Mine\n<!-- cloop:managed:start -->\nActive profile: `town`\n");
 const b=await snapshot(broken);
 await assert.rejects(installBridgecode({...options(broken),replaceStandalones:true}),/CLAUDE\.md holds malformed cloop markers.*re-run bridgecode install --replace-standalones/);
 assert.deepEqual(await snapshot(broken),b);
});
