import { mkdtemp, rm, mkdir, copyFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npm=process.env.npm_execpath;if(!npm)throw new Error("Run through npm run test:release");
const temp=await mkdtemp(path.join(os.tmpdir(),"bridgecode-release-"));
function run(args,extra={}){
 const r=spawnSync(process.execPath,args,{cwd:root,encoding:"utf8",env:{...process.env,npm_config_cache:path.join(temp,"cache")},...extra});
 if(r.status!==0)throw new Error(r.stderr+"\n"+r.stdout);
 return r.stdout;
}
try{
 run(["scripts/build-manifest.mjs"]);
 const packed=JSON.parse(run([npm,"pack","--ignore-scripts","--json","--pack-destination",temp]))[0];
 const file=path.join(temp,packed.filename);
 process.stdout.write(run(["--test","test/tarball.test.mjs"],{env:{...process.env,npm_config_cache:path.join(temp,"cache"),BRIDGECODE_TARBALL:file,BRIDGECODE_PACK_FILES:JSON.stringify(packed.files.map(f=>f.path))}}));
 if(process.argv[2]==="--output"){
  const out=path.resolve(root,process.argv[3]||"release");
  if(!out.startsWith(root+path.sep))throw new Error("Release output must be below the package directory");
  await mkdir(out,{recursive:true});await copyFile(file,path.join(out,packed.filename));
  process.stdout.write("Verified artifact: "+path.join(out,packed.filename)+"\n");
 }else if(process.argv.length>2)throw new Error("Unknown release argument");
}finally{
 if(!path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep)||!path.basename(temp).startsWith("bridgecode-release-"))throw new Error("Unsafe cleanup path");
 await rm(temp,{recursive:true,force:true});
}
