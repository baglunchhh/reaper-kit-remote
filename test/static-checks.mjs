// Static checks: syntax, referenced assets, skins registered, and a privacy scan.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let failed = 0;
const ok = (m) => console.log('PASS', m);
const bad = (m) => { console.error('FAIL', m); failed++; };

// 1. every script parses
const html = read('index.html');
const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
if (!inline.length) bad('no inline scripts found in index.html');
inline.forEach((code, i) => {
  try { new vm.Script(code, { filename: `index.html#script${i + 1}` }); ok(`index.html inline script ${i + 1} parses`); }
  catch (e) { bad(`index.html inline script ${i + 1}: ${e.message}`); }
});
for (const f of ['main.js', 'spec-export.jsx']) {
  try { new vm.Script(read(f), { filename: f }); ok(`${f} parses`); }
  catch (e) { bad(`${f}: ${e.message}`); }
}

// 2. every local asset index.html references exists
const refs = new Set();
for (const m of html.matchAll(/url\(\s*['"]?([^'")]+?)['"]?\s*\)/g)) refs.add(m[1]);
for (const m of html.matchAll(/\bsrc=["']([^"']+)["']/g)) refs.add(m[1]);
for (const r of refs) {
  if (/^(https?:|data:|\/\/)/.test(r)) { bad(`external resource referenced: ${r} (page must work offline)`); continue; }
  fs.existsSync(path.join(root, r)) ? ok(`asset exists: ${r}`) : bad(`missing asset: ${r}`);
}

// 3. the three looks are all present
for (const s of ['classic', 'retro', 'hifi']) {
  html.includes(`html[data-skin="${s}"]`) ? ok(`skin styles present: ${s}`) : bad(`skin styles missing: ${s}`);
}

// 4. privacy scan: no LAN IPs, user paths or real emails in committed text files
const skip = new Set(['node_modules', '.git']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = path.join(d, e.name);
    e.isDirectory() ? walk(p) : /\.(html|js|jsx|mjs|md|json|yml)$/i.test(e.name) && files.push(p);
  }
})(root);
const rules = [
  [/\b(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/, 'private LAN IP'],
  [/[A-Za-z]:\\Users\\/, 'Windows user path'],
  [/\b(?![\w.+-]*@users\.noreply\.github\.com)[\w.+-]+@[\w-]+\.[\w.]+\b/, 'email address'],
];
let leaks = 0;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  for (const [re, label] of rules) {
    if (re.test(text)) { bad(`${label} in ${path.relative(root, f)}`); leaks++; }
  }
}
if (!leaks) ok(`privacy scan clean (${files.length} files)`);

console.log(failed ? `\n${failed} check(s) failed` : '\nstatic checks: all passed');
process.exit(failed ? 1 : 0);
