import { assertProjectDirectory, loadPackageContext, readOptional, METADATA_PATH, sha256, legacyContext, EDITIONS, assertEdition, payloadMap, ROLES_PATH } from "./manifest.mjs";
import { parseManagedAgents, buildManagedAgents, adoptUnmarkedAgents, adoptKnownUnmarked, adoptLegacy, migrateRules, ARCHITECTURE_PATH, IMPORT_NOTICE } from "./repo-rules.mjs";
import { removeBootstrap, parseBootstrap } from "./instructions.mjs";
import { mergeHooks } from "./hooks.mjs";
import { verifyInstalled, instructionBudget, releaseFor, installedEdition, installedExtensions } from "./verification.mjs";
import { normalizeExtensions, detectStandalones, standaloneMessage, planStandaloneRemoval, verifyStandalonesRemoved, replacedMessage } from "./extensions.mjs";
import { rmdir, stat } from "node:fs/promises";
import path from "node:path";
import { applyTransaction, JOURNAL } from "./transaction.mjs";

async function begin(project,packageRoot){
  const root=await assertProjectDirectory(project),context=await loadPackageContext(packageRoot);
  const preconditions={},cache=new Map();
  async function read(p){ if(!cache.has(p)){const b=await readOptional(root,p);cache.set(p,b);preconditions[p]=b?sha256(b):null;} return cache.get(p); }
  if(await read(JOURNAL))throw new Error("Pending transaction; run bridgecode recover before updating");
  // Journal is created by our own transaction after this preflight.
  delete preconditions[JOURNAL];
  const metadataBytes=await read(METADATA_PATH),metadata=metadataBytes?JSON.parse(metadataBytes):null;
  if(metadata?.schemaVersion===2 && metadata.projectRoot!==root)throw new Error("Installation belongs to a different path; relocate with a supported migration");
  const changes=new Map();
  async function set(p,bytes){
    const current=await read(p);
    if((current?sha256(current):null)!==(bytes?sha256(bytes):null))changes.set(p,bytes);else changes.delete(p);
  }
  return {root,context,preconditions,read,metadata,changes,set};
}
async function commit({root,preconditions,changes},check,dryRun,failAfterWrites){
  if(dryRun)return false;
  if(changes.size)await applyTransaction(root,[...changes].map(([p,content])=>({path:p,content})),{preconditions,postCheck:check,failAfterWrites});
  else if(check)await check();
  return true;
}

// A standalone cheapGPT or cLoop: without the user's yes, the removal plan; with it, exactly that removal and nothing of Bridgecode.
async function replaceStandalones(s,found,{command,project,edition,dryRun,replace,transactionFailAfterWrites}){
  const {root,read,metadata,set,changes}=s;
  const plan=await planStandaloneRemoval(read,root,found,{keepPermission:Boolean(metadata?.permission)});
  const base={command,projectRoot:root,dryRun,standalones:found,removal:plan.items.map(i=>({path:i.path,action:i.bytes===null?"remove":"edit",what:i.what})),folders:plan.dirs};
  if(!replace)return {...base,stopped:"standalones",output:standaloneMessage(found,plan,{project,edition})};
  for(const i of plan.items)await set(i.path,i.bytes);
  const journalDir=path.join(root,path.dirname(JOURNAL)),hadJournalDir=await stat(journalDir).then(()=>true,()=>false);
  const verified=await commit(s,()=>verifyStandalonesRemoved(p=>readOptional(root,p),found,plan),dryRun,transactionFailAfterWrites);
  if(verified){
    for(const d of plan.dirs)await rmdir(path.join(root,d));
    if(!hadJournalDir)await rmdir(journalDir).catch(()=>{}); // the transaction's journal folder; nothing of Bridgecode stays
    const left=await detectStandalones(p=>readOptional(root,p),root);
    if(left.length)throw new Error("Standalone removal incomplete: "+left.map(f=>f.name).join(", ")+" still detected");
  }
  return {...base,replaced:true,verified,changes:[...changes].map(([p,b])=>({path:p,action:b===null?"remove":"write"})),
    output:(dryRun?"DRY RUN, zero writes. ":"")+replacedMessage(found,{project,edition})};
}

