import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const templatePath = path.join(root, 'src', 'index.template.html');
const dataPath = path.join(root, 'data', 'nationwide.json');
const outputPath = path.join(root, 'index.html');

const template = fs.readFileSync(templatePath, 'utf8').replace(/\r\n/g, '\n');
const dataset = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const gradeUi = fs.readFileSync(path.join(root, 'scripts', 'grade-ui.js'), 'utf8').replace(/\r\n/g, '\n');
const realUi = fs.readFileSync(path.join(root, 'scripts', 'real-ui.js'), 'utf8').replace(/\r\n/g, '\n');

if (dataset.records.length !== 22751) throw new Error(`2028 record count changed: ${dataset.records.length}`);
if (dataset.meta.current2028Candidates !== 21720) throw new Error('2028 active denominator changed');
if (dataset.meta.current2028Verified !== 20153) throw new Error('2028 verified count changed');

const payload = [
  '/* REAL_DATA_START */',
  `const DATA=${JSON.stringify(dataset.records)};`,
  `const DATA_META=${JSON.stringify(dataset.meta)};`,
  '/* REAL_DATA_END */'
].join('\n');

const generated = template
  .replace('__REAL_DATA__', payload)
  .replace('__GRADE_UI__', gradeUi)
  .replace('__REAL_UI__', realUi);

for (const placeholder of ['__REAL_DATA__', '__GRADE_UI__', '__REAL_UI__']) {
  if (generated.includes(placeholder)) throw new Error(`build placeholder remains: ${placeholder}`);
}

if (process.argv.includes('--check')) {
  const current = fs.readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n');
  if (current !== generated) {
    console.error('[FAIL] 2028 generated HTML differs from modules/admission-2028/index.html');
    process.exit(1);
  }
  console.log('[PASS] 2028 module build reproduces index.html');
} else {
  fs.writeFileSync(outputPath, generated, 'utf8');
  console.log(`[PASS] wrote ${path.relative(process.cwd(), outputPath)}`);
}
