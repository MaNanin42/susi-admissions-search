function regionalEligible(d,p){
 const rule=d.official?.regionalEligibility,r=p.regional;
 return d.type==='regional'&&rule?.schoolYears===3&&rule.additionalRequirements===false&&r?.enabled===true&&r.complete===true&&Array.isArray(r.provinces)&&r.provinces.length>0&&r.provinces.every(x=>rule.provinces.includes(x))&&rule.schoolTypes.includes(r.schoolType);
}
function matchedQualifications(d,p){
 if(d.type==='regional')return regionalEligible(d,p)?['regional']:[];
 const keys=d.official?.qualificationKeys||(d.type==='family'?['family']:d.type==='economic'?['single','basic','near']:[]);
 return keys.filter(k=>k==='family'?p.family==='yes'&&p.children>=d.count:k==='single'?p.single==='yes':p.economic.includes(k));
}
function qualify(d,p){if(!d.official&&/지역(?!균형)|강원인재/.test(d.track||''))return false;return d.type==='general'||matchedQualifications(d,p).length>0}
function qualificationGroup(d,p,type){const keys=matchedQualifications(d,p);return type==='economic'?keys.some(k=>['single','basic','near'].includes(k)):type==='aid'?keys.some(k=>['basic','near'].includes(k)):keys.includes(type)}
function minimum(d,p){return evaluateMinimum(d,p).text}
function minimumVerdict(state,text){return {state,text}}
function evaluateMinimum(d,p){
 if(!d.official)return minimumVerdict('pending','2028 기준 미검수');
 if(!d.minimum)return minimumVerdict('pending',d.official.minimumText+' · 자동 판정 보류');
 if(d.minimum.kind==='none')return minimumVerdict('none','수능최저 없음');
 if(!p.exam.slice(0,5).every(v=>Number.isInteger(v)&&v>=1&&v<=9))return minimumVerdict('pending',d.official.minimumText+' · 판정 보류 (국어·수학·영어·통합사회·통합과학 등급 입력 필요)');
 if(d.minimum.kind==='bestN'){
  if((d.minimum.historyMax||d.minimum.historyRequired)&&!(Number.isInteger(p.exam[5])&&p.exam[5]>=1&&p.exam[5]<=9))return minimumVerdict('pending',d.official.minimumText+' · 판정 보류 (한국사 등급 입력 필요)');
  const required=d.minimum.requiredAreas||[];
  const grades=d.minimum.areas.filter(i=>!required.includes(i)).map(i=>p.exam[i]).sort((a,b)=>a-b);
  const selected=required.map(i=>p.exam[i]).concat(grades.slice(0,d.minimum.count-required.length));
  const total=selected.reduce((a,b)=>a+b,0);
  const pass=total<=d.minimum.sum&&(!d.minimum.selectedMax||selected.every(v=>v<=d.minimum.selectedMax))&&(!d.minimum.historyMax||p.exam[5]<=d.minimum.historyMax);
  return minimumVerdict(pass?'pass':'fail',d.official.minimumText+' · 입력 기준 '+(pass?'충족':'미충족'));
 }
 if((d.minimum.historyRequired||d.minimum.historyMax)&&!(Number.isInteger(p.exam[5])&&p.exam[5]>=1&&p.exam[5]<=9))return minimumVerdict('pending',d.official.minimumText+' · 판정 보류 (한국사 등급 입력 필요)');
 let inquiry=d.minimum.inquiry==='average'?(p.exam[3]+p.exam[4])/2:Math.min(p.exam[3],p.exam[4]);
 if(d.minimum.inquiryRounding==='floor')inquiry=Math.floor(inquiry);
 if(d.minimum.inquiryRounding==='round')inquiry=Math.round(inquiry);
 if(d.minimum.inquiryRounding==='ceil')inquiry=Math.ceil(inquiry);
 const english=d.minimum.englishTop2As1&&p.exam[2]<=2?1:p.exam[2];
 const v=[p.exam[0],p.exam[1],english,inquiry],count=d.minimum.count||2,required=d.minimum.requiredAreas||[];
 const total=required.reduce((s,i)=>s+v[i],0)+v.filter((_,i)=>(d.minimum.areas||[0,1,2,3]).includes(i)&&!required.includes(i)).sort((a,b)=>a-b).slice(0,count-required.length).reduce((a,b)=>a+b,0);
 const pass=total<=d.minimum.sum&&(!d.minimum.historyMax||p.exam[5]<=d.minimum.historyMax);
 return minimumVerdict(pass?'pass':'fail',d.official.minimumText+' · 입력 기준 '+(pass?'충족':'미충족'));
}
function interestMatch(d,p){
 if(!p.fields.includes(d.field))return false;
 const selected=p.details.filter(x=>(TAXONOMY[d.field]||[]).includes(x));
 if(!selected.length)return true;
 if(selected.some(x=>d.details.includes(x)))return true;
 const normalize=s=>s.replace(/\s/g,'').toLowerCase();
 return selected.some(isOther)&&p.customMajors.some(m=>m.group===d.field&&normalize(d.major).includes(normalize(m.name)));
}
function isWomensUniversity(d){return d.womenOnly===true||/여자대학교|여자대학|여대$/.test(d.uni)}
function qualificationLabel(d,p){const names={family:'다자녀 '+d.count+'명 이상',single:'한부모 지원대상',basic:'기초생활수급',near:'차상위',regional:'고교 전과정 이수 지역'},keys=matchedQualifications(d,p);return keys.length?keys.map(k=>names[k]).join(' · ')+' 조건 연결':'일반 지원요건 확인'}
function rangeFromGrade(grade,delta){
 if(grade===''||delta===''||grade==null||delta==null)return {cutMin:null,cutMax:null};
 const g=Number(grade),d=Number(delta);
 if(!Number.isFinite(g)||g<1||g>9||!Number.isFinite(d)||d<0||d>8)return {cutMin:null,cutMax:null};
 return {cutMin:Math.max(1,Math.round((g-d)*100)/100),cutMax:Math.min(9,Math.round((g+d)*100)/100)}
}
function hasCutRange(p){return p.cutMin!=null||p.cutMax!=null}
function validCutRange(p){return [p.cutMin,p.cutMax].every(v=>v==null||(Number.isFinite(v)&&v>=1&&v<=9))&&(p.cutMin==null||p.cutMax==null||p.cutMin<=p.cutMax)}
function cutRangeMatch(d,p){if(!hasCutRange(p))return true;return validCutRange(p)&&Number.isFinite(d.cut70)&&(p.cutMin==null||d.cut70>=p.cutMin)&&(p.cutMax==null||d.cut70<=p.cutMax)}
function locationMatches(regions,d){const provinces=d.regionCandidates||[d.region];return provinces.length>0&&provinces.every(province=>regionMatches(regions,province))}
function dataModeMatch(d,p){
 if(p.dataMode==='no-cut')return !!d.official&&!Number.isFinite(d.cut70);
 if(p.dataMode==='with-cut'&&!Number.isFinite(d.cut70))return false;
 return cutRangeMatch(d,p);
}
function minimumFilterMatch(d,p){return !p.minimumState||p.minimumState==='all'||evaluateMinimum(d,p).state===p.minimumState}
function candidates(p){return DATA.filter(d=>!d.legacyDisposition2028&&(!$('verifiedOnly').checked||!!d.official)&&interestMatch(d,p)&&qualify(d,p)&&dataModeMatch(d,p)&&minimumFilterMatch(d,p)&&(!p.excludeWomen||!isWomensUniversity(d))&&(!p.only||!p.regions.length||locationMatches(p.regions,d))&&(p.interview!=='no'||d.interview===false)).map(d=>({...d,preferred:p.regions.length>0&&locationMatches(p.regions,d),score:(d.official?20:0)+(d.type!=='general'?3:0)+(locationMatches(p.regions,d)?100:0)})).sort((a,b)=>b.score-a.score||b.year-a.year||a.uni.localeCompare(b.uni,'ko')||a.major.localeCompare(b.major,'ko')||a.track.localeCompare(b.track,'ko'))}
const MAX_CANDIDATES=10;
function rank(p,all=candidates(p)){
 const seen=new Set(),picked=[];
 function take(d){if(d&&!picked.some(x=>x.id===d.id)){picked.push(d);seen.add(d.uni)}}
 // Fill the preferred region before other regions, retaining special types within each pool.
 const pools=p.regions.length&&!p.only?[all.filter(d=>d.preferred),all.filter(d=>!d.preferred)]:[all];
 for(const pool of pools){
  for(const type of ['family','economic','regional'])if(picked.length<MAX_CANDIDATES&&!picked.some(d=>qualificationGroup(d,p,type)))take(pool.find(d=>qualificationGroup(d,p,type)));
  for(const d of pool){if(picked.length>=MAX_CANDIDATES)break;if(!seen.has(d.uni))take(d)}
  for(const d of pool){if(picked.length>=MAX_CANDIDATES)break;take(d)}
 }
 return picked.sort((a,b)=>b.score-a.score||b.year-a.year||a.uni.localeCompare(b.uni,'ko'))
}
function candidateGroups(p,all=candidates(p)){
 const special=all.filter(d=>matchedQualifications(d,p).length>0),general=all.filter(d=>matchedQualifications(d,p).length===0);
 const groups=[];
 if(p.family==='yes'||p.single==='yes'||p.economic.length||p.regional?.enabled)groups.push({label:'특별조건 만족 후보',available:special.length,rows:rank(p,special)});
 groups.push({label:'일반 후보 (특별조건 적용 없음)',available:general.length,rows:rank(p,general)});
 return groups;
}
function qualificationStatus(p,all,rows){
 const items=[];
 for(const [active,type,label] of [[p.family==='yes','family','다자녀'],[p.single==='yes','single','한부모 지원대상'],[p.economic.length>0,'aid','경제적 배려'],[p.regional?.enabled,'regional','지역인재']]){
  if(!active)continue;
  const count=all.filter(d=>qualificationGroup(d,p,type)).length,shown=rows.filter(d=>qualificationGroup(d,p,type)).length;
  let reason=count?count+'개 조건 연결 · 표시 '+shown+'개':'현재 관심 분야·지역·면접·입결 범위에 맞는 검수된 전형 없음';
  if(type==='regional'&&!count)reason+=' · 고교 유형·전과정 이수 확인·모든 이수 지역 및 대학별 추가요건을 확인해주세요';
  if(type==='family'&&!count)reason+=' · 입력한 본인 포함 '+p.children+'명 기준 (대학별 2·3·4자녀 요건 구분)';
  items.push(label+': '+reason);
 }
 return items.join(' / ')
}
function link(label,url){const a=node('a',label);a.href=url;a.target='_blank';a.rel='noreferrer noopener';return a}
const showNumber=n=>n===null?'미공개':String(n);
const showRatio=d=>d.competition===null?'자료 없음':String(d.competition)+':1';
function render(){
 if(!valid()){show(0);return}
 const p=read(),all=candidates(p),groups=candidateGroups(p,all),rows=groups.flatMap(g=>g.rows);
 $('results').replaceChildren();
 $('summary').textContent=(p.regions.length?p.regions.join(' · ')+(p.only?' 한정':' 우선'):'전국')+' · '+p.fields.join(' · ')+' / 조건에 맞는 '+all.length+'개 조합 중 '+rows.length+'개 비교 후보';
 $('coverage').textContent='선택한 지역의 후보를 먼저 채우고, 같은 지역 안에서 선택한 특별자격 유형, 2028 확인 여부와 대학 다양성을 고려합니다. 특별조건 만족 후보와 일반 후보는 각각 최대 10개씩 표시합니다. 같은 조건이면 최근 입결 학년도·대학/학과명 순입니다. 지정한 70% 컷 범위로 후보를 거릅니다. 컷·경쟁률은 합격 가능성 점수로 사용하지 않습니다. 면접 없는 전형만 선택하면 면접 여부 미검수 자료도 제외됩니다. 캠퍼스가 미확정이면 가능한 소재지가 모두 선택 권역 안에 있는 후보만 지역 조건에 포함합니다.';
 if(p.dataMode!=='no-cut'&&hasCutRange(p)){const before=candidates({...p,cutMin:null,cutMax:null}),missing=before.filter(d=>!Number.isFinite(d.cut70)).length,outside=before.filter(d=>Number.isFinite(d.cut70)&&!cutRangeMatch(d,p)).length;$('results').append(node('p','입결 70% 컷 범위: '+(p.cutMin??1)+'~'+(p.cutMax??9)+'등급 (9등급제) · 범위 밖 '+outside+'개 / 입결 자료 없는 '+missing+'개 제외','cut-range-status'))}
 if(p.dataMode==='no-cut')$('results').append(node('p','입결 없는 공식 후보만 탐색 중입니다. 9등급제 입결 범위는 적용하지 않습니다. 입결이 없다는 이유만으로 신설 학과로 해석하지 않습니다.','cut-range-status'));
 const detailGrade=weightedGrade(p.gradeDetails);if(detailGrade.average!==null)$('results').append(node('p','세부 내신 (5등급제): 입력한 '+detailGrade.count+'과목의 학점 가중평균 '+detailGrade.average.toFixed(2)+'등급 · 대학별 환산성적 아님','footnote'));
 $('results').append(node('p','내신 평균 '+(p.grade9||'미입력')+' (9등급제)'+' · 모의고사 '+(p.exam.every(v=>v==null)?'미입력':examNames.map((n,i)=>n+' '+(p.exam[i]??'미입력')).join(' / '))+' · 선택과목 '+$('courseCount').textContent+'개','footnote'));
 if(p.family==='yes'||p.single==='yes'||p.economic.length||p.regional?.enabled){$('results').append(node('p',qualificationStatus(p,all,rows),'qualification-status'),node('p','특별자격은 캠퍼스·모집단위별 2028 공식 계획에서 확인한 조건만 연결합니다. 입결 범위를 지정하지 않으면, 입결이 없어도 확인된 모집단위를 표시합니다. 지원자격 확정은 고교 유형·증빙과 최종 모집요강 확인이 필요합니다.','footnote'))}
 p.customMajors.forEach(m=>$('results').append(node('p','직접 입력: '+m.name+' · 수록된 모집단위 이름에서 검색했습니다.','footnote')));
 if(!rows.length)$('results').append(node('p','현재 수록 범위에서 조건에 맞는 후보가 없습니다. 다른 지역의 대학이나 미수록 학과로 후보 수를 채우지 않습니다. 입결 범위·지역·면접·2028 확인 조건 또는 세부 분야를 조정해주세요.','empty'));
 else if(rows.length<4)$('results').append(node('p','현재 조건에서 '+rows.length+'개만 확인됩니다.','footnote'));
 groups.forEach(group=>{
 $('results').append(node('h3',group.label+' · '+group.rows.length+'개 / 조건 일치 '+group.available+'개','candidate-group-title'));
 if(group.rows.length<MAX_CANDIDATES)$('results').append(node('p',group.rows.length?'조건에 맞는 후보가 '+group.rows.length+'개여서 해당 후보만 표시합니다.':'현재 조건에 맞는 후보가 없습니다.','footnote'));
 group.rows.forEach((d,i)=>{
  const a=node('article','','result'),disclosure=node('details','','candidate-disclosure'),h=node('summary','','result-head'),title=node('span','','candidate-title');h.append(node('span',String(i+1).padStart(2,'0'),'rank'));
  title.append(node('strong',d.uni+' : '+d.major,'candidate-name'),node('span',' / '+(d.campus==='본교'&&d.region?'본교('+d.region+')':d.campus)+' / '+d.track+(d.unitStatus2028?' / '+d.unitStatus2028.label:''),'candidate-meta'));h.append(title,node('span',d.official?'2028 시행계획 대조':'추가조사 필요',d.official?'tag':'tag warn'));disclosure.append(h);a.append(disclosure);
  const table=node('table','','candidate-detail'),caption=node('caption',d.uni+' '+d.major+' 전형 상세');caption.className='sr-only';table.append(caption);const cols=node('colgroup','');[15,35,15,35].forEach(width=>{const col=node('col','');col.style.width=width+'%';cols.append(col)});table.append(cols);const body=node('tbody','');
  function detailRow(entries){const row=node('tr','');entries.forEach(([label,value])=>{const th=node('th',label);th.scope='row';const td=node('td',value);if(entries.length===1)td.colSpan=3;row.append(th,td)});body.append(row);return row}
  detailRow([['입결 학년도',d.year===null?'자료 없음':d.year+'학년도'],['2028 확인',d.official?'시행계획 대조 완료':'추가조사 필요']]);
  if(d.historyTrackLabels?.length)detailRow([['입결 원문 전형명',d.historyTrackLabels.join(' · ')+' (표기 차이 대조)']]);
  if(d.historyUniversityLabels?.length)detailRow([['입결 당시 대학명',d.historyUniversityLabels.join(' · ')+' (공식 대학 통합 대조)']]);
  if(d.historyMajorLabels?.length)detailRow([['입결 원문 모집단위',d.historyMajorLabels.join(' · ')+' (표기 차이 대조)']]);
  detailRow([['70% 컷 (9등급제)',d.cut70===null?'자료 없음':showNumber(d.cut70)+'등급'],['경쟁률',showRatio(d)]]);
  detailRow([['2028 모집인원',Number.isInteger(d.official?.recruitment2028)?d.official.recruitment2028+'명 (시행계획)':'미확인'],[d.year?d.year+' 모집인원':'과거 모집인원',Number.isInteger(d.recruitment)?d.recruitment+'명 (입결 자료)':'자료 없음']]);
  detailRow([['관심 분야',d.details.filter(x=>p.details.includes(x)).join(' · ')||d.field],['지원자격 연결',qualificationLabel(d,p)]]);
  detailRow([['면접',d.interview===null?'미검수':d.interview?'있음':'없음'],['수능최저',minimum(d,p)]]);
  detailRow([['2028 전형방법',d.official?d.official.method:'추가조사 필요 · 현재 모집 여부와 전형방법 미확정']]);
  detailRow([['지원 전 확인',d.official?d.official.eligibility+' · 최종 모집요강 확인':'과거 입결 참고용 · 2028 모집단위·전형 유지 여부 및 지원자격 추가조사 필요']]);
  if(d.unitStatus2028)detailRow([['모집단위 변경',d.unitStatus2028.label+' · '+d.unitStatus2028.note]]);
  if(d.planOnly)detailRow([['과거 입결','이전 입결 없음 · 2028 시행계획으로 확인한 후보 · 다른 모집단위의 경쟁률·70% 컷으로 대체하지 않음']]);
  const sourceRow=detailRow([['공식 근거',d.official?'':'2028 공식 자료 미확인']]);
  if(d.official)appendOfficialSource(sourceRow.querySelector('td'),d);
  table.append(body);disclosure.append(table);
  const pickButton=node('button','');pickButton.type='button';pickButton.dataset.pickId=d.id;pickButton.addEventListener('click',()=>toggleCandidate(d.id));a.append(pickButton);
  if(d.uni==='경희대학교'&&d.track==='네오르네상스전형')disclosure.append(node('p','2028 네오르네상스전형은 면접형·서류형으로 분리되었습니다. 과거 통합 전형의 입결을 어느 한 유형에 옮기지 않았습니다.'));
  if(d.uni==='아주대학교'&&d.track==='ACE전형')disclosure.append(node('p','2028 ACE전형은 면접형·서류형으로 개편되어 과거 ACE 수치를 어느 한 유형의 입결로 옮기지 않았습니다.'));
  if(d.uni==='건국대학교'&&d.sourceRegion==='충북'&&d.track==='Cogito자기추천전형')disclosure.append(node('p','2028 Cogito 전형은 면접형·서류형으로 분리되었습니다. 과거 수치를 어느 한 유형의 입결로 옮기지 않았습니다.'));
  $('results').append(a);
 });
 });
 $('appliedFilters').textContent='입결 자료: '+({all:'전체', 'with-cut':'입결 있음','no-cut':'입결 없는 공식 후보'}[p.dataMode]||'전체')+' · 수능최저: '+minimumStateLabels[p.minimumState||'all'];
 currentProfile=p;currentCandidateIds=new Set(all.map(d=>d.id));renderPicked();show(2)
}

