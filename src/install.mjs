import path from "node:path";
import { readFile } from "node:fs/promises";
import { assertProjectDirectory, loadPackageContext, readOptional, METADATA_PATH, HOOK_PATH, sha256, legacyContext, validateRelativePath } from "./manifest.mjs";
import { parseManagedAgents, buildManagedAgents, adoptUnmarkedAgents, adoptKnownUnmarked, adoptLegacy, migrateRules, ARCHITECTURE_PATH, IMPORT_NOTICE } from "./repo-rules.mjs";
import { assertInstructionMode, selectInstructionPaths, upsertBootstrap, removeBootstrap, parseBootstrap } from "./instructions.mjs";
import { HOOK_CONFIG, mergeHooks } from "./hooks.mjs";
import { verifyInstalled, instructionBudget } from "./verification.mjs";
import { applyTransaction, JOURNAL } from "./transaction.mjs";

export async function prepareLifecycle({command,project=".",packageRoot,dryRun=false,instructionFiles,instructionFile=[],hooks,transactionFailAfterWrites=0}={}) {
  const root=await assertProjectDirectory(project),context=await loadPackageContext(packageRoot);
  const preconditions={}; const cache=new Map();
  async function read(p){ if(!cache.has(p)){const b=await readOptional(root,p);cache.set(p,b);preconditions[p]=b?sha256(b):null;} return cache.get(p); }
  if(await read(JOURNAL))throw new Error("Pending transaction; run bridgecode recover before updating");
  // Journal is created by our own transaction after this preflight.
  delete preconditions[JOURNAL];
  const metadataBytes=await read(METADATA_PATH),metadata=metadataBytes?JSON.parse(metadataBytes):null;
  if(metadata?.schemaVersion===2 && metadata.projectRoot!==root)throw new Error("Installation belongs to a different path; relocate with a supported migration");
  const agentsBytes=await read("AGENTS.md"),text=agentsBytes?.toString("utf8")??"";
  const canonical=(await readFile(path.join(context.packageRoot,"AGENTS.md"))).toString("utf8"),version=context.packageJson.version;
  let parsed=parseManagedAgents(text),rules="",mode="",adoptedLegacy=false,legacyOutside="",oldHashes={};
  if(metadata){await verifyInstalled(context,metadata,read);mode="replace managed core";}
  else if(parsed)throw new Error("Marked installation has no trustworthy metadata; recover installation metadata first");
  else if(adoptUnmarkedAgents(text,canonical)){mode="adopt current source";}
  else if(/^# Bridgecode 4\.3\s*$/m.test(text)){
    const old=await legacyContext(context.packageRoot,"4.3.0");
    parsed=adoptKnownUnmarked(text,old.files["AGENTS.md"]);oldHashes=old.hashes;mode="adopt legacy 4.3";
  }
  else if(text.includes("Bridgecode 4.1 Processflow Router")||text.includes("## 5) Specific Repo Rules")){
    const old=await legacyContext(context.packageRoot);
    const adopted=adoptLegacy(text,old.files["AGENTS.md"]);
    rules=adopted.rules;legacyOutside=adopted.outside;oldHashes=old.hashes;adoptedLegacy=true;mode="adopt legacy 4.1";
  }else{
    if(command==="update")throw new Error("Bridgecode is not installed; run install");
    if(/Bridgecode\s+\d/i.test(text))throw new Error("Unrecognized Bridgecode source; export and reconcile it before installation");
    mode=text?"place managed core before repository instructions":"create AGENTS.md";
  }
  const block=buildManagedAgents(canonical,version);
  if(parsed)rules=parsed.rules;
  const architecture=(await read(ARCHITECTURE_PATH))?.toString("utf8");
  const migrated=migrateRules(adoptedLegacy?legacyOutside:mode==="adopt current source"?"":text,parsed,rules,block,architecture);
  const nextText=migrated.agents;
  const changes=new Map();
  async function set(p,bytes){
    const current=await read(p);
    if((current?sha256(current):null)!==(bytes?sha256(bytes):null))changes.set(p,bytes);
  }
  await set("AGENTS.md",Buffer.from(nextText));
  if(migrated.architecture!==architecture)await set(ARCHITECTURE_PATH,Buffer.from(migrated.architecture));
  const previousManaged=metadata?.managedFiles??Object.fromEntries(Object.entries(oldHashes).filter(([p])=>p!=="AGENTS.md"));
  const desired={};
  for(const [p,h]of Object.entries(context.manifest.files)){
    if(p==="AGENTS.md")continue;
    const current=await read(p);
    if(current&&!Object.hasOwn(previousManaged,p)&&(mode!=="adopt current source"||sha256(current)!==h))throw new Error("New payload path conflicts with repository content: "+p);
    if(current&&Object.hasOwn(previousManaged,p)&&sha256(current)!==previousManaged[p])throw new Error("Managed file conflict: "+p);
    desired[p]=h;await set(p,await readFile(path.join(context.packageRoot,p)));
  }
  const hooksEnabled=hooks??metadata?.hooksEnabled??true;
  if(hooksEnabled||metadata?.hooksEnabled){
    const current=await read(HOOK_PATH);
    if(current && !Object.hasOwn(previousManaged,HOOK_PATH))throw new Error("Unowned hook script collision");
    const merged=mergeHooks(await read(HOOK_CONFIG),root,metadata?.hookEntries,hooksEnabled);
    await set(HOOK_CONFIG,merged.bytes);
    if(hooksEnabled){desired[HOOK_PATH]=sha256(context.hook);await set(HOOK_PATH,context.hook);}
  }
  for(const [p,h]of Object.entries(previousManaged)){
    if(Object.hasOwn(desired,p))continue;
    const bytes=await read(p);
    if(bytes && sha256(bytes)!==h)throw new Error("Retired managed file was modified: "+p);
    if(bytes)await set(p,null);
  }
  const effectiveMode=instructionFiles??metadata?.instructionMode??"auto";
  assertInstructionMode(effectiveMode);
  const paths=selectInstructionPaths({mode:instructionFiles===undefined&&metadata?undefined:effectiveMode,customPaths:instructionFile,existingClaude:Boolean(await read("CLAUDE.md")),previousPaths:metadata?.instructionFiles});
  const reserved=new Set([...Object.keys(context.manifest.files),...Object.keys(previousManaged),METADATA_PATH,HOOK_PATH,HOOK_CONFIG,JOURNAL]);
  for(const p of paths){validateRelativePath(p,"instruction path");const lower=p.toLowerCase();if([...reserved].some(r=>r.toLowerCase()===lower)||/^(?:\.git|\.agents|\.codex|\.bridgecode|agentic)(?:\/|$)/i.test(p))throw new Error("Instruction bootstrap overlaps reserved path: "+p);}
  if(new Set(paths.map(p=>p.toLowerCase())).size!==paths.length)throw new Error("Instruction paths alias each other");
  const bootstraps={};
  for(const p of new Set([...paths,...Object.keys(metadata?.bootstraps??{})])){
    const old=(await read(p))?.toString("utf8")??"";
    if(parseBootstrap(old)&&!Object.hasOwn(metadata?.bootstraps??{},p))throw new Error("Unrecorded bootstrap ownership: "+p);
    if(paths.includes(p)){const out=upsertBootstrap(old,version);bootstraps[p]=sha256(out.block);await set(p,Buffer.from(out.text));}
    else{const out=removeBootstrap(old);await set(p,out.trim()?Buffer.from(out):null);}
  }
  // Reject aliasing between all managed/shared paths, including case-insensitive hosts.
  const all=[...Object.keys(desired),"AGENTS.md",...paths,HOOK_CONFIG,METADATA_PATH];
  if(new Set(all.map(p=>p.toLowerCase())).size!==all.length)throw new Error("Managed target paths alias each other");
  const parsedNext=parseManagedAgents(nextText);
  const next={package:"@bridgecode/cli",version,schemaVersion:2,projectRoot:root,instructionMode:effectiveMode,instructionFiles:paths,managedFiles:desired,agents:{path:"AGENTS.md",managedHash:parsedNext.managedHash},bootstraps,hooksEnabled,hookEntries:null};
  if(hooksEnabled){const {hookEntries,entryHash}=await import("./hooks.mjs");next.hookEntries=Object.fromEntries(Object.entries(hookEntries(root)).map(([k,v])=>[k,entryHash(v)]));}
  await set(METADATA_PATH,Buffer.from(JSON.stringify(next,null,2)+"\n"));
  const projected=async p=>changes.has(p)?changes.get(p):read(p);
  await instructionBudget(projected);
  await verifyInstalled(context,next,projected);
  const summary={command,projectRoot:root,version,dryRun,agentsMode:mode,changes:[...changes].map(([p,b])=>({path:p,action:b===null?"remove verified managed file":"write"})),migrationPending:migrated.architecture?.includes(IMPORT_NOTICE)??false,hooksEnabled,verified:false};
  if(!dryRun){
    const check=async()=>{await instructionBudget(p=>readOptional(root,p));await verifyInstalled(context,next,p=>readOptional(root,p));};
    if(changes.size)await applyTransaction(root,[...changes].map(([p,content])=>({path:p,content})),{preconditions,postCheck:check,failAfterWrites:transactionFailAfterWrites});
    else await check();
    summary.verified=true;
  }
  return summary;
}
export const installBridgecode = options => prepareLifecycle({...options,command:"install"});
export function formatLifecycleSummary(s){
  return [
    `${s.dryRun?"DRY RUN":"DONE"}: Bridgecode ${s.version} ${s.command} for ${s.projectRoot}`,
    `AGENTS.md: ${s.agentsMode}`,
    ...(s.changes.length?s.changes.map(c=>c.action+": "+c.path):["No changes required; installation is idempotent."]),
    s.dryRun?"Projected verification passed; zero writes.":"Doctor passed for the installed payload and registration.",
    s.migrationPending?"Repo rules are preserved in agentic/architecture.md. URGENT: imported constraints remain binding and unverified until reconciled with code/tests; implement corrections only within authorized scope.":"No imported rules are flagged for verification.",
    s.hooksEnabled?"Codex hooks configured, not runtime-certified. Trust this project and review /hooks.":"Hooks disabled; follow AGENTS.md directly.",
    "Start a fresh task/session after installing or updating."
  ].join("\n");
}
