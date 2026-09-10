import { mkdir, writeFile, readFile, rename, rm, rmdir } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { readOptional, safeTarget, sha256 } from "./manifest.mjs";

export const JOURNAL = ".bridgecode/transaction.json";
async function replace(root,p,bytes) {
  const target=await safeTarget(root,p);
  if(bytes===null){await rm(target,{force:true});return;}
  await mkdir(path.dirname(target),{recursive:true});
  await safeTarget(root,p);
  const temp=target+".bridgecode-"+randomBytes(8).toString("hex")+".tmp";
  try { await writeFile(temp,bytes,{flag:"wx"}); await rename(temp,target); }
  finally { await rm(temp,{force:true}).catch(()=>{}); }
}
export async function recoverTransaction(root,{automatic=false}={}) {
  const raw=await readOptional(root,JOURNAL);
  if(!raw) return {recovered:false};
  const j=JSON.parse(raw);
  if(j.schema!==1||!Array.isArray(j.entries))throw new Error("Invalid recovery journal; retained for inspection");
  if(!automatic && j.pid!==process.pid) {
    let alive=true;try{process.kill(j.pid,0);}catch(e){if(e.code==="ESRCH")alive=false;}
    if(alive)throw new Error("Transaction owner may still be running; recovery refused");
  }
  const failures=[];
  for(const e of [...j.entries].reverse()){
    try{
      const now=await readOptional(root,e.path), h=now?sha256(now):null;
      const before=e.original===null?null:Buffer.from(e.original,"base64");
      const old=before?sha256(before):null;
      if(h===old)continue;
      if(h!==e.nextHash)throw new Error("target changed outside transaction");
      await replace(root,e.path,before);
    }catch(error){failures.push(e.path+": "+error.message);}
  }
  if(failures.length)throw new Error("Incomplete rollback; recovery journal retained: "+failures.join("; "));
  await rm(await safeTarget(root,JOURNAL));
  for(const dir of [...(j.createdDirectories??[])].sort((a,b)=>b.length-a.length)){
    // Parents were recorded by this transaction; rmdir only removes an empty directory.
    await safeTarget(root,dir+"/.containment-check");
    await rmdir(path.join(root,dir)).catch(()=>{});
  }
  return {recovered:true};
}
export async function applyTransaction(root,changes,{postCheck,preconditions={},failAfterWrites=0}={}) {
  if(await readOptional(root,JOURNAL))throw new Error("Pending transaction; run bridgecode recover before updating");
  const entries=[];
  const dirs=new Set();
  for(const c of changes){
    const before=await readOptional(root,c.path);
    entries.push({path:c.path,original:before?.toString("base64")??null,nextHash:c.content===null?null:sha256(c.content)});
    let dir=path.posix.dirname(c.path);
    while(dir!=="."){try{await readFile(path.join(root,dir));}catch(e){if(e.code==="ENOENT")dirs.add(dir);}dir=path.posix.dirname(dir);}
  }
  await safeTarget(root,JOURNAL);
  await mkdir(path.dirname(path.join(root,JOURNAL)),{recursive:true});
  await safeTarget(root,JOURNAL);
  await writeFile(path.join(root,JOURNAL),JSON.stringify({schema:1,pid:process.pid,entries,createdDirectories:[...dirs]}),{flag:"wx"});
  try{
    for(const [p,h]of Object.entries(preconditions)){
      const b=await readOptional(root,p);
      if((b?sha256(b):null)!==h)throw new Error("Concurrent modification: "+p);
    }
    let writes=0;
    for(const c of changes){
      const entry=entries.find(e=>e.path===c.path);
      const now=await readOptional(root,c.path);
      if((now?.toString("base64")??null)!==entry.original)throw new Error("Concurrent modification: "+c.path);
      await replace(root,c.path,c.content);
      if(failAfterWrites && ++writes>=failAfterWrites)throw new Error("Simulated interruption");
    }
    if(postCheck)await postCheck();
  }catch(error){
    try{await recoverTransaction(root,{automatic:true});}
    catch(recovery){throw new Error(error.message+"; "+recovery.message);}
    throw new Error("Bridgecode transaction rolled back: "+error.message);
  }
  await rm(await safeTarget(root,JOURNAL));
}
