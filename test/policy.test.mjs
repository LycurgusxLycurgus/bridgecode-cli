import assert from "node:assert/strict";
import { readFile, access, readdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { execFileSync, spawnSync } from "node:child_process";
import { PACKAGE_ROOT, PAYLOAD_PATHS, EDITION_LIST } from "./helpers.mjs";
import { SPECIALISTS, EDITIONS, CARDS, CORE_CARDS } from "../src/manifest.mjs";
// Static anchors of the policy text: they do not certify model behaviour.
const text=p=>readFile(path.join(PACKAGE_ROOT,p),"utf8");
const generalists=()=>Promise.all(EDITION_LIST.map(e=>text(`editions/${e}/${EDITIONS[e].instruction}`)));
const specialists=async()=>Object.fromEntries(await Promise.all(SPECIALISTS.map(async n=>[n,await text(`bridgecode/${n}.md`)])));
const OUTCOMES=["REGRESSION","PASS","ADVANCED","STALLED","BLOCKED"];
const section=(g,name)=>g.split(`\n## ${name}\n`)[1].split(`END_${name}`)[0];

test("source and package payload are byte-identical",async t=>{
 const source=path.join(PACKAGE_ROOT,"../condensation");
 try{await access(source);}catch(e){if(e.code!=="ENOENT")throw e;t.skip("Standalone package checkout: source synchronization runs in the authoring workspace");return;}
 for(const p of PAYLOAD_PATHS){
  const from=p.startsWith("bridgecode/")||p.startsWith("engine/")?"shared/"+p:p.replace(/^editions\//,"");
  assert.deepEqual(await readFile(path.join(PACKAGE_ROOT,p)),await readFile(path.join(source,from)),p);
 }
});
test("the generalist's structure: front matter, purpose, FLOW, MECHANICS in order, LAWS L1-L10, NOISE_VETO V1-V18, SIGNALS, each closed",async()=>{
 for(const g of await generalists()){
  assert.match(g,/^---\nname: bridgecode\ndescription: .{40,}\nversion: [\d.]+\n---\n\n# Bridgecode\n/);
  assert.deepEqual([...g.matchAll(/^## (.+)$/gm)].map(m=>m[1]),["FLOW","MECHANICS","LAWS","NOISE_VETO","SIGNALS"]);
  for(const s of ["FLOW","MECHANICS","LAWS","NOISE_VETO","SIGNALS"])assert.equal(g.split(`END_${s}`).length,2,s);
  assert.deepEqual([...section(g,"MECHANICS").matchAll(/^### (.+)$/gm)].map(m=>m[1]),["The engine","INDEX","CORE CARDS","ROLES AND INVOCATION","MEMORY","DEFAULT STYLES","REPORTING"]);
  assert.deepEqual([...section(g,"LAWS").matchAll(/\*\*(L\d+) /g)].map(m=>m[1]),Array.from({length:10},(_,i)=>"L"+(i+1)));
  assert.deepEqual([...section(g,"NOISE_VETO").matchAll(/\*\*(V\d+)\*\*/g)].map(m=>m[1]),Array.from({length:18},(_,i)=>"V"+(i+1)));
 }
});
test("the three generalists are identical outside their edition line and invocation; sizes are reported",async t=>{
 const all=await generalists();
 const strip=s=>s.replace(/^Edition: .*$/m,"").replace(/^\*\*Invocation \(.*$/m,"");
 for(const g of all.slice(1))assert.equal(strip(g),strip(all[0]));
 EDITION_LIST.forEach((e,i)=>t.diagnostic(`${e} generalist: ${Buffer.byteLength(all[i])} bytes`));
});
test("every specialist and card the index names exists, and every one shipped is named",async()=>{
 for(const g of await generalists()){
  const index=section(g,"MECHANICS").split("### INDEX")[1].split("### CORE CARDS")[0];
  assert.deepEqual([...index.matchAll(/^- `([a-z-]+)\.md`/gm)].map(m=>m[1]).sort(),[...SPECIALISTS].sort());
  const cards=[...new Set([...index.split("Cards (")[1].split("Specialists (")[0].split(":\n")[1].matchAll(/`([a-z-]+)`/g)].map(m=>m[1]))];
  assert.deepEqual(cards.filter(c=>!CARDS.includes(c)),[],"named cards exist");
  assert.deepEqual(CARDS.filter(c=>!cards.includes(c)),[],"every card is in the index");
  assert.ok(g.includes("`bertram-gilfoyle.md` (anti-over-engineering)")&&g.includes("`tony-stark.md` (auto-llm-engineering)"));
 }
});
test("the core cards are inlined in every generalist and carry their specialist's version",async()=>{
 const all=await generalists();
 for(const n of CORE_CARDS){
  const card=await text(`engine/core/${n}.md`);
  const fm=Object.fromEntries(/^---\n([\s\S]*?)\n---\n/.exec(card)[1].split("\n").map(l=>l.split(": ")));
  assert.equal(fm.core,n);assert.equal(fm.specialist,`bridgecode/${n}.md`);
  const spec=await text(fm.specialist);
  assert.equal(fm.version,/^version: (.+)$/m.exec(spec)[1],`${n} core card version matches its specialist`);
  const body=card.replace(/^---\n[\s\S]*?\n---\n/,"").trim();
  for(const g of all)assert.ok(section(g,"MECHANICS").includes(body),n+" inlined");
 }
});
test("triggers name only shipped specialists, known states and known roles",async()=>{
 const triggers=JSON.parse(await text("engine/triggers.json")).specialists,flow=JSON.parse(await text("engine/flow.json"));
 const states=Object.keys(flow.states),roles=["root","planner","reviewer","loop-breaker","explorer","builder-dynamic","builder-mechanical"];
 assert.deepEqual(Object.keys(triggers).sort(),[...SPECIALISTS].sort());
 for(const [n,tr]of Object.entries(triggers)){
  assert.equal(tr.file,`bridgecode/${n}.md`);
  for(const s of [...(tr.ask??[]),...(tr.when??[]).flatMap(w=>w.state??[])])assert.ok(states.includes(s),`${n}: ${s}`);
  for(const r of tr.packet??[])assert.ok(roles.includes(r),`${n}: ${r}`);
 }
});
test("the engine's own check passes: every state, guard, card binding and rung",()=>{
 const out=execFileSync(process.execPath,[path.join(PACKAGE_ROOT,"engine/engine.mjs"),"check"],{cwd:PACKAGE_ROOT,encoding:"utf8"});
 assert.match(out,/FLOW OK/);
});
test("one outcome vocabulary across generalists, cards, flow.json and the engine; no retired verdict set or mechanism anywhere",async()=>{
 const cardTexts=await Promise.all(CARDS.map(c=>text(`engine/cards/${c}.md`)));
 for(const g of await generalists())for(const o of OUTCOMES)assert.match(g,new RegExp(`\\*\\*${o}\\*\\*`),o);
 const engine=await text("engine/engine.mjs"),flow=await text("engine/flow.json");
 for(const o of OUTCOMES)assert.match(engine,new RegExp(`\\b${o}\\b`),`engine: ${o}`);
 for(const o of ["ADVANCED","STALLED","REGRESSION"])assert.ok(flow.includes(`"${o}"`),`flow.json: ${o}`);
 const payload=[...await Promise.all(PAYLOAD_PATHS.filter(p=>!p.endsWith(".mjs")).map(text)),await text("hooks/bridgecode-turn.mjs")];
 for(const s of [...payload,...cardTexts]){
  assert.doesNotMatch(s,/\b(FIX_NO_PLAN_CHANGES|UNRESOLVED|REPLAN)\b/);
  assert.doesNotMatch(s,/FIT\s*\/\s*REVISE|REVISE\s*\/\s*STOP|PASS\s*\/\s*FIX/);
  assert.doesNotMatch(s,/loop-mechanics|G0 Method|PREFLIGHT|CavePrompt|ACTIVE_EXTENSIONS|agentic\/analysis\.md/);
 }
});
test("no specialist points to another specialist, a generalist, a card or a persona; every one is in the standard format",async()=>{
 for(const [name,s] of Object.entries(await specialists())){
  const front=/^---\n([\s\S]*?)\n---\n\n# /.exec(s)?.[1]??"";
  for(const field of [/^name: \S+$/m,/^description: .{40,}$/m,/^version: [\d.]+$/m])assert.match(front,field,name);
  for(const other of SPECIALISTS)if(other!==name)assert.ok(!s.includes(other+".md"),`${name} points to ${other}.md`);
  assert.ok(!/\b(AGENTS|CLAUDE)\.md\b/.test(s),`${name} points to a generalist`);
  assert.doesNotMatch(s,/Gilfoyle|Tony Stark|Bertram/);
 }
});
test("taste-bearing specialists ship an empty default read from agentic/default-styles.md",async()=>{
 const all=await specialists();
 for(const n of ["writing","copywriting","design","imagegen"]){
  const s=all[n].split("## DEFAULT_STYLE\n")[1].split("END_DEFAULT_STYLE")[0];
  assert.match(s,/agentic\/default-styles\.md/);assert.ok(s.length<1500,n+" default is not empty");
 }
 const rule=all.monoprompting.split("### Writing rule\n")[1].split("\n### ")[0];
 assert.match(rule,/agentic\/default-styles\.md/);assert.match(rule,/writing rule/);assert.doesNotMatch(rule,/```/,"no shipped rule text");
});
test("the README's flow diagram is generated from engine/flow.json, and a drift fails the check",async()=>{
 const tool=path.join(PACKAGE_ROOT,"tools/flow-diagram.mjs");
 const ok=spawnSync(process.execPath,[tool,"--check"],{encoding:"utf8"});assert.equal(ok.status,0,ok.stderr);
 const tmp=await mkdtemp(path.join(os.tmpdir(),"bridgecode-flow-"));
 try{
  const flow=JSON.parse(await text("engine/flow.json"));flow.states.DONE.next=["DEFINE"];
  await writeFile(path.join(tmp,"flow.json"),JSON.stringify(flow));await writeFile(path.join(tmp,"README.md"),await text("README.md"));
  const bad=spawnSync(process.execPath,[tool,"--check","--flow",path.join(tmp,"flow.json"),"--readme",path.join(tmp,"README.md")],{encoding:"utf8"});
  assert.equal(bad.status,1);assert.match(bad.stderr,/differs/);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test("release workflow attaches the exact artifact and never publishes to npm",async()=>{
 const workflow=await text(".github/workflows/release.yml");
 const expression=/node -p '([^']+)'/.exec(workflow)?.[1];
 assert.ok(expression,"Expected exact artifact version expression");
 const actual=execFileSync(process.execPath,["-p",expression],{cwd:PACKAGE_ROOT,encoding:"utf8"}).trim();
 assert.equal(actual,JSON.parse(await text("package.json")).version);
 assert.ok(workflow.includes("npm run test:release -- --output release"));
 assert.ok(workflow.includes("GITHUB_REF_NAME"));
 assert.ok(workflow.includes("gh release upload"));
 assert.doesNotMatch(workflow,/npm publish|registry-url|id-token/);
});
