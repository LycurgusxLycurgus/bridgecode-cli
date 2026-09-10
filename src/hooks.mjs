import { sha256 } from './manifest.mjs';
export const HOOK_CONFIG='.codex/hooks.json';
export function hookEntries(root) {
  // A JSON double-quoted absolute path works for spaces in supported shell hosts.
  // Reject shell-expansion characters instead of treating JSON escaping as shell escaping.
  if(/["`$%\r\n]/.test(root))throw new Error('Project path cannot be safely registered as a hook command; use --no-hooks');
  const script=root.replaceAll('\\','/')+'/.codex/hooks/bridgecode-turn.mjs';
  const command=`node "${script}"`;
  return {
    UserPromptSubmit:{hooks:[{type:'command',command,timeout:10,additionalContextLimit:1000}]},
    SessionStart:{matcher:'^compact$',hooks:[{type:'command',command,timeout:10,additionalContextLimit:9000}]},
  };
}
export function parseHookConfig(bytes) {
  const c=bytes?JSON.parse(bytes.toString('utf8')):{};
  if(!c||Array.isArray(c)||typeof c!=='object'||(c.hooks && (Array.isArray(c.hooks)||typeof c.hooks!=='object')))throw new Error('Invalid hooks configuration');
  c.hooks??={};
  for(const [k,v]of Object.entries(c.hooks))if(!Array.isArray(v))throw new Error('Hook event must be an array: '+k);
  return c;
}
export function entryHash(entry){return sha256(JSON.stringify(entry));}
export function mergeHooks(bytes,root,previous,enabled) {
  const c=parseHookConfig(bytes),next=hookEntries(root);
  for(const event of ['UserPromptSubmit','SessionStart']) {
    const list=c.hooks[event]??[];
    const owned=list.filter(e=>e.hooks?.some(h=>h.command?.includes('bridgecode-turn.mjs')));
    if(previous) {
      if(owned.length!==1||entryHash(owned[0])!==previous[event])throw new Error('Managed hook entry conflict: '+event);
    } else if(owned.length)throw new Error('Unrecorded Bridgecode hook entry: '+event);
    const keep=list.filter(e=>!owned.includes(e));
    if(enabled)keep.push(next[event]);
    if(keep.length)c.hooks[event]=keep;else delete c.hooks[event];
  }
  return {bytes:Buffer.from(JSON.stringify(c,null,2)+'\n'),entries:enabled?Object.fromEntries(Object.entries(next).map(([k,e])=>[k,entryHash(e)])):null};
}
