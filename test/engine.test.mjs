import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { PACKAGE_ROOT } from "./helpers.mjs";
// The engine on scripted tasks in disposable git repositories. The walks cross every guard flow.json names:
// at the gated transition a walk asserts that guard's refusal once, satisfies it, and goes through.
const FLOW=JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT,"engine/flow.json"),"utf8"));
const ENGINE_SRC=fs.readFileSync(path.join(PACKAGE_ROOT,"engine/engine.mjs"),"utf8");
const GUARDS=[...new Set([...FLOW.always,...Object.values(FLOW.states).flatMap(v=>[...(v.exit??[]),...Object.values(v.to??{}).flat()])])];
const COVERED=new Map();
const CRIT=(id,cls="CORE")=>`- ${id} | ${cls} | tags: law | add.js returns the sum for integers (${id}), seen in node add.js | scope: integers | unsupported: reject | evidence: node add.js\n`;
const RUBRIC=crit=>"TOKENS_USED: ~60\n## Goals\n### G1 Add works\n"+crit.join("")+"## Drop\n## Vetoes\n## Backlog\n";
const SECTIONS={"agentic/spec.md":["Intent","Inputs","Behaviour","Outputs","Constraints","Directions","Open decisions"],"agentic/architecture.md":["Overview","Tree","Decisions","Vetoes","Budgets","Harness","Unverified rules"]};
const MET=id=>`- ${id} | MET | evidence: node add.js 2 3 printed 5 | counterfeit: string concat 23 excluded | boundary: 0 0 printed 0\n`;
const NOT_MET=id=>`- ${id} | NOT_MET | case: node check.js fails\n`;
const STEP="whole: sum; class: missing; remove: none; real: sum; one file";
const ADD="const [a,b]=process.argv.slice(2).map(Number);console.log(a+b)\n";

function repo(t,{crit=[CRIT("G1.C1")],code=false,memory=false}={}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),"bc-engine-"));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const sh=(c,a,input)=>{const r=spawnSync(c,a,{cwd:root,encoding:"utf8",input});return{code:r.status,out:(r.stdout||"")+(r.stderr||"")};};
 const git=(...a)=>sh("git",["-c","user.name=t","-c","user.email=t@localhost","-c","core.autocrlf=false",...a]);
 const write=(p,s)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),s);};
 fs.cpSync(path.join(PACKAGE_ROOT,"engine"),path.join(root,".bridgecode/engine"),{recursive:true});
 write("agentic/rubric.md",RUBRIC(crit));
 if(memory)for(const [f,s] of Object.entries(SECTIONS))write(f,"TOKENS_USED: ~10\n"+s.map(x=>`## ${x}\n`).join(""));
 write("README_HUMAN.txt","installed guide\n");write("AGENTS.md","installed policy\n"); // a fresh install is not product code
 if(code){write("add.js",ADD);write("check.js","process.exit(1)\n");}
 git("init","-q","-b","main");git("add","-A");git("commit","-q","-m","base");
 const E=(...a)=>{const input=typeof a.at(-1)==="object"?a.pop().input:undefined;return sh(process.execPath,[".bridgecode/engine/engine.mjs",...a],input);};
 const ok=(...a)=>{const r=E(...a);assert.equal(r.code,0,`${a.join(" ")}:\n${r.out}`);return r.out;};
 const refused=(re,...a)=>{const r=E(...a);assert.equal(r.code,2,`${a.join(" ")} should be refused:\n${r.out}`);
  const items=/needs:\n/.test(r.out)?r.out.split(/needs:\n/)[1].trim().split("\n").filter(l=>l.startsWith("- ")):[r.out.slice(r.out.indexOf("REFUSED"))];
  for(const line of items)assert.match(line,/engine\.mjs [a-z]+|^REFUSED: [a-z]+ [<[\w.-]+[ |<]/,`the refusal names a command: ${line}`);
  if(re)assert.match(r.out,re);return r.out;};
 // one guard's refusal: asserted once in the whole file, then the walk satisfies it.
 const guard=(name,re,...a)=>{assert.ok(GUARDS.includes(name),`${name} is a flow.json guard`);assert.ok(!COVERED.has(name),`${name} asserted twice`);COVERED.set(name,refused(re,...a));};
 const commit=(m="work")=>{git("add","-A","--",".",":!temporary",":!agentic/tasks");return git("commit","-q","--allow-empty","-m",m);};
 const head=()=>git("rev-parse","HEAD").out.trim();
 const state=()=>JSON.parse(fs.readFileSync(path.join(root,"agentic/tasks/demo/state.json"),"utf8"));
 const log=()=>fs.readFileSync(path.join(root,"agentic/tasks/demo/log.jsonl"),"utf8").trim().split("\n").map(l=>JSON.parse(l));
 const answer=(words,q="go?")=>{ok("question",q);ok("turn",{input:`ok, ${words}`});ok("answer",words);};
 const adv=(to,...x)=>["advance",to,"--load","none",...x];
 const call=role=>new RegExp(`call (\\w+) \\(${role}`).exec(ok("call",role))[1];
 const reply=(id,s)=>write(`temporary/demo/runs/${id}/out.md`,s);
 const prevent=(size="tiny",what="the next action")=>{ok("stepback",size,"--targets","G1.C1",STEP);ok("block",`${what}, written whole`);}; // a state's prevent where the walk is not about it
 return{root,E,ok,refused,guard,write,commit,head,state,log,answer,adv,call,reply,git,prevent};
}

