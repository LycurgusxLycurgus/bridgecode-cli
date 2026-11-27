import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assertHashMap, sha256, EDITIONS, LEGACY_HOOK_PATH, assertEdition, payloadMap, editionSource, RESERVED } from './manifest.mjs';
import { parseManagedAgents, buildManagedAgents, buildLegacyAgents, isRulesPopulated } from './repo-rules.mjs';
import { parseBootstrap, buildBootstrap, buildLegacyBootstrap } from './instructions.mjs';
import { parseHookConfig, hookEntries, entryHash, ownedEntries } from './hooks.mjs';
import { resolveExtensions, CODEX_EXEC_PERMISSION } from './extensions.mjs';

export function sameKeys(a,b) {return JSON.stringify(Object.keys(a).sort())===JSON.stringify(Object.keys(b).sort());}

// One edition's release from a payload keyed by package path (the current package or a 4.6+ snapshot).
export function editionRelease({version,edition,extensions,text,hash,hookHash}) {
  const ext=resolveExtensions(edition,extensions,text);
  const files={};
  for(const [target,source]of Object.entries(payloadMap(edition)))files[target]=hash(source);
  const {instruction,hookPath,hookConfig}=EDITIONS[edition];
  return {legacy:false,schemaVersion:2,version,edition,instruction,hookPath,hookConfig,files,hookHash,ext,
    agents:text(editionSource(edition,instruction))};
}
export async function releaseFor(context,version,{edition='codex',extensions=[]}={}) {
  assertEdition(edition);
  if(version===context.packageJson.version)return editionRelease({version,edition,extensions,text:p=>context.texts[p],hash:p=>context.manifest.files[p],hookHash:context.manifest.hookHash});
  if(!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version))throw new Error('Invalid installed version');
  const old=JSON.parse(await readFile(path.join(context.packageRoot,'legacy',version+'.json'),'utf8').catch(()=>{throw new Error('No trusted migration snapshot for '+version+'; use a release supporting that version');}));
  if(old.version!==version)throw new Error('Legacy version mismatch');
  if(old.format===3){
    const text=p=>{if(typeof old.files[p]!=='string')throw new Error('Snapshot '+version+' lacks '+p);return old.files[p];};
    return editionRelease({version,edition,extensions,text,hash:p=>sha256(Buffer.from(text(p))),hookHash:old.hookHash});
  }
  // 4.1.0-4.3.2 snapshots are keyed by install path and predate editions and extensions.
  if(edition!=='codex'||extensions.length)throw new Error('Installation metadata names an edition '+version+' did not have');
  const files=Object.fromEntries(Object.entries(old.files).filter(([p])=>p!=='AGENTS.md').map(([p,s])=>[p,sha256(Buffer.from(s))]));
  return {legacy:true,schemaVersion:old.schemaVersion,version,edition:'codex',instruction:'AGENTS.md',hookPath:LEGACY_HOOK_PATH,hookConfig:EDITIONS.codex.hookConfig,files,hookHash:old.hookHash,agents:old.files['AGENTS.md'],ext:null};
}
export const installedEdition = metadata => metadata?.edition ?? 'codex';
export const installedExtensions = metadata => (metadata?.extensions ?? []).map(e => e.id);

