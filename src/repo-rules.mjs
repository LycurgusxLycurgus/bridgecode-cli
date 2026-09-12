import { sha256 } from "./manifest.mjs";

export const MANAGED_END = "<!-- bridgecode:managed:end -->";
export const REPO_RULES_START = "<!-- bridgecode:repo-rules:start -->";
export const REPO_RULES_END = "<!-- bridgecode:repo-rules:end -->";
const count = (s,x) => s.split(x).length-1;
const pattern = () => /<!-- bridgecode:managed:start version="([^"]+)" schema="([12])" -->/g;

export function isRulesPopulated(rules) {
  return rules.split(/\r?\n/).some(l => l.trim() && !/^-\s*$/.test(l.trim()));
}
export function splitCanonicalAgents(text) {
  const match = /^## 5\) Specific Repo Rules[^\r\n]*(?:\r?\n|$)/m.exec(text);
  if (!match) throw new Error("Legacy Specific Repo Rules heading missing");
  let n=match.index+match[0].length;
  if(text.slice(n).startsWith("\r\n")) n+=2; else if(text[n]==="\n") n++;
  return {prefix:text.slice(0,n),templateRules:text.slice(n),eol:text.includes("\r\n")?"\r\n":"\n"};
}
export function buildLegacyAgents(canonical, version, rules) {
  const {prefix,eol}=splitCanonicalAgents(canonical);
  return `<!-- bridgecode:managed:start version="${version}" schema="1" -->${eol}${prefix}${REPO_RULES_START}${eol}${rules}${eol}${REPO_RULES_END}${eol}${MANAGED_END}`;
}
export function buildManagedAgents(canonical, version) {
  return `<!-- bridgecode:managed:start version="${version}" schema="2" -->\n${canonical.trimEnd()}\n${MANAGED_END}`;
}
export function pendingRulesBlock(rules) {
  if (!isRulesPopulated(rules)) return "";
  return `\n\n## Urgent Bridgecode memory migration\n\nRepository-owned legacy rules below remain binding until reconciled. Urgently verify each rule: if implemented, record its code/test/constraint in agentic/architecture.md and remove that rule; otherwise implement the causal correction within authorized scope, verify, document, then remove. The upgrade is installed, but memory migration is incomplete while any rule remains.\n\n${REPO_RULES_START}\n${rules}\n${REPO_RULES_END}`;
}
export const ARCHITECTURE_PATH = "agentic/architecture.md";
export const IMPORT_NOTICE = "Imported repository constraints — verification pending";
function markdownHeadings(text) {
  const headings=[];let fence=null,offset=0;
  for(const line of text.match(/[^\n]*\n|[^\n]+$/g)??[]){
    const code=/^ {0,3}(`{3,}|~{3,})/.exec(line);
    if(code){if(!fence)fence=code[1];else if(code[1][0]===fence[0]&&code[1].length>=fence.length)fence=null;}
    if(!fence&&!code){
      const h=/^ {0,3}(#{1,6})[ \t]+(.+?)\s*$/.exec(line);
      if(h)headings.push({start:offset,level:h[1].length,rules:/^(?:\d+[.)]\s*)?(?:specific\s+)?repo(?:sitory)?[ -]rules\s*#*$/i.test(h[2])});
    }
    offset+=line.length;
  }
  return headings;
}
function extractNamedRules(text) {
  const headings=markdownHeadings(text),spans=[];let end=0;
  for(let i=0;i<headings.length;i++){
    const h=headings[i];if(!h.rules||h.start<end)continue;
    end=headings.slice(i+1).find(n=>n.level<=h.level)?.start??text.length;
    spans.push({start:h.start,end});
  }
  const rules=spans.map(s=>text.slice(s.start,s.end)).join("\n");
  for(const s of spans.reverse())text=text.slice(0,s.start)+text.slice(s.end);
  return {text,rules};
}
export function migrateRules(text, parsed, rules, block, architecture) {
  // Preserve repository bytes. Only the recognized core/rule wrappers are removed.
  let outside = parsed ? text.slice(0,parsed.start)+text.slice(parsed.end) : text;
  const marked=parseRules(outside);
  if(marked){
    // Schema 2 already exposes this external body through parsed.rules.
    // Unmarked 4.1 may also have a separate legacy body; preserve both.
    if(parsed?.schema!==2&&isRulesPopulated(rules))rules+="\n\n"+marked.rules;
    else rules=marked.rules;
    const oldNotice=pendingRulesBlock(marked.rules);
    if(oldNotice && outside.includes(oldNotice))outside=outside.replace(oldNotice,"");
    else outside=outside.slice(0,marked.start)+outside.slice(marked.end);
  }
  const named=extractNamedRules(outside);outside=named.text;
  if(named.rules)rules+=(isRulesPopulated(rules)?"\n\n":"")+named.rules;
  const agents=block+(outside.startsWith("\n")||outside.startsWith("\r\n")?"":"\n")+outside;
  if(!isRulesPopulated(rules))return {agents,architecture};
  const existing=architecture??"";
  const imported="## "+IMPORT_NOTICE+"\n\nThese imported rules remain binding. Their implementation status is unverified; migration changes location only. Urgently inspect applicable code/tests before affected work. Merge verified constraints beside their responsible files; keep unresolved requirements clearly marked here and implement corrections only within authorized project scope. Preserve every requirement when reconciling this section.\n\n"+rules+"\n";
  return {agents,architecture:existing+(existing?(existing.endsWith("\n")?"\n":"\n\n"):"# Architecture\n\n")+imported};
}
export function parseRules(text) {
  const a=count(text,REPO_RULES_START),b=count(text,REPO_RULES_END);
  if (!a&&!b&&!text.includes("bridgecode:repo-rules:")) return null;
  if(count(text,"bridgecode:repo-rules:start")!==a||count(text,"bridgecode:repo-rules:end")!==b)throw new Error("Repository rule markers are malformed");
  if(a!==1||b!==1) throw new Error("Repository rule markers are duplicated or missing");
  const start=text.indexOf(REPO_RULES_START), after=start+REPO_RULES_START.length,end=text.indexOf(REPO_RULES_END);
  const eol=text.slice(after).startsWith("\r\n")?"\r\n":text[after]==="\n"?"\n":"";
  if(!eol||end<=after) throw new Error("Repository rule markers are malformed");
  let stop=end;
  if(text.slice(0,stop).endsWith("\r\n"))stop-=2;else if(text[stop-1]==="\n")stop--;
  if(stop<after+eol.length)throw new Error("Repository rule markers are malformed");
  return {start,end:end+REPO_RULES_END.length,rules:text.slice(after+eol.length,stop),bodyStart:after+eol.length,bodyEnd:stop};
}
export function parseManagedAgents(text) {
  const starts=[...text.matchAll(pattern())], ends=count(text,MANAGED_END);
  if(!starts.length&&!ends&&!text.includes("bridgecode:managed:"))return null;
  if(starts.length!==1||ends!==1||count(text,"bridgecode:managed:start")!==1||count(text,"bridgecode:managed:end")!==1)throw new Error("Bridgecode markers are missing, duplicated, or malformed");
  const start=starts[0].index,end=text.indexOf(MANAGED_END)+MANAGED_END.length;
  if(end<=start+starts[0][0].length)throw new Error("Bridgecode marker order is malformed");
  const managed=text.slice(start,end),schema=Number(starts[0][2]);
  const rule=parseRules(text);
  if(schema===1 && (!rule||rule.start<=start||rule.end>=end))throw new Error("Legacy rule markers are missing or malformed");
  if(schema===2 && rule && rule.start<end && rule.end>start)throw new Error("Repo rules must be outside the package-owned core");
  const skeleton=schema===1?text.slice(start,rule.bodyStart)+"<bridgecode:repo-rules>"+text.slice(rule.bodyEnd,end):managed;
  return {start,end,version:starts[0][1],schema,managed,managedHash:sha256(skeleton),rules:rule?.rules??""};
}
export function adoptUnmarkedAgents(existing, canonical) {
  if(existing===canonical||existing.replaceAll("\r\n","\n")===canonical.replaceAll("\r\n","\n"))return {rules:"",current:true};
  return null;
}
export function adoptKnownUnmarked(existing,canonical) {
  const lf=canonical.replaceAll("\r\n","\n").trimEnd();
  for(const core of [lf,lf.replaceAll("\n","\r\n")]){
    const start=existing.indexOf(core),end=start+core.length;
    if(start<0||existing.indexOf(core,end)!==-1)continue;
    if(start&&existing[start-1]!=="\n")continue;
    if(end<existing.length&&!/^[\r\n]/.test(existing.slice(end)))continue;
    return {start,end,schema:2,rules:parseRules(existing)?.rules??""};
  }
  throw new Error("Unknown legacy instructions; reconcile the locally changed core before migration");
}
export function adoptLegacy(existing,canonical) {
  const old=splitCanonicalAgents(existing), known=splitCanonicalAgents(canonical);
  if(old.prefix.replaceAll("\r\n","\n")!==known.prefix.replaceAll("\r\n","\n"))throw new Error("Unknown legacy instructions; export and reconcile rules before migration");
  const boundary=markdownHeadings(old.templateRules).find(h=>h.level<=2)?.start??old.templateRules.length;
  return {rules:old.templateRules.slice(0,boundary).replace(/\r?\n$/,""),outside:old.templateRules.slice(boundary)};
}
