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

const courses=JSON.parse(fs.readFileSync(path.join(root,'data','recommended-courses.json'),'utf8'));
const contractData=JSON.parse(fs.readFileSync(path.join(root,'..','contracts-2028','data.json'),'utf8'));
const identities=contractData.records.filter(r=>r.status==='plan2028').map(r=>({uni:r.uni,major:r.major}));
const courseUi=fs.readFileSync(path.join(root,'scripts','course-ui.js'),'utf8').replace(/\r\n/g,'\n');
const payload = [
  `const CONTRACT_IDENTITIES=${JSON.stringify(identities)};`,
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

const courseTemplate=fs.readFileSync(path.join(root,'src','courses.template.html'),'utf8').replace(/\r\n/g,'\n');
const courseGenerated=courseTemplate.replace('__COURSE_DATA__',JSON.stringify(courses).replace(/</g,'\\u003c')).replace('__COURSE_UI__',courseUi);
for(const [destination,content] of [[outputPath,generated],[path.join(root,'courses.html'),courseGenerated]]){
 if(process.argv.includes('--check')){
  if(fs.readFileSync(destination,'utf8').replace(/\r\n/g,'\n')!==content)throw new Error('Generated HTML differs: '+destination);
  console.log('[PASS] build reproduces '+path.relative(root,destination));
 }else{fs.writeFileSync(destination,content,'utf8');console.log('[PASS] wrote '+path.relative(root,destination))}
}
