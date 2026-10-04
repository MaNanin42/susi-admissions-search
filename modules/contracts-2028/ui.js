const $=id=>document.getElementById(id);
const selected=new Set();let activeRows=[],detailId=null,sortKey='uni',sortDirection=1;
const kinds={early:'조기취업형',employment:'기업 채용조건형',worker:'재직자 재교육형',reference:'2027 참고자료'};
const node=(tag,text,cls)=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e};
const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:null}catch{return null}};
function sourceLink(key){const s=DB.sources[key],url=safeUrl(s.url),wrap=node('div','');if(url){const a=node('a',s.title);a.href=url;a.target='_blank';a.rel='noopener noreferrer';wrap.append(a)}else wrap.append(node('span',s.title));wrap.append(node('small','근거: '+(Array.isArray(s.pages)?'PDF '+s.pages.join('·')+'쪽':s.pages)+' · 검토: '+s.reviewed),node('small',s.access));return wrap}
function readFilters(){return Object.fromEntries(['query','field','region','kind','work','evaluation','resultSchool'].map(k=>[k,$(k).value]).concat(['graduate','noMinimum','references','dorm'].map(k=>[k,$(k).checked])))}
function matches(r,p){
 const q=p.query.trim().toLocaleLowerCase();
 return (!q||[r.uni,r.major,r.partners,r.field].join(' ').toLocaleLowerCase().includes(q))
  &&(!p.field||r.field===p.field)&&(!p.region||r.region===p.region)&&(!p.kind||r.kind===p.kind)
  &&(p.references||r.status==='plan2028')&&(!p.graduate||r.graduateEligible===true)
  &&(p.work!=='no'||r.workStudy!==true)
  &&(p.evaluation!=='interview'||r.interviewWeight>=50)
  &&(p.evaluation!=='sincerity'||r.attendance.includes('성실성'))
  &&(!p.noMinimum||r.minimum==='none')
  &&(!p.resultSchool||r.schoolTypeEvidence===p.resultSchool);
}
function picked(){return DB.records.filter(r=>selected.has(r.id))}
function historyMetric(h){return Number.isFinite(h.cut70)?'70% 컷 '+h.cut70.toFixed(2)+'등급':Number.isFinite(h.gradeMean)?'평균 '+h.gradeMean.toFixed(2)+'등급':'-'}
function historyText(r){return r.history.length?r.history.map(h=>h.year+'학년도 '+h.track+' / '+historyMetric(h)+(Number.isFinite(h.cut50)?' · 50% 컷 '+h.cut50.toFixed(2)+'등급':'')+' (9등급제) / 고교 유형 미공개').join(' · '):'-'}
function historyCell(r){const cell=node('td','','history-cell');if(!r.history.length){cell.textContent='-';cell.title=r.historyCheck?.note||'연도·학과·전형까지 연결한 입결 자료 없음';return cell}for(const h of [...r.history].sort((a,b)=>b.year-a.year)){const item=node('div','','history-item');item.append(node('small',h.year+' · '+h.track));const url=safeUrl(h.source),value=node(url?'a':'strong',historyMetric(h));if(url){value.href=url;value.target='_blank';value.rel='noopener noreferrer';value.title=(h.sourceTitle||'기존 입결 수집 자료')+' · '+(h.sourceType==='official'?'대학 공식 자료':'공식 원문 재대조 전')}item.append(value);cell.append(item)}return cell}
function competitionText(h){return Number.isFinite(h.competitionRatio)?h.competitionRatio.toFixed(2)+':1':'-'}
function competitionCell(r){const cell=node('td','','competition-cell'),rows=r.history.filter(h=>Number.isFinite(h.competitionRatio));if(!rows.length){cell.textContent='-';return cell}for(const h of [...rows].sort((a,b)=>b.year-a.year)){const item=node('div','','history-item');item.append(node('small',h.year+' · '+h.track),node('strong',competitionText(h)));cell.append(item)}return cell}
function methodView(text){const wrap=node('span','','method-lines');String(text).split(/\s*→\s*/).forEach((part,i)=>{const line=node('span',part.trim());if(i)line.className='next-stage';wrap.append(line)});return wrap}
function button(label,fn){const b=node('button',label);b.type='button';b.addEventListener('click',fn);return b}
function table(rows,printing=false){
 const t=node('table',''),head=node('thead',''),hr=node('tr','');
 ['대학·모집단위','2028 전형·모집','과거 입결 (9등급제)','과거 경쟁률','계약조건·확인할 점',...(printing?[]:['관리'])].forEach(v=>hr.append(node('th',v)));head.append(hr);t.append(head);const body=node('tbody','');
 for(const r of rows){const tr=node('tr',''),name=node('th','');name.scope='row';name.append(node('div',r.uni),node('div',r.major),node('span',kinds[r.kind],'tag'),node('small',r.region));
  const exam=node('td','');exam.append(node('span',r.status==='plan2028'?'2028 시행계획 확인':'2028 모집 미확인','tag'+(r.status==='plan2028'?'':' warn')),methodView(r.method),node('p',r.quota==null?'학과별 인원 미확인':r.quota+'명'+(r.tracks?.length>1?' · 대표 전형 '+r.track:'')),node('small',r.minimum==='none'?'수능최저 없음':'수능최저 원문 확인'),node('small',r.quotaNote||''));
  const terms=node('td','');terms.append(node('p',r.eligibility),node('small',r.attendance));if(printing){terms.append(node('p',r.obligations));r.sourceIds.forEach(k=>terms.append(sourceLink(k)));if($('dorm').checked)terms.append(node('p',r.dormitory));}
  else{terms.append(button('상세·입결·근거',()=>showDetail(r.id)));if($('dorm').checked)terms.append(node('small','주거 확인: '+r.dormitory));}
  tr.append(name,exam,historyCell(r),competitionCell(r),terms);if(!printing){const manage=node('td',''),b=button(selected.has(r.id)?'후보 제외':'후보 담기',()=>toggle(r.id));b.dataset.pick=r.id;b.setAttribute('aria-pressed',String(selected.has(r.id)));manage.append(b);tr.append(manage)}body.append(tr);
 }t.append(body);return t;
}
// Historical sorts use the first displayed record of the latest available year.
function latestHistory(r,predicate){return [...r.history].filter(predicate).sort((a,b)=>b.year-a.year)[0]}
function sortValue(r,key){
 if(key==='kind')return kinds[r.kind];
 if(key==='minimum')return r.minimum==='none'?'없음':'원문 확인';
 if(key==='history'){const h=latestHistory(r,h=>Number.isFinite(h.cut70)||Number.isFinite(h.gradeMean));return h?(Number.isFinite(h.cut70)?h.cut70:h.gradeMean):null}
 if(key==='competition'){const h=latestHistory(r,h=>Number.isFinite(h.competitionRatio));return h?h.competitionRatio:null}
 if(key==='picked')return selected.has(r.id)?1:0;
 return r[key]??null;
}
function compareRows(a,b,key=sortKey,direction=sortDirection){
 const av=sortValue(a,key),bv=sortValue(b,key);if(av==null||bv==null){if(av==null&&bv!=null)return 1;if(av!=null&&bv==null)return -1}
 let order=0;
 if(av!=null&&bv!=null){
  if(key==='history'){const metric=r=>Number.isFinite(latestHistory(r,h=>Number.isFinite(h.cut70)||Number.isFinite(h.gradeMean))?.cut70)?0:1;const group=metric(a)-metric(b);if(group)return group}
  order=(typeof av==='number'?av-bv:String(av).localeCompare(String(bv),'ko',{numeric:true}))*direction;
 }
 return order||a.uni.localeCompare(b.uni,'ko')||a.major.localeCompare(b.major,'ko')||a.id.localeCompare(b.id);
}
function setSort(key){
 const opened=detailId,scrollLeft=$('results').querySelector('.table-wrap')?.scrollLeft||0;
 sortDirection=sortKey===key?-sortDirection:(key==='picked'?-1:1);sortKey=key;render();
 if(opened&&activeRows.some(r=>r.id===opened))showDetail(opened,false);
 const wrap=$('results').querySelector('.table-wrap');if(wrap)wrap.scrollLeft=scrollLeft;
 document.querySelector('[data-sort="'+key+'"]')?.focus({preventScroll:true});
}
function catalog(rows){
 const t=node('table','','catalog'),head=node('thead',''),tr=node('tr','');[['대학','uni'],['학과','major'],['유형','kind'],['지역','region'],['인원','quota'],['평가방법 (대표 전형)','method'],['수능최저','minimum'],['과거 입결','history'],['과거 경쟁률','competition'],['상세',null],['후보','picked']].forEach(([label,key])=>{const th=node('th','');th.scope='col';if(key){const active=sortKey===key,b=button('',()=>setSort(key));b.className='sort-button';b.dataset.sort=key;b.append(node('span',label));const arrow=node('span',active?(sortDirection===1?'▲':'▼'):'↕','sort-arrow');arrow.setAttribute('aria-hidden','true');b.append(arrow);const next=(active?sortDirection===1:key==='picked')?'내림차순':'오름차순';b.setAttribute('aria-label',label+' '+next+' 정렬');b.title=label+' 정렬'+(key==='history'?' · 최신 연도 첫 표시값 · 70% 컷과 평균은 별도 묶음':key==='competition'?' · 최신 연도 첫 표시값':key==='method'?' · 평가방법 문구순':'');th.setAttribute('aria-sort',active?(sortDirection===1?'ascending':'descending'):'none');th.append(b)}else th.textContent=label;tr.append(th)});head.append(tr);t.append(head);const body=node('tbody','');
 for(const r of rows){const row=node('tr','');row.dataset.rowId=r.id;const uni=node('td',r.uni),name=node('th',r.major);name.scope='row';if(r.status!=='plan2028')name.append(node('span','2028 미확인','tag warn'));const kind=node('td','');kind.append(node('span',kinds[r.kind],'tag '+r.kind));const method=node('td','');method.append(methodView(r.method));if(r.tracks?.length>1)method.append(node('small',r.track+' · 다른 전형은 상세'));const detail=node('td',''),open=button('펼치기',()=>{if(detailId===r.id&&!$('detail').hidden)closeDetail();else showDetail(r.id)});open.className='catalog-name';open.setAttribute('aria-label',r.uni+' '+r.major+' 상세 보기');open.setAttribute('aria-controls','detail');open.setAttribute('aria-expanded','false');detail.append(open);const cell=node('td',''),pick=button(selected.has(r.id)?'후보 제외':'+ 담기',()=>toggle(r.id));pick.dataset.pick=r.id;pick.setAttribute('aria-label',r.uni+' '+r.major+' 후보 담기');pick.setAttribute('aria-pressed',String(selected.has(r.id)));cell.append(pick);row.append(uni,name,kind,node('td',r.region),node('td',r.quota==null?'미확인':r.quota+'명'),method,node('td',r.minimum==='none'?'없음':'원문 확인'),historyCell(r),competitionCell(r),detail,cell);body.append(row)}t.append(body);return t;
}
function closeDetail(focus=true){
 const root=$('detail'),opener=document.querySelector('.catalog tr.is-selected .catalog-name');root.hidden=true;document.querySelector('.directory').append(root);document.querySelectorAll('.detail-row').forEach(row=>row.remove());document.querySelectorAll('[data-row-id]').forEach(row=>{row.classList.remove('is-selected');const b=row.querySelector('.catalog-name');b.textContent='펼치기';b.setAttribute('aria-expanded','false')});detailId=null;if(focus&&opener)opener.focus({preventScroll:true});
}
function showDetail(id,focus=true){
 const r=DB.records.find(x=>x.id===id);if(!r)return;closeDetail(false);detailId=id;const root=$('detail');root.hidden=false;root.replaceChildren();const selectedRow=[...document.querySelectorAll('[data-row-id]')].find(row=>row.dataset.rowId===id);if(selectedRow){const expanded=node('tr','','detail-row'),cell=node('td','');cell.colSpan=11;cell.append(root);expanded.append(cell);selectedRow.after(expanded);}
 const eyebrow=node('div','','detail-eyebrow');eyebrow.append(node('span',kinds[r.kind],'tag '+r.kind),node('span',r.status==='plan2028'?'2028 시행계획 확인':'2028 모집 미확인','tag'+(r.status==='plan2028'?'':' warn')));
 root.append(eyebrow,node('p',r.uni+' · '+r.region,'detail-university'),node('h2',r.major));
 const facts=node('div','','detail-facts');for(const [label,value] of [['모집인원',r.quota==null?'학과별 미확인':r.quota+'명'],['평가방법',r.method],['수능최저',r.minimum==='none'?'없음':'원문 확인']]){const fact=node('div','','fact');fact.append(node('small',label));const strong=node('strong','');if(label==='평가방법')strong.append(methodView(value));else strong.textContent=value;fact.append(strong);facts.append(fact)}root.append(facts);
 const rows=values=>{const dl=node('dl','');for(const [k,v] of values)dl.append(node('dt',k),node('dd',v));return dl};
 const admission=[['지원자격',r.eligibility],['성실성·출결',r.attendance]];if(r.quotaNote)admission.push(['모집인원 참고',r.quotaNote]);if(r.tracks)admission.push(['확인한 전형',r.tracks.map(t=>t.name+' '+t.quota+'명 / '+t.method).join(' | ')]);
 root.append(node('h3','지원 전에 확인할 내용'),rows(admission));
 const group=(title,values,open=false)=>{const d=node('details','','detail-group');d.open=open;d.append(node('summary',title),rows(values));root.append(d);return d};
 group('취업·장학·생활 조건',[['참여기업',r.partners],['장학·비용',r.support],['취업·의무조건',r.obligations],['기숙사·주거',r.dormitory]],$('dorm').checked);
 const history=group('과거 입결 · 출신 고교 정보',[['과거 입결',historyText(r)],['과거 경쟁률',r.history.filter(h=>Number.isFinite(h.competitionRatio)).map(h=>h.year+' '+h.track+' / '+competitionText(h)).join(' · ')||'-'],['입결 고교 유형','미공개·미확인. 성적 숫자나 지원자격으로 일반고·자사고·과고를 추정하지 않습니다.']]);
 for(const h of r.history){const url=safeUrl(h.source);if(url){const a=node('a',h.year+' '+h.track+' 입결 수집 출처');a.href=url;a.target='_blank';a.rel='noopener noreferrer';history.append(a,node('small',(h.sourceType==='official'?'대학 공식 자료':'기존 수집자료 · 공식 원문 재대조 전')+(h.sourceLocation?' · '+h.sourceLocation:'')),node('small',h.note||'과거 9등급제 성적이며 2028 합격 예측값이 아닙니다.'))}}
 if(r.historyCheck){history.append(node('small',r.historyCheck.note));const url=safeUrl(r.historyCheck.source);if(url){const a=node('a','입결 공개 범위 확인');a.href=url;a.target='_blank';a.rel='noopener noreferrer';history.append(a)}}
 const sources=group('자료 출처 · 확인 범위',[['자료 기준',r.status==='plan2028'?'2028 시행계획 · 최종 모집요강 확인':'2027 참고자료 · 계약조건도 2027 기준']]);const sourceBox=node('div','');r.sourceIds.forEach(k=>sourceBox.append(sourceLink(k)));if(r.legacyPages)sourceBox.append(node('small','기존 대교협 표 PDF '+r.legacyPages.join('·')+'쪽'));sources.append(sourceBox);
 const actions=node('div','','detail-actions'),pick=button(selected.has(r.id)?'후보 제외':'이 학과 후보 담기',()=>toggle(r.id));pick.dataset.pick=r.id;pick.dataset.detailPick='true';pick.className='primary';pick.setAttribute('aria-pressed',String(selected.has(r.id)));actions.append(pick,button('상세 닫기',()=>closeDetail()));root.append(actions,node('p','최종 모집요강과 기업별 채용·장학 조건을 함께 확인하세요.','notice'));
 document.querySelectorAll('[data-row-id]').forEach(row=>{const active=row.dataset.rowId===id;row.classList.toggle('is-selected',active);const b=row.querySelector('.catalog-name');b.setAttribute('aria-expanded',String(active));b.textContent=active?'접기':'펼치기'});root.scrollTop=0;if(focus){if(innerWidth<761)root.scrollIntoView({block:'start'});root.focus({preventScroll:true})}
}
function toggle(id){selected.has(id)?selected.delete(id):selected.add(id);renderSelection();}
function renderSelection(){const count=selected.size;$('pickedCount').textContent='담은 후보 '+count+'개';['compare','print','clear'].forEach(k=>$(k).disabled=!count);document.querySelectorAll('[data-pick]').forEach(b=>{const yes=selected.has(b.dataset.pick);b.textContent=yes?'후보 제외':(b.dataset.detailPick?'이 학과 후보 담기':'+ 담기');const r=DB.records.find(r=>r.id===b.dataset.pick);if(r)b.setAttribute('aria-label',r.uni+' '+r.major+(yes?' 후보 제외':' 후보 담기'));b.setAttribute('aria-pressed',String(yes))});if(!$('comparison').hidden)renderComparison();}
function renderComparison(){const box=$('comparison'),heading=node('div','','comparison-heading');heading.append(node('h2','담은 후보 비교'),button('비교 접기',()=>{box.hidden=true;$('compare').focus()}));box.replaceChildren(heading,node('p','필터를 바꾸어도 담은 후보는 유지됩니다.','meta'));if(!selected.size){box.append(node('p','아직 담은 후보가 없습니다. 학과 목록에서 후보를 담아보세요.','empty'));return}const wrap=node('div','','table-wrap');wrap.append(table(picked()));box.append(wrap);}
function render(){
 if(!$('grade5').checkValidity()){$('moreFilters').open=true;$('grade5').closest('details').open=true;$('error').textContent='5등급제 내신은 1~5 사이 숫자로 입력하세요.';$('grade5').focus();return}
 $('error').textContent='';const p=readFilters();activeRows=DB.records.filter(r=>matches(r,p)).sort(compareRows);
 $('count').textContent='검색 결과 '+activeRows.length+'개 모집단위';$('sortStatus').textContent=sortKey==='history'?'입결 정렬: 최신 연도 첫 표시값 · 70% 컷과 평균은 별도 묶음 · 미확인 맨 아래':sortKey==='competition'?'경쟁률 정렬: 최신 연도 첫 표시값 · 미확인 맨 아래':'';
 $('applied').textContent=[p.field||'전체 분야',p.region||'전국',p.work==='no'?'일·학업 병행 필수 과정 제외 (미확인 조건은 유지)':p.work==='yes'?'일·학업 병행 의향 있음':'병행 의향 미정',p.dorm?'주거 조건 확인 추가':''].filter(Boolean).join(' · ');
 $('schoolContext').textContent=($('school').value?'학생 고교 유형: '+$('school').value+' · ':'')+'입결의 출신 고교 유형과 별개입니다. 지원자격의 세부 제한은 각 대학 원문으로 확인하세요.';
 closeDetail(false);$('results').replaceChildren();if(!activeRows.length){$('results').append(node('p',p.resultSchool&&p.resultSchool!=='unknown'?'해당 고교 유형으로 출처가 확인된 입결이 없습니다. 고교 유형 필터를 풀면 모집정보를 볼 수 있습니다.':'조건에 맞는 후보가 없습니다. 분야·지역·지원자격 조건을 완화해 보세요.','empty'));}else{const wrap=node('div','','table-wrap');wrap.append(catalog(activeRows));$('results').append(wrap)}
 renderSelection();
}
function preparePrint(){const root=$('printArea');root.replaceChildren();if(!selected.size){root.append(node('p','담은 후보가 없습니다.'));return}root.append(node('h1','2028 계약학과 상담 후보'),node('p','공식 시행계획 기준. 최종 모집요강·기업별 채용·장학 조건을 확인하세요. 과거 9등급제 입결은 2028 합격 예측값이 아닙니다.'),table(picked(),true));}
function reset(){sortKey='uni';sortDirection=1; HTMLFormElement.prototype.reset.call($('filters'));selected.clear();$('moreFilters').open=false;$('comparison').hidden=true;$('comparison').replaceChildren();$('printArea').replaceChildren();render(); }
function init(){
 for(const key of ['field','region'])[...new Set(DB.records.filter(r=>r.status==='plan2028').map(r=>r[key]))].sort((a,b)=>a.localeCompare(b,'ko')).forEach(v=>$(key).add(new Option(v,v)));
 DB.records.sort((a,b)=>a.uni.localeCompare(b.uni,'ko')||a.major.localeCompare(b.major,'ko'));
 const verified=DB.records.filter(r=>r.status==='plan2028');$('coverage').append(node('strong',new Set(verified.map(r=>r.uni)).size+'개 대학'),document.createTextNode(' · '),node('strong',verified.length+'개 모집단위'),document.createTextNode(' 수록'));$('scope').textContent='2028 확인 '+verified.length+'개 · '+new Set(verified.map(r=>r.uni)).size+'개 대학 / 이전 참고 '+(DB.records.length-verified.length)+'개 · 원문 재검토 2026-10-04';
 $('filters').addEventListener('submit',e=>{e.preventDefault();render()});$('filters').addEventListener('change',e=>{if(e.target.id!=='query')render()});$('query').addEventListener('input',render);$('reset').addEventListener('click',reset);
 $('compare').addEventListener('click',()=>{$('comparison').hidden=false;renderComparison();$('comparison').scrollIntoView({block:'start'})});$('clear').addEventListener('click',()=>{selected.clear();renderSelection()});$('print').addEventListener('click',()=>{preparePrint();window.print()});window.addEventListener('beforeprint',preparePrint);window.addEventListener('afterprint',()=>$('printArea').replaceChildren());window.addEventListener('pageshow',e=>{if(e.persisted)reset()});reset();
}
init();
