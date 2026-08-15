import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const forbidden = [
  'STUDENT_MOCK_GRADES', 'STUDENT_GRADE_INPUTS', 'studentClass',
  'studentNumber', 'studentLoadStatus'
];
for (const token of forbidden) check(!html.includes(token), `private token: ${token}`);

check(html.includes('2027학년도 V10.6'), 'version missing');
check(html.includes('공개용 · 학생 성적 미포함'), 'privacy badge missing');
check(html.includes('id="sntK"') && html.includes('id="sntM"'), 'manual CSAT inputs missing');
check(html.includes('id="pickList"') && html.includes('id="comparePickedBtn"'), 'shortlist UI missing');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
check(scripts.length > 0, 'inline script missing');
scripts.forEach((code, index) => {
  try { new vm.Script(code, { filename: `inline-${index + 1}.js` }); }
  catch (error) { errors.push(`JavaScript syntax: ${error.message}`); }
});

const admissionsText = fs.readFileSync(path.join(root, 'data', 'baseline', 'admissions.json'), 'utf8').trim();
const minimumText = fs.readFileSync(path.join(root, 'data', 'baseline', 'suneung-minimum.json'), 'utf8').trim();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'baseline', 'manifest.json'), 'utf8'));
const admissions = JSON.parse(admissionsText);
const minimums = JSON.parse(minimumText);
check(admissions.length === 5863, `admissions count: ${admissions.length}`);
check(Object.keys(minimums).length === 3576, `CSAT minimum count: ${Object.keys(minimums).length}`);
check(sha256(admissionsText) === manifest.admissions.sha256, 'admissions hash mismatch');
check(sha256(minimumText) === manifest.suneungMinimum.sha256, 'CSAT minimum hash mismatch');

let generated = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8').replace(/\r\n/g, '\n');
generated = generated.replace('__RAW_DATA__', admissionsText).replace('__SNT_DATA__', minimumText);
check(!generated.includes('__RAW_DATA__') && !generated.includes('__SNT_DATA__'), 'build placeholder remains');
check(generated === html, 'generated HTML differs from index.html');

const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'sources', 'source-manifest.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data-update-audit-260813.json'), 'utf8'));
check(sourceManifest.sources.length === 2, 'official source manifest count');
check(audit.comparison.baselineKeysMissingFromWorkbook === 0, 'baseline key missing from 260813 workbook');
check(audit.comparison.workbookKeysNotInBaseline === 134, '260813 new key count changed');
check(audit.comparison.exactBaselineRowsPresent === 5807, 'exact baseline row count changed');
check(audit.comparison.baselineRowsChangedCorrectedOrUnmatched === 56, 'changed/corrected row count changed');
check(audit.comparison.unmatchedRowsWithDonggukOfficialCorrection === 51, 'Dongguk correction count changed');
check(!JSON.stringify(audit).includes('D:\\\\'), 'audit report contains an absolute Windows path');

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git') return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}
for (const file of listFiles(root)) {
  check(!/\.(xlsx?|pdf)$/i.test(file), `source binary must not be committed: ${path.relative(root, file)}`);
}

const allowedRoot = new Set([
  '.git', '.gitignore', 'README.md', 'data', 'docs', 'index.html',
  'package.json', 'scripts', 'sources', 'src'
]);
for (const entry of fs.readdirSync(root)) check(allowedRoot.has(entry), `unexpected public path: ${entry}`);
for (const file of fs.readdirSync(path.join(root, 'scripts'))) {
  check(['audit-source.py', 'build.mjs', 'extract-baseline.mjs', 'validate-public.mjs'].includes(file), `unexpected script: ${file}`);
}

if (errors.length) {
  console.error(errors.map(error => `[FAIL] ${error}`).join('\n'));
  process.exit(1);
}
console.log('[PASS] V10.6 label, core UI, and inline JavaScript');
console.log('[PASS] student mock-exam data and loader remain excluded');
console.log('[PASS] baseline counts and SHA-256 fingerprints');
console.log('[PASS] template build reproduces index.html');
console.log('[PASS] 260813 source audit and public source-binary boundary');
console.log('[PASS] recovery project file allowlist');