export async function prepareLifecycle({command,project=".",packageRoot,dryRun=false,edition,extensions,noExtensions=false,hooks,replaceStandalones:replace=false,transactionFailAfterWrites=0}={}) {
  const s=await begin(project,packageRoot),{root,context,read,metadata,set,changes}=s;
  const standalones=await detectStandalones(read,root);
  if(standalones.length)return replaceStandalones(s,standalones,{command,project,edition,dryRun,replace,transactionFailAfterWrites});
  if(replace)throw new Error("No standalone cheapGPT or cLoop is installed here; run bridgecode "+command+" without --replace-standalones");
  const recorded=metadata?installedEdition(metadata):null;
  if(edition!==undefined)assertEdition(edition);
  if(recorded&&edition&&edition!==recorded)throw new Error(`Installed edition is ${recorded}. Changing the edition is an uninstall and a fresh install (agentic/ is preserved): run bridgecode uninstall, then bridgecode install --edition ${edition}`);
  const ed=recorded??edition??"codex",{instruction,hookConfig,hookPath}=EDITIONS[ed];
  const extensionIds=noExtensions?[]:extensions?.length?normalizeExtensions(extensions):installedExtensions(metadata);
  const version=context.packageJson.version;
  const release=await releaseFor(context,version,{edition:ed,extensions:extensionIds});

  const text=(await read(instruction))?.toString("utf8")??"";
  let parsed=parseManagedAgents(text),rules="",mode="",adoptedLegacy=false,legacyOutside="",oldHashes={};
  if(metadata){await verifyInstalled(context,metadata,read);mode="replace managed core";}
  else if(parsed)throw new Error("Marked installation has no trustworthy metadata; recover installation metadata first");
  else if(adoptUnmarkedAgents(text,release.agents)){mode="adopt current source";}
  else if(ed==="codex"&&/^# Bridgecode (4\.3(?:\.[12])?)\s*$/m.test(text)){
    const v=/^# Bridgecode (4\.3(?:\.[12])?)\s*$/m.exec(text)[1];
    const old=await legacyContext(context.packageRoot,v==="4.3"?"4.3.0":v);
    parsed=adoptKnownUnmarked(text,old.files["AGENTS.md"]);oldHashes=old.hashes;mode="adopt legacy "+v;
  }
  else if(ed==="codex"&&(text.includes("Bridgecode 4.1 Processflow Router")||text.includes("## 5) Specific Repo Rules"))){
    const old=await legacyContext(context.packageRoot);
    const adopted=adoptLegacy(text,old.files["AGENTS.md"]);
    rules=adopted.rules;legacyOutside=adopted.outside;oldHashes=old.hashes;adoptedLegacy=true;mode="adopt legacy 4.1";
  }else{
    if(command==="update")throw new Error("Bridgecode is not installed; run install");
    if(parseBootstrap(text))throw new Error("Unrecorded bootstrap ownership: "+instruction);
    if(/Bridgecode\s+\d/i.test(text))throw new Error("Unrecognized Bridgecode source in "+instruction+"; export and reconcile it before installation");
    mode=text?"place managed core before repository instructions":"create "+instruction;
  }
  const block=buildManagedAgents(release.agents,version);
  if(parsed)rules=parsed.rules;
  const architecture=(await read(ARCHITECTURE_PATH))?.toString("utf8");
  const migrated=migrateRules(adoptedLegacy?legacyOutside:mode==="adopt current source"?"":text,parsed,rules,block,architecture);
  await set(instruction,Buffer.from(migrated.agents));
  if(migrated.architecture!==architecture)await set(ARCHITECTURE_PATH,Buffer.from(migrated.architecture));

  const previousManaged=metadata?.managedFiles??Object.fromEntries(Object.entries(oldHashes).filter(([p])=>p!=="AGENTS.md"));
  const desired={},sources=payloadMap(ed);
  for(const [p,h]of Object.entries(release.files)){
    const current=await read(p);
    if(current&&!Object.hasOwn(previousManaged,p)&&(mode!=="adopt current source"||sha256(current)!==h))throw new Error("New payload path conflicts with repository content: "+p);
    if(current&&Object.hasOwn(previousManaged,p)&&sha256(current)!==previousManaged[p])throw new Error("Managed file conflict: "+p);
    desired[p]=h;await set(p,Buffer.from(context.texts[sources[p]]));
  }
  // The resolved role assignment for the engine; generated, so outside the owned set.
  await set(ROLES_PATH,Buffer.from(JSON.stringify(release.ext.rolesJson,null,2)+"\n"));

  const hooksEnabled=hooks??metadata?.hooksEnabled??true;
  const needPermission=ed==="exp"&&release.ext.needsCodexExec;
  const previousPermission=metadata?.permission??null;
  let hookEntryHashes=null,permission=null,hookConfigCreated=Boolean(metadata?.hookConfigCreated);
  if(hooksEnabled||metadata?.hooksEnabled||needPermission||previousPermission){
    const current=await read(hookPath);
    if(current && !Object.hasOwn(previousManaged,hookPath))throw new Error("Unowned hook script collision");
    const configBytes=await read(hookConfig);
    // Whether Bridgecode created the config is decidable only while it owns nothing in it.
    if(!metadata?.hooksEnabled&&!previousPermission)hookConfigCreated=!configBytes;
    const merged=mergeHooks(configBytes,root,metadata?.hooksEnabled?metadata.hookEntries:null,hooksEnabled,ed,(needPermission||previousPermission)?{need:needPermission,added:previousPermission?.added}:null);
    await set(hookConfig,merged.empty&&hookConfigCreated?null:merged.bytes);
    if(hooksEnabled){desired[hookPath]=sha256(context.hook);await set(hookPath,context.hook);hookEntryHashes=merged.entries;}
    if(needPermission)permission={added:merged.permissionAdded};
  }
  for(const [p,h]of Object.entries(previousManaged)){
    if(Object.hasOwn(desired,p))continue;
    const bytes=await read(p);
    if(bytes && sha256(bytes)!==h)throw new Error("Retired managed file was modified: "+p);
    if(bytes)await set(p,null);
  }
  // 4.3 bootstraps are retired: --edition replaces them.
  for(const p of Object.keys(metadata?.bootstraps??{})){
    const out=removeBootstrap((await read(p))?.toString("utf8")??"");
    await set(p,out.trim()?Buffer.from(out):null);
  }
  const all=[...Object.keys(desired),instruction,hookConfig,METADATA_PATH];
  if(new Set(all.map(p=>p.toLowerCase())).size!==all.length)throw new Error("Managed target paths alias each other");
  const parsedNext=parseManagedAgents(migrated.agents);
  const next={package:"@bridgecode/cli",version,schemaVersion:2,projectRoot:root,edition:ed,
    extensions:extensionIds.map((id,i)=>({id,turnLine:release.ext.turnLines[i]})),
    instructionFiles:[],managedFiles:desired,agents:{path:instruction,managedHash:parsedNext.managedHash},bootstraps:{},
    hooksEnabled,hookEntries:hookEntryHashes,hookConfigCreated,permission};
  await set(METADATA_PATH,Buffer.from(JSON.stringify(next,null,2)+"\n"));
  const projected=async p=>changes.has(p)?changes.get(p):read(p);
  await instructionBudget(projected,instruction);
  await verifyInstalled(context,next,projected);
  const summary={command,projectRoot:root,version,edition:ed,extensions:extensionIds,assignment:release.ext.line,dryRun,agentsMode:mode,instruction,
    changes:[...changes].map(([p,b])=>({path:p,action:b===null?"remove verified managed file":"write"})),
    migrationPending:migrated.architecture?.includes(IMPORT_NOTICE)??false,hooksEnabled,permission,adoption:!/^4\.[56]\./.test(metadata?.version??""),verified:false};
  summary.verified=await commit(s,async()=>{await verifyInstalled(context,next,p=>readOptional(root,p));},dryRun,transactionFailAfterWrites);
  return summary;
}
export const installBridgecode = options => prepareLifecycle({...options,command:"install"});

