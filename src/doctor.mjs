import { assertProjectDirectory, loadPackageContext, readOptional, METADATA_PATH } from "./manifest.mjs";
import { verifyInstalled, instructionBudget } from "./verification.mjs";
import { JOURNAL } from "./transaction.mjs";

export async function inspectInstallation({projectRoot,project,packageRoot,packageContext}={}) {
  const root=await assertProjectDirectory(projectRoot??project??".");
  const context=packageContext??await loadPackageContext(packageRoot),checks=[],warnings=[];
  let metadata,installed;
  try{
    if(await readOptional(root,JOURNAL))throw new Error("Pending transaction: run bridgecode recover");
    metadata=JSON.parse(await readOptional(root,METADATA_PATH));
    if(metadata.version!==context.packageJson.version)throw new Error("Use doctor from the installed exact package version");
    if(metadata.schemaVersion===2&&metadata.projectRoot!==root)throw new Error("Installation path changed; hooks need relocation");
    installed=await verifyInstalled(context,metadata,p=>readOptional(root,p));
    checks.push({name:"canonical payload, core, metadata, and registration",ok:true,detail:"complete expected set verified against package"});
  }catch(e){checks.push({name:"installation integrity",ok:false,detail:e.message});}
  try{
    const n=await instructionBudget(p=>readOptional(root,p));
    checks.push({name:"root AGENTS.md byte budget only",ok:true,detail:`${n}/32768 bytes; global, ancestor and nested instructions not measured`});
    if(await readOptional(root,"AGENTS.override.md"))warnings.push("AGENTS.override.md can shadow root AGENTS.md; inspect active host guidance.");
  }catch(e){checks.push({name:"root AGENTS.md byte budget only",ok:false,detail:e.message});}
  if(installed?.migrationPending)warnings.push("URGENT: memory migration incomplete. Reconcile legacy rules into verified implementation and agentic/architecture.md, then remove each resolved rule.");
  if(metadata?.hooksEnabled)warnings.push("Hook registration verified; host trust, activation and model compliance are not certified.");
  return {ok:checks.every(c=>c.ok),projectRoot:root,version:metadata?.version,checks,warnings,migrationPending:installed?.migrationPending??false};
}
export function formatDoctorReport(r){return ["Bridgecode doctor for "+r.projectRoot,...r.checks.map(c=>(c.ok?"PASS":"FAIL")+"  "+c.name+": "+c.detail),...r.warnings.map(w=>"NOTE  "+w),r.ok?"Doctor passed.":"Doctor found problems; no files changed."].join("\n");}
export async function doctorBridgecode(options={}){const report=await inspectInstallation(options);return {report,output:formatDoctorReport(report)};}