test("flow.json: every state reachable from a start, every non-terminal state can end, the escape is reachable; every guard is implemented; the engine's check agrees",()=>{
 const S=FLOW.states,names=Object.keys(S),terminal=names.filter(n=>!S[n].next.length);
 const reach=new Set(Object.values(FLOW.start)),queue=[...reach];
 while(queue.length)for(const n of S[queue.shift()].next)if(!reach.has(n)){reach.add(n);queue.push(n);}
 assert.deepEqual(names.filter(n=>!reach.has(n)),[],"unreachable states");
 const ends=new Set(terminal);let grew=true;
 while(grew){grew=false;for(const n of names)if(!ends.has(n)&&S[n].next.some(x=>ends.has(x))){ends.add(n);grew=true;}}
 assert.deepEqual(names.filter(n=>!ends.has(n)),[],"dead ends");
 for(const n of names)if(S[n].next.length&&!["ASK","ACCEPT","CONDENSE"].includes(n))assert.ok(S[n].next.includes(FLOW.escape),`${n} reaches ${FLOW.escape}`);
 assert.deepEqual(terminal.sort(),["DONE","STOPPED"]);
 for(const g of GUARDS)assert.match(ENGINE_SRC,new RegExp(`\\n    ${g}: \\(`),`guard ${g} is implemented`);
 const r=spawnSync(process.execPath,[path.join(PACKAGE_ROOT,"engine/engine.mjs"),"check"],{cwd:PACKAGE_ROOT,encoding:"utf8"});
 assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/FLOW OK/);
});