// Removes only what Bridgecode owns; agentic/, metrics, config and reports stay.
export async function uninstallBridgecode({project=".",packageRoot,dryRun=false,transactionFailAfterWrites=0}={}) {
  const s=await begin(project,packageRoot),{root,context,read,metadata,set,changes}=s;
  if(!metadata)throw new Error("Bridgecode is not installed");
  const {release}=await verifyInstalled(context,metadata,read);
  const text=(await read(release.instruction)).toString("utf8"),parsed=parseManagedAgents(text);
  let start=parsed.start,end=parsed.end;
  if(text.startsWith("\r\n",end))end+=2;else if(text.startsWith("\n",end))end+=1;
  const rest=text.slice(0,start)+text.slice(end);
  await set(release.instruction,rest.trim()?Buffer.from(rest):null);
  for(const p of Object.keys(metadata.managedFiles))await set(p,null);
  if(await read(ROLES_PATH))await set(ROLES_PATH,null);
  for(const p of Object.keys(metadata.bootstraps)){
    const out=removeBootstrap((await read(p)).toString("utf8"));
    await set(p,out.trim()?Buffer.from(out):null);
  }
  if(metadata.hooksEnabled||metadata.permission){
    const merged=mergeHooks(await read(release.hookConfig),root,metadata.hooksEnabled?metadata.hookEntries:null,false,release.edition,metadata.permission?{need:false,added:metadata.permission.added}:null);
    await set(release.hookConfig,merged.empty&&metadata.hookConfigCreated?null:merged.bytes);
  }
  await set(METADATA_PATH,null);
  const summary={command:"uninstall",projectRoot:root,version:metadata.version,edition:release.edition,dryRun,agentsMode:"remove managed core",instruction:release.instruction,
    changes:[...changes].map(([p,b])=>({path:p,action:b===null?"remove":"write"})),migrationPending:false,hooksEnabled:false,verified:false};
  summary.verified=await commit(s,async()=>{if(await readOptional(root,METADATA_PATH))throw new Error("Installation state remains");},dryRun,transactionFailAfterWrites);
  return summary;
}

