import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAYLOAD_PATHS, sha256 } from "../src/manifest.mjs";
export const PACKAGE_ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const MANAGED_PATHS=PAYLOAD_PATHS;
export async function fixture(t,prefix="bridgecode-test-"){
 const root=await mkdtemp(path.join(os.tmpdir(),prefix));
 t.after(()=>rm(root,{recursive:true,force:true}));return root;
}
export async function snapshot(root){
 const result={};
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name),r=path.relative(root,p).split(path.sep).join("/");
  if(e.isDirectory())await walk(p);else if(e.isSymbolicLink())result[r]="symlink";else result[r]=sha256(await readFile(p));
 }}await walk(root);return result;
}
export async function writeManifest(root,name="@bridgecode/cli",version="4.3.1"){
 const files={};for(const p of MANAGED_PATHS)files[p]=sha256(await readFile(path.join(root,p)));
 const hookHash=sha256(await readFile(path.join(root,"hooks/bridgecode-turn.mjs")));
 await writeFile(path.join(root,"payload-manifest.json"),JSON.stringify({package:name,version,schemaVersion:2,files,hookHash},null,2)+"\n");
}
export async function simulatedPackage(t,version="4.3.1"){
 const root=await fixture(t,"bridgecode-package-");
 for(const p of [...MANAGED_PATHS,"hooks","legacy"]){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await cp(path.join(PACKAGE_ROOT,p),path.join(root,p),{recursive:true});}
 const pkg=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"package.json"),"utf8"));
 const files={};for(const p of MANAGED_PATHS)files[p]=await readFile(path.join(PACKAGE_ROOT,p),"utf8");
 const manifest=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"payload-manifest.json"),"utf8"));
 await writeFile(path.join(root,"legacy",pkg.version+".json"),JSON.stringify({version:pkg.version,schemaVersion:2,files,hookHash:manifest.hookHash}));
 pkg.version=version;await writeFile(path.join(root,"package.json"),JSON.stringify(pkg));
 await writeFile(path.join(root,"bridgecode/writing.md"),files["bridgecode/writing.md"]+"\nSimulation "+version+"\n");
 await writeManifest(root,pkg.name,version);return root;
}
export async function legacyFiles(){return JSON.parse(await readFile(path.join(PACKAGE_ROOT,"legacy/4.1.0.json"),"utf8")).files;}
