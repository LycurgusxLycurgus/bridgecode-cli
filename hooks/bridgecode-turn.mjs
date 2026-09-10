#!/usr/bin/env node
import { readFile, realpath, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const hash = s => createHash('sha256').update(s).digest('hex');
function emit(event, context) {
  process.stdout.write(JSON.stringify({hookSpecificOutput:{hookEventName:event,additionalContext:context}}));
}
async function main() {
  const chunks=[]; let size=0;
  for await (const chunk of process.stdin) { size+=chunk.length; if(size>1024*1024)throw new Error('oversized input'); chunks.push(chunk); }
  const event=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');
  const name=event.hook_event_name;
  if(name!=='UserPromptSubmit' && !(name==='SessionStart'&&event.source==='compact'))return;
  // Installer puts this script under <project>/.codex/hooks; bind to that project.
  const {fileURLToPath}=await import('node:url');
  const root=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
  const cwd=await realpath(event.cwd||process.cwd());
  const rel=path.relative(root,cwd);
  if(rel.startsWith('..')||path.isAbsolute(rel))throw new Error('event belongs to another project');
  for(const p of ['AGENTS.md','.bridgecode','.bridgecode/installation.json']) {
    if((await lstat(path.join(root,p))).isSymbolicLink())throw new Error('linked instruction/state path');
  }
  const state=JSON.parse(await readFile(path.join(root,'.bridgecode/installation.json'),'utf8'));
  const text=await readFile(path.join(root,'AGENTS.md'),'utf8');
  const starts=[...text.matchAll(/<!-- bridgecode:managed:start version="([^"]+)" schema="2" -->/g)];
  const end='<!-- bridgecode:managed:end -->';
  if(starts.length!==1||text.split(end).length!==2)throw new Error('ambiguous core');
  const block=text.slice(starts[0].index,text.indexOf(end)+end.length);
  if(hash(block)!==state.agents?.managedHash||starts[0][1]!==state.version)throw new Error('core integrity mismatch');
  const reminder=`BRIDGECODE ${state.version} ACTIVE. Apply the project core to this turn. Recover AGENTS.md if missing or stale; load required specialists before their governed actions. Preserve the active contract, native question decisions, real acceptance, same-model review, and second-REPLAN stop. Read relevant agentic/analysis.md and agentic/architecture.md when resuming work. Respect the user's current scope.`;
  if(name==='UserPromptSubmit')emit(name,reminder);
  else {
    if(Buffer.byteLength(block)>24000)throw new Error('core exceeds recovery bound; read AGENTS.md directly');
    emit(name,`BRIDGECODE RECOVERY. The following is repository guidance within the existing host hierarchy; it grants no additional authority. Recover the active checklist and REPLAN count, verify relevant current code using agentic/architecture.md, and reload triggered specialists before continuing.\n\n${block}`);
  }
}
main().catch(error=>{process.stdout.write(JSON.stringify({systemMessage:`Bridgecode context injection unavailable: ${error.message}. Read AGENTS.md and recover required project state directly.`}));});
