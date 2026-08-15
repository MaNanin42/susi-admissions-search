import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const htmlPath = path.join(root, 'index.html');
const templatePath = path.join(root, 'src', 'index.template.html');
const dataDir = path.join(root, 'data', 'baseline');

const normalize = value => value.replace(/\r\n/g, '\n');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function extractLine(html, pattern, label) {
  const matches = [...html.matchAll(pattern)];
  if (matches.length !== 1) throw new Error(`${label}: expected one data declaration`);
  return { line: matches[0][0], json: matches[0][1] };
}

const html = normalize(fs.readFileSync(htmlPath, 'utf8'));
const raw = extractLine(html, /^const RAW = (.*);$/gm, 'admissions data');
const snt = extractLine(html, /^const SN\s+= (.*);$/gm, 'CSAT minimum data');
const admissions = JSON.parse(raw.json);
const minimums = JSON.parse(snt.json);

if (!Array.isArray(admissions) || admissions.length !== 5863) {
  throw new Error(`unexpected admissions row count: ${admissions.length}`);
}
if (!minimums || Array.isArray(minimums) || Object.keys(minimums).length !== 3576) {
  throw new Error(`unexpected CSAT minimum count: ${Object.keys(minimums || {}).length}`);
}

let template = html.replace(raw.line, 'const RAW = __RAW_DATA__;');
template = template.replace(snt.line, 'const SN  = __SNT_DATA__;');
if (template.includes(raw.json) || template.includes(snt.json)) {
  throw new Error('embedded baseline data remains in template');
}

fs.mkdirSync(path.dirname(templatePath), { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(templatePath, template, 'utf8');
fs.writeFileSync(path.join(dataDir, 'admissions.json'), `${raw.json}\n`, 'utf8');
fs.writeFileSync(path.join(dataDir, 'suneung-minimum.json'), `${snt.json}\n`, 'utf8');
fs.writeFileSync(path.join(dataDir, 'manifest.json'), `${JSON.stringify({
  version: 'V10.6',
  generatedFrom: 'index.html',
  admissions: { count: admissions.length, sha256: sha256(raw.json) },
  suneungMinimum: { count: Object.keys(minimums).length, sha256: sha256(snt.json) }
}, null, 2)}\n`, 'utf8');

console.log(`extracted admissions=${admissions.length}, suneungMinimum=${Object.keys(minimums).length}`);
