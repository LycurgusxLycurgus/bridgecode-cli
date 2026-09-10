import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source=path.resolve(root,'../codex_condensation');
const old=JSON.parse(await readFile(path.join(root,'legacy/4.1.0.json'),'utf8'));
const files=['AGENTS.md','README_HUMAN.txt',...(await readdir(path.join(source,'bridgecode'))).filter(p=>p.endsWith('.md')).map(p=>'bridgecode/'+p)];
for(const p of files){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),await readFile(path.join(source,p)));}
for(const [p,text]of Object.entries(old.files)){
  if(files.includes(p))continue;
  const current=await readFile(path.join(root,p),'utf8').catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  if(current!==null&&current!==text)throw new Error('Refusing to retire edited package source: '+p);
  if(current!==null)await rm(path.join(root,p));
}
console.log('Canonical payload synchronized.');
