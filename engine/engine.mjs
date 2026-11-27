#!/usr/bin/env node
// Bridgecode engine: runs the flow in flow.json, binds the cards in cards/, pushes the specialists in triggers.json,
// enforces what code can compute, and witnesses runs, verdicts, identities and the user's words.
// Judgment stays with the agents; the user's decisions stay with the user.
// Vendored from cLoop 1.2.0 (github.com/Lycvrgvs/cLoop, cloop.mjs at 585f9c7afe66d53f37c92a221562021883ae1066)
// and adapted to Bridgecode's flow. Node standard library only. Installed as .bridgecode/engine/engine.mjs;
// run from the repository root: node .bridgecode/engine/engine.mjs <command> ...
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const VERSION = '4.6.0';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha256 = (x) => crypto.createHash('sha256').update(x).digest('hex');
const now = () => new Date().toISOString();
const readText = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };

// ── Durable memory: fixed sections, rubric lines (also used by the CLI's doctor) ──────────────
export const MEMORY_SECTIONS = {
  'agentic/rubric.md': ['Goals', 'Drop', 'Vetoes', 'Backlog'],
  'agentic/spec.md': ['Intent', 'Inputs', 'Behaviour', 'Outputs', 'Constraints', 'Directions', 'Open decisions'],
  'agentic/architecture.md': ['Overview', 'Tree', 'Decisions', 'Vetoes', 'Budgets', 'Harness', 'Unverified rules'],
};
export const CLASSES = ['CORE', 'NON-CORE'];
export const TAGS = ['ui', 'prose', 'copy', 'image', 'taste', 'llm', 'prompt', 'law'];
function headings(text, level = 2) {
  const out = [], mark = '#'.repeat(level) + ' '; let fence = null;
  for (const line of text.split(/\r?\n/)) {
    const code = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (code) { if (!fence) fence = code[1]; else if (code[1][0] === fence[0] && code[1].length >= fence.length) fence = null; continue; }
    if (!fence && line.startsWith(mark)) out.push(line.slice(mark.length).trim());
  }
  return out;
}
function sectionLines(text, name) { // the lines under "## <name>" up to the next "## "
  const lines = text.split(/\r?\n/), i = lines.findIndex((l) => l.trim() === '## ' + name);
  if (i < 0) return null;
  const rest = lines.slice(i + 1), end = rest.findIndex((l) => l.startsWith('## '));
  return end < 0 ? rest : rest.slice(0, end);
}
export function parseRubric(text) { // ## Goals → ### G<n> <objective> → "- G1.C1 | CORE | tags: … | <property> | scope: … | unsupported: … | evidence: …"
  const crit = [], goals = [], errors = [], warnings = [];
  const gl = sectionLines(text, 'Goals');
  if (!gl) return { crit, goals, errors: ['add a "## Goals" section'], warnings, hash: null };
  let goal = null;
  for (const raw of gl) {
    const line = raw.trim();
    const g = /^### (G\d+)\s+(\S.*)$/.exec(line);
    if (g) { goal = { id: g[1], objective: g[2] }; goals.push(goal); continue; }
    if (line.startsWith('### ')) { errors.push(`goal heading "${line.slice(0, 60)}" needs "### G<n> <objective>"`); continue; }
    if (!line.startsWith('- ')) continue;
    const parts = line.slice(2).split(' | ').map((p) => p.trim()), [id, cls] = parts;
    const field = (k) => { const p = parts.find((x) => x.startsWith(k + ':')); return p === undefined ? null : p.slice(k.length + 1).trim(); };
    const tagsField = field('tags'), tags = tagsField ? tagsField.split(/[,\s]+/).filter(Boolean) : [];
    const property = parts.slice(2).find((p) => !/^(tags|scope|unsupported|evidence):/.test(p)) || '';
    const c = { id, cls, tags, property, scope: field('scope'), unsupported: field('unsupported'), evidence: field('evidence'), goal: goal && goal.id, raw: line };
    const problems = [];
    if (!/^G\d+\.C\d+$/.test(id || '')) problems.push('an ID (G<n>.C<n>)');
    else if (!goal || !id.startsWith(goal.id + '.')) problems.push(`its goal heading (### ${(id || '').split('.')[0]} …)`);
    if (!CLASSES.includes(cls)) problems.push('a CORE/NON-CORE class');
    const unknown = tags.filter((t) => !TAGS.includes(t)); if (unknown.length) problems.push(`known tags (unknown: ${unknown.join(', ')}; known: ${TAGS.join(', ')})`);
    if (!property) problems.push('a property');
    if (!c.scope) problems.push('a scope');
    if (!c.unsupported) problems.push('an unsupported field');
    if (!c.evidence) problems.push('an evidence field');
    if (problems.length) { errors.push(`${line.slice(0, 70)}… lacks ${problems.join(', ')}`); continue; }
    if (crit.some((x) => x.id === id)) { errors.push(`${id}: duplicate ID`); continue; }
    if (/\band\b/i.test(property)) warnings.push(`${id}: "and" in the property; split it if it can be half-met`);
    crit.push(c);
  }
  for (const g2 of goals) if (!crit.some((c) => c.goal === g2.id)) warnings.push(`${g2.id}: no criteria under it`);
  if (crit.length && !crit.some((c) => c.cls === 'CORE')) errors.push('add a CORE criterion');
  const drop = sectionLines(text, 'Drop') || [];
  const norm = (ls) => ls.map((l) => l.trim()).filter((l) => l.startsWith('- ') || l.startsWith('### '));
  return { crit, goals, errors, warnings, hash: sha256([...norm(gl), '##Drop', ...norm(drop)].join('\n')) };
}
export function checkMemoryShape(file, text) {
  const warnings = [], expected = MEMORY_SECTIONS[file];
  if (!/^TOKENS_USED: ~\d+\s*$/.test(text.split(/\r?\n/).find((l) => l.trim()) ?? '')) warnings.push(`${file}: first line must be TOKENS_USED: ~N (written by the engine's metrics)`);
  const found = headings(text), missing = expected.filter((h) => !found.includes(h)), extra = found.filter((h) => !expected.includes(h));
  if (missing.length) warnings.push(`${file}: missing section(s) ${missing.join(', ')}`);
  if (extra.length) warnings.push(`${file}: section(s) outside the template ${extra.join(', ')}`);
  if (!missing.length && !extra.length && found.join('|') !== expected.join('|')) warnings.push(`${file}: sections are reordered or repeated; expected ${expected.join(', ')}`);
  if (file === 'agentic/rubric.md') warnings.push(...parseRubric(text).errors.map((e) => `${file}: ${e}`));
  return warnings;
}

