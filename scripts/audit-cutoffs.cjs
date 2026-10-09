// Read-only source audit. A matching secondary source is NOT official verification.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const sourceRoot=process.argv[2],output=process.argv[3];
if(!sourceRoot||!output)throw Error('Usage: node scripts/audit-cutoffs.cjs <public cutoff folder> <audit output folder>');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const data=read('modules/admission-2028/data/nationwide.json'),baseline=read('data/baseline/admissions.json'),contracts=read('modules/contracts-2028/data.json');
const files=new Map(),rows=[];
const number=s=>/^\d+(?:\.\d+)?$/.test(String(s).trim())?Number(s):null;
function sourceCheck(r){
 if(!r.sourceFile)return {status:'no-source-locator'};
 const p=path.resolve(sourceRoot,r.sourceFile);
 if(!p.startsWith(path.resolve(sourceRoot)+path.sep))throw Error('Source escaped public cutoff folder');
 if(!fs.existsSync(p))return {status:'source-file-missing'};
 if(!files.has(r.sourceFile))files.set(r.sourceFile,{sha256:hash(p),lines:fs.readFileSync(p,'utf8').split(/\r?\n/)});
 const f=files.get(r.sourceFile),line=Number(r.sourceRow),cells=(f.lines[line-1]||'').split('|').slice(1,-1).map(s=>s.trim());
 if(cells.length<4)return {status:'source-row-invalid',sourceFile:r.sourceFile,sourceRow:r.sourceRow};
 const issues=[];
 if(number(cells[1])!==r.year)issues.push('year');
 if(number(cells[3])!==r.cut70)issues.push('cut70');
 const names=[r.major,...r.historyMajorLabels||[]];
 if(!names.includes(cells[0]))issues.push('major-label-needs-mapping');
 return {status:issues.length?'source-difference':'secondary-source-match',issues,sourceFile:r.sourceFile,sourceRow:line,sourceMajor:cells[0],sourceYear:number(cells[1]),sourceCut50:number(cells[2]),sourceCut70:number(cells[3]),sourceSha256:f.sha256};
}
for(const r of data.records){
 const check=sourceCheck(r);
 rows.push({dataset:'nationwide',id:r.id,uni:r.uni,campus:r.campus,major:r.major,track:r.track,category:r.category,active:!r.legacyDisposition2028,year:r.year,cut70:r.cut70,metric:r.metric,officialResultStatus:'unverified',...check});
 for(const [i,h] of (r.history||[]).entries())rows.push({dataset:'nationwide-history',id:r.id,historyIndex:i,uni:r.uni,major:r.major,track:r.track,year:h.year,cut70:h.cut70,officialResultStatus:'unverified',...sourceCheck({...r,...h})});
}
for(const [i,r] of baseline.entries())for(const slot of ['k1','k2','k3','j1','j2']){
 if(!r[slot+'n'])continue;
 const a=number(r[slot+'a']),b=number(r[slot+'b']);
 rows.push({dataset:'baseline',id:i+1,slot,uni:r.u,major:r.m,track:r[slot+'n'],year:2026,value50:r[slot+'a']??null,value70:r[slot+'b']??null,metric:r[slot+'metric']||'percentile-collected',status:r[slot+'metric']==='donggukOfficial'?'previous-official-correction-not-rechecked':'workbook-comparison-pending',officialResultStatus:'unverified',flags:[...(a!==null&&b!==null&&a>b?['percentile-order-reversed']:[]),...(a===1||b===1?['one-value-review-not-error']:[])]});
}
for(const r of contracts.records){
 if(!r.history?.length)rows.push({dataset:'contracts',id:r.id,uni:r.uni,major:r.major,status:'no-history',officialResultStatus:'no-result'});
 for(const [i,h] of r.history.entries())rows.push({dataset:'contracts',id:r.id,historyIndex:i,uni:r.uni,major:r.major,...h,status:h.sourceType==='official'?'previous-official-evidence-not-rechecked':'secondary-source-unverified',officialResultStatus:'unverified'});
}
const counts={};for(const r of rows){const k=r.dataset+':'+r.status;counts[k]=(counts[k]||0)+1;}
const report={scope:'Source transcription checks and row inventory; not a certification of official result accuracy',inputs:Object.fromEntries(['modules/admission-2028/data/nationwide.json','data/baseline/admissions.json','modules/contracts-2028/data.json'].map(p=>[p,hash(path.join(root,p))])),denominators:{nationwide:data.records.length,active:data.records.filter(r=>!r.legacyDisposition2028).length,baseline:baseline.length,contracts:contracts.records.length,auditEntries:rows.length,sourceFiles:files.size},counts,rows};
fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'row-audit.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(output,'source-inventory.json'),JSON.stringify([...files].map(([file,v])=>({file,sha256:v.sha256})),null,2)+'\n');
console.log(JSON.stringify({denominators:report.denominators,counts},null,2));
