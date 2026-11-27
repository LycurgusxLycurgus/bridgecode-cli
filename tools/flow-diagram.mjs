#!/usr/bin/env node
// The README's flow diagram and ladder table, generated from engine/flow.json so the two cannot drift.
// Vendored from cLoop 1.2.0 (585f9c7afe66d53f37c92a221562021883ae1066) tools/flow-diagram.mjs.
//   node tools/flow-diagram.mjs           rewrite the block between <!-- flow:start … --> and <!-- flow:end --> in README.md
//   node tools/flow-diagram.mjs --check   exit 1 when README.md differs from what flow.json generates
//   --flow <path> --readme <path>         other files (tests)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
const flowPath = opt('--flow', path.join(ROOT, 'engine', 'flow.json')), readmePath = opt('--readme', path.join(ROOT, 'README.md'));
const START = '<!-- flow:start (generated from engine/flow.json by tools/flow-diagram.mjs; do not edit) -->', END = '<!-- flow:end -->';

export function diagram(flow) {
  const lines = ['```mermaid', 'flowchart LR'];
  for (const [k, v] of Object.entries(flow.states)) for (const t of v.next) lines.push(`  ${k} --> ${t}`);
  lines.push('  subgraph ladder [the ladder: rungs and the state each leads to]', '    direction LR');
  for (const [r, v] of Object.entries(flow.rungs)) lines.push(`    ${r}["${r} (${v.state})"]`);
  const edges = {}, nth = (n) => (n === 1 ? '' : n === 2 ? '2nd ' : n === 3 ? '3rd ' : `${n}th `);
  for (const from of Object.keys(flow.rungs)) for (const o of ['ADVANCED', 'STALLED', 'REGRESSION']) {
    const [n, to] = flow.ladder[from][o]; if (to === from) continue;
    (edges[`${from}|${to}`] ||= []).push(nth(n) + o);
  }
  for (const [k, labels] of Object.entries(edges)) { const [from, to] = k.split('|'); lines.push(`    ${from} -->|${labels.join(', ')}| ${to}`); }
  for (const r of Object.keys(flow.rungs)) if (r !== flow.ladder.pass) lines.push(`    ${r} -->|PASS| ${flow.ladder.pass}`);
  lines.push(`    blocked((BLOCKED)) --> ${flow.ladder.blocked}`, '  end', '```');
  return lines.join('\n') + '\n\n' + ladderTable(flow);
}

// The ladder as a table: per rung, how many outcomes of each kind move the task, and to which rung.
export function ladderTable(flow) {
  const nth = (n) => ['', '1st', '2nd', '3rd'][n] || `${n}th`;
  const cell = ([n, to], from) => (to === from ? 'stays' : `${nth(n)} → \`${to}\``);
  const rows = Object.entries(flow.rungs).map(([r, v]) => `| \`${r}\` | ${v.state}: ${v.says} | ${['ADVANCED', 'STALLED', 'REGRESSION'].map((o) => cell(flow.ladder[r][o], r)).join(' | ')} |`);
  return ['| Rung | State and what happens | ADVANCED | STALLED | REGRESSION |', '| --- | --- | --- | --- | --- |', ...rows, '', `PASS returns to \`${flow.ladder.pass}\`; BLOCKED goes to \`${flow.ladder.blocked}\`. Outcomes are counted per rung since the last PASS or rung change; the cell names which outcome of that kind moves the rung.`].join('\n');
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  const flow = JSON.parse(fs.readFileSync(flowPath, 'utf8')), readme = fs.readFileSync(readmePath, 'utf8');
  const a = readme.indexOf(START), b = readme.indexOf(END);
  if (a < 0 || b < a) { console.error(`${readmePath}: no flow block (${START} … ${END})`); process.exit(1); }
  const next = readme.slice(0, a) + START + '\n' + diagram(flow) + '\n' + readme.slice(b);
  if (args.includes('--check')) {
    if (next !== readme) { console.error('README flow diagram differs from engine/flow.json: run node tools/flow-diagram.mjs'); process.exit(1); }
    console.log('README flow diagram matches engine/flow.json');
  } else { fs.writeFileSync(readmePath, next); console.log('README flow diagram written'); }
}