// Candidate selections and student criteria stay in the current page only.
const pickedCandidates=new Map();
let currentProfile=null,currentCandidateIds=new Set();
const minimumStateLabels={all:'전체',none:'최저 없음',pass:'입력 기준 충족',fail:'입력 기준 미충족',pending:'판정 보류'};
function officialSourceUrl(d){
 try{const url=new URL(d.official?.url);return ['https:','http:'].includes(url.protocol)?url.href:null}catch{return null}
}
function appendOfficialSource(container,d){
 const url=officialSourceUrl(d);
 if(url)container.append(link('공식 자료 열기',url));
 else container.append(node('span','공식 링크 확인 필요'));
 container.append(node('div','근거: '+(d.official.pages||'쪽수 미기재'),'source-meta'),node('div','검토일: '+(d.official.reviewed||'미기재'),'source-meta'));
}
function toggleCandidate(id){
 if(pickedCandidates.has(id))pickedCandidates.delete(id);
 else{const d=DATA.find(d=>d.id===id&&!d.legacyDisposition2028);if(d)pickedCandidates.set(id,d)}
 renderPicked();
}
function comparisonTable(printing=false){
 const table=node('table','','picked-table');table.append(node('caption','2028 상담 후보 비교 · '+pickedCandidates.size+'개'));
 const head=node('thead',''),headRow=node('tr','');
 for(const title of ['대학·모집단위 / 전형','입결·모집인원','면접·수능최저','전형방법·공식 근거',...(printing?[]:['관리'])]){const th=node('th',title);th.scope='col';headRow.append(th)}
 head.append(headRow);table.append(head);const body=node('tbody','');
 for(const d of pickedCandidates.values()){
  const row=node('tr',''),identity=node('th','');identity.scope='row';identity.append(node('strong',d.uni+' · '+d.major),node('div',d.campus+' / '+d.track),node('div',currentCandidateIds.has(d.id)?'현재 탐색 조건 일치':'현재 탐색 조건 밖 · 담은 후보 유지','source-meta'));
  const figures=node('td','');figures.append(node('div',(d.year?d.year+'학년도':'과거 입결')+' 70% 컷: '+(Number.isFinite(d.cut70)?d.cut70+'등급 (9등급제)':'자료 없음')),node('div','2028 모집인원: '+(Number.isInteger(d.official?.recruitment2028)?d.official.recruitment2028+'명':'미확인')));
  const exam=node('td','');exam.append(node('div','면접: '+(d.interview===null?'미검수':d.interview?'있음':'없음')),node('div',minimum(d,currentProfile)));
  const method=node('td','');method.append(node('div',d.official?.method||'2028 전형방법 미확인'));
  if(d.official)appendOfficialSource(method,d);else method.append(node('div','추가조사 필요 · 과거 입결 참고','source-meta'));
  row.append(identity,figures,exam,method);
  if(!printing){const cell=node('td',''),remove=node('button','제외');remove.type='button';remove.setAttribute('aria-label',d.uni+' '+d.major+' '+d.track+' 후보 제외');remove.addEventListener('click',()=>{toggleCandidate(d.id);$('pickedCount').focus()});cell.append(remove);row.append(cell)}
  body.append(row);
 }
 table.append(body);return table;
}
function renderPicked(){
 $('pickedCount').textContent='담은 후보 '+pickedCandidates.size+'개';
 $('comparePicked').disabled=!pickedCandidates.size;$('printPicked').disabled=!pickedCandidates.size;$('clearPicked').disabled=!pickedCandidates.size;
 $('pickedComparison').replaceChildren();
 if(pickedCandidates.size&&currentProfile)$('pickedComparison').append(comparisonTable());
 else $('pickedComparison').append(node('p','비교할 후보를 결과에서 담아주세요.','muted'));
 document.querySelectorAll('[data-pick-id]').forEach(button=>{const picked=pickedCandidates.has(button.dataset.pickId);button.textContent=picked?'담은 후보에서 제외':'상담 후보 담기';button.setAttribute('aria-pressed',String(picked))});
}
function preparePrint(){
 const sheet=$('printSheet');sheet.replaceChildren();
 if(!pickedCandidates.size||!currentProfile)return;
 sheet.append(node('h1','2028 대입 탐색 · 상담 후보 비교'),node('p','담은 후보 '+pickedCandidates.size+'개 · 수능최저는 마지막으로 적용한 입력 기준입니다. 지원자격·최종 모집요강을 별도로 확인하세요.'),comparisonTable(true),node('p','시행계획은 변경될 수 있습니다. 과거 9등급제 입결은 2028 합격 가능성이나 5등급제 환산성적이 아닙니다. 학생 이름·과목별 성적·가족 관련 입력은 이 상담지에 포함하지 않습니다.'));
}
function setupCounsel(){
$('comparePicked').addEventListener('click',()=>{$('pickedDetails').open=true;$('pickedDetails').scrollIntoView({block:'start'});$('pickedDetails').querySelector('summary').focus()});
$('clearPicked').addEventListener('click',()=>{pickedCandidates.clear();renderPicked();$('pickedCount').focus()});
$('printPicked').addEventListener('click',()=>{preparePrint();window.print()});
window.addEventListener('beforeprint',preparePrint);
window.addEventListener('afterprint',()=>$('printSheet').replaceChildren());
}
