import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import applicationLinker from '../../scripts/link-application-2027.cjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n');
const data=JSON.parse(read('data.json'));
const cutoff=JSON.parse(fs.readFileSync(path.join(root,'..','..','data','cutoff-current.json'),'utf8'));
data.records=data.records.map(r=>({...r,history:r.history.map((h,i)=>({...h,cutoffCurrent:cutoff.contracts[r.id]?.[i]}))}));
const applications=JSON.parse(fs.readFileSync(path.join(root,'..','..','data','application-2027.json'),'utf8'));
data.records=applicationLinker.linkApplications(data.records,applications);
data.application2027Scope=applications.scope;
const linked=data.records.filter(r=>r.application2027||r.application2027Options?.length);
const coverage='2027 자료 연결: '+new Set(linked.map(r=>r.uni)).size+'개 대학 · '+linked.length+'개 학과. 미연결은 -입니다.';
const html=read('template.html').replace('__APPLICATION_COVERAGE__',coverage).replace('__DATA__',JSON.stringify(data).replace(/</g,'\\u003c')).replace('__UI__',read('ui.js'));
if(process.argv.includes('--check')){if(read('index.html')!==html)throw Error('Contract module build differs');}
else fs.writeFileSync(path.join(root,'index.html'),html);
console.log('[PASS] 2028 contract module build');