test("walk FOCUSED, new code: DEFINE → tiny LOOP → pre-release GATE → CONSOLIDATE → release GATE → ACCEPT → CONDENSE → DONE",t=>{
 const r=repo(t,{crit:[CRIT("G1.C1"),CRIT("G1.C2","NON-CORE")]});
 r.ok("init","FOCUSED","demo","add numbers");assert.equal(r.state().state,"DEFINE");
 assert.ok(!fs.existsSync(path.join(r.root,".bridgecode/git")),"a writable .git needs no separate store");
 r.write("add.js",ADD);r.commit("product");
 r.guard("briefRecorded",/the Brief/,...r.adv("LOOP"));
 r.ok("brief","intent: sum two integers; criterion: G1; interpretation: integers only; perspective: user; objection: floats");
 r.write("agentic/rubric.md",RUBRIC([CRIT("G1.C1").replace(" | scope: integers",""),CRIT("G1.C2","NON-CORE")]));
 r.guard("rubricValid",/rubric: .*lacks a scope/,...r.adv("LOOP"));
 // every working state owes its prevent before its first work command: here DEFINE's, before the freeze
 r.refused(/freeze waits for this DEFINE's PREVENT: PREVENT first, the step back: .*stepback tiny/,"freeze");
 r.ok("stepback","tiny","goal: sum; criteria: G1.C1, G1.C2; code: none; risk: strings");
 r.refused(/freeze waits for this DEFINE's PREVENT: PREVENT, then the one-block of the next action: .*engine\.mjs block/,"freeze");
 r.ok("block","rubric: G1.C1 CORE and G1.C2 NON-CORE, the sum of two integers; spec and architecture: add.js, drafted together");
 r.refused(/lacks a scope[\s\S]*then .*engine\.mjs freeze/,"freeze");
 r.write("agentic/rubric.md",RUBRIC([CRIT("G1.C1"),CRIT("G1.C2","NON-CORE").replace("(G1.C2)","(G1.C2, amended)")]));
 r.guard("rubricFrozen",/freeze the rubric/,...r.adv("LOOP"));
 r.ok("freeze");r.commit("rubric");
 r.guard("userAnswer",/the user's answer/,...r.adv("LOOP"));
 r.answer("yes go ahead");
 r.guard("fullOnly",/FOCUSED builds in tiny loops, without a one-shot: .*advance LOOP/,...r.adv("ONESHOT"));
 r.ok(...r.adv("LOOP"));
 // PREVENT = the step back (tiny on FOCUSED), then the one-block of the next action.
 r.guard("stepBack",/PREVENT first, the step back: .*stepback tiny/,...r.adv("GATE"));
 r.refused(/a FOCUSED task steps back tiny/,"stepback","small","--targets","G1.C1,G1.C2",STEP);
 r.ok("stepback","tiny","--targets","G1.C1,G1.C2","goal: sum; criteria: G1.C1, G1.C2; code: none yet; risk: strings");
 r.refused(/the one-block of the next action: .*engine\.mjs block/,...r.adv("GATE"));
 r.ok("block","add.js: read two integers from argv and print their sum (G1.C1, G1.C2); real input: node add.js 2 3");
 assert.match(fs.readFileSync(path.join(r.root,"agentic/tasks/demo/board.md"),"utf8"),/## Next action\n.*add\.js: read two integers/);
 r.guard("seenFailing",/the target seen failing on BEST/,...r.adv("GATE"));
 r.ok("run","--before","--","node","add.js","2","3");
 r.guard("judged",/your verdict per target/,...r.adv("GATE"));
 r.ok("run","--","node","add.js","2","3");
 r.write("temporary/demo/v.md","- G1.C1 | MET | evidence: printed 5\n");
 r.refused(/MET needs evidence, counterfeit and boundary/,"judge","loop","--self","temporary/demo/v.md");
 r.write("temporary/demo/v.md",MET("G1.C1")+MET("G1.C2"));r.ok("judge","loop","--self","temporary/demo/v.md");
 assert.equal(r.state().history.at(-1).outcome,"PASS");
 // a targetless BREAK is refused with the allowed transition, never with a forbidden one
 const brk=r.refused(null,...r.adv("BREAK"));
 assert.match(brk,/nothing to fix; .*advance GATE/);COVERED.set("breakTargets",brk);
 assert.match(brk,/after a PASS: .*advance GATE/);COVERED.set("passRoute",brk);
 assert.doesNotMatch(brk,/stepback small/);
 r.write("agentic/rubric.md",RUBRIC([CRIT("G1.C1")]));
 r.guard("rubricUnchanged",/changed since the freeze/,...r.adv("GATE"));
 r.git("checkout","--","agentic/rubric.md");
 r.ok(...r.adv("GATE"));
 assert.match(r.ok("status"),/STATE GATE \(pre-release gate\)[\s\S]*PREVENT OWED before GATE's first work/);
 assert.match(r.ok("status","--line"),/· PREVENT OWED/);
 r.prevent("tiny","the gate: node add.js end to end, the suite, every criterion judged");
 r.guard("e2eRun",/one end-to-end real run of every feature on HEAD/,...r.adv("CONSOLIDATE"));
 r.ok("run","--e2e","--","node","add.js","4","4");
 r.guard("suiteRun",/the full suite once on HEAD/,...r.adv("CONSOLIDATE"));
 r.ok("run","--suite","--","node","add.js","0","0");
 let id=r.call("reviewer");r.reply(id,MET("G1.C1")+MET("G1.C2"));r.ok("judge","gate",id);
 assert.equal(r.state().history.at(-1).outcome,"PASS");const pre=r.head();assert.equal(r.state().prePassed,pre);
 r.refused(/the pre-release gate passed: .*advance CONSOLIDATE/,...r.adv("ACCEPT"));
 r.ok(...r.adv("CONSOLIDATE"));
 r.refused(/PREVENT first, the step back/,...r.adv("GATE"));
 r.ok("stepback","tiny","--targets","G1.C1","goal: a simpler add.js; criteria: all; code: one file; risk: none");
 r.ok("block","remove nothing; no fundamental error to prevent; tests within budget");
 r.guard("checksRun",/the affected checks rerun/,...r.adv("GATE"));
 r.ok("run","--","node","add.js","1","1");
 r.guard("metricsRecorded",/the budgets: .*metrics/,...r.adv("GATE"));
 r.ok("metrics");r.commit("consolidate");
 r.guard("candidateFrozen",/commit and freeze the candidate/,...r.adv("GATE"));
 r.ok("candidate");
 r.ok(...r.adv("GATE"));
 assert.match(r.ok("status"),/STATE GATE \(release gate\)/);
 r.prevent("tiny","the release: the same run and suite on the candidate, the consolidation diff reviewed");
 r.refused(/one end-to-end real run of every feature on the frozen candidate/,...r.adv("ACCEPT"));
 r.ok("run","--e2e","--","node","add.js","4","4");
 r.ok("run","--suite","--","node","add.js","0","0");
 // evidence: a read-only call is void when the tree changes before its judging; a reply without a verdict line is a failed call.
 id=r.call("reviewer");r.reply(id,MET("G1.C1")+MET("G1.C2"));r.write("add.js","console.log('changed')\n");
 r.refused(/void[\s\S]*redispatch/,"judge","gate",id);
 r.git("checkout","--","add.js");
 r.refused(/not a live reviewer call/,"judge","gate",id);
 id=r.call("reviewer");r.reply(id,"looks fine to me\n");
 assert.match(fs.readFileSync(path.join(r.root,`temporary/demo/runs/${id}/packet.md`),"utf8"),new RegExp(`the consolidation to review: git diff ${pre} ${r.head()}`),"the release review carries the consolidation diff");
 r.refused(/failed:[\s\S]*no verdict line/,"judge","gate",id);
 r.ok("redispatch",id);r.reply(id,MET("G1.C1")+MET("G1.C2")+"RUBRIC: reword G1.C2 to name its boundary\n");
 r.ok("judge","gate",id);assert.equal(r.state().history.at(-1).outcome,"PASS");
 const gated=r.head();
 r.ok(...r.adv("ACCEPT"));
 r.answer("yes accept","accept?");
 r.guard("finalReport",/the final report/,...r.adv("CONDENSE"));
 r.ok("report","--final");
 r.guard("proposalsResolved",/resolve rubric proposal 1 \("reword G1\.C2[\s\S]*resolve 1 /,...r.adv("CONDENSE"));
 r.ok("resolve","1","dismissed: the boundary is already in scope");
 r.write("extra.txt","x\n");r.commit("after the gate");
 r.guard("gatedHead",/is not the gated commit/,...r.adv("CONDENSE"));
 r.git("reset","-q","--hard",gated);
 r.ok(...r.adv("CONDENSE"));
 r.guard("memoryShape",/spec\.md is missing[\s\S]*architecture\.md is missing/,...r.adv("DONE"));
 r.refused(/PREVENT first, the step back/,...r.adv("DONE"));
 r.ok("stepback","tiny","--targets","G1.C1","goal: memory; criteria: all; code: gated; risk: stale spec");r.ok("block","spec: the sum; architecture: add.js; no vetoes");
 for(const [f,s] of Object.entries(SECTIONS))r.write(f,"TOKENS_USED: ~10\n"+s.map(x=>`## ${x}\n`).join(""));
 r.ok("metrics");
 r.ok(...r.adv("DONE"));
 assert.equal(r.state().state,"DONE");
 r.refused(/DONE cannot go to DEFINE; it goes to nothing/,...r.adv("DEFINE"));
});

test("walk FULL, new code: the one-shot passes when every CORE criterion works; one next-shot is judged on every criterion",t=>{
 const r=repo(t,{crit:[CRIT("G1.C1"),CRIT("G1.C2","NON-CORE")]});
 r.ok("init","FULL","demo","add numbers");r.ok("brief","intent: sum");r.answer("go");
 r.guard("oneshotFirst",/FULL builds with a one-shot first[\s\S]*advance ONESHOT/,...r.adv("LOOP"));
 r.prevent("small","the definition: rubric, spec and architecture together");
 r.ok(...r.adv("ONESHOT"));
 r.refused(/a FULL task steps back small/,"stepback","tiny","--targets","G1.C1","goal: sum");
 r.ok("stepback","small","--targets","G1.C1,G1.C2",STEP);
 r.write("add.js",ADD);r.write("check.js","process.exit(1)\n");r.commit("the one-shot");
 r.guard("realRun",/a real run of the one-shot/,...r.adv("LOOP"));
 r.ok("run","--","node","add.js","2","3");
 let id=r.call("reviewer");r.reply(id,MET("G1.C1")+NOT_MET("G1.C2"));r.ok("judge","oneshot",id);
 r.ok("reproduce","G1.C2","yes","--","node","check.js");
 assert.equal(r.state().history.at(-1).outcome,"PASS","NON-CORE may fail");assert.equal(r.state().nextShot,true);
 assert.match(r.ok("status"),/CORE 1\/1, NON-CORE 0\/1 established\. Every CORE criterion works/);
 r.ok(...r.adv("LOOP"));
 assert.match(r.ok("status"),/NEXT-SHOT: one loop[\s\S]*TARGETS[\s\S]*G1\.C1[\s\S]*G1\.C2/);
 r.guard("nextShotDone",/the next-shot has not passed[\s\S]*advance LOOP/,...r.adv("GATE"));
 r.ok("stepback","small","--targets","G1.C2",STEP);r.ok("block","src/add.js from the one-shot, repairing G1.C2; every criterion re-run");
 r.ok("run","--before","--","node","check.js");
 r.write("check.js","process.exit(0)\n");r.commit("the next-shot");r.ok("run","--","node","add.js","2","3");
 id=r.call("reviewer");
 const packet=fs.readFileSync(path.join(r.root,`temporary/demo/runs/${id}/packet.md`),"utf8");
 assert.match(packet,/\(G1\.C1\)[\s\S]*\(G1\.C2\)/,"the next-shot is judged on every criterion");
 r.reply(id,MET("G1.C1")+MET("G1.C2"));r.ok("judge","loop",id);
 assert.equal(r.state().history.at(-1).outcome,"PASS");assert.equal(r.state().nextShot,false);
 r.ok(...r.adv("GATE"));
});

test("walk ADOPT, existing code without memory: the baseline run, the user's adoption decision, no added criteria",t=>{
 const r=repo(t,{code:true});
 r.ok("init","FOCUSED","demo","adopt");assert.equal(r.state().state,"ADOPT");
 r.refused(/ADOPT cannot go to ONESHOT; it goes to DEFINE, ASK/,...r.adv("ONESHOT"));
 r.guard("baselineRun",/the baseline real run on HEAD/,...r.adv("DEFINE"));
 r.refused(/run waits for this ADOPT's PREVENT: PREVENT first, the step back: .*stepback tiny/,"run","--","node","add.js","2","3");
 r.prevent("tiny","what exists: add.js prints the sum; no checks; the baseline is node add.js 2 3");
 r.ok("run","--","node","add.js","2","3");
 r.guard("adoptRecord",/the adoption decision/,...r.adv("DEFINE"));
 r.refused(/the adoption decision is the user's/,"adopt","keep","what exists: add.js; works: sum; checks: none");
 r.answer("keep it");
 r.ok("adopt","keep","what exists: add.js; works: sum; checks: none");
 r.write("agentic/rubric.md",RUBRIC([CRIT("G1.C1"),CRIT("G1.C2")]));
 r.guard("adoptCount",/never raises the criterion count \(2 > 1\)/,...r.adv("DEFINE"));
 r.write("agentic/rubric.md",RUBRIC([CRIT("G1.C1")]));
 r.ok(...r.adv("DEFINE"));
});

test("walk FULL, existing code with memory: the plan review, the explore trigger, options run and judged, the winner as the one-shot, then the next-shot",t=>{
 const r=repo(t,{code:true,memory:true});
 r.ok("init","FULL","demo","rework add");const s=r.state();assert.equal(s.state,"DEFINE");assert.equal(s.existing,true);
 r.ok("brief","intent: sum; criterion: G1; interpretation: integers; perspective: user; objection: floats");
 r.answer("go");
 r.guard("planReviewed",/the plan review on existing code/,...r.adv("ONESHOT"));
 r.prevent("small","the definition against the existing add.js");
 let id=r.call("reviewer");r.reply(id,"none\n");r.ok("planreview",id,"none");
 r.refused(/freeze after the plan review/,...r.adv("ONESHOT"));
 r.ok("freeze");
 r.guard("exploreTrigger",/name the trigger: .*advance EXPLORE --why/,...r.adv("EXPLORE","--why","because"));
 const trig=/--why ([a-z-]+)/.exec(COVERED.get("exploreTrigger"))[1];
 r.ok(...r.adv("EXPLORE","--why",trig));
 // EXPLORE owes a full step back: a small one does not open it
 r.ok("stepback","small","--targets","G1.C1",STEP);
 r.refused(/call explorer waits for this EXPLORE's PREVENT: PREVENT first, the step back: .*stepback full --targets/,"call","explorer");
 r.ok("stepback","full","--targets","G1.C1","a page from scratch: the rubric, the evidence, two mechanisms no cheap check separates");
 r.guard("exploreSettled",/every option run and judged/,...r.adv("LOOP"));
 const opts=[r.call("explorer"),r.call("explorer")];
 for(const o of opts)r.ok("run","--cwd",`temporary/demo/wt/${o}`,"--","node","add.js","2","3");
 id=r.call("reviewer");r.reply(id,opts.map(o=>MET(`${o}/G1.C1`)).join(""));
 assert.match(r.ok("judge","explore",id,"--options",opts.join(",")),/OPTIONS/);
 r.ok("winner",opts[0]);
 r.refused(/the integrated winner run on real input on HEAD/,...r.adv("LOOP"));
 r.write("add.js",ADD.replace("a+b","b+a"));r.commit("the winner");r.ok("run","--","node","add.js","2","3");
 assert.equal(r.state().nextShot,true,"the winner is the one-shot: the next-shot follows");
 r.ok(...r.adv("LOOP"));
 r.refused(/the next-shot has not passed/,...r.adv("GATE"));
});

test("walk the ladder: two STALLED loops lead to BREAK, two STALLED breaks to a re-define, the approved re-plan back to DEFINE, and the loop-breakers build",t=>{
 const r=repo(t);
 r.ok("init","FOCUSED","demo","ladder");r.write("add.js",ADD);r.write("check.js","process.exit(1)\n");r.commit("product");
 r.ok("brief","intent: sum");r.answer("go");r.prevent("tiny","the definition");r.ok(...r.adv("LOOP"));
 const prevent=i=>{r.ok("stepback","tiny","--targets","G1.C1",`loop ${i}: goal sum; criteria G1.C1; code add.js; risk check.js`);r.ok("block",`loop ${i}: fix add.js for check.js`);};
 const loop=(i,carried)=>{
  if(!carried)prevent(i);
  if(i===0)r.refused(/the target seen failing on BEST/,...r.adv("BREAK"));
  r.ok("run","--before","--","node","check.js");
  const before=r.log().filter(l=>l.ev==="run").at(-1);assert.equal(before.kind,"before");assert.equal(before.code,1);assert.match(before.digest,/^[0-9a-f]{16}$/);
  r.write("temporary/demo/v.md",NOT_MET("G1.C1"));r.commit(`try ${i}`);
  r.refused(/the target passing on the candidate/,"judge","loop","--self","temporary/demo/v.md");
  r.ok("run","--","node","add.js","1","1");
  r.ok("judge","loop","--self","temporary/demo/v.md");
  r.refused(/does not show "yes"[\s\S]*reproduce G1\.C1 no/,"reproduce","G1.C1","yes","--","node","add.js","1","1");
  r.ok("reproduce","G1.C1","yes","--","node","check.js");
  const rep=r.state().runs.at(-1);assert.equal(rep.kind,"reproduce");assert.equal(rep.code,1,"reproduce records the real exit");assert.match(rep.digest,/^[0-9a-f]{16}$/);
  assert.match(r.log().at(-1).evidence,new RegExp(`exit 1 \\(digest ${rep.digest}\\)`));
  assert.equal(r.state().history.at(-1).outcome,"STALLED");
 };
 loop(0);
 r.guard("pendingStepBack",/the tiny step back after the last loop STALLED: .*stepback tiny/,...r.adv("LOOP"));
 prevent("after STALLED");
 r.guard("allEstablished",/criteria still open: G1\.C1: .*advance LOOP/,...r.adv("GATE"));
 r.ok(...r.adv("LOOP"));
 loop(1,true); // the step back after the outcome is this loop's prevent: nothing owed again

 assert.equal(r.state().rung,FLOW.ladder.first.STALLED[1]);
 r.guard("ladder",new RegExp(`rung full\\) leads to ${FLOW.rungs.full.state}`),...r.adv("LOOP"));
 r.ok(...r.adv("BREAK"));
 const brk=i=>{
  if(i>0)r.ok(...r.adv("BREAK"));
  if(i===0)r.refused(/loop-breaker call\(s\), each taking the full step back/,...r.adv("LOOP"));
  const lb=r.call("loop-breaker");r.ok("stepback","full","--call",lb,`break ${i}: the step at fault was DEFINE`);
  if(i===0)r.refused(new RegExp(`call reviewer waits for this BREAK's PREVENT: loop-breaker ${lb}'s one-block: .*block --call ${lb}`),"call","reviewer");
  r.ok("block","--call",lb,`break ${i}: add.js rewritten whole against check.js`);
  r.write("add.js",ADD+`// ${i}\n`);r.commit(`fix ${i}`);
  const id=r.call("reviewer");r.reply(id,NOT_MET("G1.C1"));r.ok("judge","break",id);
  r.ok("reproduce","G1.C1","yes","--","node","check.js");
  assert.equal(r.state().history.at(-1).outcome,"STALLED");
 };
 brk(0);brk(1);
 assert.equal(r.state().rung,"redefine");
 r.ok(...r.adv("ASK"));
 r.guard("replanApproved",/the loop-breakers' re-plan from the user's comment/,...r.adv("DEFINE"));
 r.answer("the criterion is wrong, rethink it","what went wrong?");
 r.call("loop-breaker");
 const shown=r.ok("stepback","replan","DEFINE","the step at fault: DEFINE; what changes: the check; what is removed: check.js");
 assert.match(shown,/show it to the user in plain words, with what differs from their comment[\s\S]*their reply as they wrote it \(any clear yes or no\)/);
 r.refused(/the user's decision on the re-plan, shown to them in plain words[\s\S]*approve "<their reply, as they wrote it>"/,...r.adv("DEFINE"));
 r.ok("turn",{input:"yes"});
 r.refused(/approve waits for this ASK's PREVENT: the one-block of the new definition/,"approve","yes");
 r.ok("block","the new definition: G1.C1 checked by add.js itself; check.js removed");
 r.ok("approve","yes");
 r.refused(/the approved re-plan goes to DEFINE/,...r.adv("EXPLORE"));
 r.ok(...r.adv("DEFINE")); // the approved re-plan is DEFINE's prevent
 r.answer("yes","build it?");
 r.guard("redefineBuilds",/after a re-define the loop-breakers build/,...r.adv("LOOP"));
 r.ok(...r.adv("BREAK"));
 r.ok("stepback","tiny","--targets","G1.C1","after a break outcome the root steps back here"); // BREAK allows the step back its outcomes ask for
});

test("a task begun before the prevent rule resumes mid-state: the prevent is owed from its next state entry",t=>{
 const r=repo(t);r.ok("init","FOCUSED","demo","x");
 const p=path.join(r.root,"agentic/tasks/demo/state.json"),old=JSON.parse(fs.readFileSync(p,"utf8"));delete old.entry.steps;
 const text=JSON.stringify(old,null,2);fs.writeFileSync(p,text);
 fs.appendFileSync(path.join(r.root,"agentic/tasks/demo/log.jsonl"),JSON.stringify({t:new Date().toISOString(),state:old.state,ev:"save",hash:crypto.createHash("sha256").update(text).digest("hex"),snap:old})+"\n");
 r.ok("freeze");r.ok("brief","intent: resume");r.answer("go");r.ok(...r.adv("LOOP"));
 r.refused(/call builder-dynamic waits for this LOOP's PREVENT/,"call","builder-dynamic");
});

test("a hand-edited state.json is refused until recover; answer and approve need the user's recorded words",t=>{
 const r=repo(t);r.ok("init","FOCUSED","demo","x");
 const p=path.join(r.root,"agentic/tasks/demo/state.json");fs.writeFileSync(p,fs.readFileSync(p,"utf8").replace('"rung": "first"','"rung": "full"'));
 r.refused(/edited by hand[\s\S]*recover --task demo/,"status");
 r.ok("recover","--task","demo");assert.equal(r.state().rung,"first");r.ok("status");
 r.ok("question","go?");
 assert.match(r.ok("answer","yes go"),/UNWITNESSED/,"no prompt recorded yet: the answer is marked, not trusted");
 r.ok("question","really?");r.ok("turn",{input:"something else"});
 r.refused(/appears in no user prompt/,"answer","yes really");
 r.ok("turn",{input:"ok yes really"});r.ok("answer","yes really");
 assert.equal(r.log().filter(l=>l.ev==="answer").at(-1).witnessed,true);
 assert.match(ENGINE_SRC,/approve\(\)[\s\S]{0,600}witnessQuote/,"approve checks the quote the same way");
 const c=repo(t);c.refused(/init <FOCUSED\|FULL>/,"init","DIRECT","demo","x");
});

test("a task begun before the single features stage resumes: its stage is dropped and the small rung becomes the first rung",t=>{
 const r=repo(t);r.ok("init","FOCUSED","demo","x");
 const p=path.join(r.root,"agentic/tasks/demo/state.json"),old={...JSON.parse(fs.readFileSync(p,"utf8")),stage:"CORE",rung:"small",pending:"small",pendingFrom:"gate REGRESSION"};
 const text=JSON.stringify(old,null,2);fs.writeFileSync(p,text);
 fs.appendFileSync(path.join(r.root,"agentic/tasks/demo/log.jsonl"),JSON.stringify({t:new Date().toISOString(),state:old.state,ev:"save",hash:crypto.createHash("sha256").update(text).digest("hex"),snap:old})+"\n");
 const out=r.ok("status");
 assert.doesNotMatch(out,/stage (CORE|NON-CORE)|· stage /);assert.match(out,/STEP BACK PENDING after gate REGRESSION: .*stepback tiny/);
 r.ok("brief","intent: resume");assert.equal(r.state().rung,"first");assert.equal(r.state().pending,"first");assert.ok(!("stage" in r.state()));
});

// Read-only .git: Windows denies creating entries under .git (git reads still work); POSIX removes write permission.
const USER=process.platform==="win32"?spawnSync("whoami",{encoding:"utf8"}).stdout.trim():null;
const lock=dir=>process.platform==="win32"?spawnSync("icacls",[dir,"/deny",`${USER}:(OI)(CI)(AD,WD)`],{encoding:"utf8"}):spawnSync("chmod",["-R","a-w",dir]);
const unlock=dir=>process.platform==="win32"?spawnSync("icacls",[dir,"/remove:d",USER,"/T","/Q"],{encoding:"utf8"}):spawnSync("chmod",["-R","u+w",dir]);
const locked=(t,r,dirs)=>{
 if(process.platform!=="win32"&&process.getuid?.()===0){t.skip("root ignores file permissions");return false;}
 for(const d of dirs)lock(path.join(r.root,d));
 t.after(()=>{for(const d of dirs)unlock(path.join(r.root,d));}); // registered after the fixture's removal hook; unlocked again explicitly below
 if(!r.git("branch","lock-probe").code){for(const d of dirs)unlock(path.join(r.root,d));t.skip("could not make .git refuse writes here");return false;}
 return true;
};

test("git store: init on a read-only .git moves the task to a separate store seeded from history; planner, builder commits and runs resolve it; .git is untouched",t=>{
 const r=repo(t,{memory:true});r.write("add.js",ADD);r.commit("product");
 const head0=r.head(),refs0=r.git("for-each-ref").out;
 if(!locked(t,r,[".git"]))return;
 try{
  const out=r.ok("init","FOCUSED","demo","read-only checkout");
  assert.match(out,/\.git refuses the writes delegates need \(.*(lock|denied|unable|create).*\); this task's repository is \.bridgecode\/git, seeded from the checkout's history, and \.git is left untouched/i,"Git's own diagnostic is kept");
  assert.equal(r.E("git","rev-parse","HEAD").out.trim(),head0,"the store continues from the checkout's history");
  assert.match(r.E("git","symbolic-ref","HEAD").out,/refs\/heads\/bc\/demo/);
  assert.match(r.ok("status","--line"),/git: \.bridgecode\/git \(.*engine\.mjs git <args>\)/);
  const planner=r.call("planner");assert.ok(fs.existsSync(path.join(r.root,`temporary/demo/wt/${planner}/add.js`)),"the planner's worktree is checked out from the store");
  r.ok("brief","intent: sum");r.answer("go");r.prevent("tiny","the definition");r.ok(...r.adv("LOOP"));
  r.ok("stepback","tiny","--targets","G1.C1","goal: sum");r.ok("block","add.js prints the sum");
  const b=r.call("builder-dynamic"),wt=path.join(r.root,`temporary/demo/wt/${b}`);
  fs.writeFileSync(path.join(wt,"note.txt"),"built\n");
  const g=(...a)=>spawnSync("git",["-c","user.name=t","-c","user.email=t@localhost",...a],{cwd:wt,encoding:"utf8"});
  assert.equal(g("add","note.txt").status,0);assert.equal(g("commit","-q","-m","delegate").status,0,"a delegate commits in its store worktree");
  assert.match(r.E("git","log","--oneline",`bc/demo-${b}`).out,/delegate/);
  r.ok("run","--before","--","node","add.js","2","3");
  const before=r.log().filter(l=>l.ev==="run").at(-1);assert.equal(before.sha,head0,"the BEST worktree is at the intended revision");
  r.commit("loop");r.E("git","add","-A","--",".",":!temporary",":!agentic/tasks",":!.bridgecode/git");r.E("git","commit","-q","--allow-empty","-m","loop");
  const h=r.E("git","rev-parse","HEAD").out.trim();r.ok("run","--","node","add.js","2","3");
  assert.equal(r.log().filter(l=>l.ev==="run").at(-1).sha,h,"runs record the store's HEAD");
 }finally{unlock(path.join(r.root,".git"));}
 assert.equal(r.head(),head0,"the checkout's HEAD did not move");assert.equal(r.git("for-each-ref").out,refs0,"no ref was written into .git");
});

test("git store: a mid-task worktree failure keeps the task record and reports both diagnostics when no store can be made; once one can, the task moves there",t=>{
 const r=repo(t,{memory:true});r.write("add.js",ADD);r.commit("product");
 r.ok("init","FOCUSED","demo","x");r.ok("brief","intent: sum");
 const p=path.join(r.root,"agentic/tasks/demo/state.json"),kept=fs.readFileSync(p,"utf8");
 if(!locked(t,r,[".git",".bridgecode"]))return;
 try{
  const out=r.refused(null,"call","planner");
  assert.match(out,/git refuses the writes delegates need here, and a separate store could not be made either; the task record is kept\.\n\.git: .*(lock|denied|unable).*\n\.bridgecode\/git: .+\nmake \.git \(or \.bridgecode\/\) writable, then .*engine\.mjs call planner/i,"both diagnostics, and the command to run again");
  assert.equal(fs.readFileSync(p,"utf8"),kept,"the task record is kept");
  unlock(path.join(r.root,".bridgecode"));
  assert.match(r.ok("call","planner"),/this task's repository is \.bridgecode\/git/);
  assert.match(r.E("git","symbolic-ref","HEAD").out,/refs\/heads\/bc\/demo/,"the store continues on the task branch");
 }finally{unlock(path.join(r.root,".git"));unlock(path.join(r.root,".bridgecode"));}
});

test("git store: a linked worktree's store continues on that worktree's branch, not the main checkout's",t=>{
 const r=repo(t,{memory:true});r.write("add.js",ADD);r.commit("product");
 const wt=fs.mkdtempSync(path.join(os.tmpdir(),"bc-linked-"));t.after(()=>fs.rmSync(wt,{recursive:true,force:true}));
 assert.equal(r.git("worktree","add","-q","-b","feature",wt).code,0);
 const W=(...a)=>{const x=spawnSync(process.execPath,[".bridgecode/engine/engine.mjs",...a],{cwd:wt,encoding:"utf8"});return{code:x.status,out:(x.stdout||"")+(x.stderr||"")};};
 const G=(...a)=>spawnSync("git",["-c","user.name=t","-c","user.email=t@localhost",...a],{cwd:wt,encoding:"utf8"});
 fs.writeFileSync(path.join(wt,"feature.txt"),"feature\n");G("add","feature.txt");G("commit","-q","-m","feature work");
 const feature=G("rev-parse","HEAD").stdout.trim();assert.notEqual(feature,r.head());
 if(!locked(t,r,[".git"]))return;
 try{
  const out=W("init","FOCUSED","demo","linked worktree");assert.equal(out.code,0,out.out);
  assert.match(out.out,/this task's repository is \.bridgecode\/git/);
  assert.equal(W("git","rev-parse","HEAD").out.trim(),feature,"the store continues from the linked worktree's branch");
  assert.equal(W("git","rev-parse","feature").out.trim(),feature);
 }finally{unlock(path.join(r.root,".git"));}
 assert.match(r.git("symbolic-ref","HEAD").out,/refs\/heads\/main/,"the main checkout is untouched");
});

test("cards and triggers: every root-acted state has a card; triggers bind on a rubric tag, a state and a changed file; packets carry the bound specialists",t=>{
 for(const [n,v] of Object.entries(FLOW.states))if(v.next.length)assert.ok(fs.existsSync(path.join(PACKAGE_ROOT,`engine/cards/${n.toLowerCase()}.md`)),`${n} has a card`);
 const triggers=JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT,"engine/triggers.json"),"utf8")).specialists;
 const r=repo(t);r.ok("init","FOCUSED","demo","x");r.write("add.js",ADD);r.commit("product");
 const line=r.ok("turn",{input:"next"});assert.match(line,/cards: define[\s\S]*specialists: best-agent/);
 const lawTagged=Object.entries(triggers).filter(([,tr])=>(tr.when??[]).some(w=>(w.tag??[]).includes("law"))).map(([n])=>n);
 assert.ok(lawTagged.includes("tony-stark"));
 for(const n of lawTagged)assert.match(line,new RegExp(n),`${n} fires on the law tag`);
 assert.doesNotMatch(line,/\bwriting\b/,"no prose tag and no changed docs: writing is not bound");
 r.ok("brief","intent: sum");r.answer("go");r.prevent("tiny","the definition");r.ok("advance","LOOP","--load","none");
 r.write("NOTES.md","# notes\n");r.commit("docs");r.prevent("tiny","the loop");
 assert.match(r.ok("turn",{input:"next"}),/specialists: [^\n]*\bwriting\b/);
 assert.ok(triggers.writing.packet.includes("reviewer")&&!triggers["best-agent"].packet.includes("reviewer"));
 const id=r.call("reviewer"),packet=fs.readFileSync(path.join(r.root,`temporary/demo/runs/${id}/packet.md`),"utf8");
 assert.match(packet,/bridgecode[\\/]writing\.md/,"writing in the reviewer packet");
 assert.doesNotMatch(packet,/bridgecode[\\/]best-agent\.md/,"best-agent goes to planners only");
});

test("audit: every guard in flow.json had its refusal asserted exactly once and its pass walked",()=>{
 assert.deepEqual(GUARDS.filter(g=>!COVERED.has(g)),[],"guards without a refusal test");
 assert.deepEqual([...COVERED.keys()].filter(g=>!GUARDS.includes(g)),[],"asserted names that are not guards");
});
