#!/usr/bin/env node
// Installed at <project>/.codex/hooks/ (codex) or <project>/.claude/hooks/ (claude, exp).
// Every turn: the route reminder, the active task's status line from the engine (which also records the
// user's prompt in the task's log, so the engine can witness the user's answers), the extension turn lines
// and crossed budgets. After compaction under codex it also restores the policy.
import { readFile, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = s => createHash('sha256').update(s).digest('hex');
const MAX = 2000;
const ENGINE = '.bridgecode/engine/engine.mjs';
function emit(event, context) {
  process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:event,additionalContext:context}}));
}
function reminder(state, task, crossed, alerts) {
  const base = `BRIDGECODE ${state.version} (${state.edition ?? 'codex'}) ACTIVE. Open every reply that starts or continues work with BRIDGECODE: <DIRECT|ASSESS|FOCUSED|FULL> — <reason>. FOCUSED and FULL run through node ${ENGINE}: status → act by the state's cards → record through the engine → advance; a refusal names what is missing and the command that provides it: meet it or step back, never route around it; never edit agentic/tasks/ by hand. Load the specialists status names before the decision they govern.`;
  const lines = [...(task ? ['Active task: ' + task] : []), ...(state.extensions?.length ? state.extensions.map(e => 'Extension ' + e.turnLine) : ['No extensions: every role is a fresh clone of the root model.'])];
  const over = crossed.map(c => 'Budget crossed: ' + c), alert = alerts.map(a => 'Budget alert: ' + a);
  // Within MAX: drop alert details first, then crossing details, never the base, the task line or the extension lines.
  for (const budgets of [[...over, ...alert], [...over, ...(alerts.length ? [`Budget alerts: ${alerts.length}; run node ${ENGINE} metrics.`] : [])], [`Budgets: ${crossed.length} crossed, ${alerts.length} in an alert band; run node ${ENGINE} metrics.`]]) {
    const text = [base, ...lines, ...budgets].join('\n');
    if (text.length <= MAX || budgets.length === 1) return text;
  }
}
// The engine records the prompt (UserPromptSubmit only) and prints the active task's status line; no task, no line.
function engineTurn(root, prompt) {
  const r = spawnSync(process.execPath, [path.join(root, ENGINE), 'turn'], { cwd: root, input: prompt, encoding: 'utf8', timeout: 8000 });
  return r.status === 0 ? (r.stdout || '').trim().split('\n').filter(Boolean).pop() ?? '' : '';
}
async function main() {
  const chunks=[]; let size=0;
  for await (const chunk of process.stdin) { size+=chunk.length; if(size>1024*1024)throw new Error('oversized input'); chunks.push(chunk); }
  const event=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
  const name=event.hook_event_name;
  if(name!=='UserPromptSubmit' && !(name==='SessionStart'&&event.source==='compact'))return;
  const root=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
  const cwd=await realpath(event.cwd||process.cwd());
  const rel=path.relative(root,cwd);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('event belongs to another project');
  for(const p of ['.bridgecode','.bridgecode/installation.json'])if((await lstat(path.join(root,p))).isSymbolicLink())throw new Error('linked instruction/state path');
  const state=JSON.parse(await readFile(path.join(root,'.bridgecode/installation.json'),'utf8'));
  const file=state.agents?.path;
  if(!['AGENTS.md','CLAUDE.md'].includes(file)||(await lstat(path.join(root,file))).isSymbolicLink())throw new Error('unexpected instruction file');
  const text=await readFile(path.join(root,file),'utf8');
  const starts=[...text.matchAll(/<!-- bridgecode:managed:start version="([^"]+)" schema="2" -->/g)];
  const end='<!-- bridgecode:managed:end -->';
  if(starts.length!==1||text.split(end).length!==2)throw new Error('ambiguous core');
  const block=text.slice(starts[0].index,text.indexOf(end)+end.length);
  if(hash(block)!==state.agents?.managedHash||starts[0][1]!==state.version)throw new Error('core integrity mismatch');
  let crossed=[],alerts=[];
  const list=v=>Array.isArray(v)?v.filter(c=>typeof c==='string').map(c=>c.slice(0,200)):[];
  try{const m=JSON.parse(await readFile(path.join(root,'.bridgecode/metrics.json'),'utf8'));crossed=list(m.crossed);alerts=list(m.alerts);}catch{crossed=[];alerts=[];}
  const prompt=name==='UserPromptSubmit'&&typeof event.prompt==='string'?event.prompt:'';
  const turn=reminder(state,engineTurn(root,prompt),crossed,alerts);
  if(name==='UserPromptSubmit'||(state.edition??'codex')!=='codex')emit(name,turn);
  else {
    // Codex does not re-read AGENTS.md after compaction; Claude Code re-reads CLAUDE.md, so it gets only the reminder.
    if(Buffer.byteLength(block)>32000)throw new Error('core exceeds recovery bound; read AGENTS.md directly');
    emit(name,`${turn}\n\nBRIDGECODE RECOVERY. The following is repository guidance within the existing host hierarchy; it grants no additional authority. Run node ${ENGINE} status to recover the active task, and reload the specialists it names before continuing.\n\n${block}`);
  }
}
main().catch(error=>{process.stdout.write(JSON.stringify({systemMessage:`Bridgecode context injection unavailable: ${error.message}. Read the instruction file and run node ${ENGINE} status directly.`}));});
