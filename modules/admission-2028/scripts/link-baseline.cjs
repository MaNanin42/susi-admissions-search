// Join only the same campus, major and admission category/track.
// The NAVI guidebook p.8 explicitly identifies its results as the 2026 cycle.
const norm=value=>String(value||'').normalize('NFKC').replace(/[\s·ㆍ・,\[\]{}]/g,'').toLowerCase();
const uni=value=>norm(String(value||'').replace(/대학교/g,'대'));
const track=value=>norm(value).replace(/전형$/,'');
const regionGroups={서울:'서울',경기:'경인권',인천:'경인권',강원:'강원권',부산:'경상권',울산:'경상권',대구:'경상권',경북:'경상권',경남:'경상권',전북:'전라권',전남:'전라권',광주:'전라권',충북:'충청권',충남:'충청권',대전:'충청권',세종:'충청권',제주:'제주권'};
const grade=value=>/^\d+(?:\.\d+)?$/.test(String(value??''))&&Number(value)>=1&&Number(value)<=9?Number(value):null;
const has2026=r=>r.year===2026&&r.metric==='등급'&&Number.isFinite(r.cut70);
function campusMatches(r,b){
 if(!(r.regionCandidates||[]).some(region=>regionGroups[region]===b.r))return false;
 // The same province contains separate campuses; province alone is insufficient.
 if(b.u==='강원대')return r.campus==='춘천'||(r.campus==='본교'&&/강원대학교\//.test(r.sourceFile||''));
 if(b.u==='경북대')return /대구/.test(r.campus)||r.campus==='본교'&&/경북대학교\//.test(r.sourceFile||'');
 return true;
}
function linkBaseline(records,baseline,{auditExisting=false}={}){
 const index=new Map(),links={},stats={linked:0,ambiguous:0,already2026:0};
 baseline.forEach((row,i)=>{for(const slot of ['k1','k2','k3','j1','j2']){
  if(!row[slot+'n']||row[slot+'metric']==='donggukOfficial')continue; // mean/minimum != percentile cut
  const cut=grade(row[slot+'b']);if(cut===null)continue;
  const key=[uni(row.u),norm(row.m),track(row[slot+'n']),slot[0]==='k'?'학생부교과':'학생부종합'].join('|');
  if(!index.has(key))index.set(key,[]);index.get(key).push({row,slot,cut,rowIndex:i});
 }});
 for(const r of records){
  if(r.legacyDisposition2028)continue;
  if(has2026(r)){stats.already2026++;if(!auditExisting)continue;}
  const keys=new Set();for(const m of [r.major,...r.historyMajorLabels||[]])for(const t of [r.track,...r.historyTrackLabels||[]])keys.add([uni(r.uni),norm(m),track(t),r.category].join('|'));
  const matches=[...keys].flatMap(k=>index.get(k)||[]).filter(x=>campusMatches(r,x.row));
  if(!matches.length)continue;
  if(new Set(matches.map(x=>x.cut)).size!==1){stats.ambiguous++;continue;}
  const m=matches[0];links[r.id]={year:2026,cut70:m.cut,cut50:grade(m.row[m.slot+'a']),metric:'등급',source:'2026 입결 현황 · 경기도교육청 2027 수시NAVI',baselineRows:[...new Set(matches.map(x=>x.rowIndex+1))],university:m.row.u,major:m.row.m,track:m.row[m.slot+'n'],category:r.category,region:m.row.r,reviewed:'2026-10-09',sourceYearEvidence:'2027 수시NAVI 가이드북 PDF 8쪽: 입시 결과의 기준은 2026 대입 결과'};stats.linked++;
 }
 return {links,stats};
}
module.exports={linkBaseline,campusMatches};