export function formatLifecycleSummary(s){
  if(s.standalones)return s.output;
  if(s.command==="uninstall")return [
    `${s.dryRun?"DRY RUN":"DONE"}: Bridgecode ${s.version} uninstall (${s.edition}) for ${s.projectRoot}`,
    ...(s.changes.map(c=>c.action+": "+c.path)),
    "agentic/ and .bridgecode/ metrics, config and reports are preserved.",
  ].join("\n");
  return [
    `${s.dryRun?"DRY RUN":"DONE"}: Bridgecode ${s.version} ${s.command} (${s.edition} edition) for ${s.projectRoot}`,
    `${s.instruction}: ${s.agentsMode}`,
    s.assignment,
    ...(s.changes.length?s.changes.map(c=>c.action+": "+c.path):["No changes required; installation is idempotent."]),
    s.dryRun?"Projected verification passed; zero writes.":"Doctor passed for the installed payload and registration.",
    s.migrationPending?"Repo rules are preserved in agentic/architecture.md. URGENT: imported constraints remain binding and unverified until reconciled with code/tests; implement corrections only within authorized scope.":"No imported rules are flagged for verification.",
    s.hooksEnabled?`Hooks configured, not runtime-certified. Trust this project and review /hooks.`:"Hooks disabled; the agent follows the instruction file directly.",
    s.permission?`Permission ${s.permission.added?"added":"found"}: Bash(codex exec:*) in .claude/settings.json.`:"",
    s.adoption&&!s.dryRun?"Recommended first task if this project already has plans, rubrics, specs or architecture notes: ask the agent to \"run the Bridgecode adoption task\" (bridgecode/memory.md, ADOPTION), which rewrites them into the memory templates without changing product behaviour.":"",
    "Start a fresh task/session after installing or updating.",
  ].filter(Boolean).join("\n");
}