// ── Budgets (metrics): computed, never estimated ──────────────────────────────────────────────
export const METRICS_PATH = '.bridgecode/metrics.json';
export const CONFIG_PATH = '.bridgecode/config.json';
export const THRESHOLDS = { testAlert: 0.6, testRatio: 0.9, testTarget: 0.3, memoryAlert: 18000, memoryTokens: 30000, memoryTarget: 9000 };
const SOURCE = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'mts', 'cts', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'kts', 'scala', 'swift', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'm', 'mm', 'cs', 'fs', 'vb', 'php', 'pl', 'pm', 'lua', 'dart', 'ex', 'exs', 'erl', 'hs', 'ml', 'mli', 'clj', 'cljs', 'r', 'jl', 'zig', 'nim', 'sh', 'bash', 'zsh', 'ps1', 'psm1', 'sql', 'vue', 'svelte', 'astro', 'html', 'css', 'scss', 'sass', 'less', 'elm', 'sol', 'tf']);
const TEST_PATTERNS = ['**/test/**', '**/tests/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*', '**/*_test.*', '**/test_*.py'];
const EXCLUDE_PATTERNS = ['**/node_modules/**', '**/vendor/**', '**/third_party/**', '**/dist/**', '**/build/**', '**/out/**', '**/coverage/**', '**/target/**', '**/.next/**', '**/__pycache__/**', '**/generated/**', '**/*.generated.*', '**/*.min.*', '**/*.map', '**/docs/**', '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml', '**/Cargo.lock', '**/poetry.lock', '**/Gemfile.lock', '**/composer.lock', '**/go.sum', 'agentic/**', 'temporary/**', '.bridgecode/**', 'bridgecode/**', '.codex/**', '.claude/**'];
export function globToRegExp(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') { i++; if (glob[i + 1] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; }
    else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'i');
}
const matcher = (globs) => { const res = globs.map(globToRegExp); return (p) => res.some((r) => r.test(p)); };
export const STORE_PATH = '.bridgecode/git'; // the task's own Git store when the checkout's .git refuses writes
export const storeArgs = (root) => { const st = path.join(root, STORE_PATH); return fs.existsSync(st) ? ['--git-dir=' + st, '--work-tree=' + root] : []; };
function listFiles(root) {
  const g = spawnSync('git', [...storeArgs(root), 'ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (g.status === 0) return { source: 'git', files: g.stdout.split('\0').filter(Boolean) };
  const files = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      if (files.length >= 20000) return;
      const p = dir ? `${dir}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!['.git', 'node_modules'].includes(e.name)) walk(p); } else if (e.isFile()) files.push(p);
    }
  };
  walk('');
  return { source: 'walk', files };
}
const nonBlank = (t) => t.split(/\r?\n/).filter((l) => l.trim()).length;
export const approxTokens = (t) => Math.ceil((t ?? '').length / 4);
export function countCriteria(rubricText) {
  const goals = {};
  for (const c of parseRubric(rubricText ?? '').crit) { goals[c.goal] ??= { CORE: 0, 'NON-CORE': 0 }; goals[c.goal][c.cls]++; }
  return goals;
}
const withoutTokenLine = (t) => t.replace(/^\s*TOKENS_USED:[^\n]*\n?/, '');
export function computeMetrics(root) {
  let config = {}; try { config = JSON.parse(readText(path.join(root, CONFIG_PATH)) ?? '{}'); } catch { config = {}; }
  const isTest = matcher(config.tests ?? TEST_PATTERNS), isExcluded = matcher([...EXCLUDE_PATTERNS, ...(config.exclude ?? [])]);
  const { source, files } = listFiles(root);
  const production = { files: 0, loc: 0 }, tests = { files: 0, loc: 0 }, classified = { production: [], tests: [] };
  for (const p of files.sort()) {
    const ext = /\.([^./]+)$/.exec(p)?.[1]?.toLowerCase();
    if (!ext || !SOURCE.has(ext) || isExcluded(p)) continue;
    let bytes; try { bytes = fs.readFileSync(path.join(root, p)); } catch { continue; }
    if (bytes.includes(0)) continue;
    const test = isTest(p), bucket = test ? tests : production;
    classified[test ? 'tests' : 'production'].push(p); bucket.files++; bucket.loc += nonBlank(bytes.toString('utf8'));
  }
  const mem = (f) => { const t = readText(path.join(root, 'agentic', f + '.md')); return t === null ? null : approxTokens(withoutTokenLine(t)); };
  const ratio = production.loc ? tests.loc / production.loc : (tests.loc ? Infinity : 0), pct = Math.round(ratio * 100);
  const tokens = { rubric: mem('rubric'), spec: mem('spec'), architecture: mem('architecture') };
  const crossed = [], alerts = [];
  if (ratio > THRESHOLDS.testRatio) crossed.push(`test volume ${pct}% of production LOC (> 90%): run the prune pass toward 30% at the next CONSOLIDATE`);
  else if (ratio >= THRESHOLDS.testAlert) alerts.push(`test volume ${pct}% of production LOC (alert band 60-90%): give new properties law-level checks, not more examples`);
  for (const f of ['architecture', 'spec']) {
    const n = tokens[f];
    if (n > THRESHOLDS.memoryTokens) crossed.push(`agentic/${f}.md ~${n} tokens (> 30k): distill toward 9k at the next CONDENSE`);
    else if (n >= THRESHOLDS.memoryAlert) alerts.push(`agentic/${f}.md ~${n} tokens (alert band 18k-30k): one line per entry, remove before adding`);
  }
  return { classified, result: { listing: source, production, tests, ratio: Number.isFinite(ratio) ? Math.round(ratio * 1000) / 1000 : null, tokens, criteria: countCriteria(readText(path.join(root, 'agentic/rubric.md'))), thresholds: THRESHOLDS, alerts, crossed } };
}
export function writeMetrics(root) { // metrics.json, and the TOKENS_USED line of each durable file
  const { result } = computeMetrics(root);
  fs.mkdirSync(path.join(root, '.bridgecode'), { recursive: true });
  fs.writeFileSync(path.join(root, METRICS_PATH), JSON.stringify({ t: now(), ...result }, null, 2) + '\n');
  for (const f of ['rubric', 'spec', 'architecture']) {
    const p = path.join(root, 'agentic', f + '.md'), t = readText(p); if (t === null) continue;
    const body = withoutTokenLine(t), next = `TOKENS_USED: ~${approxTokens(body)}\n` + body;
    if (next !== t) fs.writeFileSync(p, next);
  }
  return result;
}
export function formatMetrics(m) {
  const t = (v) => v === null ? 'absent' : `~${v} tokens`;
  const goals = Object.entries(m.criteria).map(([g, c]) => `${g}: CORE ${c.CORE}, NON-CORE ${c['NON-CORE']}`);
  return [
    `Production: ${m.production.files} files, ${m.production.loc} non-blank LOC`,
    `Tests: ${m.tests.files} files, ${m.tests.loc} non-blank LOC (ratio ${m.ratio === null ? 'n/a' : Math.round(m.ratio * 100) + '%'}; alert 60-90%, prune > 90% toward 30%)`,
    `Memory: rubric ${t(m.tokens.rubric)} · spec ${t(m.tokens.spec)} · architecture ${t(m.tokens.architecture)} (alert 18k-30k, distill > 30k toward 9k)`,
    `Criteria: ${goals.length ? goals.join('; ') : 'no rubric criteria'}`,
    ...m.alerts.map((a) => 'ALERT: ' + a),
    ...(m.crossed.length ? m.crossed.map((c) => 'CROSSED: ' + c) : ['No budget crossed.']),
    `Written to ${METRICS_PATH}.`,
  ].join('\n');
}

// ── Flow, cards, core cards, triggers, roles: data next to the engine ─────────────────────────
export function readCards(dir) { // <id>.md: front matter (card, state, role, rung, route, loads), then the body
  const cards = {};
  if (!fs.existsSync(dir)) return cards;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md')).sort()) {
    const t = fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n'), m = t.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) { cards[f] = { file: f, bad: 'no front matter' }; continue; }
    const fm = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s*/)).filter((x) => x.length >= 2).map(([k, ...v]) => [k.trim(), v.join(':').trim()]));
    const id = fm.card || fm.core || f;
    cards[id] = { file: f, ...fm, states: (fm.state || '').split(/,\s*/).filter(Boolean), roles: (fm.role || '').split(/,\s*/).filter(Boolean), body: m[2].trim() };
  }
  return cards;
}
const EXPLORE_TRIGGERS = { shape: "the output's shape is unclear after DEFINE", mechanism: 'several mechanisms are plausible and no cheap check separates them', oneshot: 'the one-shot was a bad base (FULL)' };
const ROLES = ['planner', 'reviewer', 'loop-breaker', 'explorer', 'builder-dynamic', 'builder-mechanical'];
const WRITE_ROLES = ['loop-breaker', 'explorer', 'builder-dynamic', 'builder-mechanical'];
const NATIVE = { codex: 'spawn_agent', claude: 'Agent tool', exp: 'Agent tool' };
const ZERO = () => ({ ADVANCED: 0, STALLED: 0, REGRESSION: 0 });
const METHOD_PATHS = ['.bridgecode/', '.codex/', '.claude/', 'bridgecode/', 'agentic/tasks/', 'temporary/', 'AGENTS.md', 'CLAUDE.md', 'README_HUMAN.txt'];
const JUDGE_KIND = { DEFINE: 'plan', EXPLORE: 'explore', ONESHOT: 'oneshot', LOOP: 'loop', BREAK: 'break', GATE: 'gate' };

function main(argv) {
  const ROOT = process.cwd();
  const CMD = 'node ' + (path.relative(ROOT, fileURLToPath(import.meta.url)).split(path.sep).join('/') || 'engine.mjs');
  const die = (msg) => { console.error('REFUSED: ' + msg); process.exit(2); };
  const NEXT_HINT = `${CMD} status shows the state, its cards and what each exit needs`;
  const flowPath = path.join(HERE, 'flow.json');
  if (!fs.existsSync(flowPath)) die(`flow.json is missing next to the engine (${flowPath}): run bridgecode update`);
  const FLOWDATA = JSON.parse(fs.readFileSync(flowPath, 'utf8')), FLOW = FLOWDATA.states, LADDER = FLOWDATA.ladder, RUNGS = FLOWDATA.rungs, PREVENT = FLOWDATA.prevent || {};
  const CARDS = readCards(path.join(HERE, 'cards')), CORE = readCards(path.join(HERE, 'core'));
  const TRIGGERS = JSON.parse(readText(path.join(HERE, 'triggers.json')) ?? '{"specialists":{}}').specialists;
  const ROLESDATA = JSON.parse(readText(path.join(HERE, 'roles.json')) ?? 'null') || { edition: null, extensions: [], roles: {} };
  const subst = (t) => t.replaceAll('{{cmd}}', CMD);
  const bound = (state, role) => FLOWDATA.cards.filter((b) => b.state === state && b.role === role);
  const cardText = (state, role) => bound(state, role).map((b) => { const c = CARDS[b.card]; if (!c || !c.body) die(`card "${b.card}" (${b.state}, ${b.role}) is missing from ${path.join(HERE, 'cards')}: run bridgecode update`); return subst(c.body); }).join('\n\n');

  // ── The task record: agentic/tasks/<slug>/ (state, append-only log with the state hash, board) ──
  const TASKS = path.join(ROOT, 'agentic', 'tasks');
  const files = (slug) => { const d = path.join(TASKS, slug); return { dir: d, state: path.join(d, 'state.json'), log: path.join(d, 'log.jsonl'), board: path.join(d, 'board.md'), tmp: path.join(ROOT, 'temporary', slug) }; };
  const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', cwd: opts.cwd || ROOT, maxBuffer: 1 << 28, shell: !!opts.shell, timeout: opts.timeout, input: opts.input }); return { code: r.status ?? 1, out: (r.stdout || '') + (r.stderr || '') }; };
  let hasId = null;
  const git = (args, cwd) => { if (hasId === null) hasId = !!sh('git', ['config', 'user.email']).out.trim(); return sh('git', ['-c', 'safe.directory=*', ...(hasId ? [] : ['-c', 'user.name=bridgecode', '-c', 'user.email=bridgecode@localhost']), ...(cwd ? [] : storeArgs(ROOT)), ...args], { cwd }); };
  const STORE = path.join(ROOT, STORE_PATH), stored = () => fs.existsSync(STORE);
  function gitProbe() { // the writes delegates need, made for real: a branch, a linked worktree, a commit in it; Git's own diagnostic on failure
    const tag = crypto.randomBytes(3).toString('hex'), br = `bc/probe-${tag}`, wt = path.join(ROOT, 'temporary', `probe-${tag}`);
    const r = git(['worktree', 'add', '-q', '-b', br, wt, 'HEAD']), c = r.code ? r : git(['commit', '-q', '--allow-empty', '-m', 'Bridgecode probe'], wt);
    git(['worktree', 'remove', '--force', wt]); git(['branch', '-q', '-D', br]); git(['worktree', 'prune']); fs.rmSync(wt, { recursive: true, force: true });
    return c.code ? c.out.trim() || `git exited ${c.code}` : null;
  }
  function useStore(diag, retry) { // seed a separate store from the checkout's history; the checkout's .git is only read
    const history = !git(['rev-parse', '--verify', 'HEAD']).code; // a clone keeps the checkout's HEAD: its branch (a linked worktree's too) or its detached commit
    const r = history ? sh('git', ['-c', 'safe.directory=*', 'clone', '--bare', '--no-hardlinks', '-q', ROOT, STORE]) : sh('git', ['init', '--bare', '-q', '-b', 'main', STORE]);
    if (r.code) { fs.rmSync(STORE, { recursive: true, force: true }); die(`git refuses the writes delegates need here, and a separate store could not be made either; the task record is kept.\n.git: ${diag}\n${STORE_PATH}: ${r.out.trim()}\nmake .git (or ${path.dirname(STORE_PATH)}/) writable, then ${retry}`); }
    for (const x of [['config', 'core.bare', 'false'], ['remote', 'remove', 'origin']]) sh('git', ['--git-dir=' + STORE, ...x]);
    writeExcludes();
    if (history) git(['reset', '-q']); else git(['commit', '--allow-empty', '-q', '-m', 'Bridgecode baseline']);
    const again = gitProbe();
    if (again) { fs.rmSync(STORE, { recursive: true, force: true }); die(`git refuses the writes delegates need in .git and in a separate store; the task record is kept.\n.git: ${diag}\n${STORE_PATH}: ${again}\nmake the workspace writable, then ${retry}`); }
    console.log(`.git refuses the writes delegates need (${diag.split('\n').find((l) => l.trim()) || diag}); this task's repository is ${STORE_PATH}, seeded from the checkout's history, and .git is left untouched. Run every git command as ${CMD} git <args>.`);
  }
  function writeExcludes() { // the task record, the evidence and the store stay out of the product's history
    const ex = path.resolve(ROOT, git(['rev-parse', '--git-common-dir']).out.trim(), 'info', 'exclude'); fs.mkdirSync(path.dirname(ex), { recursive: true });
    const have = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8').split(/\r?\n/) : [];
    fs.appendFileSync(ex, ['temporary/', 'agentic/tasks/', STORE_PATH + '/'].filter((w) => !have.includes(w)).map((w) => w + '\n').join(''));
  }
  function addWorktree(args, retry) { // a delegate's worktree; when .git refuses it mid-task, move to the separate store once and retry
    let r = git(['worktree', 'add', '-q', ...args]);
    if (r.code && !stored() && !git(['rev-parse', '--verify', 'HEAD']).code && gitProbe()) { useStore(r.out.trim(), retry); r = git(['worktree', 'add', '-q', ...args]); }
    return r;
  }
  const head = (cwd) => git(['rev-parse', 'HEAD'], cwd).out.trim();
  const branch = () => git(['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
  const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');
  const product = (p) => !METHOD_PATHS.some((m) => p === m.replace(/\/$/, '') || p.startsWith(m));
  const EXCLUDES = METHOD_PATHS.map((m) => `:(exclude)${m.replace(/\/$/, '')}`);
  const statusLines = () => git(['status', '--porcelain']).out.split('\n').filter((l) => l.trim() && product(l.slice(3).trim().replace(/^"|"$/g, '')));
  const dirty = (s) => statusLines().map((l) => l.slice(3).trim().replace(/^"|"$/g, '')).filter((p) => !((s && s.dirtyAtInit) || []).includes(p));
  const snapshot = () => ({ head: head(), status: statusLines().join('\n'), diff: sha256(git(['diff', '--', '.', ...EXCLUDES]).out), t: now() });
  const sameTree = (a, b) => a.head === b.head && a.status === b.status && a.diff === b.diff;
  const diffSize = (from, to) => from && to ? git(['diff', '--numstat', from, to, '--', '.', ...EXCLUDES]).out.split('\n').filter(Boolean).reduce((n, l) => n + (+l.split('\t')[0] || 0) + (+l.split('\t')[1] || 0), 0) : 0;
  const rubricText = () => readText(path.join(ROOT, 'agentic', 'rubric.md'));
  const rubric = () => { const t = rubricText(); return t === null ? { crit: [], goals: [], errors: ['agentic/rubric.md is missing (the define card gives its format)'], warnings: [], hash: null } : parseRubric(t); };
  const installation = () => { try { return JSON.parse(readText(path.join(ROOT, '.bridgecode', 'installation.json'))); } catch { return null; } };

  function slugFromContext(explicit) {
    if (explicit) return explicit;
    if (process.env.BRIDGECODE_TASK) return process.env.BRIDGECODE_TASK;
    const b = branch(); if (b.startsWith('bc/') && fs.existsSync(files(b.slice(3)).state)) return b.slice(3);
    const live = fs.existsSync(TASKS) ? fs.readdirSync(TASKS).filter((d) => { try { const s = JSON.parse(fs.readFileSync(files(d).state, 'utf8')); return !FLOW[s.state]?.terminal; } catch { return false; } }) : [];
    if (live.length === 1) return live[0];
    return live.length ? { many: live } : null;
  }
  const logLines = (slug) => (readText(files(slug).log) ?? '').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  function load(explicit, opts = {}) {
    const slug = slugFromContext(explicit);
    if (!slug) die(`no active task: ${CMD} init <FOCUSED|FULL> <slug> "<reason>" (DIRECT and ASSESS use no engine)`);
    if (slug.many) die(`several tasks are open (${slug.many.join(', ')}): check out the task's branch bc/<slug>, or add --task <slug>`);
    const F = files(slug); if (!fs.existsSync(F.state)) die(`no task "${slug}": ${CMD} init <FOCUSED|FULL> <slug> "<reason>"`);
    const text = fs.readFileSync(F.state, 'utf8'), last = logLines(slug).filter((l) => l.hash).pop();
    if (!opts.skipHash && (!last || last.hash !== sha256(text))) die(`agentic/tasks/${slug}/state.json no longer matches its last record in log.jsonl (it was edited by hand): ${CMD} recover --task ${slug} rebuilds it from the log`);
    const s = JSON.parse(text);
    if ('stage' in s) { delete s.stage; if (s.rung === 'small') s.rung = LADDER.pass; if (s.pending === 'small') s.pending = LADDER.pass; } // a task begun before the single features stage
    if (!FLOW[s.state]) die(`state ${s.state} is unknown to this engine: finish the task with the Bridgecode version that started it`);
    return s;
  }
  function save(s, event) {
    const F = files(s.slug); fs.mkdirSync(F.dir, { recursive: true });
    const text = JSON.stringify(s, null, 2); fs.writeFileSync(F.state, text);
    fs.appendFileSync(F.log, JSON.stringify({ t: now(), state: s.state, rung: s.rung, ...(event || { ev: 'save' }), hash: sha256(text), snap: s }) + '\n');
    fs.writeFileSync(F.board, board(s));
  }

  // ── Rubric scope ──
  const required = (s) => { const C = rubric().crit; return s.adopted ? C.filter((c) => c.cls === 'CORE' || s.touched.includes(c.id) || !s.baselineIds.includes(c.id)) : C; };
  const requiredIds = (s) => required(s).map((c) => c.id);
  const openRequired = (s) => requiredIds(s).filter((id) => !s.est.includes(id));
  const gateKind = (s) => s.prePassed ? 'release' : 'pre-release'; // one features stage: the end-to-end gate before CONSOLIDATE, then the release gate on the frozen candidate
  const openTargets = (s, ids) => { const known = rubric().crit.map((c) => c.id), t = (ids || []).filter((id) => known.includes(id) && !s.est.includes(id)); return t.length ? t : openRequired(s); };
  const scopeOf = (s, kind) => kind === 'gate' || ['oneshot', 'explore', 'merge', 'plan'].includes(kind) || (s.nextShot && ['loop', 'break'].includes(kind)) ? requiredIds(s) // the next-shot is judged on every criterion
    : kind === 'loop' ? openTargets(s, (s.prevent && s.prevent.targets) || s.targets) : openTargets(s, s.targets);
  const firstSize = (s) => s.route === 'FOCUSED' ? 'tiny' : 'small';
  const STEP_TEXT = { tiny: 'the goal, the criteria in scope, where the code stands, the one risk', small: 'the whole, the class and root cause, what to remove, the real property, the one correction' };
  const stepHint = (s) => `${CMD} stepback ${firstSize(s)} --targets <IDs> "<${STEP_TEXT[firstSize(s)]}>"`;
  const BLOCK_HINT = `${CMD} block "<the next action written whole, in one block: what it builds or changes, in which files, against which criteria and real inputs>"`;
  const FULL_HINT = `${CMD} stepback full --targets <IDs> "<a page, from scratch: the rubric, all the evidence, what is unsettled and why no cheap check separates it, what to remove, the real property>"`;
  const REPLAN_HINT = `the loop-breakers' re-plan from the user's comment: ${CMD} call loop-breaker, then ${CMD} stepback replan DEFINE|EXPLORE "<the step at fault, what changes, what is removed>"`;
  const RANK = { tiny: 1, small: 1, full: 2, replan: 3 };
  const judgeOf = (s, kind) => (FLOWDATA.judge[s.route] || {})[kind] || 'reviewer';
  const roleRows = (role) => { const r = (ROLESDATA.roles || {})[role]; return r && r.length ? r : [{ model: 'root', effort: 'root', spawn: NATIVE[ROLESDATA.edition] || 'native', context: 'fresh', claim: 'core default', source: 'core' }]; };
  const callsIn = (s, role) => Object.entries(s.calls).filter(([, c]) => c.role === role && c.entry === s.entryN && !c.void).map(([id]) => id);
  const bestSha = (s) => s.best || s.base;

  // ── Witnessing helpers ──
  const normModel = (m) => (m || '').toLowerCase().replace(/^claude-/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function findFiles(dir, test, depth = 4, out = []) { if (depth < 0 || !fs.existsSync(dir)) return out; for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) findFiles(p, test, depth - 1, out); else if (test(e.name, p)) out.push(p); } return out; }
  function identity(s, id) { // model and effort from the harness's own record, never from the delegate's reply
    const c = s.calls[id], F = files(s.slug), run = path.join(F.tmp, 'runs', id), packet = path.join(run, 'packet.md');
    const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
    const fromCodex = (file) => { const tc = (readText(file) || '').split('\n').filter((l) => l.includes('"turn_context"')).pop(); if (!tc) return null; try { const p = JSON.parse(tc).payload; return { model: p.model, effort: p.effort || p.collaboration_mode?.settings?.reasoning_effort, record: file }; } catch { return null; } };
    const ev = readText(path.join(run, 'events.jsonl'));
    if (ev) {
      const m = /"thread_id"\s*:\s*"([^"]+)"/.exec(ev);
      if (m) { const f = findFiles(path.join(codexHome, 'sessions'), (n) => n.includes(m[1]))[0]; if (f) { const r = fromCodex(f); if (r) return { ...r, how: 'codex exec session log' }; } }
      return { how: 'events.jsonl without a session record' };
    }
    const since = Date.parse(c.t) - 60e3, mine = (p) => { try { return fs.statSync(p).mtimeMs >= since; } catch { return false; } };
    const needle = packet.split(path.sep).join('/'), needle2 = JSON.stringify(packet).slice(1, -1);
    const hit = (p) => { const t = readText(p) || ''; const first = t.slice(0, 20000); return first.includes(needle) || first.includes(needle2) || first.includes(rel(packet)); };
    for (const f of findFiles(path.join(codexHome, 'sessions'), (n, p) => n.startsWith('rollout-') && mine(p))) if (hit(f)) { const r = fromCodex(f); if (r) return { ...r, how: 'codex session log' }; }
    const key = ROOT.replace(/[^A-Za-z0-9]/g, '-'), proj = path.join(os.homedir(), '.claude', 'projects', key);
    for (const f of findFiles(proj, (n, p) => n.endsWith('.jsonl') && p.includes('subagents') && mine(p), 3)) if (hit(f)) {
      const t = readText(f) || '', models = [...t.matchAll(/"model":"([^"]+)"/g)].map((x) => x[1]).filter((x) => !x.startsWith('<')), efforts = [...t.matchAll(/"effort":"([^"]+)"/g)].map((x) => x[1]);
      if (models.length) return { model: models[models.length - 1], effort: efforts[efforts.length - 1], record: f, how: 'Claude Code subagent transcript' };
    }
    return { how: 'as requested (no harness record found)' };
  }
  function identityProblem(s, id) {
    const c = s.calls[id], got = identity(s, id); c.identity = got;
    if (!got.model || c.requested.model === 'root') return null;
    const okModel = normModel(got.model) === normModel(c.requested.model), okEffort = !got.effort || !c.requested.effort || got.effort === c.requested.effort;
    return okModel && okEffort ? null : `${id}: ran ${got.model} ${got.effort || ''} (${got.how}), roles.json assigns ${c.requested.model} ${c.requested.effort}: redispatch with the assigned model`;
  }
  function citesMissing(text, worktree) { // a cited path:line that does not exist voids the verdict
    const out = [];
    for (const m of text.matchAll(/(?:^|[\s(`'"])([\w./\\-]+\.[A-Za-z0-9]+):(\d+)/g)) {
      const [, p, ln] = m, cands = [path.resolve(worktree || ROOT, p), path.resolve(ROOT, p)];
      const f = cands.find((x) => fs.existsSync(x) && fs.statSync(x).isFile());
      if (!f) out.push(`cites ${p}:${ln}, which does not exist`); else if ((readText(f) || '').split('\n').length < +ln) out.push(`cites ${p}:${ln}, past the end of the file`);
    }
    return out;
  }
  function parseOut(file, ids, worktree) {
    if (!fs.existsSync(file)) return { incomplete: [`save the reply verbatim as ${rel(file)}`], v: {}, rubricLines: [], fixes: [] };
    const v = {}, incomplete = [], rubricLines = [], fixes = [], text = fs.readFileSync(file, 'utf8');
    for (const line of text.split('\n').map((l) => l.trim().replace(/^[-*]\s*/, '').replace(/^`|`$/g, ''))) {
      let m = line.match(/^RUBRIC:\s*(.+)/); if (m) { rubricLines.push(m[1]); continue; }
      m = line.match(/^FIX:\s*(.+)/); if (m) { fixes.push(m[1]); continue; }
      const parts = line.split(' | ').map((p) => p.trim());
      if (!ids.includes(parts[0]) || !['MET', 'NOT_MET'].includes(parts[1])) continue;
      const val = (k) => { const p = parts.find((x) => x.startsWith(k + ':')); return p ? p.slice(k.length + 1).trim() : ''; };
      if (parts[1] === 'MET' && !(val('evidence') && val('counterfeit') && val('boundary'))) incomplete.push(`${parts[0]}: MET needs evidence, counterfeit and boundary`);
      if (parts[1] === 'NOT_MET' && !val('case')) incomplete.push(`${parts[0]}: NOT_MET needs a rerunnable case`);
      v[parts[0]] = parts[1];
    }
    for (const id of ids) if (!v[id]) incomplete.push(`${id}: no verdict line`);
    incomplete.push(...citesMissing(text, worktree));
    return { v, incomplete, rubricLines, fixes };
  }
  function userPrompts(s, since) { return logLines(s.slug).filter((l) => l.ev === 'prompt' && l.t >= since); }
  const normWords = (t) => t.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
  function witnessQuote(s, quote, since) { // the user's words must appear in a prompt the hook recorded since the question
    const all = logLines(s.slug).filter((l) => l.ev === 'prompt');
    if (!all.length) return { witnessed: false, why: installation()?.hooksEnabled === false ? 'hooks are disabled' : 'the hook has recorded no user prompt in this task' };
    const q = normWords(quote); if (q.length < 2) die('quote the user\'s own words');
    const hit = userPrompts(s, since).find((p) => normWords(p.text || '').includes(q));
    if (!hit) die(`"${quote.slice(0, 80)}" appears in no user prompt recorded since the question (${since.slice(11, 19)}): ask the user, then ${CMD} answer "<their reply, word for word>"`);
    return { witnessed: true, prompt: hit.digest };
  }

  // ── Guards: named functions; flow.json names which apply to which exit ──
  const GUARDS = {
    ladder: (s, to) => {
      if (s.ask && s.state !== 'ASK' && to !== 'ASK') return [`a re-define is open (${s.ask}): ${CMD} advance ASK`];
      if (s.require && !s.require.includes(to) && to !== FLOWDATA.escape) return [`the ladder (rung ${s.rung}) leads to ${s.require.join(' or ')}: ${CMD} advance ${s.require[0]}`];
      return [];
    },
    pendingStepBack: (s, to) => s.pending === LADDER.pass && !s.prevent && to !== FLOWDATA.escape ? [`the ${firstSize(s)} step back after the last ${s.pendingFrom || 'outcome'}: ${stepHint(s)} (the step-back card)`] : [],
    breakTargets: (s, to) => to === 'BREAK' && s.state !== 'BREAK' && !openRequired(s).length && !s.nextShot ? [`every required criterion is established, so the loop-breakers have nothing to fix; to re-check the product end to end: ${CMD} advance GATE`] : [],
    rubricUnchanged: (s) => !s.frozen || rubric().hash === s.frozen ? [] : ['agentic/rubric.md\'s Goals or Drop changed since the freeze: restore them (git checkout -- agentic/rubric.md); only DEFINE or a re-define changes them: ' + CMD + ' advance ASK'],
    rubricValid: () => rubric().errors.map((x) => `rubric: ${x}; fix it, then ${CMD} freeze`),
    rubricFrozen: (s) => s.frozen && s.frozen === rubric().hash ? [] : [`freeze the rubric: ${CMD} freeze`],
    briefRecorded: (s) => s.brief ? [] : [`the Brief (best-agent: intent, completion criterion, interpretation, perspective, anticipated objection): ${CMD} brief "<the brief>"`],
    planReviewed: (s) => {
      if (!(s.route === 'FULL' && s.existing)) return [];
      const p = s.entry.planReview; if (!p) return [`the plan review on existing code: ${CMD} call reviewer, then ${CMD} planreview <call-id> "<the amendments, or none>"`];
      return s.frozenT && s.frozenT > p.t ? [] : [`freeze after the plan review's amendment pass (amended criteria checked again): ${CMD} freeze`];
    },
    userAnswer: (s) => { const e = s.entry; if (!e.answers.length) return [`the user's answer: ${CMD} question "<the decision, as a table with your recommendation>", then ${CMD} answer "<their words, quoted>"`]; const open = e.questions.filter((q) => !q.answered); return open.length ? open.map((q) => `an answer to question ${q.n} ("${q.text.slice(0, 50)}"): ${CMD} answer --q ${q.n} "<their words>"`) : []; },
    redefineBuilds: (s, to) => s.rung === 'redefine' && openRequired(s).length && to !== 'BREAK' && to !== 'ASK' ? [`after a re-define the loop-breakers build: ${CMD} advance BREAK`] : [],
    fullOnly: (s) => s.route === 'FULL' ? [] : [`FOCUSED builds in tiny loops, without a one-shot: ${CMD} advance LOOP`],
    oneshotFirst: (s) => s.route !== 'FULL' || s.history.some((h) => ['oneshot', 'explore', 'merge'].includes(h.kind)) ? [] : [`FULL builds with a one-shot first (one file holding every criterion), then the next-shot: ${CMD} advance ONESHOT`],
    baselineRun: (s) => s.entry.runs.some((r) => r.kind === 'run' && !r.cwd && r.sha === s.base) ? [] : [`the baseline real run on HEAD: ${CMD} run -- <command>`],
    adoptRecord: (s) => s.adopt ? [] : [`the adoption decision with the user's answer: ${CMD} adopt keep|simplify|replace "<what exists, what works on the baseline, the protected checks>"`],
    adoptCount: (s) => { if (!s.adopt || s.adopt === 'replace' || !s.baselineIds.length) return []; const n = rubric().crit.length; return n > s.baselineIds.length ? [`adoption never raises the criterion count (${n} > ${s.baselineIds.length}): remove the added criteria, or ${CMD} adopt replace "<why the existing area is replaced>"`] : []; },
    exploreTrigger: (s, to, o) => s.route !== 'FULL' ? [`a FOCUSED task explores only through a re-define: ${CMD} advance ASK --why "<why the shape or mechanism is unclear>"`] : EXPLORE_TRIGGERS[o.why] ? [] : [`name the trigger: ${CMD} advance EXPLORE --why ${Object.keys(EXPLORE_TRIGGERS).join('|')}`],
    stepBack: (s) => { // PREVENT, owed by every working state (flow.json "prevent"): the step back, then the one-block of the next action (a one-shot or an explorer's option is its own block)
      const p = PREVENT[s.state]; if (!p || !s.entry.steps) return []; // an entry begun before this rule owes it from the next state entry
      if (p.step === 'breakers') {
        const ids = callsIn(s, 'loop-breaker'), need = roleRows('loop-breaker').length;
        if (ids.length < need) return [`${need} loop-breaker call(s), each taking the full step back from scratch: ${CMD} call loop-breaker`];
        return ids.flatMap((id) => { const st = s.stepbacks.find((x) => x.size === 'full' && x.call === id), b = s.calls[id].block;
          return !st ? [`loop-breaker ${id}'s full step back: ${CMD} stepback full --call ${id} "<its step back, from its reply>"`] : !b || b.t < st.t ? [`loop-breaker ${id}'s one-block: ${CMD} block --call ${id} "<its one-block, from its reply>"`] : []; });
      }
      if (p.step === 'replan') { const r = s.entry.replan; return !r ? [REPLAN_HINT] : s.block && s.block.t >= r.t ? [] : [`the one-block of the new definition, before the user sees the plan: ${CMD} block "<the definition written whole: what the rubric, spec and architecture become>"`]; }
      const size = p.step === 'first' ? firstSize(s) : p.step, step = s.entry.steps.filter((x) => RANK[x.size] >= RANK[size]).pop();
      if (!step) return [`PREVENT first, the step back: ${size === 'full' ? FULL_HINT : stepHint(s)}`];
      return !p.block || (s.block && s.block.t >= step.t) ? [] : [`PREVENT, then the one-block of the next action: ${BLOCK_HINT}`];
    },
    exploreSettled: (s) => {
      const e = s.entry, j = e.judged;
      if (!j || !e.winner) return [`every option run and judged, then one chosen: ${CMD} judge explore <reviewer-ids> --options <explorer-ids>, then ${CMD} winner <id>`];
      if (!j.outcome) return [j.amalgam ? `the amalgam judged: ${CMD} call reviewer, then ${CMD} judge merge <reviewer-ids>` : `settle every NOT_MET: ${CMD} reproduce <ID> yes|no -- <command>`];
      return e.runs.some((r) => r.code === 0 && r.t > e.winnerT && r.sha === head() && !r.cwd) ? [] : [`the integrated winner run on real input on HEAD (committed): ${CMD} run -- <command>`];
    },
    realRun: (s) => s.entry.runs.some((r) => r.kind === 'run' && !r.cwd && (r.code === 0 || r.judgment)) ? [] : [`a real run of the one-shot on real input: ${CMD} run -- <command>`],
    seenFailing: (s) => {
      const targets = (s.prevent && s.prevent.targets) || s.targets, needed = judgeOf(s, 'loop') === 'root' || targets.some((t) => s.failedEver.includes(t));
      if (!needed || s.entry.judged) return []; // judge loop checked it against the BEST of that moment; a PASS moves BEST
      return s.entry.runs.some((r) => r.kind === 'before' && r.sha === bestSha(s) && (r.code !== 0 || r.judgment)) ? [] : [`the target seen failing on BEST: ${CMD} run --before -- <the target's check> (the engine runs it in a worktree of BEST; add --judgment when the evidence is the criterion's real output)`];
    },
    judged: (s) => {
      const j = s.entry.judged, kind = JUDGE_KIND[s.state], who = judgeOf(s, kind);
      if (!j) return [who === 'root' ? `your verdict per target: write it in the judge card's format and ${CMD} judge ${kind} --self <file>` : `the judging: ${CMD} call reviewer (${roleRows('reviewer').length}×), then ${CMD} judge ${kind} <reviewer-ids>`];
      return j.outcome ? [] : [`settle every NOT_MET: ${CMD} reproduce <ID> yes|no -- <command> | reproduce <ID> missing "<why>"`];
    },
    e2eRun: (s) => s.state === 'GATE' && !s.entry.runs.some((r) => r.kind === 'e2e' && r.code === 0) ? [`one end-to-end real run of every feature on ${gateKind(s) === 'release' ? 'the frozen candidate' : 'HEAD'}: ${CMD} run --e2e -- <command>`] : [],
    suiteRun: (s) => s.state === 'GATE' && !s.entry.runs.some((r) => r.kind === 'suite' && r.code === 0) ? [`the full suite once on ${gateKind(s) === 'release' ? 'the frozen candidate' : 'HEAD'}: ${CMD} run --suite -- <command>`] : [],
    passRoute: (s, to) => {
      const j = s.entry.judged; if (!j || j.outcome !== 'PASS') return [];
      if (s.state === 'GATE') { const next = j.gate === 'release' ? 'ACCEPT' : 'CONSOLIDATE'; return to === next ? [] : [`the ${j.gate} gate passed: ${CMD} advance ${next}`]; }
      const next = s.nextShot || openRequired(s).length ? 'LOOP' : 'GATE';
      return [next, 'LOOP'].includes(to) ? [] : [`after a PASS: ${CMD} advance ${next}${s.nextShot ? ' (the next-shot)' : ''}`];
    },
    allEstablished: (s) => openRequired(s).length ? [`criteria still open: ${openRequired(s).join(', ')}: ${CMD} advance LOOP`] : [],
    nextShotDone: (s) => s.nextShot ? [`the next-shot has not passed (one LOOP that repairs every failing criterion and moves the one-shot into the architecture's layout, judged on every criterion): ${CMD} advance LOOP`] : [],
    checksRun: (s) => s.entry.runs.some((r) => r.kind === 'run' && !r.cwd && r.code === 0 && r.t > (s.entry.lastEditT || '')) ? [] : [`the affected checks rerun after the consolidation: ${CMD} run -- <command>`],
    metricsRecorded: (s) => { const m = s.entry.metrics; if (!m) return [`the budgets: ${CMD} metrics`]; return m.crossed.length && !m.reason ? [`a budget is crossed (${m.crossed.join('; ')}): prune or distill and rerun ${CMD} metrics, or record why it stays: ${CMD} metrics --reason "<the protection floor>"`] : []; },
    candidateFrozen: (s) => s.candidate && s.candidate === head() ? [] : [`commit and freeze the candidate: ${CMD} candidate`],
    replanApproved: (s, to) => {
      const e = s.entry;
      if (!e.replan) return [REPLAN_HINT];
      if (!e.approved) return [`the user's decision on the re-plan, shown to them in plain words with what differs from their comment: ${CMD} approve "<their reply, as they wrote it>"`];
      return to === e.replan.choice ? [] : [`the approved re-plan goes to ${e.replan.choice}: ${CMD} advance ${e.replan.choice}`];
    },
    finalReport: (s) => s.entry.finalReport ? [] : [`the final report: ${CMD} report --final`],
    proposalsResolved: (s) => s.proposals.flatMap((p, i) => p.resolved ? [] : [`resolve rubric proposal ${i + 1} ("${p.text.slice(0, 60)}"): ${CMD} resolve ${i + 1} "<applied at DEFINE | dismissed: reason>"`]),
    gatedHead: (s) => s.gateSha && head() === s.gateSha ? [] : [`HEAD ${head().slice(0, 7)} is not the gated commit ${(s.gateSha || 'none').slice(0, 7)}: deliver the gated commit (git checkout ${(s.gateSha || '').slice(0, 7) || '<it>'}), or gate again: ${CMD} advance ASK`],
    memoryShape: () => Object.keys(MEMORY_SECTIONS).flatMap((f) => { const t = readText(path.join(ROOT, f)); return (t === null ? [`${f} is missing (memory.md has its template)`] : checkMemoryShape(f, t)).map((x) => `${x}: fix it, then ${CMD} memory`); }),
  };
  function needs(s, to, o = {}) {
    const st = FLOW[s.state];
    if (!st.next.includes(to)) return [`${s.state} cannot go to ${to}; it goes to ${st.next.length ? `${st.next.join(', ')}: ${CMD} status shows what each exit needs` : `nothing (the task is over): ${CMD} init <FOCUSED|FULL> <slug> "<reason>" for new work`}`];
    const n = [];
    for (const g of FLOWDATA.always) n.push(...GUARDS[g](s, to, o));
    if (to === FLOWDATA.escape && s.state !== FLOWDATA.escape) { if (!s.ask && !(s.require || []).includes(to) && !o.why) n.push(`ASK is the re-define with the user: it opens from the ladder, ${CMD} blocked "<what blocks>", or ${CMD} advance ASK --why "<what needs the user>"`); return [...new Set(n)]; }
    for (const g of [...(st.exit || []), ...((st.to || {})[to] || [])]) n.push(...GUARDS[g](s, to, o));
    return [...new Set(n)];
  }
  function allowed(s, name) { const where = FLOWDATA.commands[name]; if (where && !where.includes(s.state)) die(`${name} belongs to ${where.join(' or ')}; this task is in ${s.state}: ${NEXT_HINT}`); }
  function preventFirst(s, name) { // a state's first work commands wait for the prevent it owes
    const before = (PREVENT[s.state] || {}).before || []; if (!before.some((b) => name === b || name.startsWith(b + ' '))) return;
    const x = GUARDS.stepBack(s); if (x.length) die(`${name} waits for this ${s.state}'s PREVENT: ${x.join('; ')}`);
  }
  function mergeEligibility(s) { // a merged delegate result needs its own witnessed run; the merged whole runs on HEAD before judging
    const n = [], H = head(), merged = [];
    for (const [id, c] of Object.entries(s.calls)) {
      if (c.entry !== s.entryN || !WRITE_ROLES.includes(c.role) || c.void || !fs.existsSync(c.worktree)) continue;
      const tip = head(c.worktree); if (!tip || tip === c.commit) continue;
      if (git(['merge-base', '--is-ancestor', tip, H]).code !== 0) continue;
      merged.push(id);
      const ok = s.entry.runs.some((r) => r.cwd === c.worktree && r.sha === tip && (r.code === 0 || r.judgment));
      if (!ok) n.push(`${c.role} ${id} was merged without a passing witnessed run of its own result: ${CMD} run --cwd ${rel(c.worktree)} -- <command> (an ineligible candidate is reverted, never merged)`);
    }
    if (merged.length) { const last = Math.max(...s.entry.runs.filter((r) => r.cwd).map((r) => Date.parse(r.t))); if (!s.entry.runs.some((r) => !r.cwd && r.sha === H && (r.code === 0 || r.judgment) && Date.parse(r.t) >= last)) n.push(`run the merged result on HEAD before its judging: ${CMD} run -- <command>`); }
    return n;
  }

  // ── Outcomes and the ladder ──
  function escalate(s, j) { // counted per rung since the last PASS or rung change; the nth of a kind moves the rung
    s.prevent = null;
    if (j.outcome === 'PASS') { s.rung = LADDER.pass; s.count = ZERO(); s.require = null; s.pending = null; return; }
    s.pendingFrom = `${j.kind} ${j.outcome}`;
    if (j.kind === 'oneshot' && j.outcome !== 'REGRESSION') { s.require = [LADDER.oneshot.good, LADDER.oneshot.bad, ...(s.route === 'FULL' ? [LADDER.oneshot.badFull] : [])]; s.pending = LADDER.pass; return; }
    const from = s.rung; s.count[j.outcome]++;
    const [n, to] = LADDER[from][j.outcome]; if (s.count[j.outcome] >= n && to !== from) { s.rung = to; s.count = ZERO(); }
    s.require = [RUNGS[s.rung].state]; s.pending = s.rung;
    if (j.kind === 'gate' && j.gate === 'release' && s.rung === LADDER.pass) s.require.push('CONSOLIDATE'); // a release-gate failure goes back to the consolidation, or to a loop when a criterion broke
    if (s.rung === 'redefine') s.ask = `${j.kind} ${j.outcome} at rung ${from}: ${s.targets.join(', ')}`;
  }
  function settle(s) {
    const j = s.entry.judged;
    if (!j || j.outcome || (j.kind === 'explore' && !s.entry.winner) || Object.values(j.alleged).some((x) => x.status === undefined)) return;
    const st = (id) => j.alleged[id] && j.alleged[id].status;
    const est = j.scope.filter((id) => st(id) !== 'yes' && (j.met.includes(id) || st(id) === 'no'));
    const regress = j.scope.filter((id) => s.est.includes(id) && st(id) === 'yes');
    const fresh = est.filter((id) => !s.est.includes(id)), failed = j.scope.filter((id) => !est.includes(id));
    j.established = est;
    const isCore = (id) => (rubric().crit.find((c) => c.id === id) || {}).cls === 'CORE', blocking = j.kind === 'oneshot' ? failed.filter(isCore) : failed; // a one-shot passes when every CORE criterion works
    j.outcome = regress.length ? 'REGRESSION' : !blocking.length ? 'PASS' : fresh.length ? 'ADVANCED' : 'STALLED';
    if (['oneshot', 'explore', 'merge'].includes(j.kind)) s.nextShot = true;
    else if (['loop', 'break'].includes(j.kind) && j.outcome === 'PASS' && s.nextShot) s.nextShot = false;
    if (j.kind === 'gate' && j.outcome === 'PASS' && j.gate === 'pre-release') s.prePassed = j.sha;
    if (j.kind === 'gate' && j.outcome !== 'PASS' && j.gate === 'pre-release' && s.route === 'FULL') s.nextShot = true; // on FULL the failing criteria go back as a next-shot
    for (const id of j.scope.filter((x) => st(x) === 'yes')) if (!s.failedEver.includes(id)) s.failedEver.push(id);
    for (const id of fresh) { const d = s.ledger.find((x) => x.id === id && !x.fixed); if (d) d.fixed = j.sha; }
    for (const id of j.scope.filter((x) => st(x) === 'yes')) s.ledger.push({ id, at: j.sha, evidence: (j.alleged[id].evidence || '').slice(0, 160), fixed: null });
    s.est = [...new Set([...s.est.filter((id) => !regress.includes(id)), ...est])];
    s.touched = [...new Set([...s.touched, ...j.scope])];
    s.targets = failed;
    j.diff = diffSize(bestSha(s), j.sha);
    if (['PASS', 'ADVANCED'].includes(j.outcome) && j.sha) s.best = j.sha;
    if (j.kind === 'gate' && j.outcome === 'PASS') s.gateSha = j.sha;
    const from = s.rung; escalate(s, j); j.from = from; j.to = s.rung; s.history.push(j);
  }
  function blocked(s, why) { s.ask = 'BLOCKED: ' + why; s.rung = LADDER.blocked; s.count = ZERO(); s.require = [RUNGS[LADDER.blocked].state]; s.pending = LADDER.blocked; }

  // ── Formalized signals: computed from the record; information, never a block ──
  function signals(s) {
    const out = [], H = s.history, fails = {};
    for (const h of H) for (const [id, x] of Object.entries(h.alleged || {})) if (x.status === 'yes') fails[id] = (fails[id] || 0) + 1;
    const again = Object.entries(fails).filter(([, n]) => n >= 2).map(([id, n]) => `${id} (${n}×)`);
    if (again.length) out.push({ kind: 'spiral', text: `the same criterion failing again: ${again.join(', ')} → step back on the class, not the instance` });
    const ret = [...new Set(H.flatMap((h) => Object.entries(h.alleged || {}).filter(([id, x]) => x.status === 'yes' && H.some((p) => p.t < h.t && p.established.includes(id))).map(([id]) => id)))];
    if (ret.length) out.push({ kind: 'spiral', text: `a failure returning after it was established: ${ret.join(', ')} → the earlier fix did not hold; find the shared cause` });
    const L = H.filter((h) => ['loop', 'break', 'merge'].includes(h.kind)).slice(-2);
    if (L.length === 2 && L.every((h) => ['STALLED', 'REGRESSION'].includes(h.outcome)) && L[1].diff > L[0].diff) out.push({ kind: 'spiral', text: `a diff growing while nothing is established (${L[0].diff} → ${L[1].diff} lines) → remove before adding` });
    const last = H[H.length - 1];
    if (last && last.runFailed && last.established.length) out.push({ kind: 'green-red', text: `checks green while the real run fails: the last real run on ${(last.sha || '').slice(0, 7)} exited non-zero, yet ${last.established.join(', ')} were established → step back now` });
    let m = null; try { m = JSON.parse(readText(path.join(ROOT, METRICS_PATH))); } catch { m = null; }
    if (m) { for (const a of m.alerts || []) out.push({ kind: /test volume/.test(a) ? 'testAlert' : 'memoryAlert', text: 'budget alert: ' + a }); for (const c of m.crossed || []) out.push({ kind: /test volume/.test(c) ? 'testAlert' : 'memoryAlert', text: 'budget crossed: ' + c }); }
    return out;
  }

  // ── Specialists: computed triggers, the phase-entry question, delivery to whoever acts ──
  function changedFiles(s) { return [...new Set([...git(['diff', '--name-only', s.base, '--', '.', ...EXCLUDES]).out.split('\n'), ...dirty(s)].map((x) => x.trim()).filter(Boolean))]; }
  function triggerFires(s, w, ctx) {
    if (w.state && !w.state.includes(s.state)) return false;
    if (w.route && !w.route.includes(s.route)) return false;
    if (w.rung && !w.rung.includes(s.rung)) return false;
    if (w.tag && !ctx.tags.some((t) => w.tag.includes(t))) return false;
    if (w.files && !ctx.files.some((f) => matcher(w.files)(f))) return false;
    if (w.signal && !ctx.signals.some((k) => w.signal.includes(k))) return false;
    if (w.missing && fs.existsSync(path.join(ROOT, w.missing))) return false;
    if (w.firstTask && !s.firstTask) return false;
    if (w.writingRuleMissing) { const t = readText(path.join(ROOT, 'agentic', 'default-styles.md')) || ''; const hs = headings(t); if (!(hs.some((h) => / · writing$/.test(h)) && !hs.some((h) => / · writing rule$/.test(h)))) return false; }
    return true;
  }
  function boundSpecialists(s) {
    const R = rubric(), scopeIds = new Set([...((s.prevent && s.prevent.targets) || s.targets), ...openRequired(s)]);
    const ctx = { tags: [...new Set(R.crit.filter((c) => scopeIds.has(c.id) || s.state === 'DEFINE' || s.state === 'ADOPT').flatMap((c) => c.tags))], files: changedFiles(s), signals: signals(s).map((x) => x.kind) };
    const out = {};
    for (const [name, t] of Object.entries(TRIGGERS)) {
      const w = (t.when || []).find((x) => triggerFires(s, x, ctx));
      if (w) out[name] = { ...t, why: w.why || 'computed trigger' };
      else if ((s.loaded || []).includes(name)) out[name] = { ...t, why: 'loaded at the phase entry' };
    }
    return out;
  }
  const questionsFor = (s, to) => Object.entries(TRIGGERS).filter(([, t]) => t.question && (t.ask || []).includes(to)).map(([name, t]) => ({ name, question: t.question }));
  function stylesFor(craft) {
    const t = readText(path.join(ROOT, 'agentic', 'default-styles.md')); if (!t || !craft) return '';
    const parts = t.split(/^(?=## )/m).filter((p) => new RegExp(`^## .+ · ${craft}\\s*$`, 'm').test(p.split('\n')[0]));
    return parts.length ? `\n\n## Default style entries for ${craft} (use the root model's entry)\n\n` + parts.join('\n').trim() : `\n\n## Default style for ${craft}\nNo calibrated entry in agentic/default-styles.md: use the specialist's labeled self-named default and say so in your reply.`;
  }

  // ── Rendering ──
  function counts(s) { const C = required(s), k = (t) => C.filter((c) => c.cls === t), e = (arr) => arr.filter((c) => s.est.includes(c.id)).length; return `CORE ${e(k('CORE'))}/${k('CORE').length} · NON-CORE ${e(k('NON-CORE'))}/${k('NON-CORE').length}`; }
  const rungLine = (s) => `rung ${s.rung} (${RUNGS[s.rung].says}; here: ADVANCED ${s.count.ADVANCED}/${LADDER[s.rung].ADVANCED[0]}, STALLED ${s.count.STALLED}/${LADDER[s.rung].STALLED[0]}, REGRESSION ${s.count.REGRESSION}/${LADDER[s.rung].REGRESSION[0]})`;
  const nextLines = (s) => FLOW[s.state].next.map((t) => { const x = needs(s, t, { why: t === FLOWDATA.escape ? null : undefined }); return `- ${t}: ${x.length ? 'needs ' + x.join('; ') : 'ready'}`; });
  const lastOutcome = (s) => { const h = s.history[s.history.length - 1]; return h ? `${h.kind} ${h.outcome}` : 'none'; };
  function statusLine(s) {
    const cards = bound(s.state, 'root').map((b) => b.card), sp = Object.keys(boundSpecialists(s)), sig = signals(s);
    return `BRIDGECODE ${s.slug}: ${s.route} · ${s.state}${s.state === 'GATE' ? ' (' + gateKind(s) + ')' : ''}${s.nextShot && ['LOOP', 'BREAK'].includes(s.state) ? ' (next-shot)' : ''} · rung ${s.rung} · last ${lastOutcome(s)}${s.pending === LADDER.pass && !s.prevent ? ' · STEP BACK PENDING' : GUARDS.stepBack(s).length ? ' · PREVENT OWED' : ''}${s.ask ? ' · re-define open' : ''} · ${counts(s)}${sig.length ? ' · signals: ' + sig.map((x) => x.kind).join(', ') : ''} · cards: ${cards.join(', ')} · specialists: ${sp.join(', ') || 'none'}${stored() ? ` · git: ${STORE_PATH} (${CMD} git <args>)` : ''}`;
  }
  function board(s) {
    const R = rubric(), sp = boundSpecialists(s), ext = ROLESDATA.extensions || [];
    return [`# Bridgecode task board (rendered by engine.mjs; never edit)`, '',
      `## Brief`, s.brief || '(not recorded)', '',
      `## Task`, `${s.route} — ${s.reason} | bc/${s.slug} | state ${s.state}${s.nextShot ? ' (next-shot due)' : ''} | ${rungLine(s)} | rubric ${s.frozen ? s.frozen.slice(0, 12) : 'not frozen'} | specialists: ${Object.keys(sp).join(', ') || 'none'}`, '',
      `## Next action`, ...GUARDS.stepBack(s).map((x) => `- owed in ${s.state}: ${x}`), s.block ? `${s.block.t.slice(0, 19)} (${s.block.state}): ${s.block.text}` : '(no one-block yet)',
      ...Object.entries(s.calls).filter(([, c]) => c.block && c.entry === s.entryN).map(([id, c]) => `- loop-breaker ${id}: ${c.block.text}`), '',
      `## BEST`, `${bestSha(s).slice(0, 7)}${s.best ? '' : ' (base)'} | ${counts(s)}`, ...R.crit.map((c) => `- ${c.id} ${c.cls}${c.tags.length ? ' [' + c.tags.join(',') + ']' : ''}: ${s.est.includes(c.id) ? 'established' : 'open'}`), '',
      `## One-shots`, ...s.history.filter((h) => h.kind === 'oneshot').map((h) => `- ${h.t.slice(0, 19)} @${(h.sha || '').slice(0, 7)} → ${h.outcome}: ${h.established.length}/${h.scope.length} established`), '',
      `## Loops`, ...s.history.filter((h) => h.kind !== 'oneshot').map((h) => `- ${h.t.slice(0, 19)} ${h.kind}${h.gate ? ' ' + h.gate : ''} @${(h.sha || '').slice(0, 7)} [${h.scope.join(',')}] → ${h.outcome} (${h.established.length}/${h.scope.length}), rung ${h.from} → ${h.to}`), '',
      `## Open`, ...(s.ask ? [`- re-define with the user: ${s.ask}`] : []), ...s.targets.map((t) => `- target ${t}`), ...s.proposals.map((p, i) => `- rubric proposal ${i + 1}:${p.text}${p.resolved ? ' (resolved: ' + p.resolved + ')' : ''}`), ...s.vetoes.map((v) => `- veto for CONDENSE: ${v}`), ...s.backlog.map((v) => `- backlog for CONDENSE: ${v}`), '',
      `## Repair ledger`, ...s.ledger.map((d) => `- ${d.id}: violation reproduced at ${(d.at || '').slice(0, 7)} (${d.evidence})${d.fixed ? ' → fixed at ' + d.fixed.slice(0, 7) : ''}`), '',
      `## Falsified`, ...s.falsified.map((x) => '- ' + x), '',
      `## Step backs`, ...s.stepbacks.map((x) => `- ${x.t.slice(0, 19)} ${x.size}${x.call ? ' (' + x.call + ')' : ''}${x.choice ? ' → ' + x.choice : ''}${x.targets ? ' [' + x.targets.join(',') + ']' : ''}: ${x.text.slice(0, 200)}`), '',
      `## Questions`, ...s.questions.map((q) => `- ${q.n}. ${q.text}${q.answered ? ` → "${q.answered.text}"${q.answered.witnessed ? '' : ' (unwitnessed: ' + q.answered.why + ')'}` : ' (open)'}`), '',
      `## Signals (computed)`, ...signals(s).map((x) => '- ' + x.text), '',
      `## Notes`, ...s.notes.map((v) => '- ' + v), '',
      `## Next`, ...(FLOW[s.state].terminal ? ['- the task is over'] : nextLines(s)), '',
      ...ext.flatMap((x) => [`## Extension ${x.id}`, ...Object.entries(ROLESDATA.roles || {}).flatMap(([role, rows]) => rows.filter((r) => r.source === x.id).map((r) => `- ${role}: ${r.model} ${r.effort} via ${r.spawn} (${r.context}, ${r.claim})`)), '']),
    ].join('\n');
  }
  function report(s, final) {
    const j = s.history[s.history.length - 1], open = required(s).filter((c) => !s.est.includes(c.id)).map((c) => c.id);
    const ready = FLOW[s.state].next.find((t) => !needs(s, t).length);
    const out = [`Last: ${j ? j.outcome + ' (' + j.kind + ')' : 'no judging yet'} — ${rungLine(s)} — ${s.state} — ${counts(s)} — open: ${open.join(', ') || 'none'} — next: ${FLOW[s.state].terminal ? 'end' : ready || needs(s, (s.require || FLOW[s.state].next)[0]).join('; ')}`];
    if (j) {
      const blocks = Object.entries(j.alleged || {}).filter(([, x]) => x.status === 'yes').map(([id]) => id);
      const notes = [...Object.entries(j.alleged || {}).filter(([, x]) => x.status !== 'yes').map(([id, x]) => `${id} ${x.status === 'missing' ? 'not decided (missing run)' : 'unconfirmed'}`), ...s.proposals.filter((p) => !p.resolved).map((p) => 'rubric proposal: ' + p.text)];
      if (blocks.length) out.push('Reproduced violations (block): ' + blocks.join(', ')); if (notes.length) out.push('Does not block: ' + notes.join('; '));
    }
    const unw = s.questions.filter((q) => q.answered && !q.answered.witnessed); if (unw.length) out.push(`Unwitnessed answers: ${unw.map((q) => q.n).join(', ')} (${unw[0].answered.why})`);
    const ids = Object.values(s.calls).filter((c) => c.identity && c.identity.how && !c.identity.model); if (ids.length) out.push(`Identity recorded as requested for ${ids.length} call(s): no harness record was found`);
    const sig = signals(s); if (sig.length) out.push('Signals (computed): ' + sig.map((x) => x.text).join('; '));
    if (final) out.push(`Delivered: bc/${s.slug} at ${head().slice(0, 7)} (merged into your branch only when you ask).`, ...(s.vetoes.length ? ['Vetoes for the rubric: ' + s.vetoes.join('; ')] : []), ...(s.backlog.length ? ['Backlog: ' + s.backlog.join('; ')] : []));
    return out.join('\n');
  }

  // ── Commands ──
  const freshEntry = (s) => ({ t: now(), runs: [], judged: null, finalReport: false, winner: null, winnerT: null, answers: [], questions: [], replan: null, approved: null, fixes: [], planReview: null, metrics: null, lastEditT: null, steps: [], n: s ? s.entryN : 0 });
  const a = [...argv.slice(1)], cmd = argv[0];
  const flag = (f) => { const i = a.indexOf(f); if (i < 0) return false; a.splice(i, 1); return true; };
  const opt = (f) => { const i = a.indexOf(f); if (i < 0) return null; const v = a[i + 1]; a.splice(i, 2); return v; };
  const taskOpt = opt('--task');
  const text = (what) => { const t = a.join(' ').trim(); if (!t) die(`add ${what}`); return t; };

  const C = {
    init() {
      const [route, slug, ...why] = a;
      if (!['FOCUSED', 'FULL'].includes(route) || !/^[a-z0-9][a-z0-9-]*$/.test(slug || '')) die('init <FOCUSED|FULL> <slug: lowercase letters, digits, dashes> "<reason>" (DIRECT and ASSESS use no engine)');
      if (fs.existsSync(files(slug).state)) die(`task ${slug} exists: git checkout bc/${slug}, then ${CMD} status`);
      if (sh('git', ['--version']).code) die('git is required: install it, then init again');
      if (!stored() && !fs.existsSync(path.join(ROOT, '.git')) && git(['init', '-b', 'main']).code) die('git init failed here: initialize the repository yourself, then init again');
      const base = git(['rev-parse', '--verify', 'HEAD']).code ? git(['commit', '--allow-empty', '-m', 'Bridgecode baseline']) : { code: 0 };
      const diag = stored() ? null : base.code ? base.out.trim() : gitProbe(); // before the task is ready: Git must create a delegate branch and worktree
      if (diag) useStore(diag, `${CMD} init ${route} ${slug} "<reason>"`); else writeExcludes();
      const code = git(['ls-files']).out.split('\n').filter((f) => f && product(f) && !f.startsWith('agentic/'));
      const memory = Object.keys(MEMORY_SECTIONS).every((f) => { const t = readText(path.join(ROOT, f)); return t !== null && !checkMemoryShape(f, t).length; });
      const existing = code.length > 0, start = existing && !memory ? FLOWDATA.start.existing : FLOWDATA.start.new;
      const co = git(['checkout', '-q', '-b', 'bc/' + slug]); if (co.code) die(`the task branch bc/${slug} could not be created:\n${co.out}`);
      const R = rubric(), firstTask = !fs.existsSync(TASKS) || !fs.readdirSync(TASKS).length;
      const s = { version: VERSION, route, slug, reason: why.join(' '), state: start, existing, firstTask, entryN: 0, entry: null, brief: null, adopt: null, adopted: false, frozen: R.errors.length ? null : R.hash, frozenT: null, baselineIds: R.crit.map((c) => c.id), est: [], targets: [], touched: [], failedEver: [], rung: LADDER.pass, count: ZERO(), require: null, pending: null, pendingFrom: null, prevent: null, block: null, nextShot: false, prePassed: null, ask: null, proposals: [], stepbacks: [], history: [], ledger: [], falsified: [], vetoes: [], backlog: [], notes: [], questions: [], loaded: [], calls: {}, runs: [], base: head(), best: null, gateSha: null, candidate: null, snap: null, dirtyAtInit: dirty() };
      if (s.frozen) s.frozenT = now();
      s.entry = freshEntry(s); fs.mkdirSync(files(slug).tmp, { recursive: true });
      save(s, { ev: 'init', route, slug, existing, start }); console.log(`BRIDGECODE: ${route} — ${s.reason}\nbranch bc/${slug}${stored() ? ' in ' + STORE_PATH : ''}; record agentic/tasks/${slug}/; evidence temporary/${slug}/`); C.status();
    },
    status() {
      const line = flag('--line'), s = load(taskOpt);
      if (line) return console.log(statusLine(s));
      const T = FLOW[s.state], sp = boundSpecialists(s);
      const jk = s.state === 'DEFINE' && !(s.route === 'FULL' && s.existing) ? null : JUDGE_KIND[s.state]; // the plan review is FULL on existing code only
      console.log(`STATE ${s.state}${s.state === 'GATE' ? ' (' + gateKind(s) + ' gate)' : ''} · ${s.route} · ${counts(s)} · ${rungLine(s)} · BEST ${bestSha(s).slice(0, 7)} · judge: ${jk ? judgeOf(s, jk) : '—'}\n\nCARDS\n${cardText(s.state, 'root')}`);
      if (Object.keys(sp).length) console.log('\nSPECIALISTS (read each in full once on entering this state; keep it while the state lasts)\n' + Object.entries(sp).map(([n, t]) => `- ${t.file} (${n}): ${t.why}`).join('\n'));
      if (T.terminal) return;
      if (s.ask) console.log(`\nRE-DEFINE WITH THE USER (${s.ask})`);
      if (s.pending === LADDER.pass && !s.prevent) console.log(`\nSTEP BACK PENDING after ${s.pendingFrom}: ${stepHint(s)}`);
      else { const owed = GUARDS.stepBack(s); if (owed.length) console.log(`\nPREVENT OWED before ${s.state}'s first work (${PREVENT[s.state].before.join(', ')}):\n- ` + owed.join('\n- ')); }
      if (s.nextShot && s.state === 'LOOP') console.log(`\nNEXT-SHOT: one loop that repairs every failing criterion and moves the one-shot into the layout architecture.md names (translating it under Rosetta), in one block; judged on every criterion`);
      const R = rubric(), ids = ['LOOP', 'BREAK'].includes(s.state) ? scopeOf(s, JUDGE_KIND[s.state]) : [];
      if (ids.length) console.log('\nTARGETS\n' + R.crit.filter((c) => ids.includes(c.id)).map((c) => c.raw).join('\n'));
      if (R.warnings.length) console.log('\nRUBRIC WARNINGS\n- ' + R.warnings.join('\n- '));
      const j = s.entry.judged; if (j && !j.outcome && j.alleged) { const open = Object.keys(j.alleged).filter((id) => j.alleged[id].status === undefined); if (open.length) console.log('\nSETTLE before the outcome counts: ' + open.map((id) => `reproduce ${id} yes|no -- <command> | reproduce ${id} missing "<why>"`).join(' ; ')); }
      if (j && s.state === 'ONESHOT' && j.outcome) { const k = (c) => j.scope.filter((id) => (R.crit.find((x) => x.id === id) || {}).cls === c), e = (ids) => ids.filter((id) => j.established.includes(id)).length; console.log(`\nONE-SHOT: CORE ${e(k('CORE'))}/${k('CORE').length}, NON-CORE ${e(k('NON-CORE'))}/${k('NON-CORE').length} established. ${j.outcome === 'PASS' ? 'Every CORE criterion works: the next-shot repairs the rest (advance LOOP)' : 'Judge it: good when every failing CORE criterion has a local or relational cause (→ LOOP, the next-shot); bad otherwise (→ ASK' + (s.route === 'FULL' ? ', or EXPLORE --why oneshot' : '') + ')'}`); }
      if (s.entry.fixes.length) console.log('\nREVIEWER FIX SUGGESTIONS (advice for your next step back, not obligations)\n- ' + s.entry.fixes.join('\n- '));
      const sig = signals(s); if (sig.length) console.log('\nSIGNALS (computed; information, never a block)\n- ' + sig.map((x) => x.text).join('\n- '));
      const roles = Object.entries(ROLESDATA.roles || {}); if (roles.length) console.log('\nROLES (roles.json)\n' + roles.map(([r, rows]) => `- ${r}: ${rows.map((x) => `${x.model} ${x.effort} via ${x.spawn}`).join(' + ')}`).join('\n'));
      console.log('\nNEXT\n' + nextLines(s).join('\n'));
      const qs = FLOW[s.state].next.flatMap((t) => questionsFor(s, t).filter((q) => !Object.keys(sp).includes(q.name)).map((q) => `- entering ${t}: ${q.question} (${q.name}) → advance ${t} --load ${q.name},… | --load none`));
      if (qs.length) console.log('\nPHASE-ENTRY QUESTIONS\n' + [...new Set(qs)].join('\n'));
    },
    advance() {
      const s = load(taskOpt), why = opt('--why'), load_ = opt('--load'), to = a[0];
      if (!FLOW[to]) die(`unknown state ${to || ''}; ${s.state} goes to ${FLOW[s.state].next.join(', ')}`);
      const x = needs(s, to, { why }); if (x.length) die(`${s.state} → ${to} needs:\n- ` + x.join('\n- '));
      const qs = questionsFor(s, to); const undecided = qs.filter((q) => !Object.keys(boundSpecialists({ ...s, state: to })).includes(q.name));
      if (undecided.length && load_ === null) die(`entering ${to} asks:\n` + undecided.map((q) => `- ${q.question} (${q.name})`).join('\n') + `\nanswer in the record: ${CMD} advance ${to} --load <names, comma-separated> | --load none`);
      const loads = (load_ || '').split(',').map((v) => v.trim()).filter((v) => v && v !== 'none');
      for (const l of loads) if (!TRIGGERS[l]) die(`unknown specialist ${l}; known: ${Object.keys(TRIGGERS).join(', ')}`);
      const j = s.entry.judged;
      if (to === 'ASK' && !s.ask) { s.rung = 'redefine'; s.count = ZERO(); s.ask = why ? `asked: ${why}` : `a bad one-shot: ${s.targets.join(', ')}`; }
      if (s.state === 'ASK') { s.ask = null; if (to !== 'STOPPED') s.count = ZERO(); }
      if (s.state === 'DEFINE' && s.rung === 'redefine') s.targets = openRequired(s);
      if (['DEFINE', 'EXPLORE', 'ONESHOT', 'LOOP', 'BREAK'].includes(to)) s.prePassed = null; // building again: the pre-release gate is due again
      if (s.state === 'EXPLORE' && j && ['PASS', 'ADVANCED'].includes(j.outcome)) s.best = head();
      if (to === 'EXPLORE' && EXPLORE_TRIGGERS[why]) s.notes.push(`EXPLORE trigger: ${why} — ${EXPLORE_TRIGGERS[why]}`);
      if (s.state === 'ONESHOT' && j && j.outcome && j.outcome !== 'PASS') s.notes.push(`one-shot judged ${to === 'LOOP' ? 'good' : 'bad'} (${j.established.length}/${j.scope.length})`);
      // the prevent carries only where it was taken for what comes next: the step back after an outcome, or the approved re-define
      const carried = s.state === 'ASK' && s.entry.approved ? { size: 'replan', t: s.entry.replan.t } : j && j.outcome && s.prevent ? { size: s.prevent.size || firstSize(s), t: s.prevent.t } : null;
      if (!carried || s.state === 'ASK') s.prevent = null;
      s.require = null; s.state = to; s.entryN++; s.entry = freshEntry(s); s.loaded = loads; s.snap = null; if (carried) s.entry.steps.push(carried);
      save(s, { ev: 'advance', to, why, load: loads }); C.status();
    },
    escalate() { const s = load(taskOpt); if (a[0] !== 'FULL') die('escalate FULL (routes escalate on surprise and never downgrade)'); if (s.route === 'FULL') die('the route is FULL already'); s.route = 'FULL'; s.notes.push('escalated to FULL: ' + (a.slice(1).join(' ') || 'surprise')); save(s, { ev: 'escalate', to: 'FULL' }); console.log('route FULL: reviewers judge one-shots and loops from now on'); },
    brief() { const s = load(taskOpt); allowed(s, 'brief'); s.brief = text('the brief'); save(s, { ev: 'brief', text: s.brief }); console.log('brief recorded'); },
    adopt() {
      const s = load(taskOpt), d = a.shift(); allowed(s, 'adopt'); preventFirst(s, 'adopt');
      if (!['keep', 'simplify', 'replace'].includes(d)) die('adopt keep|simplify|replace "<what exists, what works on the baseline, the protected checks>"');
      if (!s.entry.answers.length) die(`the adoption decision is the user's: ${CMD} question "<keep, simplify or replace, with your recommendation>", then ${CMD} answer "<their words>"`);
      s.adopt = d; s.adopted = d !== 'replace'; save(s, { ev: 'adopt', decision: d, reason: text('what exists and what works') }); console.log('adoption: ' + d);
    },
    freeze() {
      const s = load(taskOpt); allowed(s, 'freeze'); preventFirst(s, 'freeze');
      const R = rubric(); if (R.errors.length) die('fix the rubric first:\n- ' + R.errors.join('\n- ') + `\nthen ${CMD} freeze`);
      s.frozen = R.hash; s.frozenT = now();
      git(['add', 'agentic/rubric.md']); git(['commit', '-q', '-m', 'Freeze rubric', '--', 'agentic/rubric.md']);
      save(s, { ev: 'freeze', hash: R.hash }); console.log(`frozen ${R.hash.slice(0, 12)}` + (R.warnings.length ? '\nwarnings:\n- ' + R.warnings.join('\n- ') : ''));
    },
    planreview() {
      const s = load(taskOpt), id = a.shift(); allowed(s, 'planreview'); preventFirst(s, 'planreview');
      const c = s.calls[id]; if (!c || c.role !== 'reviewer' || c.entry !== s.entryN) die(`planreview <reviewer call id of this DEFINE> "<the amendments, or none>": ${CMD} call reviewer first`);
      const out = path.join(files(s.slug).tmp, 'runs', id, 'out.md'); if (!(readText(out) || '').trim()) die(`save the reviewer's reply verbatim as ${rel(out)}`);
      if (s.snap && !sameTree(s.snap, snapshot())) { c.void = true; save(s, { ev: 'void', id }); die(`the repository changed during the read-only review: ${id} is void; ${CMD} redispatch ${id}`); }
      const idp = identityProblem(s, id); if (idp) die(idp);
      s.entry.planReview = { t: now(), id, amendments: text('the amendments, or none') }; s.snap = null; save(s, { ev: 'planreview', id }); console.log(`plan review recorded; amend once, check the amended criteria on real cases, then ${CMD} freeze`);
    },
    call() {
      const s = load(taskOpt), role = a[0], at = opt('--at');
      if (!ROLES.includes(role)) die(`call ${ROLES.join('|')} [--at <commit>]`);
      allowed(s, 'call ' + role);
      if (role === 'reviewer' && s.state !== 'DEFINE' && s.state !== 'EXPLORE') { const d = dirty(s); if (d.length) die(`reviewers judge HEAD: commit the candidate first (uncommitted: ${d.slice(0, 3).join(', ')})`); }
      if (role === 'reviewer' && s.state === 'GATE' && gateKind(s) === 'release' && head() !== s.candidate) die(`the release gate judges the frozen candidate ${(s.candidate || 'none').slice(0, 7)}; HEAD is ${head().slice(0, 7)}: ${CMD} advance CONSOLIDATE`);
      preventFirst(s, 'call ' + role);
      const rows = roleRows(role), nth = callsIn(s, role).length, row = rows[nth % rows.length];
      const commit = at || (role === 'reviewer' || role === 'planner' ? head() : bestSha(s)), id = crypto.randomBytes(4).toString('hex'), F = files(s.slug);
      const run = path.join(F.tmp, 'runs', id), wt = path.join(F.tmp, 'wt', id); fs.mkdirSync(run, { recursive: true });
      const r = addWorktree(['-b', `bc/${s.slug}-${id}`, wt, commit], `${CMD} call ${role}`); if (r.code) die(`the worktree could not be created; the task record is kept (git said: ${r.out.trim()}); fix what git names, then ${CMD} call ${role}`);
      if (role === 'reviewer' && !s.snap) s.snap = snapshot();
      const R = rubric(), scope = role === 'reviewer' || s.nextShot ? scopeOf(s, JUDGE_KIND[s.state] || 'plan') : openTargets(s, (s.prevent && s.prevent.targets) || s.targets);
      const consolidated = role === 'reviewer' && s.state === 'GATE' && gateKind(s) === 'release' ? [`- the consolidation to review: git diff ${s.prePassed} ${s.candidate} (every removal traced to the problem, every prevention encoded at its boundary, no criterion lost)`] : [];
      const sp = Object.entries(boundSpecialists(s)).filter(([, t]) => (t.packet || []).includes(role));
      const core = sp.map(([n]) => CORE[n]).filter(Boolean).map((c) => subst(c.body));
      const card = cardText(s.state, role) + (role === 'loop-breaker' && CARDS['step-back'] ? '\n\n' + subst(CARDS['step-back'].body) : '');
      const packet = path.join(run, 'packet.md'), out = path.join(run, 'out.md');
      fs.writeFileSync(packet, [card, ...(core.length ? ['## Core cards', ...core] : []),
        ...(sp.length ? ['## Specialists (read each in full before acting)', ...sp.map(([n, t]) => `- ${path.join(ROOT, t.file)} (${n}): ${t.why}`)] : []), ...sp.map(([, t]) => stylesFor(t.craft)).filter(Boolean),
        '## Criteria in scope (quoted from agentic/rubric.md)', ...R.crit.filter((c) => scope.includes(c.id)).map((c) => c.raw),
        '## This call', `- call: ${id} (${role}); model ${row.model}, effort ${row.effort}`, `- commit: ${commit}`, ...consolidated, `- worktree: ${wt}${role === 'reviewer' || role === 'planner' ? ' (read-only: write nothing anywhere; return everything in your reply)' : ` (work and commit only there, on branch bc/${s.slug}-${id}; only add tests; never delete or revert what you do not own)`}`, `- your reply is saved verbatim as ${out}`,
        '## The assignment', ''].join('\n').replace(/\n(## )/g, '\n\n$1').replace(/^(## [^\n]+)\n/gm, '$1\n\n'));
      s.calls[id] = { role, commit, t: now(), worktree: wt, entry: s.entryN, requested: { model: row.model, effort: row.effort, spawn: row.spawn }, rootSnap: WRITE_ROLES.includes(role) ? snapshot() : null };
      save(s, { ev: 'call', id, role, commit, requested: s.calls[id].requested });
      const spawn = /codex exec/.test(row.spawn) ? `codex exec -m ${row.model} -c model_reasoning_effort=${row.effort} -s ${role === 'reviewer' || role === 'planner' ? 'read-only' : 'workspace-write'} -C "${wt}" --json -o "${out}" "Read ${packet} and follow it." < /dev/null > "${path.join(run, 'events.jsonl')}"` : row.model === 'root' ? `${row.spawn}: a fresh instance of your own model and effort, prompted "Read ${packet} and follow it."` : `${row.spawn} with model ${row.model} and effort ${row.effort}, prompted "Read ${packet} and follow it."`;
      console.log(`call ${id} (${role}${rows.length > 1 ? `, instance ${nth % rows.length + 1} of ${rows.length}` : ''}) at ${commit.slice(0, 7)}\npacket: ${packet} (card, criteria and specialists written; append the assignment)\nspawn: ${spawn}\nreturn: ${out} (the reply, verbatim)\nworktree: ${wt}`);
    },
    run() {
      const s = load(taskOpt), kind = flag('--e2e') ? 'e2e' : flag('--suite') ? 'suite' : flag('--before') ? 'before' : 'run', judgment = flag('--judgment'); let cwd = opt('--cwd');
      if (kind !== 'run') allowed(s, 'run --' + kind);
      preventFirst(s, 'run');
      if (a[0] === '--') a.shift(); const command = a.join(' '); if (!command) die('run [--e2e|--suite|--before [--judgment]] [--cwd <worktree>] -- <command>');
      if (kind === 'before') { // fail-before runs in a worktree of BEST, never through git stash
        const best = bestSha(s), wt = cwd ? path.resolve(ROOT, cwd) : path.join(files(s.slug).tmp, 'wt', 'best-' + best.slice(0, 7));
        if (!fs.existsSync(wt)) { const r = addWorktree(['--detach', wt, best], `${CMD} run --before -- <command>`); if (r.code) die(`a worktree of BEST could not be created; the task record is kept (git said: ${r.out.trim()}); fix what git names, then ${CMD} run --before -- <command>`); }
        if (head(wt) !== best) die(`${rel(wt)} is at ${head(wt).slice(0, 7)}, not BEST ${best.slice(0, 7)}: drop --cwd and the engine makes one`);
        cwd = wt;
      }
      if ((kind === 'e2e' || kind === 'suite') && gateKind(s) === 'release' && head() !== s.candidate) die(`the release gate runs on the frozen candidate ${(s.candidate || 'none').slice(0, 7)}: ${CMD} advance CONSOLIDATE`);
      const dir = cwd ? path.resolve(ROOT, cwd) : ROOT;
      const call = Object.entries(s.calls).find(([, c]) => c.worktree === dir && WRITE_ROLES.includes(c.role) && !c.void);
      if (call && call[1].rootSnap && !call[1].contained) { // a write call's changes stay in its worktree
        if (!sameTree(call[1].rootSnap, snapshot())) { call[1].void = true; save(s, { ev: 'void', id: call[0] }); die(`the root tree changed while ${call[1].role} ${call[0]} worked: its changes left its worktree, so the call is void; restore the root tree, then ${CMD} redispatch ${call[0]}`); }
        const idp = identityProblem(s, call[0]); if (idp) { call[1].void = true; save(s, { ev: 'void', id: call[0], identity: call[1].identity }); die(idp); }
        call[1].contained = true;
      }
      const t0 = Date.now(), r = sh(command, [], { cwd: dir, shell: true, timeout: 3 * 3600e3 });
      const rec = { kind, command, cwd: cwd ? dir : null, code: r.code, sha: head(cwd ? dir : undefined), secs: Math.round((Date.now() - t0) / 100) / 10, t: now(), digest: sha256(r.out).slice(0, 16), tail: r.out.split('\n').slice(-12).join('\n'), judgment };
      s.entry.runs.push(rec); s.runs.push(rec); if (s.state === 'CONSOLIDATE' && !cwd && dirty(s).length) s.entry.lastEditT = rec.t; save(s, { ev: 'run', ...rec, tail: undefined });
      process.stdout.write(r.out); console.log(`\n[bridgecode] ${kind} exit ${r.code} on ${rec.sha.slice(0, 7)}${cwd ? ' in ' + rel(dir) : ''} in ${rec.secs}s (digest ${rec.digest})`);
    },
    judge() {
      const s = load(taskOpt), options = (opt('--options') || '').split(',').filter(Boolean), self = opt('--self'), [kind, ...ids] = a, e = s.entry;
      if (!['explore', 'merge', 'oneshot', 'loop', 'break', 'gate'].includes(kind)) die('judge <explore|merge|oneshot|loop|break|gate> <reviewer-ids…> [--options <explorer-ids>] | judge <oneshot|loop> --self <verdict file> (FOCUSED)');
      allowed(s, 'judge ' + kind);
      if (e.judged && e.judged.outcome) die(`this entry is judged (${e.judged.outcome}): follow the outcome; ${NEXT_HINT}`);
      if (e.judged && !(kind === 'merge' && e.judged.amalgam)) die(`settle the open judging first: ${CMD} reproduce <ID> yes|no -- <command>`);
      if (kind === 'merge' && !(e.judged && e.judged.amalgam)) die(`judge merge follows an amalgam: ${CMD} winner <a>,<b>`);
      preventFirst(s, 'judge ' + kind);
      const elig = kind === 'explore' ? [] : mergeEligibility(s); if (elig.length) die('merge eligibility:\n- ' + elig.join('\n- '));
      const who = judgeOf(s, kind), H = head(), F = files(s.slug);
      if (kind === 'gate') { const x = [...GUARDS.e2eRun(s), ...GUARDS.suiteRun(s)]; if (x.length) die('the release gate needs, before its judges:\n- ' + x.join('\n- ')); }
      const scope = scopeOf(s, kind);
      if (!scope.length) die(openRequired(s).length ? `nothing in scope: name the targets in the step back: ${stepHint(s)}` : `every required criterion is established, so this ${kind} has nothing to judge: ${CMD} advance GATE (the pre-release gate re-checks everything end to end)`);
      let res, met, alleged = {};
      const vids = kind === 'explore' ? options.flatMap((o) => scope.map((c) => `${o}/${c}`)) : scope;
      if (who === 'root') {
        if (!self) die(`on ${s.route} the root judges ${kind}: write your verdict per target in the judge card's format and ${CMD} judge ${kind} --self <file>`);
        if (kind === 'loop') { const x = GUARDS.seenFailing(s); if (x.length) die(x[0]); if (!e.runs.some((r) => !r.cwd && r.kind === 'run' && r.sha === H && (r.code === 0 || r.judgment))) die(`the target passing on the candidate, witnessed: commit, then ${CMD} run -- <the target's check>`); }
        if (kind === 'oneshot') { const x = GUARDS.realRun(s); if (x.length) die(x[0]); }
        const selfRel = rel(path.resolve(ROOT, self)), d = dirty(s).filter((p) => p !== selfRel);
        if (d.length) die(`the root judges the committed candidate: commit first (uncommitted: ${d.slice(0, 3).join(', ')})`);
        res = [{ id: 'root', ...parseOut(path.resolve(ROOT, self), vids, ROOT) }];
        if (res[0].incomplete.length) die('your verdict is incomplete:\n- ' + res[0].incomplete.join('\n- ') + `\ncomplete it, then ${CMD} judge ${kind} --self ${self}`);
      } else {
        if (self) die(`${kind} on ${s.route} is judged by reviewers: ${CMD} call reviewer, then ${CMD} judge ${kind} <reviewer-ids>`);
        const need = roleRows('reviewer').length;
        for (const id of ids) if (!s.calls[id] || s.calls[id].role !== 'reviewer' || s.calls[id].entry !== s.entryN || s.calls[id].void) die(`${id} is not a live reviewer call of this step: ${CMD} call reviewer`);
        if (new Set(ids).size < need) die(`${need} independent reviewer verdict(s): ${CMD} call reviewer (${need}×), then judge ${kind} <ids>`);
        if (kind === 'explore') { if (options.length < 2 || options.length > 4) die('judge explore needs --options with 2–4 explorer call ids'); for (const o of options) { const c = s.calls[o]; if (!c || c.role !== 'explorer') die(`${o} is not an explorer call: ${CMD} call explorer`); if (!e.runs.some((r) => r.cwd === c.worktree)) die(`run option ${o} yourself on real input: ${CMD} run --cwd ${rel(c.worktree)} -- <command>`); } }
        if (!s.snap) die(`start the reviewer calls with ${CMD} call reviewer`);
        const before = s.snap, after = snapshot(); s.snap = null;
        if (!sameTree(before, after)) { for (const id of ids) s.calls[id].void = true; save(s, { ev: 'judge-void', kind }); die(`the repository changed during the read-only calls: they are void; ${CMD} redispatch <id> for each, with the same packets, then judge again`); }
        res = ids.map((id) => ({ id, ...parseOut(path.join(F.tmp, 'runs', id, 'out.md'), vids, s.calls[id].worktree) }));
        for (const r of res) { const idp = identityProblem(s, r.id); if (idp) r.incomplete.push(idp); }
        const bad = res.filter((r) => r.incomplete.length);
        if (bad.length) {
          const twice = bad.filter((r) => s.calls[r.id].redispatched); if (twice.length) blocked(s, `reviewer ${twice.map((r) => r.id).join(', ')} failed after its re-dispatch`);
          save(s, { ev: 'judge-incomplete', calls: bad.map((r) => r.id) });
          die(bad.map((r) => `${r.id} failed:\n  - ${r.incomplete.join('\n  - ')}`).join('\n') + (s.ask ? `\nBLOCKED: ${CMD} advance ASK` : `\nthe judging never passes on the remaining verdicts: ${CMD} redispatch <id> once with the same packet, then judge again`));
        }
      }
      for (const r of res) { for (const p of r.rubricLines) if (!s.proposals.some((x) => x.text === p && !x.resolved)) s.proposals.push({ text: p, resolved: null }); for (const f of r.fixes) if (!e.fixes.includes(f)) e.fixes.push(f); }
      met = vids.filter((id) => res.some((r) => r.v[id] === 'MET'));
      for (const r of res) for (const id of vids) if (r.v[id] === 'NOT_MET') alleged[id] = {};
      const lastRun = e.runs.filter((r) => !r.cwd && ['run', 'e2e'].includes(r.kind) && r.sha === H).pop(), runFailed = !!lastRun && lastRun.code !== 0 && !lastRun.judgment;
      if (kind === 'explore') {
        const core = scope.filter((c) => rubric().crit.find((x) => x.id === c).cls === 'CORE'), good = (o, c) => met.includes(`${o}/${c}`) && !alleged[`${o}/${c}`];
        const rank = options.map((o) => ({ o, core: core.filter((c) => good(o, c)).length, all: scope.filter((c) => good(o, c)).length, ran: e.runs.some((r) => r.cwd === s.calls[o].worktree && (r.code === 0 || r.judgment)) }));
        const full = rank.filter((r) => r.ran && r.core === core.length).map((r) => r.o), eligible = full.length ? full : rank.filter((r) => r.ran).map((r) => r.o);
        e.judged = { kind, sha: null, scope, options, rank, eligible, met, alleged, runFailed, t: now(), outcome: null, established: [] };
        save(s, { ev: 'judge', kind, rank, eligible });
        return console.log('OPTIONS (eligibility is computed; the choice is yours, by the merge card)\n' + rank.map((r) => `- ${r.o}: CORE ${r.core}/${core.length}, all ${r.all}/${scope.length}${r.ran ? '' : ', its real run failed'}${eligible.includes(r.o) ? ' — eligible' : ''}`).join('\n') + `\n${CMD} winner <id>, or winner <a>,<b> for an amalgam (judged again)`);
      }
      e.judged = { kind, gate: kind === 'gate' ? gateKind(s) : null, judge: who, sha: H, scope, met, alleged, runFailed, t: now(), outcome: null, established: [] }; settle(s);
      save(s, { ev: 'judge', kind, judge: who, met, alleged: Object.keys(alleged), outcome: e.judged.outcome }); C.status();
    },
    winner() {
      const s = load(taskOpt), picks = (a[0] || '').split(',').filter(Boolean), j = s.entry.judged; allowed(s, 'winner'); preventFirst(s, 'winner');
      if (!j || j.kind !== 'explore' || !j.options || s.entry.winner) die(`winner follows judge explore, once: ${NEXT_HINT}`);
      if (!picks.length) die('winner <id> | winner <a>,<b> (an amalgam, judged again)');
      for (const o of picks) if (!j.eligible.includes(o)) die(`${o} is not eligible (eligible: ${j.eligible.join(', ')}): an option without a passing real run, or missing a CORE criterion another option establishes, is out`);
      for (const r of j.rank) if (!picks.includes(r.o)) s.vetoes.push(`explored option ${r.o}: CORE ${r.core}, all ${r.all}/${j.scope.length} (mechanism in temporary/${s.slug}/wt/${r.o})`);
      s.entry.winner = picks.join(','); s.entry.winnerT = now();
      if (picks.length > 1) { s.entry.judged = { kind: 'explore', amalgam: true, scope: j.scope, alleged: {}, met: [], outcome: null, established: [], t: now() }; s.snap = null; save(s, { ev: 'winner', options: picks }); return console.log(`amalgam: integrate it on HEAD, commit, run it, then ${CMD} call reviewer and ${CMD} judge merge <ids>`); }
      j.met = j.scope.filter((c) => j.met.includes(`${picks[0]}/${c}`)); j.alleged = Object.fromEntries(j.scope.filter((c) => j.alleged[`${picks[0]}/${c}`]).map((c) => [c, {}]));
      j.sha = head(s.calls[picks[0]].worktree);
      settle(s); save(s, { ev: 'winner', options: picks }); console.log(`integrate ${picks[0]} on HEAD by refactor or translation against its real-run outputs, commit, then ${CMD} run -- <command>`); C.status();
    },
    redispatch() {
      const s = load(taskOpt), id = a[0]; allowed(s, 'redispatch'); if (!s.calls[id]) die(`unknown call ${id || ''}`);
      if (s.calls[id].redispatched) { blocked(s, `${s.calls[id].role} ${id} failed twice`); save(s, { ev: 'blocked', id }); die(`a call is re-dispatched once; the second failure is BLOCKED: ${CMD} advance ASK`); }
      const c = s.calls[id]; c.redispatched = true; c.void = false; c.contained = false;
      git(['reset', '-q', '--hard', c.commit], c.worktree); git(['clean', '-qfdx'], c.worktree);
      for (const f of ['out.md', 'events.jsonl']) fs.rmSync(path.join(files(s.slug).tmp, 'runs', id, f), { force: true });
      if (c.role === 'reviewer') s.snap = snapshot(); if (WRITE_ROLES.includes(c.role)) c.rootSnap = snapshot();
      save(s, { ev: 'redispatch', id }); console.log(`re-dispatch ${id} with the same packet (${path.join(files(s.slug).tmp, 'runs', id, 'packet.md')}); its reply goes to out.md again`);
    },
    reproduce() {
      const s = load(taskOpt), id = a.shift(), st = a.shift(), judgment = flag('--judgment'), j = s.entry.judged; allowed(s, 'reproduce');
      if (!j || !j.alleged[id] || j.alleged[id].status !== undefined) die(`no open NOT_MET ${id || ''} to settle: ${NEXT_HINT}`);
      if (!['yes', 'no', 'missing'].includes(st)) die(`reproduce ${id} yes|no [--judgment] -- <command> (the engine runs it: yes needs it to fail, no to pass) | reproduce ${id} missing "<the run that could not be made, and why>"`);
      let evidence;
      if (st === 'missing') evidence = text('the run that could not be made, and why');
      else {
        if (a[0] === '--') a.shift(); const command = a.join(' '); if (!command) die(`reproduce ${id} ${st} [--judgment] -- <the command that decides it>`);
        const r = sh(command, [], { shell: true, timeout: 3 * 3600e3 }), ok = st === 'yes' ? r.code !== 0 : r.code === 0;
        const rec = { kind: 'reproduce', id, command, code: r.code, sha: head(), t: now(), digest: sha256(r.out).slice(0, 16), tail: r.out.split('\n').slice(-12).join('\n'), judgment };
        s.entry.runs.push(rec); s.runs.push(rec); process.stdout.write(r.out);
        if (!ok && !judgment) { save(s, { ev: 'run', ...rec, tail: undefined }); die(`the run exited ${r.code}, which does not show "${st}": ${st === 'yes' ? 'a violation fails the command' : 'a holding criterion passes it'}; settle with the verdict the run shows (${CMD} reproduce ${id} ${st === 'yes' ? 'no' : 'yes'} -- <command>), or add --judgment when the evidence is the real output rather than the exit code`); }
        evidence = `${command} → exit ${r.code}${judgment ? ' (judged on its output)' : ''} (digest ${rec.digest})`;
      }
      j.alleged[id].status = st; j.alleged[id].evidence = evidence;
      settle(s); save(s, { ev: 'reproduce', id, status: st, evidence }); C.status();
    },
    stepback() {
      const s = load(taskOpt), size = a.shift(), targets = (opt('--targets') || '').split(',').filter(Boolean), callId = opt('--call'), known = rubric().crit.map((c) => c.id);
      if (!['tiny', 'small', 'full', 'replan'].includes(size)) die('stepback tiny|small --targets <IDs> "<the step back>" | stepback full --call <loop-breaker id> "<its step back>" | stepback full --targets <IDs> "<a page>" (EXPLORE) | stepback replan DEFINE|EXPLORE "<the re-plan>"');
      if (['tiny', 'small'].includes(size) && size !== firstSize(s)) die(`a ${s.route} task steps back ${firstSize(s)}: ${stepHint(s)}`);
      allowed(s, 'stepback ' + size);
      for (const t of targets) if (!known.includes(t)) die(`unknown criterion ${t}; the rubric has ${known.join(', ')}`);
      if (size === 'tiny' || size === 'small' || (size === 'full' && s.state === 'EXPLORE')) { // the root's own step back; in EXPLORE a full one
        const t = text('the step back: ' + (STEP_TEXT[size] || 'a page, from scratch'));
        s.prevent = { t: now(), size, targets: targets.length ? targets : null }; if (s.pending === LADDER.pass) s.pending = null; if (s.entry.steps) s.entry.steps.push({ size, t: s.prevent.t });
        s.stepbacks.push({ size, targets: s.prevent.targets, text: t, t: now() }); save(s, { ev: 'stepback', size, targets, text: t }); return console.log(`${size} step back recorded; PREVENT continues with the one-block${PREVENT[s.state] && !PREVENT[s.state].block ? ' (here the one-shot is the block)' : `: ${BLOCK_HINT}`}`);
      }
      if (size === 'full') {
        const c = s.calls[callId]; if (!c || c.role !== 'loop-breaker' || c.entry !== s.entryN) die(`stepback full --call <a loop-breaker call of this BREAK> "<its step back>": ${CMD} call loop-breaker`);
        const t = text("the loop-breaker's full step back, including the step at fault"); s.stepbacks.push({ size, call: callId, text: t, t: now() });
        save(s, { ev: 'stepback', size, call: callId, text: t }); return console.log(`full step back recorded; PREVENT continues with its one-block: ${CMD} block --call ${callId} "<its one-block, from its reply>"`);
      }
      const choice = a.shift();
      if (!s.entry.answers.length) die(`the re-plan follows the user's comment: ${CMD} question "<what you need from them>", then ${CMD} answer "<their words>"`);
      if (!['DEFINE', 'EXPLORE'].includes(choice)) die('stepback replan DEFINE|EXPLORE "<the re-plan>"');
      const need = roleRows('loop-breaker').length; if (callsIn(s, 'loop-breaker').length < need) die(`the loop-breakers take the full step back with the user's comment first: ${CMD} call loop-breaker (${need}×)`);
      const t = text('the re-plan: the step at fault, what changes, what is removed'); s.entry.replan = { choice, text: t, t: now() }; s.entry.approved = null;
      s.stepbacks.push({ size, choice, targets: targets.length ? targets : s.targets, text: t, t: now() }); if (s.pending === 'redefine') s.pending = null;
      save(s, { ev: 'stepback', size, choice, text: t }); console.log(`re-plan recorded (${choice}); PREVENT continues with the one-block of the new definition (${CMD} block "<…>"), then show it to the user in plain words, with what differs from their comment and anything it newly commits to, then record their reply as they wrote it (any clear yes or no): ${CMD} approve "<their words>"`);
    },
    block() {
      const s = load(taskOpt), callId = opt('--call');
      if (callId) { // a loop-breaker's own one-block, from its reply
        allowed(s, 'block --call'); const c = s.calls[callId];
        if (!c || c.role !== 'loop-breaker' || c.entry !== s.entryN) die(`block --call <a loop-breaker call of this BREAK> "<its one-block>": ${CMD} call loop-breaker`);
        c.block = { t: now(), text: text("the loop-breaker's one-block, from its reply") }; if (s.pending === 'full' && !GUARDS.stepBack(s).length) s.pending = null;
        save(s, { ev: 'block', call: callId, text: c.block.text }); return console.log(`loop-breaker ${callId}'s one-block recorded`);
      }
      s.block = { t: now(), state: s.state, text: text('the next action written whole, in one block') }; save(s, { ev: 'block', text: s.block.text }); console.log('one-block recorded (the board\'s Next action)');
    },
    git() { if (a[0] === '--') a.shift(); const r = git(a); process.stdout.write(r.out); process.exit(r.code); },
    question() { const s = load(taskOpt); const t = text('the question (a decision table with your recommendation)'), n = s.questions.length + 1; const q = { n, text: t, t: now(), answered: null }; s.questions.push(q); s.entry.questions.push(q); save(s, { ev: 'question', n, text: t }); console.log(`question ${n} recorded; ask it now, then ${CMD} answer --q ${n} "<their words>"`); },
    answer() {
      const s = load(taskOpt), qn = opt('--q'); allowed(s, 'answer'); const t = text("the user's words, quoted");
      const open = s.entry.questions.filter((q) => !q.answered), q = qn ? s.entry.questions.find((x) => x.n === +qn) : open[0];
      const since = q ? q.t : s.entry.t, w = witnessQuote(s, t, since), rec = { text: t, t: now(), ...w };
      if (q) { q.answered = rec; const g = s.questions.find((x) => x.n === q.n); if (g) g.answered = rec; }
      s.entry.answers.push(rec); save(s, { ev: 'answer', q: q && q.n, text: t, witnessed: w.witnessed });
      console.log(`answer recorded${w.witnessed ? ' (witnessed in a recorded prompt)' : ` (UNWITNESSED: ${w.why}; the report says so)`}`);
    },
    approve() {
      const s = load(taskOpt); allowed(s, 'approve'); preventFirst(s, 'approve'); if (!s.entry.replan) die(`approve follows the re-plan: ${CMD} stepback replan DEFINE|EXPLORE "<the re-plan>"`);
      const t = text("the user's words"), w = witnessQuote(s, t, s.entry.replan.t); s.entry.approved = { t: now(), text: t, ...w };
      save(s, { ev: 'approve', text: t, witnessed: w.witnessed }); console.log(`the user approved the re-plan${w.witnessed ? '' : ' (UNWITNESSED: ' + w.why + ')'}: ${CMD} advance ${s.entry.replan.choice}`);
    },
    blocked() { const s = load(taskOpt); allowed(s, 'blocked'); const t = text('what blocks the work'); blocked(s, t); save(s, { ev: 'blocked', text: t }); console.log(`blocked: ${CMD} advance ASK, and report the candidate, the remaining cases, what is needed, and the EXPLORE and RESEARCH options`); },
    candidate() {
      const s = load(taskOpt); allowed(s, 'candidate'); preventFirst(s, 'candidate'); const d = dirty(s); if (d.length) die(`commit the consolidation first (uncommitted: ${d.slice(0, 3).join(', ')}), then ${CMD} candidate`);
      const x = [...GUARDS.checksRun(s), ...GUARDS.metricsRecorded(s)]; if (x.length) die('the candidate needs:\n- ' + x.join('\n- '));
      s.candidate = head(); save(s, { ev: 'candidate', sha: s.candidate }); console.log(`candidate frozen at ${s.candidate.slice(0, 7)}: ${CMD} advance GATE`);
    },
    metrics() {
      const json = flag('--json'), reason = opt('--reason'), m = writeMetrics(ROOT);
      const live = slugFromContext(taskOpt); if (live && !live.many && fs.existsSync(files(live).state)) { const s = load(live); preventFirst(s, 'metrics'); s.entry.metrics = { t: now(), crossed: m.crossed, alerts: m.alerts, reason }; save(s, { ev: 'metrics', crossed: m.crossed, alerts: m.alerts, reason }); }
      console.log(json ? JSON.stringify(m, null, 2) : formatMetrics(m));
    },
    memory() { const w = GUARDS.memoryShape(); console.log(w.length ? 'MEMORY SHAPE\n- ' + w.join('\n- ') : 'MEMORY SHAPE OK'); process.exit(w.length ? 1 : 0); },
    resolve() { const s = load(taskOpt), [i, ...how] = a, p = s.proposals[+i - 1]; if (!p || !how.join(' ').trim()) die('resolve <n> "<applied at DEFINE | dismissed: reason>"'); p.resolved = how.join(' '); save(s, { ev: 'resolve', i }); console.log('resolved'); },
    veto() { const s = load(taskOpt); s.vetoes.push(text('the mechanism, why it is vetoed, and what instead')); save(s, { ev: 'veto', text: a.join(' ') }); console.log('veto recorded; it is written to agentic/rubric.md at CONDENSE'); },
    backlog() { const s = load(taskOpt); s.backlog.push(text('the backlog item')); save(s, { ev: 'backlog', text: a.join(' ') }); console.log('backlog item recorded; it is written to agentic/rubric.md at CONDENSE'); },
    falsified() { const s = load(taskOpt); s.falsified.push(text('the premise and the run that falsified it')); save(s, { ev: 'falsified', text: a.join(' ') }); console.log(`falsified premise recorded; a falsified spec or architecture premise goes to the user: ${CMD} blocked "<…>"`); },
    note() { const s = load(taskOpt); s.notes.push(text('the note')); save(s, { ev: 'note', text: a.join(' ') }); console.log('note recorded'); },
    report() { const s = load(taskOpt), final = flag('--final'); if (final) { allowed(s, 'report --final'); s.entry.finalReport = true; save(s, { ev: 'report', final }); } console.log(report(s, final)); },
    turn() { // the hook: record the user's prompt in the active task's log, then print the status line
      let input = ''; try { input = fs.readFileSync(0, 'utf8'); } catch { input = ''; }
      const slug = slugFromContext(taskOpt); if (!slug || slug.many || !fs.existsSync(files(slug).state)) return;
      if (input.trim()) fs.appendFileSync(files(slug).log, JSON.stringify({ t: now(), ev: 'prompt', digest: sha256(input).slice(0, 16), text: input.slice(0, 20000) }) + '\n');
      let s; try { s = JSON.parse(fs.readFileSync(files(slug).state, 'utf8')); } catch { return; }
      if (!FLOW[s.state] || FLOW[s.state].terminal) return;
      console.log(statusLine(s));
    },
    tasks() { const live = fs.existsSync(TASKS) ? fs.readdirSync(TASKS) : []; console.log(live.map((d) => { try { const s = JSON.parse(fs.readFileSync(files(d).state, 'utf8')); return `${d}: ${s.route} ${s.state}`; } catch { return `${d}: unreadable`; } }).join('\n') || 'no tasks'); },
    recover() {
      const slug = slugFromContext(taskOpt); if (!slug || slug.many) die('recover --task <slug>');
      const last = logLines(slug).filter((l) => l.hash && l.snap).pop(); if (!last) die(`agentic/tasks/${slug}/log.jsonl holds no state record to rebuild from`);
      fs.writeFileSync(files(slug).state, JSON.stringify(last.snap, null, 2)); const s = load(slug); save(s, { ev: 'recover' }); console.log(`state.json rebuilt from the log (${last.t}); ${NEXT_HINT}`);
    },
    clean() {
      const force = flag('--force'), s = load(taskOpt, { skipHash: force });
      if (!force) allowed(s, 'clean');
      for (const [id, c] of Object.entries(s.calls || {})) { git(['worktree', 'remove', '--force', c.worktree]); git(['branch', '-q', '-D', `bc/${s.slug}-${id}`]); }
      const F = files(s.slug); for (const w of fs.existsSync(path.join(F.tmp, 'wt')) ? fs.readdirSync(path.join(F.tmp, 'wt')) : []) git(['worktree', 'remove', '--force', path.join(F.tmp, 'wt', w)]);
      git(['worktree', 'prune']); fs.rmSync(F.tmp, { recursive: true, force: true }); fs.rmSync(F.dir, { recursive: true, force: true });
      console.log(`task ${s.slug} cleaned: agentic/tasks/${s.slug}/ and temporary/${s.slug}/ removed; branch bc/${s.slug} kept until the user asks to merge it`);
    },
    check() {
      const errs = [], states = Object.keys(FLOW);
      for (const [k, v] of Object.entries(FLOW)) {
        for (const t of v.next) if (!FLOW[t]) errs.push(`${k} → ${t}: unknown state`);
        for (const g of [...(v.exit || []), ...Object.values(v.to || {}).flat()]) if (!GUARDS[g]) errs.push(`${k}: unknown guard ${g}`);
        for (const t of Object.keys(v.to || {})) if (!v.next.includes(t)) errs.push(`${k}: guards for ${t}, which is not in next`);
        if (!v.terminal && !v.next.includes(FLOWDATA.escape) && k !== FLOWDATA.escape && !v.next.some((t) => FLOW[t]?.terminal) && !['ACCEPT', 'CONDENSE'].includes(k)) errs.push(`${k}: no way to ${FLOWDATA.escape}`);
      }
      for (const g of FLOWDATA.always) if (!GUARDS[g]) errs.push(`always: unknown guard ${g}`);
      for (const [k, p] of Object.entries(PREVENT)) { // the prevent: refused before the first work commands, and checked again at the exit
        if (!FLOW[k] || FLOW[k].terminal) { errs.push(`prevent: ${k} is not a working state`); continue; }
        if (!['first', 'full', 'breakers', 'replan'].includes(p.step)) errs.push(`prevent ${k}: unknown step ${p.step}`);
        for (const b of p.before || []) if (!C[b.split(' ')[0]]) errs.push(`prevent ${k}: unknown command ${b}`);
        if (![...(FLOW[k].exit || []), ...Object.values(FLOW[k].to || {}).flat()].includes('stepBack')) errs.push(`${k}: owes a prevent, but no exit checks stepBack`);
      }
      for (const [c, where] of Object.entries(FLOWDATA.commands)) { if (!C[c.split(' ')[0]]) errs.push(`commands: unknown command ${c}`); for (const w of where) if (!FLOW[w]) errs.push(`commands ${c}: unknown state ${w}`); }
      for (const k of states) { const seen = new Set([k]), q = [k]; let ok = false; while (q.length) { const x = q.shift(); if (FLOW[x].terminal) { ok = true; break; } for (const t of FLOW[x].next) if (!seen.has(t)) { seen.add(t); q.push(t); } } if (!ok) errs.push(k + ': cannot end'); }
      const reach = new Set(Object.values(FLOWDATA.start)), q = [...reach]; while (q.length) for (const t of FLOW[q.shift()].next) if (!reach.has(t)) { reach.add(t); q.push(t); }
      for (const k of states) if (!reach.has(k)) errs.push(k + ': unreachable');
      for (const [r, v] of Object.entries(RUNGS)) { if (!FLOW[v.state]) errs.push(`rung ${r}: unknown state ${v.state}`); for (const st of ['ONESHOT', 'LOOP', 'BREAK', 'GATE']) if (!FLOW[st].next.includes(v.state)) errs.push(`${st}: rung ${r}'s state ${v.state} is not reachable from a judging`); }
      for (const r of Object.keys(RUNGS)) for (const o of ['ADVANCED', 'STALLED', 'REGRESSION']) if (!LADDER[r] || !LADDER[r][o] || !RUNGS[LADDER[r][o][1]] || LADDER[r][o][0] < 1) errs.push(`ladder ${r}/${o}: missing or unknown rung`);
      if (RUNGS[LADDER.blocked].state !== FLOWDATA.escape) errs.push('BLOCKED does not reach the user');
      for (const k of states) if (!bound(k, 'root').length) errs.push(`${k}: no root card bound`);
      for (const r of ROLES) if (!FLOWDATA.cards.some((b) => b.role === r)) errs.push(`no card bound for role ${r}`);
      for (const b of FLOWDATA.cards) { const c = CARDS[b.card]; if (!c || !c.body) errs.push(`binding ${b.state}/${b.role}: card "${b.card}" missing`); else if (!c.states.includes(b.state) || !c.roles.includes(b.role)) errs.push(`card "${b.card}": front matter (${c.state} · ${c.role}) does not name ${b.state} · ${b.role}`); }
      for (const [id, c] of Object.entries(CARDS)) { if (c.bad) errs.push(`${c.file}: ${c.bad}`); else { if (!FLOWDATA.cards.some((b) => b.card === id)) errs.push(`card "${id}" (${c.file}) is bound to nothing in flow.json`); for (const st of c.states) for (const ro of c.roles) if (!FLOWDATA.cards.some((b) => b.card === id && b.state === st && b.role === ro)) errs.push(`card "${id}" names ${st} · ${ro}, which flow.json does not bind`); } }
      for (const [n, t] of Object.entries(TRIGGERS)) { if (!t.file) errs.push(`trigger ${n}: no file`); for (const w of t.when || []) for (const st of w.state || []) if (!FLOW[st]) errs.push(`trigger ${n}: unknown state ${st}`); for (const st of t.ask || []) if (!FLOW[st]) errs.push(`trigger ${n}: question at unknown state ${st}`); for (const r of t.packet || []) if (!ROLES.includes(r)) errs.push(`trigger ${n}: unknown role ${r}`); }
      console.log(errs.length ? 'FLOW INVALID\n- ' + errs.join('\n- ') : `FLOW OK: ${states.length} states, each reachable and able to end; ${Object.keys(CARDS).length} cards, each bound; ${Object.keys(TRIGGERS).length} specialist triggers; ladder of ${Object.keys(RUNGS).length} rungs reachable from every judging; BLOCKED reaches the user`);
      process.exit(errs.length ? 1 : 0);
    },
    flow() {
      const ord = (n) => n + (n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
      const L = Object.keys(RUNGS).map((r) => `${r} (${RUNGS[r].state}): ` + ['ADVANCED', 'STALLED', 'REGRESSION'].map((o) => { const [n, to] = LADDER[r][o]; return `${o} ${to === r ? 'stays' : n === 1 ? '→ ' + to : `stays (${ord(n)} → ${to})`}`; }).join(' · '));
      console.log(Object.entries(FLOW).map(([k, v]) => `${k} → ${v.next.join(', ') || '(end)'}`).join('\n') + `\n\nLADDER (counted per rung since the last PASS or rung change; PASS → ${LADDER.pass}; BLOCKED → ${LADDER.blocked}; a one-shot: good → ${LADDER.oneshot.good}, bad → ${LADDER.oneshot.bad} or, on FULL, ${LADDER.oneshot.badFull})\n` + L.join('\n'));
    },
    card() { const id = a[0], c = CARDS[id] || CORE[id]; if (!c || !c.body) die(`unknown card ${id || ''}; cards: ${Object.keys(CARDS).join(', ')}; core: ${Object.keys(CORE).join(', ')}`); console.log(subst(c.body)); },
    version() { console.log(VERSION); },
  };
  if (!C[cmd]) { console.log(`engine.mjs ${VERSION}\ncommands: ${Object.keys(C).join(' ')}`); process.exit(cmd ? 2 : 0); }
  C[cmd]();
}

const self = fileURLToPath(import.meta.url), invoked = process.argv[1] ? path.resolve(process.argv[1]) : '';
const same = (x, y) => { try { const r = (p) => fs.realpathSync.native(p); return process.platform === 'win32' ? r(x).toLowerCase() === r(y).toLowerCase() : r(x) === r(y); } catch { return false; } };
if (invoked && same(invoked, self)) main(process.argv.slice(2));
