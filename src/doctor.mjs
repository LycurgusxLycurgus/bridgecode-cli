import { assertProjectDirectory, loadPackageContext, readOptional, METADATA_PATH } from "./manifest.mjs";
import { verifyInstalled, instructionBudget, installedEdition } from "./verification.mjs";
import { JOURNAL } from "./transaction.mjs";
import { ARCHITECTURE_PATH, IMPORT_NOTICE } from "./repo-rules.mjs";
import { detectStandalones } from "./extensions.mjs";

// The memory shape is the engine's memoryShape guard: one module for the guard and for doctor.
import { MEMORY_SECTIONS, checkMemoryShape } from "../engine/engine.mjs";
export { MEMORY_SECTIONS, checkMemoryShape };

export async function inspectInstallation({projectRoot,project,packageRoot,packageContext}={}) {
  const root=await assertProjectDirectory(projectRoot??project??".");
  const context=packageContext??await loadPackageContext(packageRoot),checks=[],warnings=[];
  const read=p=>readOptional(root,p);
  let metadata,installed;
  try{
    if(await read(JOURNAL))throw new Error("Pending transaction: run bridgecode recover");
    const raw=await read(METADATA_PATH);
    if(raw==null)throw new Error("No Bridgecode installation here: run bridgecode install --project <path> --edition <codex|claude|exp>");
    metadata=JSON.parse(raw);
    if(metadata.version!==context.packageJson.version)throw new Error("Use doctor from the installed exact package version");
    if(metadata.schemaVersion===2&&metadata.projectRoot!==root)throw new Error("Installation path changed; hooks need relocation");
    installed=await verifyInstalled(context,metadata,read);
    checks.push({name:"canonical payload, core, metadata, hooks and extensions",ok:true,detail:`${installedEdition(metadata)} edition; complete expected set verified against package`});
  }catch(e){checks.push({name:"installation integrity",ok:false,detail:e.message});}
  try{
    const instruction=installed?.release.instruction??"AGENTS.md";
    const n=await instructionBudget(read,instruction);
    checks.push({name:`${instruction} size (informational)`,ok:true,detail:`${n} bytes; no Bridgecode size gate; host instruction discovery is not certified`});
    if(n>32768)warnings.push(`Large ${instruction}: check the host's actual instruction-loading configuration; size does not block installation.`);
    if(await read("AGENTS.override.md"))warnings.push("AGENTS.override.md can shadow root AGENTS.md; inspect active host guidance.");
    if((await read(ARCHITECTURE_PATH))?.toString("utf8").includes(IMPORT_NOTICE))warnings.push("URGENT: imported architecture constraints remain binding and unverified. Reconcile with code/tests within authorized scope.");
    for(const file of Object.keys(MEMORY_SECTIONS)){
      const text=(await read(file))?.toString("utf8");
      if(text!==undefined)warnings.push(...checkMemoryShape(file,text));
    }
    if(metadata&&!metadata.hooksEnabled)warnings.push("Hooks are disabled: no per-turn reminder and no recovery after compaction, so the agent relies on the instruction file alone. Re-run update with --hooks unless the host forbids hooks.");
    if(installedEdition(metadata)==="exp"){
      const agents=(await read("AGENTS.md"))?.toString("utf8")??"";
      if(/bridgecode:managed:|cheapgpt:managed:|cloop:managed:/.test(agents))warnings.push("AGENTS.md holds an orchestration block under the exp edition; Codex sub-agents would load it as their policy. Remove it.");
    }
    for(const s of await detectStandalones(read,root))warnings.push(`Two orchestrators: a standalone ${s.name} is installed. bridgecode install --project . prints what removing it changes; with the user's yes run bridgecode install --project . --replace-standalones, then install again with the extension they choose (suggested: --extension ${s.extension}).`);
  }catch(e){checks.push({name:"repository instruction/memory access",ok:false,detail:e.message});}
  if(installed?.parsed.rules)warnings.push("Legacy repo rules detected inside the core; update to transfer them into agentic/architecture.md.");
  if(metadata?.hooksEnabled)warnings.push("Hook registration verified; host trust, activation and model compliance are not certified.");
  return {ok:checks.every(c=>c.ok),projectRoot:root,version:metadata?.version,edition:metadata?installedEdition(metadata):null,checks,warnings,migrationPending:installed?.migrationPending??false};
}
export function formatDoctorReport(r){return ["Bridgecode doctor for "+r.projectRoot,...r.checks.map(c=>(c.ok?"PASS":"FAIL")+"  "+c.name+": "+c.detail),...r.warnings.map(w=>"NOTE  "+w),r.ok?"Doctor passed.":"Doctor found problems; no files changed."].join("\n");}
export async function doctorBridgecode(options={}){const report=await inspectInstallation(options);return {report,output:formatDoctorReport(report)};}