export async function verifyInstalled(context,metadata,read) {
  if(metadata.package!=='@bridgecode/cli'||![1,2].includes(metadata.schemaVersion))throw new Error('Unsupported installation metadata');
  if(metadata.extensions!==undefined&&(!Array.isArray(metadata.extensions)||metadata.extensions.some(e=>typeof e?.id!=='string')))throw new Error('Invalid extension metadata');
  const release=await releaseFor(context,metadata.version,{edition:installedEdition(metadata),extensions:installedExtensions(metadata)});
  if(release.schemaVersion!==metadata.schemaVersion)throw new Error('Installed schema mismatch');
  assertHashMap(metadata.managedFiles,'managed metadata path');
  assertHashMap(metadata.bootstraps,'bootstrap metadata path');
  const expected={...release.files};
  if(metadata.schemaVersion===2){
    if(typeof metadata.hooksEnabled!=='boolean')throw new Error('Missing hooks mode');
    if(metadata.hooksEnabled)expected[release.hookPath]=release.hookHash;
  }
  if(!sameKeys(expected,metadata.managedFiles))throw new Error('Incomplete or unexpected managed file coverage');
  for(const [p,h]of Object.entries(expected)){
    const bytes=await read(p);
    if(metadata.managedFiles[p]!==h||!bytes||sha256(bytes)!==h)throw new Error('Managed file conflict: '+p);
  }
  const bytes=await read(release.instruction);
  const parsed=bytes&&parseManagedAgents(bytes.toString('utf8'));
  if(!parsed||parsed.version!==release.version||parsed.schema!==release.schemaVersion)throw new Error('Managed '+release.instruction+' identity conflict');
  const template=parsed.schema===1&&parsed.managed.split('\n',1)[0].endsWith('\r')?release.agents.replaceAll('\r\n','\n').replaceAll('\n','\r\n'):release.agents;
  const canonical=parsed.schema===1?buildLegacyAgents(template,release.version,parsed.rules):buildManagedAgents(template,release.version);
  if(parsed.managed!==canonical||parsed.managedHash!==metadata.agents?.managedHash||metadata.agents?.path!==release.instruction)throw new Error('Managed '+release.instruction+' differs from canonical release');
  if(!release.legacy){
    if(JSON.stringify((metadata.extensions??[]).map(e=>e.turnLine))!==JSON.stringify(release.ext.turnLines))throw new Error('Extension state differs from the package');
    if(metadata.instructionFiles?.length||Object.keys(metadata.bootstraps).length)throw new Error('Unexpected bootstrap metadata');
  }
  if(!Array.isArray(metadata.instructionFiles)||metadata.instructionFiles.length!==new Set(metadata.instructionFiles).size||!sameKeys(Object.fromEntries(metadata.instructionFiles.map(p=>[p,0])),metadata.bootstraps))throw new Error('Incomplete bootstrap coverage');
  for(const p of metadata.instructionFiles){
    if(Object.keys(expected).some(k=>k.toLowerCase()===p.toLowerCase())||p.toLowerCase()==='agents.md'||RESERVED.test(p))throw new Error('Reserved bootstrap target');
    const b=await read(p),block=b&&parseBootstrap(b.toString('utf8'));
    const eol=block?.block.includes('\r\n')?'\r\n':'\n';
    const build=release.schemaVersion===1?buildLegacyBootstrap:buildBootstrap;
    if(!block||block.block!==build(release.version,eol)||block.hash!==metadata.bootstraps[p])throw new Error('Managed bootstrap conflict: '+p);
  }
  const config=(metadata.hooksEnabled||metadata.permission)?parseHookConfig(await read(release.hookConfig)):null;
  if(metadata.hooksEnabled){
    const expectedEntries=hookEntries(metadata.projectRoot,release.edition,release.legacy);
    if(!metadata.hookEntries||!sameKeys(expectedEntries,metadata.hookEntries))throw new Error('Incomplete hook coverage');
    for(const [event,entry]of Object.entries(expectedEntries)){
      const owned=ownedEntries(config.hooks[event]);
      if(owned.length!==1||entryHash(owned[0])!==entryHash(entry)||metadata.hookEntries[event]!==entryHash(entry))throw new Error('Managed hook entry conflict: '+event);
    }
  }else if(metadata.schemaVersion===2 && metadata.hookEntries!==null)throw new Error('Unexpected hook metadata');
  if(!release.legacy){
    const need=release.edition==='exp'&&release.ext.needsCodexExec;
    if(Boolean(metadata.permission)!==need)throw new Error('Permission ownership does not match the active extensions');
    if(need&&!(config.permissions?.allow??[]).includes(CODEX_EXEC_PERMISSION))throw new Error('Managed permission missing: '+CODEX_EXEC_PERMISSION);
  }
  return {parsed,release,migrationPending:isRulesPopulated(parsed.rules)};
}
// The size of the installed instruction file is reported, never gated.
export async function instructionBudget(read,instruction='AGENTS.md') {
  const bytes=await read(instruction);
  return bytes?.length??0;
}
