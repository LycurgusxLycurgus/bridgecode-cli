import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertHashMap, sha256, METADATA_PATH, HOOK_PATH, readOptional } from './manifest.mjs';
import { parseManagedAgents, buildManagedAgents, buildLegacyAgents, isRulesPopulated } from './repo-rules.mjs';
import { parseBootstrap, buildBootstrap, buildLegacyBootstrap } from './instructions.mjs';
import { HOOK_CONFIG, parseHookConfig, hookEntries, entryHash } from './hooks.mjs';

export function sameKeys(a,b) {return JSON.stringify(Object.keys(a).sort())===JSON.stringify(Object.keys(b).sort());}
export async function releaseFor(context,version) {
  if(version===context.packageJson.version)return {schemaVersion:2,version,files:context.manifest.files,agents:(await readFile(path.join(context.packageRoot,'AGENTS.md'))).toString('utf8'),hookHash:context.manifest.hookHash};
  if(!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))throw new Error('Invalid installed version');
  const old=JSON.parse(await readFile(path.join(context.packageRoot,'legacy',version+'.json'),'utf8').catch(()=>{throw new Error('No trusted migration snapshot for '+version+'; use a release supporting that version');}));
  if(old.version!==version)throw new Error('Legacy version mismatch');
  return {schemaVersion:old.schemaVersion,version,files:Object.fromEntries(Object.entries(old.files).map(([p,s])=>[p,sha256(Buffer.from(s))])),agents:old.files['AGENTS.md'],hookHash:old.hookHash};
}
export async function verifyInstalled(context,metadata,read) {
  if(metadata.package!=='@bridgecode/cli'||![1,2].includes(metadata.schemaVersion))throw new Error('Unsupported installation metadata');
  const release=await releaseFor(context,metadata.version);
  if(release.schemaVersion!==metadata.schemaVersion)throw new Error('Installed schema mismatch');
  assertHashMap(metadata.managedFiles,'managed metadata path');
  assertHashMap(metadata.bootstraps,'bootstrap metadata path');
  const expected={...release.files};delete expected['AGENTS.md'];
  if(metadata.schemaVersion===2){
    if(typeof metadata.hooksEnabled!=='boolean')throw new Error('Missing hooks mode');
    if(metadata.hooksEnabled)expected[HOOK_PATH]=release.hookHash;
  }
  if(!sameKeys(expected,metadata.managedFiles))throw new Error('Incomplete or unexpected managed file coverage');
  for(const [p,h]of Object.entries(expected)){
    const bytes=await read(p);
    if(metadata.managedFiles[p]!==h||!bytes||sha256(bytes)!==h)throw new Error('Managed file conflict: '+p);
  }
  const bytes=await read('AGENTS.md');
  const parsed=bytes&&parseManagedAgents(bytes.toString('utf8'));
  if(!parsed||parsed.version!==release.version||parsed.schema!==release.schemaVersion)throw new Error('Managed AGENTS identity conflict');
  const template=parsed.schema===1&&parsed.managed.split('\n',1)[0].endsWith('\r')?release.agents.replaceAll('\r\n','\n').replaceAll('\n','\r\n'):release.agents;
  const canonical=parsed.schema===1?buildLegacyAgents(template,release.version,parsed.rules):buildManagedAgents(template,release.version);
  if(parsed.managed!==canonical||parsed.managedHash!==metadata.agents?.managedHash||metadata.agents?.path!=='AGENTS.md')throw new Error('Managed AGENTS.md differs from canonical release');
  if(!Array.isArray(metadata.instructionFiles)||metadata.instructionFiles.length!==new Set(metadata.instructionFiles).size||!sameKeys(Object.fromEntries(metadata.instructionFiles.map(p=>[p,0])),metadata.bootstraps))throw new Error('Incomplete bootstrap coverage');
  for(const p of metadata.instructionFiles){
    if(Object.keys(expected).some(k=>k.toLowerCase()===p.toLowerCase())||p.toLowerCase()==='agents.md'||/^(?:\.git|\.agents|\.codex|\.bridgecode|agentic)(?:\/|$)/i.test(p))throw new Error('Reserved bootstrap target');
    const b=await read(p),block=b&&parseBootstrap(b.toString('utf8'));
    const eol=block?.block.includes('\r\n')?'\r\n':'\n';
    const build=release.schemaVersion===1?buildLegacyBootstrap:buildBootstrap;
    if(!block||block.block!==build(release.version,eol)||block.hash!==metadata.bootstraps[p])throw new Error('Managed bootstrap conflict: '+p);
  }
  if(metadata.hooksEnabled){
    const config=parseHookConfig(await read(HOOK_CONFIG)),expectedEntries=hookEntries(metadata.projectRoot);
    if(!metadata.hookEntries||!sameKeys(expectedEntries,metadata.hookEntries))throw new Error('Incomplete hook coverage');
    for(const [event,entry]of Object.entries(expectedEntries)){
      const owned=(config.hooks[event]??[]).filter(e=>e.hooks?.some(h=>h.command?.includes('bridgecode-turn.mjs')));
      if(owned.length!==1||entryHash(owned[0])!==entryHash(entry)||metadata.hookEntries[event]!==entryHash(entry))throw new Error('Managed hook entry conflict: '+event);
    }
  }else if(metadata.schemaVersion===2 && metadata.hookEntries!==null)throw new Error('Unexpected hook metadata');
  return {parsed,migrationPending:isRulesPopulated(parsed.rules)};
}
export async function instructionBudget(read) {
  // This measures the project root file only; host/global/ancestor layers are not certified.
  const bytes=await read('AGENTS.md');
  return bytes?.length??0;
}
