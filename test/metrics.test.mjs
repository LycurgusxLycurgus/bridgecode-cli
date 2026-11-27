import assert from "node:assert/strict";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { computeMetrics, runMetrics } from "../src/metrics.mjs";
import { run } from "../src/cli.mjs";
import { fixture, PACKAGE_ROOT } from "./helpers.mjs";

// Hand-counted non-blank lines. Production 3+4+2+3 = 12 in 4 files; tests 3+2 = 5 in 2 files.
const POLYGLOT={
 "src/app.py":"import sys\n\ndef main():\n    print('hi')\n\n",
 "src/util.ts":"export function add(a: number, b: number) {\n  return a + b;\n}\n\nexport const zero = 0;\n",
 "lib/main.go":"package main\n\nfunc main() {}\n",
 "web/index.html":"<html>\n<body></body>\n</html>\n",
 "tests/test_app.py":"from src.app import main\n\ndef test_main():\n    main()\n",
 "src/util.test.ts":"import { add } from './util';\n\nif (add(1, 2) !== 3) throw new Error('add');\n",
 "README.md":"# Readme\none\ntwo\nthree\nfour\n",
 "docs/guide.py":"print(1)\nprint(2)\n",
 "package-lock.json":"{\n\"a\": 1\n}\n",
 "node_modules/x/index.js":"a\nb\nc\nd\n",
 "dist/bundle.min.js":"x\n",
 "data.csv":"a,b\n1,2\n",
 "agentic/notes.py":"print(3)\n",
};
async function polyglot(t,extra={}){
 const root=await fixture(t,"bridgecode-metrics-");
 for(const [p,s]of Object.entries({...POLYGLOT,...extra})){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);}
 return root;
}
test("metrics on a polyglot fixture match hand-counted lines and classes",async t=>{
 const {result,classified}=await computeMetrics(await polyglot(t));
 assert.equal(result.listing,"walk");
 assert.deepEqual(result.production,{files:4,loc:12});assert.deepEqual(result.tests,{files:2,loc:5});
 assert.equal(result.ratio,0.417);assert.deepEqual(result.crossed,[]);
 assert.deepEqual(classified.tests.sort(),["src/util.test.ts","tests/test_app.py"]);
});
test("metrics on this repository: git listing; src, bin, hooks, scripts, engine and tools are production; test/ is tests; docs and payload are excluded",async()=>{
 const {result,classified}=await computeMetrics(PACKAGE_ROOT);
 assert.equal(result.listing,"git");
 assert.ok(classified.production.includes("src/cli.mjs")&&classified.tests.includes("test/lifecycle.test.mjs"));
 assert.ok(classified.production.every(p=>/^(src|bin|hooks|scripts|engine|tools)\//.test(p)),classified.production.join());
 assert.ok(classified.tests.every(p=>p.startsWith("test/")),classified.tests.join());
});
test("test volume crosses above 90% of production LOC; 60-90% is the alert band",async t=>{
 // 5 hand-counted test lines + 6 = 11 of 12 production lines (92%); + 5 = 10 of 12 (83%) alerts only; the bare fixture (42%) is quiet.
 const over=await computeMetrics(await polyglot(t,{"tests/test_more.py":"a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6\n"}));
 assert.equal(over.result.ratio,0.917);assert.equal(over.result.crossed.length,1);assert.match(over.result.crossed[0],/^test volume 92% .*> 90%.*prune.*30%/);assert.deepEqual(over.result.alerts,[]);
 const under=await computeMetrics(await polyglot(t,{"tests/test_more.py":"a = 1\nb = 2\nc = 3\nd = 4\ne = 5\n"}));
 assert.equal(under.result.ratio,0.833);assert.deepEqual(under.result.crossed,[]);assert.equal(under.result.alerts.length,1);assert.match(under.result.alerts[0],/^test volume 83% .*alert band 60-90%/);
});
for(const file of ["architecture","spec"])test(`${file} memory: quiet under 18k tokens, alert from 18k to 30k, crossed above 30k`,async t=>{
 const at=async tokens=>(await computeMetrics(await polyglot(t,{[`agentic/${file}.md`]:"x".repeat(tokens*4)}))).result;
 const quiet=await at(17999);assert.deepEqual([quiet.alerts,quiet.crossed],[[],[]]);
 for(const n of [18000,30000]){const r=await at(n);assert.equal(r.tokens[file],n);assert.deepEqual(r.crossed,[]);assert.match(r.alerts[0],new RegExp(`agentic/${file}.md ~${n} tokens .*alert band`));}
 const over=await at(30001);assert.deepEqual(over.alerts,[]);assert.match(over.crossed[0],new RegExp(`agentic/${file}.md ~30001 tokens .*distill toward 9k`));
});
test("config overrides the test patterns and adds exclusions",async t=>{
 const root=await polyglot(t,{"checks/verify.go":"package checks\n\nfunc Verify() {}\n",".bridgecode/config.json":JSON.stringify({tests:["checks/**"],exclude:["lib/**"]})});
 const {result,classified}=await computeMetrics(root);
 assert.deepEqual(classified.tests,["checks/verify.go"]);
 assert.deepEqual(result.tests,{files:1,loc:2});assert.deepEqual(result.production,{files:5,loc:15});
});
test("criteria counts per goal and tag come from the rubric; the cache matches the --json output",async t=>{
 const rubric="TOKENS_USED: ~50\n## Goals\n### G1 Ingest\n- G1.C1 | CORE | a | scope: x | unsupported: y | evidence: z\n- G1.C2 | NON-CORE | b | scope: x | unsupported: y | evidence: z\n### G2 Report\n- G2.C1 | CORE | c | scope: x | unsupported: y | evidence: z\n- G2.C2 | CORE | d | scope: x | unsupported: y | evidence: z\n- G2.C3 | NON-CORE | e | scope: x | unsupported: y | evidence: z\n## Drop\n## Vetoes\n## Backlog\n- not a criterion\n";
 const root=await polyglot(t,{"agentic/rubric.md":rubric});
 const result=await runMetrics({project:root});
 assert.deepEqual(result.criteria,{G1:{CORE:1,"NON-CORE":1},G2:{CORE:2,"NON-CORE":1}});
 assert.equal(result.tokens.rubric,Math.ceil(rubric.replace(/^TOKENS_USED[^\n]*\n/,"").length/4),"the token line itself is not counted");
 const {t:_,...cached}=JSON.parse(await readFile(path.join(root,".bridgecode/metrics.json"),"utf8"));assert.deepEqual(cached,result);
 assert.ok((await readFile(path.join(root,"agentic/rubric.md"),"utf8")).startsWith(`TOKENS_USED: ~${result.tokens.rubric}\n`),"metrics writes the token line");
 assert.deepEqual(JSON.parse((await run(["metrics","--project",root,"--json"])).output),result);
});
