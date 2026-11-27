import { cp, mkdtemp, readFile, readdir, rm, writeFile, mkdir, realpath } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PAYLOAD_PATHS, MANIFEST_SCHEMA, sha256 } from "../src/manifest.mjs";
import { buildManagedAgents } from "../src/repo-rules.mjs";
import { buildBootstrap } from "../src/instructions.mjs";
import { hookEntries, entryHash } from "../src/hooks.mjs";
export const PACKAGE_ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export { PAYLOAD_PATHS };
export const EDITION_LIST=["codex","claude","exp"];
export async function fixture(t,prefix="bridgecode-test-"){
 const root=await realpath(await mkdtemp(path.join(os.tmpdir(),prefix)));
 t.after(()=>rm(root,{recursive:true,force:true}));return root;
}
export async function snapshot(root){
 const result={};
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  const p=path.join(dir,e.name),r=path.relative(root,p).split(path.sep).join("/");
  if(e.isDirectory())await walk(p);else if(e.isSymbolicLink())result[r]="symlink";else result[r]=sha256(await readFile(p));
 }}await walk(root);return result;
}
export async function writeManifest(root,name="@bridgecode/cli",version="4.6.1"){
 const files={};for(const p of PAYLOAD_PATHS)files[p]=sha256(await readFile(path.join(root,p)));
 const hookHash=sha256(await readFile(path.join(root,"hooks/bridgecode-turn.mjs")));
 await writeFile(path.join(root,"payload-manifest.json"),JSON.stringify({package:name,version,schemaVersion:MANIFEST_SCHEMA,files,hookHash},null,2)+"\n");
}
// A next release: the current payload becomes a trusted format-3 snapshot and one specialist changes.
export async function simulatedPackage(t,version="4.6.1"){
 const root=await fixture(t,"bridgecode-package-");
 for(const p of [...PAYLOAD_PATHS,"hooks","legacy"]){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await cp(path.join(PACKAGE_ROOT,p),path.join(root,p),{recursive:true});}
 const pkg=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"package.json"),"utf8"));
 const files={};for(const p of PAYLOAD_PATHS)files[p]=await readFile(path.join(PACKAGE_ROOT,p),"utf8");
 const hook=await readFile(path.join(PACKAGE_ROOT,"hooks/bridgecode-turn.mjs"),"utf8");
 await writeFile(path.join(root,"legacy",pkg.version+".json"),JSON.stringify({version:pkg.version,format:3,files,hookHash:sha256(hook),hook}));
 pkg.version=version;await writeFile(path.join(root,"package.json"),JSON.stringify(pkg));
 await writeFile(path.join(root,"bridgecode/writing.md"),files["bridgecode/writing.md"]+"\nSimulation "+version+"\n");
 await writeManifest(root,pkg.name,version);return root;
}
export async function legacyFiles(){return JSON.parse(await readFile(path.join(PACKAGE_ROOT,"legacy/4.1.0.json"),"utf8")).files;}
// The exact installation a 4.3.x CLI produced (codex, hooks on), built from its trusted snapshot.
export async function legacyInstall(root,version,{bootstraps=[]}={}){
 const old=JSON.parse(await readFile(path.join(PACKAGE_ROOT,"legacy/"+version+".json"),"utf8"));
 if(sha256(old.hook)!==old.hookHash)throw new Error(version+" hook snapshot mismatch");
 const managedFiles={};
 for(const [p,s]of Object.entries({...old.files,".codex/hooks/bridgecode-turn.mjs":old.hook})){
  if(p==="AGENTS.md")continue;
  await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),s);managedFiles[p]=sha256(s);
 }
 const block=buildManagedAgents(old.files["AGENTS.md"],version);
 await writeFile(path.join(root,"AGENTS.md"),block+"\n");
 const entries=hookEntries(root,"codex",true);
 await writeFile(path.join(root,".codex/hooks.json"),JSON.stringify({hooks:entries.UserPromptSubmit?{UserPromptSubmit:[entries.UserPromptSubmit],SessionStart:[entries.SessionStart]}:{}},null,2)+"\n");
 const boot={};
 for(const p of bootstraps){const b=buildBootstrap(version);await writeFile(path.join(root,p),b+"\n");boot[p]=sha256(b);}
 await mkdir(path.join(root,".bridgecode"),{recursive:true});
 await writeFile(path.join(root,".bridgecode/installation.json"),JSON.stringify({package:"@bridgecode/cli",version,schemaVersion:2,projectRoot:root,instructionMode:bootstraps.length?"claude":"auto",instructionFiles:bootstraps,managedFiles,agents:{path:"AGENTS.md",managedHash:sha256(block)},bootstraps:boot,hooksEnabled:true,hookEntries:Object.fromEntries(Object.entries(entries).map(([k,e])=>[k,entryHash(e)]))},null,2)+"\n");
}
export const read=(root,p)=>readFile(path.join(root,p),"utf8");
