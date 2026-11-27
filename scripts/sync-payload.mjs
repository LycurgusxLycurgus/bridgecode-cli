// Copy the authoring source ../condensation into the package payload:
// shared/bridgecode/*.md -> bridgecode/, shared/engine/ -> engine/, roles/*.json -> roles/,
// <edition>/{generalist, README_HUMAN.txt} -> editions/<edition>/.
// The synced folders hold only copies, so a file the source no longer has is removed from them.
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EDITIONS, PAYLOAD_PATHS, ENGINE_FILES, EXTENSIONS, rolesSource } from '../src/manifest.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=path.resolve(root,'../condensation');
const copies={};
for(const f of await readdir(path.join(source,'shared/bridgecode')))if(f.endsWith('.md'))copies['bridgecode/'+f]='shared/bridgecode/'+f;
for(const f of ENGINE_FILES)copies['engine/'+f]='shared/engine/'+f;
for(const id of EXTENSIONS)copies[rolesSource(id)]=rolesSource(id);
for(const [ed,{instruction}]of Object.entries(EDITIONS))for(const f of [instruction,'README_HUMAN.txt'])copies[`editions/${ed}/${f}`]=`${ed}/${f}`;
const missing=PAYLOAD_PATHS.filter(p=>!copies[p]),unexpected=Object.keys(copies).filter(p=>!PAYLOAD_PATHS.includes(p));
if(missing.length||unexpected.length)throw new Error('Source and payload list differ. Missing: '+missing.join(', ')+' Unexpected: '+unexpected.join(', '));
// Every card and core card in the source is in the payload list, so none is silently left out.
for(const dir of ['cards','core'])for(const f of await readdir(path.join(source,'shared/engine',dir)))if(!copies[`engine/${dir}/${f}`])throw new Error(`Source has engine/${dir}/${f}, which the payload list (src/manifest.mjs) lacks`);
for(const [p,s]of Object.entries(copies)){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),await readFile(path.join(source,s)));}
async function walk(dir){const out=[];for(const e of await readdir(path.join(root,dir),{withFileTypes:true}).catch(()=>[])){const p=dir+'/'+e.name;if(e.isDirectory())out.push(...await walk(p));else out.push(p);}return out;}
const removed=[];
for(const dir of ['bridgecode','engine','roles','editions'])for(const p of await walk(dir))if(!copies[p]){await rm(path.join(root,p));removed.push(p);}
for(const dir of ['editions/codex/extensions','editions/claude/extensions','editions/exp/extensions'])await rm(path.join(root,dir),{recursive:true,force:true});
console.log('Canonical payload synchronized: '+Object.keys(copies).length+' files.'+(removed.length?' Removed: '+removed.join(', '):''));
