function isSeparateContract(d){
 if(typeof CONTRACT_IDENTITIES==='undefined')return false;
 return CONTRACT_IDENTITIES.some(c=>c.uni===d.uni&&c.major===d.major&&(!c.campus||c.campus===d.campus));
}
function regionalEligible(d,p){
 const rule=d.official?.regionalEligibility,r=p.regional;
 return d.type==='regional'&&rule?.schoolYears===3&&rule.additionalRequirements===false&&r?.enabled===true&&r.complete===true&&Array.isArray(r.provinces)&&r.provinces.length>0&&r.provinces.every(x=>rule.provinces.includes(x))&&rule.schoolTypes.includes(r.schoolType);
}
function matchedQualifications(d,p){
 if(d.type==='regional')return regionalEligible(d,p)?['regional']:[];
 const keys=d.official?.qualificationKeys||(d.type==='family'?['family']:d.type==='economic'?['single','basic','near']:[]);
 return keys.filter(k=>k==='family'?p.family==='yes'&&p.children>=d.count:k==='single'?p.single==='yes':p.economic.includes(k));
}
function qualify(d,p){if(p.browseMode==='all')return true;if(!d.official&&/지역(?!균형)|강원인재/.test(d.track||''))return false;return d.type==='general'||matchedQualifications(d,p).length>0}
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
function qualificationLabel(d,p){if(p.browseMode==='all'&&d.type!=='general')return '특별·별도 자격 확인 필요 · 적격 판정 아님';const names={family:'다자녀 '+d.count+'명 이상',single:'한부모 지원대상',basic:'기초생활수급',near:'차상위',regional:'고교 전과정 이수 지역'},keys=matchedQualifications(d,p);return keys.length?keys.map(k=>names[k]).join(' · ')+' 조건 연결':'일반 지원요건 확인'}
function rangeFromGrade(grade,delta){
 if(grade===''||delta===''||grade==null||delta==null)return {cutMin:null,cutMax:null};
 const g=Number(grade),d=Number(delta);
 if(!Number.isFinite(g)||g<1||g>9||!Number.isFinite(d)||d<0||d>8)return {cutMin:null,cutMax:null};
 return {cutMin:Math.max(1,Math.round((g-d)*100)/100),cutMax:Math.min(9,Math.round((g+d)*100)/100)}
}
function hasCutRange(p){return p.cutMin!=null||p.cutMax!=null}
function validCutRange(p){return [p.cutMin,p.cutMax].every(v=>v==null||(Number.isFinite(v)&&v>=1&&v<=9))&&(p.cutMin==null||p.cutMax==null||p.cutMin<=p.cutMax)}
function cutRangeMatch(d,p){if(!hasCutRange(p))return true;return validCutRange(p)&&Number.isFinite(historicalCut70(d))&&(p.cutMin==null||historicalCut70(d)>=p.cutMin)&&(p.cutMax==null||historicalCut70(d)<=p.cutMax)}
function locationMatches(regions,d){const provinces=d.regionCandidates||[d.region];return provinces.length>0&&provinces.every(province=>regionMatches(regions,province))}
function dataModeMatch(d,p){
 if(p.dataMode==='points'&&!pointSource2026(d))return false;
 if(p.dataMode==='grades'&&(pointSource2026(d)||!currentSource2026(d)||!Number.isFinite(rawCut2026(d))))return false;
 if(p.dataMode==='no-cut')return !!d.official&&!Number.isFinite(rawCut2026(d))&&!pointSource2026(d);
 if(p.dataMode==='with-cut'&&!Number.isFinite(rawCut2026(d))&&!pointSource2026(d))return false;
 return cutRangeMatch(d,p);
}
function minimumFilterMatch(d,p){return !p.minimumState||p.minimumState==='all'||evaluateMinimum(d,p).state===p.minimumState}
function candidates(p){return DATA.filter(d=>!d.legacyDisposition2028&&!/정시/.test(d.official?.admissionsSeason||'')&&!isSeparateContract(d)&&(!p.programQuery||[d.uni,d.major,d.track].join(' ').includes(p.programQuery.trim()))&&(!$('verifiedOnly').checked||!!d.official)&&interestMatch(d,p)&&qualify(d,p)&&dataModeMatch(d,p)&&minimumFilterMatch(d,p)&&(!p.excludeWomen||!isWomensUniversity(d))&&(!p.only||!p.regions.length||locationMatches(p.regions,d))&&(p.interview!=='no'||d.interview===false)).map(d=>({...d,preferred:p.regions.length>0&&locationMatches(p.regions,d),score:(d.official?20:0)+(d.type!=='general'?3:0)+(locationMatches(p.regions,d)?100:0)})).sort((a,b)=>b.score-a.score||historicalYear(b)-historicalYear(a)||a.uni.localeCompare(b.uni,'ko')||a.major.localeCompare(b.major,'ko')||a.track.localeCompare(b.track,'ko'))}
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
 return picked.sort((a,b)=>b.score-a.score||historicalYear(b)-historicalYear(a)||a.uni.localeCompare(b.uni,'ko'))
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
const showRatio=d=>Number.isFinite(d.application2027?.ratio)?d.application2027.ratio.toFixed(d.application2027.ratioPrecision??2)+':1':'-';
const recruitment2027=d=>Number.isInteger(d.application2027?.recruitment)?d.application2027.recruitment:null;
const recruitment2028=d=>Number.isInteger(d.official?.recruitment2028)?d.official.recruitment2028:null;
const countText=n=>n===null?'-':n+'명';
let resultSort={key:null,direction:1};
const resultColumns=[['uni','대학'],['major','학과'],['campus','캠퍼스'],['track','전형'],['cut2026','2026 70% 컷'],['recruitment2027','2027 모집'],['ratio2027','2027 경쟁률'],['recruitment2028','2028 모집계획']];
function currentSource2026(d){return d.cutoffCurrent?.status==='matched'&&d.cutoffCurrent.year===2026?d.cutoffCurrent:null}
function pointSource2026(d){const s=currentSource2026(d);return s&&(s.perfectScore>0||(!Number.isFinite(s.grade50)&&!Number.isFinite(s.grade70)&&[s.point50,s.point70].some(Number.isFinite)))?s:null}
function pointDisplay2026(d){const s=pointSource2026(d);return s?'환산 70% '+(s.point70??'미공개')+'점 / 만점 '+(s.perfectScore??'미공개'):'-'}
function rawCut2026(d){const s=currentSource2026(d);if(s)return s.grade70>=1&&s.grade70<=9?s.grade70:null;return Number.isFinite(d.baseline2026?.cut70)?d.baseline2026.cut70:d.year===2026&&d.metric==='등급'&&Number.isFinite(d.cut70)?d.cut70:null}
// Rules describe the 2026 result basis, never the current 2028 selection method.
// Preserve collected values; these exceptions must not enter the common grade range.
function cutBasis2026(d){
 if(rawCut2026(d)===null||d.category!=='학생부교과')return null;
 if(d.uni==='계명대학교'&&d.track==='지역전형'&&!['의예과','약학부'].includes(d.major))return {label:'진로선택 환산',note:'2026 지역전형(의예·약학 제외)은 진로선택 성취도를 환산해 반영했습니다. 일반 석차 내신 1등급과 같은 뜻이 아닙니다. 공통 내신 범위·수치 정렬에서 제외합니다.',url:'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2027&unvCd=0000068'};
 if(d.uni==='동국대학교'&&d.track==='학교장추천인재전형')return {label:'상위 10과목',note:'2026 학교장추천인재전형은 지정 교과의 석차등급 상위 10과목을 반영합니다. 전체 교과 평균으로 해석하지 마세요. 공통 내신 범위·수치 정렬에서 제외합니다.',url:'https://www.adiga.kr/ucp/uvt/uni/univDetailSelection.do?menuId=PCUVTINF2000&searchSyr=2026&unvCd=0000100'};
 return null;
}
function historicalCut70(d){return (d.cutoffCurrent&&!currentSource2026(d))||pointSource2026(d)||cutBasis2026(d)?null:rawCut2026(d)}
function historicalYear(d){return Number.isFinite(rawCut2026(d))?2026:null}
function cutDisplay2026(d){const value=rawCut2026(d),basis=cutBasis2026(d);if(pointSource2026(d))return pointDisplay2026(d)+' · 원문 등급컷 '+(value??'-')+' (참고)';return value===null?'-':value.toFixed(2)+(basis?' · '+basis.label:'')+(d.cutoffCurrent&&!currentSource2026(d)?' · 기준 미확인':'')}
function cut2026(d){return historicalCut70(d)}
function resultNumber(d,key){return key==='cut2026'?cut2026(d):key==='recruitment2027'?recruitment2027(d):key==='recruitment2028'?recruitment2028(d):Number.isFinite(d.application2027?.ratio)?d.application2027.ratio:null}
function campusLabel(d){return d.campus==='본교'&&d.region?'본교 ('+d.region+')':d.campus||'미확인'}
function sortResults(rows){if(!resultSort.key)return rows;if(['cut2026','recruitment2027','ratio2027','recruitment2028'].includes(resultSort.key))return [...rows].sort((a,b)=>{const av=resultNumber(a,resultSort.key),bv=resultNumber(b,resultSort.key);return av===null?(bv===null?0:1):bv===null?-1:resultSort.direction*(av-bv)||String(a.id).localeCompare(String(b.id))});const value=d=>resultSort.key==='campus'?campusLabel(d):String(d[resultSort.key]||'');return [...rows].sort((a,b)=>resultSort.direction*value(a).localeCompare(value(b),'ko',{numeric:true})||String(a.id).localeCompare(String(b.id)))}
function createResultsTable(){
 const grid=node('table','','result-grid');grid.id='admissionResultsTable';grid.dataset.component='admission-results-table';
 const caption=node('caption','대학·학과·캠퍼스·전형별 모집정보');caption.className='sr-only';grid.append(caption);
 const heading=node('thead',''),headerRow=node('tr','');heading.id='admissionResultsHeader';heading.dataset.component='result-column-headers';
 resultColumns.forEach(([key,label])=>{const th=node('th','');th.id='result-column-'+key;th.scope='col';th.dataset.component='sort-column-'+key;th.setAttribute('aria-sort',resultSort.key===key?(resultSort.direction===1?'ascending':'descending'):'none');const button=node('button',label+(resultSort.key===key?(resultSort.direction===1?' ↑':' ↓'):' ↕'));button.id='sort-'+key;button.type='button';button.dataset.sort=key;button.setAttribute('aria-label',label+' '+(resultSort.key===key&&resultSort.direction===1?'내림차순':'오름차순')+' 정렬');button.addEventListener('click',()=>{resultSort={key,direction:resultSort.key===key?-resultSort.direction:1};render();document.querySelector('[data-sort="'+key+'"]').focus({preventScroll:true})});th.append(button);headerRow.append(th)});
 for(const [key,label] of [['detail','상세'],['candidate','후보 담기']]){const th=node('th',label);th.id='result-column-'+key;th.scope='col';th.dataset.component=key+'-column';headerRow.append(th)}
 heading.append(headerRow);grid.append(heading);const resultBody=node('tbody','','result-body');resultBody.id='admissionResultsBody';grid.append(resultBody);return{grid,resultBody};
}
function createResultRow(d){
 const key=encodeURIComponent(d.id),row=node('tr','','result');row.id='result-row-'+key;row.dataset.resultId=d.id;row.dataset.component='admission-result-row';
 [d.uni,d.major,campusLabel(d),d.category+' · '+d.track].forEach((text,i)=>{const cell=node('td',text,i<2?'result-name':'');cell.id='result-'+key+'-'+resultColumns[i][0];cell.dataset.component='result-'+resultColumns[i][0];cell.setAttribute('headers','result-column-'+resultColumns[i][0]);row.append(cell)});
 const cut=rawCut2026(d),basis=cutBasis2026(d),cutCell=node('td',cut===null?'-':cut.toFixed(2),'history-cell');cutCell.setAttribute('headers','result-column-cut2026');cutCell.title=basis?basis.note:cut===null?(d.year===2025?'2025 입결만 연결되어 있습니다. 2026 동일 전형 입결은 미연결입니다.':'2026 동일 캠퍼스·학과·전형 입결 미연결'):(d.baseline2026?'2026 입결 현황 자료 연결 · ':'')+'2026학년도 입결 · 대학별 반영교과 차이 있음 · 2028 합격 예측값 아님';if(basis){cutCell.classList.add('separate-cut');cutCell.append(node('small',basis.label,'cut-basis'))}if(pointSource2026(d)){cutCell.textContent=pointDisplay2026(d);cutCell.append(node('small','원문 등급컷 '+(cut??'-')+' · 참고','cut-basis'));cutCell.title='환산점수 자료 · 공통 내신 범위·숫자 정렬 제외'}if(d.cutoffCurrent&&!currentSource2026(d)&&cut!==null)cutCell.append(node('small','기준 미확인','cut-basis'));row.append(cutCell);
 const detailRow=node('tr','','detail-row');detailRow.hidden=true;detailRow.id='detail-'+key;detailRow.dataset.component='admission-result-detail';
 for(const [column,value] of [['recruitment2027',countText(recruitment2027(d))],['ratio2027',showRatio(d)],['recruitment2028',countText(recruitment2028(d))]]){const cell=node('td',value,'history-cell');cell.setAttribute('headers','result-column-'+column);cell.title=column==='recruitment2028'?'2028학년도 시행계획 · 최종 모집요강에서 변경 가능':d.application2027?'2027학년도 수시 최종 마감 · '+d.application2027.track:'2027 동일 모집단위·전형 최종 자료 미연결';if(column==='ratio2027'&&d.application2027?.linkCategoryChanged)cell.append(node('small','전형 유형 변경','footnote'));row.append(cell)}
 const detailCell=node('td','');detailCell.colSpan=10;const disclosure=node('div','','candidate-disclosure');detailCell.append(disclosure);detailRow.append(detailCell);
 disclosure.append(node('span',d.official?'2028 시행계획 대조':'추가조사 필요',d.official?'tag':'tag warn'));
 const actions=node('td','','detail-cell'),detailButton=node('button','상세','detail-toggle');actions.setAttribute('headers','result-column-detail');detailButton.id='detail-toggle-'+key;detailButton.dataset.component='detail-button';detailButton.type='button';detailButton.setAttribute('aria-label',d.uni+' '+d.major+' '+d.track+' 상세');detailButton.setAttribute('aria-expanded','false');detailButton.setAttribute('aria-controls',detailRow.id);detailButton.addEventListener('click',()=>{detailRow.hidden=!detailRow.hidden;detailButton.setAttribute('aria-expanded',String(!detailRow.hidden));detailButton.textContent=detailRow.hidden?'상세':'닫기'});actions.append(detailButton);row.append(actions);
 const candidateCell=node('td','','candidate-cell');candidateCell.setAttribute('headers','result-column-candidate');row.append(candidateCell);
 return{row,detailRow,disclosure,candidateCell,key};
}
function render(page=0){
 if(!valid()){show(0);return}
 const p=read(),baseCandidates=candidates(p),all=p.browseMode==='all'?sortResults(baseCandidates):baseCandidates,offset=(typeof page==='number'?page:0)*30,groups=p.browseMode==='all'?[{label:'모집정보 · 지원자격 별도 확인',available:all.length,rows:all.slice(offset,offset+30)}]:candidateGroups(p,all),rows=groups.flatMap(g=>g.rows);
 $('results').replaceChildren();$('resultPager').replaceChildren();$('resultScroll').scrollTop=0;
 if(p.browseMode==='all'){
  const pager=node('div','','actions'),prev=node('button','이전 30개'),next=node('button','다음 30개');prev.type=next.type='button';prev.disabled=offset===0;next.disabled=offset+30>=all.length;prev.addEventListener('click',()=>render(page-1));next.addEventListener('click',()=>render(page+1));pager.append(prev,node('span',all.length?String(offset+1)+'~'+Math.min(offset+30,all.length)+' / '+all.length:'0개'),next);$('resultPager').append(pager);
  $('results').append(node('p','전체 모집정보는 특별자격 충족 여부로 제외하지 않습니다. 계약학과는 별도 계약학과 탭에서 탐색하세요.','notice'));
 }

 $('yearBasis').textContent='2026 입결 · 2027 수시 모집·최종 경쟁률 · 2028 시행계획 | 2027 연결 '+DATA_META.application2027.universities+'개 대학 · '+DATA_META.application2027.linked.toLocaleString()+'건 · 미연결 -';
 $('summary').textContent=(p.regions.length?p.regions.join(' · ')+(p.only?' 한정':' 우선'):'전국')+' · '+(p.fields.length===fields.length?'전체 계열':p.fields.join(' · '))+' · '+all.length+'건';
 $('coverage').textContent=(p.browseMode==='all'?'전체 모집정보는 30개씩 표시하며 지원자격 충족으로 해석하지 않습니다. ':'')+'선택한 지역의 후보를 먼저 채우고, 같은 지역 안에서 선택한 특별자격 유형, 2028 확인 여부와 대학 다양성을 고려합니다. 특별조건 만족 후보와 일반 후보는 각각 최대 10개씩 표시합니다. 같은 조건이면 최근 입결 학년도·대학/학과명 순입니다. 지정한 70% 컷 범위로 후보를 거릅니다. 컷·경쟁률은 합격 가능성 점수로 사용하지 않습니다. 면접 없는 전형만 선택하면 면접 여부 미검수 자료도 제외됩니다. 캠퍼스가 미확정이면 가능한 소재지가 모두 선택 권역 안에 있는 후보만 지역 조건에 포함합니다.';
 if(p.dataMode!=='no-cut'&&hasCutRange(p)){const before=candidates({...p,cutMin:null,cutMax:null}),missing=before.filter(d=>rawCut2026(d)===null).length,separate=before.filter(d=>rawCut2026(d)!==null&&!Number.isFinite(historicalCut70(d))).length,outside=before.filter(d=>Number.isFinite(historicalCut70(d))&&!cutRangeMatch(d,p)).length;$('results').append(node('p','입결 70% 컷 범위: '+(p.cutMin??1)+'~'+(p.cutMax??9)+'등급 (9등급제) · 범위 밖 '+outside+'개 / 별도 반영 '+separate+'개 / 입결 자료 없는 '+missing+'개 제외','cut-range-status'))}
 if(p.dataMode==='no-cut')$('results').append(node('p','입결 없는 공식 후보만 탐색 중입니다. 9등급제 입결 범위는 적용하지 않습니다. 입결이 없다는 이유만으로 신설 학과로 해석하지 않습니다.','cut-range-status'));
 const detailGrade=weightedGrade(p.gradeDetails);if(detailGrade.average!==null)$('results').append(node('p','세부 내신 (5등급제): 입력한 '+detailGrade.count+'과목의 학점 가중평균 '+detailGrade.average.toFixed(2)+'등급 · 대학별 환산성적 아님','footnote'));
 $('results').append(node('p','과거 입결 기준값 '+(p.grade9||'미입력')+' (9등급제)'+' · 모의고사 '+(p.exam.every(v=>v==null)?'미입력':examNames.map((n,i)=>n+' '+(p.exam[i]??'미입력')).join(' / '))+' · 선택과목 '+$('courseCount').textContent+'개','footnote'));
 if(p.family==='yes'||p.single==='yes'||p.economic.length||p.regional?.enabled){$('results').append(node('p',qualificationStatus(p,all,rows),'qualification-status'),node('p','특별자격은 캠퍼스·모집단위별 2028 공식 계획에서 확인한 조건만 연결합니다. 입결 범위를 지정하지 않으면, 입결이 없어도 확인된 모집단위를 표시합니다. 지원자격 확정은 고교 유형·증빙과 최종 모집요강 확인이 필요합니다.','footnote'))}
 p.customMajors.forEach(m=>$('results').append(node('p','직접 입력: '+m.name+' · 수록된 모집단위 이름에서 검색했습니다.','footnote')));
 if(!rows.length)$('results').append(node('p','현재 수록 범위에서 조건에 맞는 후보가 없습니다. 다른 지역의 대학이나 미수록 학과로 후보 수를 채우지 않습니다. 입결 범위·지역·면접·2028 확인 조건 또는 세부 분야를 조정해주세요.','empty'));
 else if(rows.length<4)$('results').append(node('p','현재 조건에서 '+rows.length+'개만 확인됩니다.','footnote'));
 const {grid,resultBody}=createResultsTable();$('results').append(grid);
 groups.forEach(group=>{
 if(p.browseMode!=='all'){const sectionRow=node('tr','','group-heading'),th=node('th',group.label+' · '+group.rows.length+'개');th.colSpan=10;th.scope='rowgroup';sectionRow.append(th);resultBody.append(sectionRow)}
 if(p.browseMode!=='all'&&group.rows.length<MAX_CANDIDATES)$('results').append(node('p',group.rows.length?'조건에 맞는 후보가 '+group.rows.length+'개여서 해당 후보만 표시합니다.':'현재 조건에 맞는 후보가 없습니다.','footnote'));
 sortResults(group.rows).forEach((d,i)=>{
  const {row:a,detailRow:detailRowElement,disclosure,candidateCell,key}=createResultRow(d);
  const table=node('table','','candidate-detail'),caption=node('caption',d.uni+' '+d.major+' 전형 상세');caption.className='sr-only';table.append(caption);const cols=node('colgroup','');[15,35,15,35].forEach(width=>{const col=node('col','');col.style.width=width+'%';cols.append(col)});table.append(cols);const body=node('tbody','');
  function detailRow(entries){const row=node('tr','');entries.forEach(([label,value])=>{const th=node('th',label);th.scope='row';const td=node('td',value);if(entries.length===1)td.colSpan=3;row.append(th,td)});body.append(row);return row}
  detailRow([['입결 학년도',historicalYear(d)==null?'자료 없음':historicalYear(d)+'학년도'],['2028 확인',d.official?'시행계획 대조 완료':'추가조사 필요']]);
  if(d.baseline2026)detailRow([['2026 입결 연결',d.baseline2026.source+' / '+d.baseline2026.university+' · '+d.baseline2026.major+' · '+d.baseline2026.track+' ('+d.baseline2026.category+') / 첫 탭 원본 '+d.baseline2026.baselineRows.join('·')+'번째 행']]);
  if(d.historyTrackLabels?.length)detailRow([['입결 원문 전형명',d.historyTrackLabels.join(' · ')+' (표기 차이 대조)']]);
  if(d.historyUniversityLabels?.length)detailRow([['입결 당시 대학명',d.historyUniversityLabels.join(' · ')+' (공식 대학 통합 대조)']]);
  if(d.historyMajorLabels?.length)detailRow([['입결 원문 모집단위',d.historyMajorLabels.join(' · ')+' (표기 차이 대조)']]);
  detailRow([['입결의 출신 고교','미공개·미확인 · 지원자격으로 출신 고교 유형을 추정하지 않음']]);
  detailRow([['2026 70% 컷',cutDisplay2026(d)],['2027 최종 경쟁률',showRatio(d)]]);
  const cs=currentSource2026(d);if(cs){const cr=detailRow([['2026 입결 지표','등급컷 50% '+(cs.grade50??'-')+' / 70% '+(cs.grade70??'-')+' · 환산컷 50% '+(cs.point50??'-')+' / 70% '+(cs.point70??'-')+' · 만점 '+(cs.perfectScore??'미공개')+' · '+(pointSource2026(d)?'점수자료: 공통 내신 범위·숫자 정렬 제외':'등급자료')]]);cr.querySelector('td').append(link(' cutoff 현재 원문',cs.source));}
  const basis=cutBasis2026(d);if(basis){const basisRow=detailRow([['입결 반영 기준',basis.note]]);basisRow.querySelector('td').append(link(' 2026 반영방법 근거',basis.url));}
  detailRow([['2027 수시 모집인원',countText(recruitment2027(d))],['2028 모집예정 인원',countText(recruitment2028(d))+' (시행계획)']]);
  if(d.application2027){const h=d.application2027,source=detailRow([['2027 지원현황',h.track+' · 모집 '+h.recruitment+'명 / 지원 '+h.applicants+'명 · 확인 '+h.reviewed]]),cell=source.querySelector('td');cell.append(link(' 최종 마감 원문',h.source));if(h.aggregation)cell.append(node('div','기업별 모집·지원인원 합산 · 경쟁률 = 총 지원인원 ÷ 총 모집인원'));if(h.linkNote){cell.append(node('div',h.linkNote));cell.append(link(' 전형명 대응 근거 (PDF '+h.linkEvidencePage+'쪽)',h.linkEvidence))}if(h.linkMajorNote){cell.append(node('div','원문 모집단위: '+h.major+' · '+h.linkMajorNote))}if(h.linkCampusNote){cell.append(node('div','2027 확인 캠퍼스: '+h.linkCampus2027+' · '+h.linkCampusNote));cell.append(link(' 캠퍼스 확인 근거 (PDF '+h.linkCampusEvidencePage+'쪽)',h.linkCampusEvidence))}}
  detailRow([['관심 분야',d.details.filter(x=>p.details.includes(x)).join(' · ')||d.field],['지원자격 연결',qualificationLabel(d,p)]]);
  detailRow([['면접',d.interview===null?'미검수':d.interview?'있음':'없음'],['수능최저',minimum(d,p)]]);
  detailRow([['2028 전형방법',d.official?d.official.method:'추가조사 필요 · 현재 모집 여부와 전형방법 미확정']]);
  detailRow([['지원 전 확인',d.official?d.official.eligibility+' · 최종 모집요강 확인':'과거 입결 참고용 · 2028 모집단위·전형 유지 여부 및 지원자격 추가조사 필요']]);
  if(d.official?.assessment){const assessment=detailRow([['서류 평가요소',d.official.assessment]]);assessment.querySelector('td').append(link(' 평가요소 원문 (11쪽)',d.official.assessmentSource.url+'#page=11'))}
  if(d.universityPlan){const context=detailRow([['대학 공통 변경사항',d.universityPlan.note]]);context.querySelector('td').append(link(' 2028 변경사항 원문',d.universityPlan.url))}
  if(d.unitStatus2028)detailRow([['모집단위 변경',d.unitStatus2028.label+' · '+d.unitStatus2028.note]]);
  if(rawCut2026(d)===null)detailRow([['과거 입결','2026 동일 모집단위·전형 70% 컷 미연결 · 다른 연도나 전형 값으로 대체하지 않음']]);
  const sourceRow=detailRow([['공식 근거',d.official?'':'2028 공식 자료 미확인']]);
  if(d.official)appendOfficialSource(sourceRow.querySelector('td'),d);
  table.append(body);disclosure.append(table);
  const pickButton=node('button','');pickButton.type='button';pickButton.dataset.pickId=d.id;pickButton.id='candidate-pick-'+key;pickButton.dataset.component='candidate-button';pickButton.addEventListener('click',()=>toggleCandidate(d.id));candidateCell.append(pickButton);
  if(d.uni==='경희대학교'&&d.track==='네오르네상스전형')disclosure.append(node('p','2028 네오르네상스전형은 면접형·서류형으로 분리되었습니다. 과거 통합 전형의 입결을 어느 한 유형에 옮기지 않았습니다.'));
  if(d.uni==='아주대학교'&&d.track==='ACE전형')disclosure.append(node('p','2028 ACE전형은 면접형·서류형으로 개편되어 과거 ACE 수치를 어느 한 유형의 입결로 옮기지 않았습니다.'));
  if(d.uni==='건국대학교'&&d.sourceRegion==='충북'&&d.track==='Cogito자기추천전형')disclosure.append(node('p','2028 Cogito 전형은 면접형·서류형으로 분리되었습니다. 과거 수치를 어느 한 유형의 입결로 옮기지 않았습니다.'));
  resultBody.append(a,detailRowElement);
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
  const row=node('tr',''),identity=node('th','');identity.scope='row';identity.append(node('strong',d.uni+' · '+d.major),node('div',d.campus+' / '+d.category+' · '+d.track),node('div',currentCandidateIds.has(d.id)?'현재 탐색 조건 일치':'현재 탐색 조건 밖 · 담은 후보 유지','source-meta'));
  const figures=node('td','');figures.append(node('div','2026 70% 컷: '+cutDisplay2026(d)),node('div','2027 수시 모집: '+countText(recruitment2027(d))),node('div','2027 최종 경쟁률: '+showRatio(d)),node('div','2028 모집계획: '+countText(recruitment2028(d))));const basis=cutBasis2026(d);if(basis)figures.append(node('div',basis.note,'source-meta'));if(d.application2027)figures.append(link('2027 최종 마감 원문',d.application2027.source));
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
 document.querySelectorAll('[data-pick-id]').forEach(button=>{const picked=pickedCandidates.has(button.dataset.pickId);button.textContent=picked?'후보 제외':'후보 담기';button.setAttribute('aria-pressed',String(picked));const record=DATA.find(d=>d.id===button.dataset.pickId);if(record)button.setAttribute('aria-label',record.uni+' '+record.major+' '+record.track+' '+(picked?'후보 제외':'후보 담기'))});
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
