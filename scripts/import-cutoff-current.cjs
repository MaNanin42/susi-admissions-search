// Explicit public source import. Never infer grades from converted points.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),audit=process.argv[2],sourceRoot=process.argv[3];
if(!audit||!sourceRoot)throw Error('Usage: node scripts/import-cutoff-current.cjs <audit folder> <public markdown folder>');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const n=v=>/^\d+(?:\.\d+)?$/.test(String(v??'').trim())?Number(v):null;
const norm=v=>String(v||'').normalize('NFKC').replace(/[\s·ㆍ・]/g,'').toLowerCase();
const uni=v=>norm(v).replace(/대학교/g,'대').replace(/\[(?:본교|분교)\]/g,'').replace(/[\[\]]/g,x=>x==='['?'(':')').replace(/캠퍼스/g,'');
const track=v=>norm(v).replace(/^(?:학생부)?(?:교과|종합)\((.*)\)$/,'$1').replace(/전형$/,'').replace(/^do-dream$/,'dodream');
const key=(u,m,t,c,y)=>[uni(u),norm(m),track(t),c,Number(y)].join('|');
const manifest=read(path.join(audit,'current-cutoff-manifest.json'));
const current=manifest.flatMap(f=>read(path.join(audit,'current-cutoff',f.file)).data);
const index=new Map();for(const r of current){const k=key(r.university,r.department,r.admission_type,r.highschool_type,r.year);if(!index.has(k))index.set(k,[]);index.get(k).push(r)}
const fields=['grade_50_cut','grade_70_cut','perfect_score','convert_50_cut','convert_70_cut','recruitment_count','competition_rate'];
function lookup(k){const found=index.get(k)||[];if(!found.length)return {status:'unmatched'};if(new Set(found.map(r=>JSON.stringify(fields.map(f=>r[f])))).size!==1)return {status:'ambiguous',sourceIds:found.map(r=>r.id)};const r=found[0];return {status:'matched',sourceIds:found.map(r=>r.id),year:Number(r.year),university:r.university,major:r.department,category:r.highschool_type,track:r.admission_type,grade50:n(r.grade_50_cut),grade70:n(r.grade_70_cut),perfectScore:n(r.perfect_score),point50:n(r.convert_50_cut),point70:n(r.convert_70_cut),quota:n(r.recruitment_count),ratio:n(r.competition_rate),source:'https://cutoff.co.kr/susi.php',reviewed:'2026-10-09',raw:Object.fromEntries(fields.map(f=>[f,r[f]]))}}
const data=read(path.join(root,'modules/admission-2028/data/nationwide.json'));
const baseline=read(path.join(root,'data/baseline/admissions.json'));
const contracts=read(path.join(root,'modules/contracts-2028/data.json'));
const sourceCache=new Map();
function nationalLookup(r,h=r){
 if(!h.sourceFile||!h.sourceFile.endsWith('.md'))return {status:'no-secondary-locator'};
 const file=path.resolve(sourceRoot,h.sourceFile);if(!file.startsWith(path.resolve(sourceRoot)+path.sep))throw Error('Public source boundary');
 if(!fs.existsSync(file))return {status:'source-file-missing'};
 if(!sourceCache.has(file))sourceCache.set(file,fs.readFileSync(file,'utf8').split(/\r?\n/));
 const lines=sourceCache.get(file),header=lines[0].match(/^# (.+?\]) (?:(교과|종합) - )?(.+?) 최신 입결/),cells=(lines[Number(h.sourceRow)-1]||'').split('|').slice(1,-1).map(x=>x.trim());
 if(!header||cells.length<4)return {status:'source-locator-unparsed'};
 const category=header[2]||(r.category==='학생부교과'?'교과':r.category==='학생부종합'?'종합':'');
 const latest=lookup(key(header[1],cells[0],header[3],category,2026));
 return h===r&&latest.status==='matched'?latest:lookup(key(header[1],cells[0],header[3],category,h.year));
}
const national={},base={},contract={},ledger=[];
for(const r of data.records){const match=nationalLookup(r);national[r.id]=match;ledger.push({dataset:'nationwide',id:r.id,uni:r.uni,major:r.major,track:r.track,active:!r.legacyDisposition2028,oldYear:r.year,oldCut:r.cut70,...match});}
const priorLinks=require('../modules/admission-2028/scripts/link-baseline.cjs').linkBaseline(data.records,baseline,{auditExisting:true}).links;
const reverse=new Map();for(const r of data.records){const link=priorLinks[r.id],s=national[r.id];if(!link||s.status!=='matched'||s.year!==2026)continue;for(const row of link.baselineRows)for(const slot of ['k1','k2','k3','j1','j2']){const b=baseline[row-1];if(track(b[slot+'n'])!==track(link.track)||Number(b[slot+'b'])!==link.cut70)continue;const k=row+'|'+slot;if(!reverse.has(k))reverse.set(k,[]);reverse.get(k).push(s)}}
for(const [i,r] of baseline.entries()){
 base[i+1]={};for(const slot of ['k1','k2','k3','j1','j2'])if(r[slot+'n']){
  let match=lookup(key(r.u,r.m,r[slot+'n'],slot[0]==='k'?'교과':'종합',2026));
  if(match.status==='unmatched'){const options=reverse.get((i+1)+'|'+slot)||[];if(options.length&&new Set(options.map(s=>s.sourceIds.join(','))).size===1)match={...options[0],mapping:'existing-campus-major-track-link'};}
  base[i+1][slot]=match;ledger.push({dataset:'baseline',id:i+1,slot,uni:r.u,major:r.m,track:r[slot+'n'],old50:r[slot+'a'],old70:r[slot+'b'],oldMetric:r[slot+'metric']||'percentile',...match});
 }
}
for(const r of contracts.records){
 contract[r.id]=r.history.map(h=>{
  const category=/종합|미래인재|조기취업/.test(h.track)?'종합':/교과/.test(h.track)?'교과':'';
  let t=h.track.replace(/^학생부(?:교과|종합)\((.*)\)$/,'$1');
  if(r.uni==='가천대학교'&&h.year===2026&&t==='조기취업')t='조기취업형계약학과전형';
  if(category)return lookup(key(r.uni,r.major,t,category,h.year));
  const matches=['교과','종합'].map(c=>lookup(key(r.uni,r.major,t,c,h.year))).filter(x=>x.status==='matched');
  return matches.length===1?matches[0]:{status:matches.length?'ambiguous':'unmatched'};
 });
 r.history.forEach((h,i)=>ledger.push({dataset:'contracts',id:r.id,historyIndex:i,uni:r.uni,major:r.major,oldMetric:h.gradeMean!=null?'mean':'percentile',...contract[r.id][i]}));
}
for(const r of data.records){
 const link=priorLinks[r.id];if(national[r.id].status==='matched'||!link)continue;
 const options=link.baselineRows.flatMap(i=>Object.values(base[i]||{})).filter(s=>s.status==='matched'&&s.year===2026&&track(s.track)===track(link.track));
 if(options.length&&new Set(options.map(s=>s.sourceIds.join(','))).size===1){national[r.id]={...options[0],mapping:'existing-baseline-link'};const entry=ledger.find(x=>x.dataset==='nationwide'&&x.id===r.id);Object.assign(entry,national[r.id]);}
}
const compact=r=>{if(r.status!=='matched')return r;const {raw,...rest}=r;return rest};
const payload={reviewed:'2026-10-09',source:'https://cutoff.co.kr/susi.php',policy:'만점 또는 환산컷이 공개된 자료는 점수자료로 분리. 공개 등급컷은 참고로 보존하며 점수와 혼합 정렬/내신 비교하지 않음. 원문 미연결은 미확인. 다른 전형·연도로 빈값을 채우지 않음.',national:Object.fromEntries(Object.entries(national).map(([k,v])=>[k,compact(v)])),baseline:Object.fromEntries(Object.entries(base).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([s,m])=>[s,compact(m)]))])),contracts:Object.fromEntries(Object.entries(contract).map(([k,v])=>[k,v.map(compact)]))};
const counts={};for(const r of ledger){const k=r.dataset+':'+r.status;counts[k]=(counts[k]||0)+1}
const point=r=>r.status==='matched'&&(r.perfectScore>0||(!Number.isFinite(r.grade50)&&!Number.isFinite(r.grade70)&&[r.point50,r.point70].some(Number.isFinite)));
const pointCounts={};for(const r of ledger.filter(point)){const k=r.dataset;pointCounts[k]=(pointCounts[k]||0)+1}
const summary={campuses:manifest.length,sourceRows:current.length,sourceRows2026:current.filter(r=>r.year==='2026').length,counts,pointCounts};
const sourceLedger=current.map(r=>({sourceId:r.id,university:r.university,department:r.department,category:r.highschool_type,track:r.admission_type,year:Number(r.year),grade50:n(r.grade_50_cut),grade70:n(r.grade_70_cut),perfectScore:n(r.perfect_score),point50:n(r.convert_50_cut),point70:n(r.convert_70_cut),kind:[r.perfect_score,r.convert_50_cut,r.convert_70_cut].some(x=>n(x)!==null)?'points-separated':'grade-or-missing',flags:[...(n(r.grade_70_cut)!==null&&(n(r.grade_70_cut)<1||n(r.grade_70_cut)>9)?['grade-outside-1-9']:[]),...(n(r.perfect_score)!==null&&n(r.convert_70_cut)!==null&&n(r.convert_70_cut)>n(r.perfect_score)?['points-above-maximum']:[])]}));
for(const r of sourceLedger)r.kind=point({...r,status:'matched'})?'points-separated':'grade-or-missing';
summary.convertedFields2026=sourceLedger.filter(r=>r.year===2026&&[r.perfectScore,r.point50,r.point70].some(Number.isFinite)).length;
summary.pointRows2026=sourceLedger.filter(r=>r.year===2026&&r.kind==='points-separated').length;
summary.pointCampuses2026=new Set(sourceLedger.filter(r=>r.year===2026&&r.kind==='points-separated').map(r=>r.university)).size;
fs.writeFileSync(path.join(audit,'site-all-metrics-audit.json'),JSON.stringify({summary,rows:sourceLedger},null,2)+'\n');
payload.policy='만점이 공개된 자료 또는 등급컷 없이 환산컷만 있는 자료를 점수자료로 분리. 만점 미공개이고 등급컷이 있는 자료는 등급자료로 유지하고 환산컷은 별도 참고. 낮은 숫자만으로 오류를 추정하지 않음. 미연결은 기준 미확인.';
payload.reviewed='2026-10-10';
fs.writeFileSync(path.join(root,'data/cutoff-current.json'),JSON.stringify({...payload,summary},null,2)+'\n');
fs.writeFileSync(path.join(audit,'current-row-audit.json'),JSON.stringify({summary,ledger},null,2)+'\n');
console.log(JSON.stringify(summary,null,2));
