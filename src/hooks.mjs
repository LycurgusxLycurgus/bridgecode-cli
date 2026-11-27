import { sha256, EDITIONS } from './manifest.mjs';
import { CODEX_EXEC_PERMISSION } from './extensions.mjs';

const SCRIPT = 'bridgecode-turn.mjs';
// legacy=true reproduces the entries 4.3.x wrote, so their installations still verify before migration.
export function hookEntries(root, edition = 'codex', legacy = false) {
  // A JSON double-quoted absolute path works for spaces in supported shell hosts.
  // Reject shell-expansion characters instead of treating JSON escaping as shell escaping.
  if(/["`$%\r\n]/.test(root))throw new Error('Project path cannot be safely registered as a hook command; use --no-hooks');
  const command=`node "${root.replaceAll('\\','/')}/${EDITIONS[edition].hookPath}"`;
  if(edition==='codex')return {
    UserPromptSubmit:{hooks:[{type:'command',command,timeout:10,additionalContextLimit:legacy?1000:2000}]},
    SessionStart:{matcher:'^compact$',hooks:[{type:'command',command,timeout:10,additionalContextLimit:legacy?9000:32000}]},
  };
  return {
    UserPromptSubmit:{hooks:[{type:'command',command,timeout:10}]},
    SessionStart:{matcher:'compact',hooks:[{type:'command',command,timeout:10}]},
  };
}
export function parseHookConfig(bytes) {
  const c=bytes?JSON.parse(bytes.toString('utf8')):{};
  if(!c||Array.isArray(c)||typeof c!=='object'||(c.hooks && (Array.isArray(c.hooks)||typeof c.hooks!=='object')))throw new Error('Invalid hooks configuration');
  c.hooks??={};
  for(const [k,v]of Object.entries(c.hooks))if(!Array.isArray(v))throw new Error('Hook event must be an array: '+k);
  return c;
}
export const ownedEntries = list => (list??[]).filter(e=>e.hooks?.some(h=>h.command?.includes(SCRIPT)));
export function entryHash(entry){return sha256(JSON.stringify(entry));}

// Merge Bridgecode's hook entries and, under exp, the shared codex exec permission into one config file.
// permission: {need, added} — added records whether Bridgecode added the entry (true) or found it (false).
export function mergeHooks(bytes,root,previous,enabled,edition='codex',permission=null) {
  const existed=Boolean(bytes);
  const c=parseHookConfig(bytes),next=hookEntries(root,edition);
  for(const event of ['UserPromptSubmit','SessionStart']) {
    const list=c.hooks[event]??[];
    const owned=ownedEntries(list);
    if(previous) {
      if(owned.length!==1||entryHash(owned[0])!==previous[event])throw new Error('Managed hook entry conflict: '+event);
    } else if(owned.length)throw new Error('Unrecorded Bridgecode hook entry: '+event);
    const keep=list.filter(e=>!owned.includes(e));
    if(enabled)keep.push(next[event]);
    if(keep.length)c.hooks[event]=keep;else delete c.hooks[event];
  }
  let added=false;
  if(permission){
    if(c.permissions!==undefined&&(typeof c.permissions!=='object'||Array.isArray(c.permissions)||(c.permissions.allow!==undefined&&!Array.isArray(c.permissions.allow))))throw new Error('Invalid permissions configuration');
    const allow=c.permissions?.allow??[],present=allow.includes(CODEX_EXEC_PERMISSION);
    if(permission.need){
      added=present?Boolean(permission.added):true;
      if(!present){c.permissions??={};c.permissions.allow=[...allow,CODEX_EXEC_PERMISSION];}
    }else if(permission.added&&present){
      c.permissions.allow=allow.filter(p=>p!==CODEX_EXEC_PERMISSION);
      if(!c.permissions.allow.length)delete c.permissions.allow;
      if(!Object.keys(c.permissions).length)delete c.permissions;
    }
  }
  if(!Object.keys(c.hooks).length)delete c.hooks;
  // empty: nothing but Bridgecode's own content was in the file; the caller removes it only if Bridgecode created it.
  return {bytes:Buffer.from(JSON.stringify(c,null,2)+'\n'),empty:!Object.keys(c).length,existed,entries:enabled?Object.fromEntries(Object.entries(next).map(([k,e])=>[k,entryHash(e)])):null,permissionAdded:added};
}
