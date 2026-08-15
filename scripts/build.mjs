import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const normalize = value => value.replace(/\r\n/g, '\n');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

function replaceOnce(source, token, value) {
  const first = source.indexOf(token);
  if (first < 0 || first !== source.lastIndexOf(token)) {
    throw new Error(`${token}: expected exactly one placeholder`);
  }
  return source.slice(0, first) + value + source.slice(first + token.length);
}

const args = new Set(process.argv.slice(2));
const template = normalize(fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8'));
const admissions = normalize(fs.readFileSync(path.join(root, 'data', 'baseline', 'admissions.json'), 'utf8')).trim();
const minimums = normalize(fs.readFileSync(path.join(root, 'data', 'baseline', 'suneung-minimum.json'), 'utf8')).trim();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'baseline', 'manifest.json'), 'utf8'));

if (sha256(admissions) !== manifest.admissions.sha256) throw new Error('admissions baseline hash mismatch');
if (sha256(minimums) !== manifest.suneungMinimum.sha256) throw new Error('CSAT minimum baseline hash mismatch');

let built = replaceOnce(template, '__RAW_DATA__', admissions);
built = replaceOnce(built, '__SNT_DATA__', minimums);

const target = path.join(root, 'index.html');
if (args.has('--write')) {
  fs.writeFileSync(target, built, 'utf8');
  console.log(`wrote ${target}`);
} else {
  const current = normalize(fs.readFileSync(target, 'utf8'));
  if (built !== current) throw new Error('generated HTML differs from index.html');
  console.log('[PASS] generated HTML matches index.html');
}
