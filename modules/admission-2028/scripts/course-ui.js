function renderCourseGuide(){
 const university=$('courseUniversity').value,q=$('courseMajor').value.trim(),out=$('courseGuideResults'),policy=$('coursePolicy');out.replaceChildren();policy.replaceChildren();
 $('coursePolicyPanel').hidden=!university;$('resetCourseSearch').disabled=!university&&!q;
 if(!university){renderUniversityList(q,out);return}
 $('coursePolicySummary').textContent=university+' · 반영 기준과 공식 근거';
 const policies=COURSE_DATA.policies.filter(p=>p['대학명']===university);
 for(const p of policies){const block=node('div','','notice');block.append(node('strong',p['확인 상태']+' · 자료 기준 '+p['자료 기준일']),node('p',p['권장 이유']),node('p','정시 학생부: '+p['정시 학생부 반영']),node('small',p['근거·출처']+' / '+p['안내·주의']));try{const u=new URL(p['공식 원문 URL']);if(['https:','http:'].includes(u.protocol))block.append(link(p['원문 유형']||'근거 열기',u.href))}catch{}policy.append(block)}
 const rows=COURSE_DATA.rows.filter(r=>r.university===university&&(!q||r.major_group.includes(q)));
 const title=node('div','','panel-heading');title.append(node('h2',university+' · '+rows.length+'개 학과·계열 항목'),node('p',rows.some(r=>r.sourceId)?'2028 대교협 자료집 대조 · 원자료 기준 2025-09-30':'기존 수집표 · 최신 원문 재대조 전'));out.append(title);
 if(!rows.length){out.append(node('p','일치하는 학과가 없습니다. 검색어를 줄이거나 다른 학과명으로 찾아보세요.','empty'));return}
 const wrap=node('div','','compare'),table=node('table',''),head=node('thead',''),tr=node('tr','');['모집단위·캠퍼스','핵심과목','권장·반영과목','기준·평가방법'].forEach(t=>{const th=node('th',t);th.scope='col';tr.append(th)});const caption=node('caption',university+' 모집단위별 권장과목');caption.className='sr-only';table.append(caption);head.append(tr);table.append(head);const body=node('tbody','');
 for(const r of rows){const row=node('tr',''),name=node('td','');name.append(node('span',r.major_group,'major-name'),node('span',r.campus||'캠퍼스 미기재','campus-name'));const source=COURSE_DATA.sources?.[r.sourceId];if(source){const a=link('원문 PDF '+r.sourcePage+'쪽',source.url+'#page='+r.sourcePage);a.className='campus-name';name.append(a)}row.append(name);[r.subjectClassification==='common'?'핵심·권장 구분 없음':r.core_subjects,r.recommended_subjects,[r.quantitative_criteria,r.evaluation_method].filter(Boolean).join(' · ')].forEach(t=>row.append(node('td',t||'미기재')));body.append(row)}table.append(body);wrap.append(table);out.append(wrap);

}
function renderUniversityList(query,out){
 const heading=node('div','','panel-heading');heading.append(node('h2',query?'학과 검색 결과':'수록 대학에서 바로 찾기'),node('p',query?'검색한 학과가 있는 대학을 선택하세요.':'대학명을 누르면 모집단위별 과목을 볼 수 있습니다.'));out.append(heading);
 const list=node('div','','university-list');let count=0;
 for(const university of courseUniversities){const rows=COURSE_DATA.rows.filter(r=>r.university===university&&(!query||r.major_group.includes(query)));if(query&&!rows.length)continue;count++;const button=node('button','','university-choice');button.type='button';button.dataset.university=university;button.append(node('strong',university),node('span',rows.length+'개 항목'));button.addEventListener('click',()=>{$('courseUniversity').value=university;$('coursePolicyPanel').open=false;renderCourseGuide();$('courseUniversity').focus({preventScroll:true})});list.append(button)}
 if(count)out.append(list);else out.append(node('p','일치하는 학과가 없습니다. 검색어를 줄여 다시 찾아보세요.','empty'));
}
const courseUniversities=[...new Set([...COURSE_DATA.rows.map(r=>r.university),...COURSE_DATA.policies.map(p=>p['대학명'])])].sort((a,b)=>a.localeCompare(b,'ko'));
courseUniversities.forEach(u=>$('courseUniversity').add(new Option(u,u)));
$('courseCoverage').textContent='2028 상담용 · '+courseUniversities.length+'개 대학·캠퍼스 · '+COURSE_DATA.rows.length+'개 학과·계열 항목. 전국 전체 자료는 아닙니다.';
$('courseUniversity').addEventListener('change',()=>{$('coursePolicyPanel').open=false;renderCourseGuide()});$('resetCourseSearch').addEventListener('click',()=>{$('courseUniversity').value='';$('courseMajor').value='';$('coursePolicyPanel').open=false;renderCourseGuide()});$('courseMajor').addEventListener('input',renderCourseGuide);

renderCourseGuide();
