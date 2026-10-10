const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nationwide.json'), 'utf8'));
const {linkBaseline}=require('./link-baseline.cjs');
const baseline=JSON.parse(fs.readFileSync(path.join(root,'..','..','data','baseline','admissions.json'),'utf8'));
const baselineLinks=linkBaseline(data.records,baseline);
data.records=data.records.map(r=>baselineLinks.links[r.id]?{...r,baseline2026:baselineLinks.links[r.id]}:r);
const {linkApplications}=require('../../../scripts/link-application-2027.cjs');
const applications=JSON.parse(fs.readFileSync(path.join(root,'..','..','data','application-2027.json'),'utf8'));
data.records=linkApplications(data.records,applications);
const realUi = fs.readFileSync(path.join(root, 'scripts', 'real-ui.js'), 'utf8').replace(/\r\n/g, '\n');
const gradeUi = fs.readFileSync(path.join(root, 'scripts', 'grade-ui.js'), 'utf8').replace(/\r\n/g, '\n');
let checks = 0;
const test = (name, fn) => { fn(); checks += 1; console.log(`PASS ${name}`); };

test('current 2028 denominator and research boundary', () => {
  const active = data.records.filter(record => !record.legacyDisposition2028);
  const verified = active.filter(record => record.official);
  const research = active.filter(record => !record.official);
  assert.equal(data.records.length, 22751);
  assert.equal(active.length, 21720);
  assert.equal(verified.length, 20153);
  assert.equal(research.length, 1567);
  assert.equal(data.records.length - active.length, 1031);
  assert.ok(research.every(record => record.researchStatus === 'needs-research'));
  assert.ok(research.every(record => record.researchLabel === '추가조사 필요'));
});

test('coverage figures and historical source rows remain intact', () => {
  assert.equal(data.meta.current2028Candidates, 21720);
  assert.equal(data.meta.current2028Verified, 20153);
  assert.equal(data.meta.current2028Percent, 92.7854511970534);
  assert.equal(data.meta.sourceRecords, 16412);
  assert.equal(data.meta.source, 'local source CSV excluded; integrity retained in sourceSHA256');
  assert.match(data.meta.sourceSHA256, /^[a-f0-9]{64}$/);
});

test('maintained UI sources are embedded in the built module', () => {
  assert.ok(html.includes(realUi));
  assert.ok(html.includes(gradeUi));
  assert.ok(html.includes('id="verifiedOnly" type="checkbox" checked'));
  assert.ok(html.includes('추가조사 필요'));
  assert.ok(html.includes('과거 입결 참고'));
});

test('module keeps student input in page memory only', () => {
  assert.ok(html.includes("connect-src 'none'"));
  assert.ok(!/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket/.test(html));
});

test('candidate logic excludes archived records and supports research mode', () => {
  const taxonomy = JSON.parse(html.match(/const TAXONOMY=(.*);/)[1]);
  for (const key in taxonomy) taxonomy[key].push(`기타 (${key})`);
  const regionGroups = JSON.parse(html.match(/const REGION_GROUPS=(.*);/)[1]);
  let verifiedOnly = false;
  const context = {
    DATA: data.records,
    TAXONOMY: taxonomy,
    isOther: value => value.startsWith('기타 ('),
    $: () => ({ checked: verifiedOnly, addEventListener() {} }),
    regionMatches: (regions, province) => regions.some(region => regionGroups[region]?.includes(province)),
    URL
  };
  vm.createContext(context);
  vm.runInContext(realUi, context);
  const profile = {
    fields: Object.keys(taxonomy), details: [], customMajors: [], regions: [], only: false,
    interview: 'any', family: 'unknown', children: 0, single: 'unknown', economic: [],
    exam: [null, null, null, null, null, null], cutMin: null, cutMax: null
  };
  const researchMode = context.candidates(profile);
  assert.ok(researchMode.some(record => record.researchStatus === 'needs-research'));
  assert.ok(researchMode.every(record => !record.legacyDisposition2028));
  verifiedOnly = true;
  assert.ok(context.candidates(profile).every(record => record.official));
});

test('special and general candidates keep independent ten-row caps', () => {
  const taxonomy = JSON.parse(html.match(/const TAXONOMY=(.*);/)[1]);
  for (const key in taxonomy) taxonomy[key].push(`기타 (${key})`);
  const regionGroups = JSON.parse(html.match(/const REGION_GROUPS=(.*);/)[1]);
  const context = {
    DATA: data.records,
    TAXONOMY: taxonomy,
    isOther: value => value.startsWith('기타 ('),
    $: () => ({ checked: false, addEventListener() {} }),
    regionMatches: (regions, province) => regions.some(region => regionGroups[region]?.includes(province)),
    URL
  };
  vm.createContext(context);
  vm.runInContext(realUi, context);
  const profile = {
    fields: Object.keys(taxonomy), details: [], customMajors: [], regions: [], only: false,
    interview: 'any', family: 'yes', children: 3, single: 'yes', economic: [],
    exam: [null, null, null, null, null, null], cutMin: null, cutMax: null
  };
  const all = context.candidates(profile);
  const groups = context.candidateGroups(profile, all);
  assert.equal(groups.length, 2);
  assert.ok(groups.every(group => group.rows.length === Math.min(10, group.available)));
  assert.ok(groups[0].rows.every(record => context.matchedQualifications(record, profile).length > 0));
  assert.ok(groups[1].rows.every(record => context.matchedQualifications(record, profile).length === 0));
});


function candidateContext() {
  const taxonomy = JSON.parse(html.match(/const TAXONOMY=(.*);/)[1]);
  for (const key in taxonomy) taxonomy[key].push(`기타 (${key})`);
  const regionGroups = JSON.parse(html.match(/const REGION_GROUPS=(.*);/)[1]);
  const context = { DATA: data.records, TAXONOMY: taxonomy, URL,
    isOther: value => value.startsWith('기타 ('),
    $: () => ({ checked: true }),
    regionMatches: (regions, province) => regions.some(region => regionGroups[region]?.includes(province)) };
  vm.createContext(context); vm.runInContext(realUi, context);
  const profile = { fields: Object.keys(taxonomy), details: [], customMajors: [], regions: [], only: false,
    interview: 'any', family: 'yes', children: 4, single: 'yes', economic: ['basic', 'near'],
    exam: [null,null,null,null,null,null], cutMin: null, cutMax: null, dataMode: 'all', minimumState: 'all' };
  return { context, profile };
}

test('minimum states distinguish absent, pending, pass and fail at thresholds', () => {
  const { context: c, profile: p } = candidateContext();
  const row = { official: { minimumText: '2개 합 5' }, minimum: { kind: 'bestN', areas:[0,1,2], count:2, sum:5 } };
  assert.equal(c.evaluateMinimum(row,p).state, 'pending');
  assert.equal(c.evaluateMinimum(row,{...p,exam:[2,3,9,9,9,null]}).state, 'pass');
  assert.equal(c.evaluateMinimum(row,{...p,exam:[3,3,9,9,9,null]}).state, 'fail');
  assert.equal(c.evaluateMinimum({official:{minimumText:'없음'},minimum:{kind:'none'}},p).state,'none');
  assert.equal(c.evaluateMinimum({official:{minimumText:'개별 확인'}},p).state,'pending');
  assert.equal(c.evaluateMinimum({},p).state,'pending');
  row.minimum.historyMax=4;
  assert.equal(c.evaluateMinimum(row,{...p,exam:[2,3,9,9,9,null]}).state,'pending');
  assert.equal(c.evaluateMinimum(row,{...p,exam:[2,3,9,9,9,5]}).state,'fail');
});

test('minimum filters partition actual candidates without promoting unknown rules', () => {
  const { context: c, profile: p } = candidateContext();
  const all=c.candidates(p);let total=0;
  for(const state of ['none','pending','pass','fail']){
    const rows=c.candidates({...p,minimumState:state});total+=rows.length;
    assert.ok(rows.every(r=>c.evaluateMinimum(r,p).state===state));
    if(state==='pass'||state==='fail')assert.equal(rows.length,0);
  }
  assert.equal(total,all.length);
  const entered={...p,exam:[3,3,3,3,3,3]};
  for(const state of ['pass','fail'])assert.ok(c.candidates({...entered,minimumState:state}).length>0);
});

test('no-cut mode bypasses historical range but retains official, interest and interview filters', () => {
  const { context:c,profile:p }=candidateContext();
  const rows=c.candidates({...p,dataMode:'no-cut',cutMin:1,cutMax:1});
  assert.ok(rows.length>0);
  assert.ok(rows.every(r=>r.official&&!r.legacyDisposition2028&&c.cut2026(r)===null));
  assert.equal(rows.length,c.candidates({...p,dataMode:'no-cut'}).length);
  const narrowed=c.candidates({...p,dataMode:'no-cut',fields:['자연·공학계열'],interview:'no'});
  assert.ok(narrowed.length>0);assert.ok(narrowed.every(r=>r.field==='자연·공학계열'&&r.interview===false));
  assert.ok(c.candidates({...p,dataMode:'with-cut',cutMin:2,cutMax:3}).every(r=>(r.baseline2026?.cut70??r.cut70)>=2&&(r.baseline2026?.cut70??r.cut70)<=3));
});

test('new filters preserve independent special and general ten-row limits', () => {
  const {context:c,profile:p}=candidateContext();
  for(const dataMode of ['all','with-cut','no-cut'])for(const minimumState of ['all','none','pending','pass','fail']){
    const q={...p,dataMode,minimumState,exam:[3,3,3,3,3,3]};
    const all=c.candidates(q),groups=c.candidateGroups(q,all);
    assert.equal(groups.length,2);
    assert.ok(groups.every(g=>g.rows.length===Math.min(10,g.available)));
    assert.equal(groups.reduce((sum,g)=>sum+g.available,0),all.length);
  }
});

test('source URLs reject executable schemes and preserve official metadata coverage',()=>{
 const {context:c}=candidateContext();
 assert.equal(c.officialSourceUrl({official:{url:'javascript:alert(1)'}}),null);
 assert.equal(c.officialSourceUrl({official:{url:'data:text/html,test'}}),null);
 assert.equal(c.officialSourceUrl({}),null);
 assert.equal(c.officialSourceUrl({official:{url:'https://example.org/plan.pdf'}}),'https://example.org/plan.pdf');
 assert.ok(data.records.filter(r=>!r.legacyDisposition2028&&r.official).every(r=>c.officialSourceUrl(r)&&r.official.pages&&r.official.reviewed));
});

test('candidate selection toggles by stable identity and rejects archived records',()=>{
 const {context:c}=candidateContext();c.renderPicked=()=>{};
 const active=data.records.find(r=>!r.legacyDisposition2028),archived=data.records.find(r=>r.legacyDisposition2028);
 c.toggleCandidate(active.id);assert.equal(vm.runInContext('pickedCandidates.size',c),1);
 c.toggleCandidate(active.id);assert.equal(vm.runInContext('pickedCandidates.size',c),0);
 c.toggleCandidate(archived.id);c.toggleCandidate('missing');assert.equal(vm.runInContext('pickedCandidates.size',c),0);
});

test('full browse keeps manual eligibility visible but excludes explicit regular admissions and separate contracts',()=>{
 const {context:c,profile:p}=candidateContext();
 const contract=JSON.parse(fs.readFileSync(path.join(root,'..','contracts-2028','data.json'),'utf8'));
 c.CONTRACT_IDENTITIES=contract.records.filter(r=>r.status==='plan2028').map(r=>({uni:r.uni,major:r.major}));
 const rows=c.candidates({...p,browseMode:'all',family:'unknown',economic:[],single:'unknown',regional:{enabled:false}});
 assert.ok(rows.some(r=>r.type==='manual'));
 assert.ok(rows.every(r=>!/정시/.test(r.official?.admissionsSeason||'')));
 assert.ok(rows.every(r=>!c.CONTRACT_IDENTITIES.some(x=>x.uni===r.uni&&x.major===r.major)));
 const chemistry=c.candidates({...p,browseMode:'all',programQuery:'화학'});
 assert.ok(chemistry.length>0&&chemistry.every(r=>[r.uni,r.major,r.track].join(' ').includes('화학')));
});

test('course data preserves public fields and does not invent a missing-subject verdict',()=>{
 const courses=JSON.parse(fs.readFileSync(path.join(root,'data','recommended-courses.json'),'utf8'));
 assert.equal(courses.rows.length,914);assert.equal(new Set(courses.rows.map(r=>r.university)).size,44);assert.equal(courses.policies.length,45);
 const allowed=new Set(['university','campus','major_group','core_subjects','recommended_subjects','quantitative_criteria','evaluation_method','sourceId','sourcePage','subjectClassification','year']);
 assert.ok(courses.rows.every(r=>Object.keys(r).every(k=>allowed.has(k))&&r.university&&r.major_group));
 assert.ok(html.includes('미입력 과목을 미이수로 판정하지 않으며'));
 assert.ok(!html.includes('usePastCut'));
 const courseHtml=fs.readFileSync(path.join(root,'courses.html'),'utf8');
 assert.ok(courseHtml.includes('id="courseCoverage"'));
 assert.ok(!html.includes('id="courseGuidance"'));
 assert.ok(courseHtml.includes(fs.readFileSync(path.join(root,'scripts','course-ui.js'),'utf8').replace(/\r\n/g,'\n')));
});


test('2026 cutoff column keeps year, metric and missing-value boundaries',()=>{
 const c={};vm.createContext(c);vm.runInContext(realUi,c);
 assert.equal(c.cut2026({year:2026,metric:'등급',cut70:2.55}),2.55);
 for(const r of [{year:2025,metric:'등급',cut70:2},{year:null,metric:'등급',cut70:2},{year:2026,metric:'점수',cut70:2},{year:2026,metric:'등급',cut70:null}])assert.equal(c.cut2026(r),null);
 c.samples=[{id:'a',year:2026,metric:'등급',cut70:2},{id:'b',year:2026,metric:'등급',cut70:4},{id:'z',year:2025,metric:'등급',cut70:1}];
 for(const [direction,expected] of [[1,'a,b,z'],[-1,'b,a,z']])assert.equal(vm.runInContext(`resultSort={key:'cut2026',direction:${direction}};sortResults(samples).map(r=>r.id).join(',')`,c),expected);
 const hknu=data.records.filter(r=>r.universityPlan);assert.equal(hknu.length,72);assert.ok(hknu.every(r=>!r.official&&r.researchStatus==='needs-research'));
 const assessments=data.records.filter(r=>r.official?.assessment);assert.equal(assessments.length,72);assert.ok(assessments.every(r=>r.official.assessmentSource.reviewed==='2026-10-09'));
});
test('2026 separate grade bases remain visible but outside common grade comparisons',()=>{
 const c={};vm.createContext(c);vm.runInContext(realUi,c);
 const km=data.records.find(r=>r.id==='RES-007710');
 assert.equal(km.cut70,1);assert.equal(c.rawCut2026(km),1);
 assert.equal(c.cutDisplay2026(km),'1.00 · 진로선택 환산');
 assert.equal(c.historicalYear(km),2026);assert.equal(c.cut2026(km),null);
 assert.equal(c.cutRangeMatch(km,{cutMin:1,cutMax:2}),false);
 assert.equal(c.dataModeMatch(km,{dataMode:'with-cut'}),true);
 assert.equal(c.dataModeMatch(km,{dataMode:'no-cut'}),false);
 assert.equal(c.dataModeMatch(km,{dataMode:'with-cut',cutMin:1,cutMax:2}),false);
 for(const diff of [{major:'의예과'},{major:'약학부'},{category:'학생부종합'},{track:'일반전형'},{uni:'다른대학교'}])assert.equal(c.cutBasis2026({...km,...diff}),null);
 assert.equal(c.cutBasis2026({...km,year:2025}),null);
 const dg=data.records.find(r=>r.uni==='동국대학교'&&r.track==='학교장추천인재전형'&&r.year===2026&&Number.isFinite(r.cut70));
 assert.equal(c.cutBasis2026(dg).label,'상위 10과목');assert.equal(c.cut2026(dg),null);
 const reviewed=data.records.filter(r=>!r.legacyDisposition2028&&c.cutBasis2026(r));
 assert.equal(reviewed.filter(r=>r.uni==='계명대학교').length,63);
 c.samples=[{id:'ordinary',year:2026,metric:'등급',cut70:3},km,dg];
 for(const direction of [1,-1])assert.equal(vm.runInContext(`resultSort={key:'cut2026',direction:${direction}};sortResults(samples)[0].id`,c),'ordinary');
 assert.ok(realUi.includes("'2026 70% 컷: '+cutDisplay2026(d)"));
 console.log('  separately labelled active records:',reviewed.length);
});
test('first-tab history joins without borrowing another campus or admission track',()=>{
 assert.equal(baselineLinks.stats.linked,299);
 const g=data.records.find(r=>r.uni==='가천대학교'&&r.major==='정보보호학과'&&r.track==='가천바람개비전형');assert.equal(g.baseline2026.cut70,4.05);assert.equal(g.cut70,null);
 const sample={id:'test',uni:'강원대학교',campus:'춘천',regionCandidates:['강원'],major:'간호학과',category:'학생부종합',track:'미래인재면접전형',year:null,cut70:null};
 const rows=[{r:'강원권',u:'강원대',m:'간호학과',j1n:'미래인재면접',j1a:'2.4',j1b:'2.47'}];
 assert.equal(linkBaseline([sample],rows).links.test.cut70,2.47);
 for(const diff of [{campus:'도계'},{category:'학생부교과'},{track:'기초생활수급자전형'},{regionCandidates:['서울']}])assert.equal(linkBaseline([{...sample,...diff}],rows).stats.linked,0);
 assert.equal(linkBaseline([sample],[...rows,{...rows[0],j1b:'3.5'}]).stats.ambiguous,1);
 assert.equal(linkBaseline([sample],[{...rows[0],j1metric:'donggukOfficial'}]).stats.linked,0);
 assert.equal(linkBaseline([{...sample,year:2026,cut70:3,metric:'등급'}],rows).stats.linked,0);
 const c={};vm.createContext(c);vm.runInContext(realUi,c);assert.equal(c.cut2026(g),4.05);assert.equal(c.cutRangeMatch(g,{cutMin:4,cutMax:4.1}),true);assert.equal(c.cutRangeMatch(g,{cutMin:2,cutMax:3}),false);
});
test('2027 applications are final, track-specific and independent from 2026 history',()=>{
 assert.equal(applications.records.length,applications.coverage.recordsCollected);
 assert.ok(applications.records.length>=26000);
 assert.ok(data.records.filter(r=>r.application2027).length>=10478);
 const r=data.records.find(r=>r.uni==='가천대학교'&&r.major==='정보보호학과'&&r.track==='가천바람개비전형');
 assert.equal(r.baseline2026.cut70,4.05);assert.equal(r.application2027.recruitment,7);assert.equal(r.application2027.applicants,185);assert.equal(r.application2027.ratio,26.43);
 const c={};vm.createContext(c);vm.runInContext(realUi,c);
 assert.equal(c.cutRangeMatch({year:2025,metric:'등급',cut70:2},{cutMin:1,cutMax:3}),false);
 assert.equal(vm.runInContext('showRatio({competition:40,year:2026})',c),'-');assert.equal(vm.runInContext('recruitment2027({recruitment:25,year:2026})',c),null);
 const raw={uni:'가천대학교',major:'정보보호학과',campus:'글로벌(성남)',track:'가천바람개비전형'};
 for(const diff of [{track:'다른 전형'},{campus:'캠퍼스 확인 필요 (경기·인천)'},{uni:'다른 대학교'},{legacyDisposition2028:'archived'}])assert.equal(linkApplications([{...raw,...diff}],applications)[0].application2027,undefined);
 const one=applications.records.find(x=>x.university===raw.uni&&x.major===raw.major&&x.track==='가천바람개비 전형');
 assert.equal(linkApplications([raw],{...applications,programTotals:[],records:[one,one]})[0].application2027,undefined);
 assert.equal(linkApplications([raw],{...applications,programTotals:[],records:[{...one,year:2026}]})[0].application2027,undefined);
 assert.equal(linkApplications([raw],{...applications,programTotals:[],records:[{...one,status:'interim'}]})[0].application2027,undefined);
 c.samples=[{id:'a',application2027:{ratio:4,recruitment:6}},{id:'b',application2027:{ratio:18.38,recruitment:8}},{id:'z',competition:100,recruitment:200}];
 for(const key of ['ratio2027','recruitment2027'])for(const [direction,expected] of [[1,'a,b,z'],[-1,'b,a,z']])assert.equal(vm.runInContext(`resultSort={key:'${key}',direction:${direction}};sortResults(samples).map(r=>r.id).join(',')`,c),expected);
});
test('national application coverage preserves campus, category and final-status boundaries',()=>{
 assert.equal(new Set(applications.records.map(r=>r.university)).size,applications.coverage.universitiesCollected);
 assert.ok(applications.coverage.universitiesCollected>=153);
 assert.equal(Object.values(applications.sources).reduce((n,s)=>n+s.validatedTrackTotals,0),applications.coverage.validatedTrackTotals);
 for(const s of Object.values(applications.sources)){assert.equal(s.status,'final');assert.match(s.evidenceSha256,/^[a-f0-9]{64}$/);assert.ok(s.finalEvidence);assert.ok(s.validatedTrackTotals>0)}
 const base={university:'건국대학교',major:'검증용학과',track:'학생부교과(지역균형전형)',campus:'',year:2027,season:'수시',status:'final',recruitment:10,applicants:30,ratio:3};
 const fixture={...applications,programTotals:[],sources:{seoul:{status:'final',sourceCampus:'건국대'},glocal:{status:'final',sourceCampus:'건국대(글로컬)'}},records:[{...base,sourceId:'seoul'},{...base,sourceId:'glocal',applicants:50,ratio:5}]};
 const target={uni:'건국대학교',major:'검증용학과',track:'지역균형전형',category:'학생부교과',campus:'서울'};
 assert.equal(linkApplications([target],fixture)[0].application2027.ratio,3);
 assert.equal(linkApplications([{...target,campus:'글로컬캠퍼스'}],fixture)[0].application2027.ratio,5);
 assert.equal(linkApplications([{...target,category:'학생부종합'}],fixture)[0].application2027,undefined);
 assert.equal(linkApplications([{...target,campus:'캠퍼스 확인 필요'}],fixture)[0].application2027,undefined);
 const precision={...fixture,records:[{...base,sourceId:'seoul',recruitment:7,applicants:10,ratio:1.4,ratioPrecision:1}]};
 assert.equal(linkApplications([target],precision)[0].application2027.ratio,1.4);
 assert.throws(()=>linkApplications([target],{...precision,records:[{...precision.records[0],ratio:1.5}]}),/Invalid/);
});
test('expanded joins retain quotas, distinct tracks and documented renames',()=>{
 const {trackKey}=require('../../../scripts/link-application-2027.cjs');
 assert.equal(trackKey('정원내 모집 학생부 교과 일반전형'),trackKey('일반전형'));
 assert.equal(trackKey('학생부종합[면접전형]'),trackKey('면접전형'));
 assert.notEqual(trackKey('면접전형'),trackKey('서류전형'));
 assert.notEqual(trackKey('일반Ⅰ'),trackKey('일반Ⅱ'));
 const row={university:'검증대학교',major:'학과',track:'정원외 학생부교과(일반전형)',campus:'',year:2027,season:'수시',status:'final',sourceId:'s',recruitment:2,applicants:10,ratio:5};
 const fixture={year:2027,season:'수시',status:'final',sources:{s:{status:'final'}},records:[row]};
 const target={uni:row.university,major:row.major,track:'정원내 일반전형',category:'학생부교과'};
 assert.equal(linkApplications([target],fixture)[0].application2027,undefined);
 assert.equal(linkApplications([{...target,track:'정원외 일반전형'}],fixture)[0].application2027.ratio,5);
 const renamed=data.records.filter(r=>r.application2027?.linkEvidence);
 const reviewRules=require('../../../data/application-2027-link-rules.json').rules;
 assert.ok(renamed.length>0&&renamed.every(r=>r.application2027.linkNote&&(r.official||reviewRules.some(x=>x.university===r.uni&&x.recordIds?.includes(r.id)&&x.evidence===r.application2027.linkEvidence))));
 assert.ok(data.records.filter(r=>r.uni==='부산대학교'&&/^탐구전형|^서류전형/.test(r.track)).every(r=>!r.application2027));
});
test('company totals reconcile every component and reject missing or altered rows',()=>{
 assert.equal(applications.programTotals.length,9);
 const target={uni:'한국기술교육대학교',major:'반도체·디스플레이공학과',track:'충남형계약학과(조기취업형)',kind:'early'};
 const joined=linkApplications([target],applications)[0].application2027;
 assert.equal(joined.recruitment,60);assert.equal(joined.applicants,315);assert.equal(joined.ratio,5.25);assert.equal(joined.componentRows.length,21);
 const total=applications.programTotals[0];
 assert.throws(()=>linkApplications([target],{...applications,programTotals:[{...total,recruitment:61}]}),/Invalid company/);
 assert.throws(()=>linkApplications([target],{...applications,programTotals:[{...total,componentRows:total.componentRows.slice(1)}]}),/Invalid company/);
 assert.throws(()=>linkApplications([target],{...applications,records:applications.records.filter(r=>!(r.sourceId===total.sourceId&&r.sourceTable===total.sourceTable&&r.sourceRow===total.componentRows[0]))}),/Invalid company/);
});
test('reviewed cross-category changes require an official rule and disclose the change',()=>{
 const row=data.records.find(r=>r.uni==='영남대학교'&&r.track==='기회균형전형'&&r.application2027);
 assert.ok(row);assert.equal(row.category,'학생부종합');assert.equal(row.application2027.linkCategoryChanged,true);
 assert.match(row.application2027.linkNote,/교과.*종합/);
 const {application2027,...raw}=row;
 assert.equal(linkApplications([{...raw,official:null}],applications)[0].application2027,undefined);
 assert.ok(realUi.includes("node('small','전형 유형 변경'"));
});
test('Kangwon renames stay within the documented campus and exclude new tracks',()=>{
 for(const campus of ['춘천','강릉','원주','삼척','도계']){
  const r=data.records.find(r=>r.uni==='강원대학교'&&r.campus===campus&&r.track==='일반전형'&&r.application2027);
  assert.ok(r,campus);assert.equal(r.application2027.linkEvidencePage,4);
  const {application2027,...raw}=r;
  const fixture={...applications,programTotals:[],records:[application2027]};
  assert.ok(linkApplications([raw],fixture)[0].application2027);
  assert.equal(linkApplications([{...raw,campus:campus==='춘천'?'원주':'춘천'}],fixture)[0].application2027,undefined);
  assert.equal(linkApplications([{...raw,track:'일반-정성평가전형'}],fixture)[0].application2027,undefined);
 }
});
test('Mokpo Maritime final rows include verified 2027 rolling admission season evidence',()=>{
 const rows=applications.records.filter(r=>r.university==='국립목포해양대학교');
 assert.equal(rows.length,96);assert.equal(rows.reduce((n,r)=>n+r.recruitment,0),705);assert.equal(rows.reduce((n,r)=>n+r.applicants,0),4555);
 const source=applications.sources[rows[0].sourceId];assert.equal(source.validatedTrackTotals,11);
 assert.equal(source.seasonEvidencePage,7);assert.match(source.seasonEvidence,/mmu\.ac\.kr/);assert.match(source.seasonEvidenceSha256,/^[a-f0-9]{64}$/);
});
test('source annotations retain distinct admission tracks and whole-unit scope',()=>{
 const {trackKey}=require('../../../scripts/link-application-2027.cjs');
 assert.equal(trackKey('학생부 교과 - 교과면접 전형 (교과 80% + 면접 20%)'),trackKey('교과면접전형'));
 assert.notEqual(trackKey('학생부교과 전형'),trackKey('학생부종합 전형'));
 assert.equal(trackKey('학교생활우수자(면접)'),trackKey('학교생활우수자(면접형)'));
 assert.notEqual(trackKey('학교생활우수자(면접)'),trackKey('학교생활우수자(서류)'));
 for(const uni of ['감리교신학대학교','한동대학교']){
  const rows=applications.records.filter(r=>r.university===uni);assert.ok(rows.length);
  const source=applications.sources[rows[0].sourceId];assert.ok(source.unitEvidence&&source.unitEvidencePage);
  assert.equal(new Set(rows.map(r=>r.major)).size,1);
  assert.equal(linkApplications([{uni,major:'임의 세부학과',track:rows[0].track}],applications)[0].application2027,undefined);
 }
 const gnu=data.records.filter(r=>r.uni==='경상국립대학교'&&r.application2027?.linkCategoryChanged);
 assert.ok(gnu.length);assert.ok(gnu.every(r=>r.application2027.linkEvidencePage===4));
});
test('additional source labels preserve track types and do not borrow parent or adult quotas',()=>{
 const {trackKey}=require('../../../scripts/link-application-2027.cjs');
 assert.equal(trackKey('학생부교과(일반)전형'),trackKey('일반전형'));
 assert.notEqual(trackKey('학생부교과전형'),trackKey('학생부종합전형'));
 const row={university:'상명대학교',major:'인문콘텐츠학부 역사콘텐츠전공',track:'학생부교과(일반)전형',campus:'',year:2027,season:'수시',status:'final',sourceId:'s',recruitment:10,applicants:30,ratio:3};
 const fixture={year:2027,season:'수시',status:'final',sources:{s:{status:'final',sourceCampus:'상명대학교'}},records:[row]};
 const target={uni:row.university,major:'역사콘텐츠전공',track:'일반전형',category:'학생부교과',campus:'서울'};
 assert.equal(linkApplications([target],fixture)[0].application2027.ratio,3);
 assert.equal(linkApplications([{...target,category:'학생부종합'}],fixture)[0].application2027,undefined);
 assert.equal(linkApplications([target],{...fixture,records:[{...row,major:'인문콘텐츠학부'}]})[0].application2027,undefined);
 const adult={...row,university:'광주대학교',major:'사회복지학과[성인학습자 과정]'};
 assert.equal(linkApplications([{...target,uni:adult.university,major:'사회복지학과',campus:''}],{...fixture,records:[adult]})[0].application2027,undefined);
 for(const [uni,track,page] of [['국립부경대학교','백경인재전형',11],['대진대학교','윈윈대진전형-면접형',3]]){
  const r=data.records.find(r=>r.uni===uni&&r.track===track&&r.application2027);
  assert.ok(r,uni);assert.equal(r.application2027.linkEvidencePage,page);
  const {application2027,...raw}=r;
  assert.equal(linkApplications([{...raw,official:null}],applications)[0].application2027,undefined);
 }
 assert.ok(data.records.filter(r=>r.uni==='대진대학교'&&/윈윈대진.*서류/.test(r.track)).every(r=>!r.application2027));
});

test('education university final summaries agree with single-unit guide quotas and precision',()=>{
 for(const [id,uni,count,quota,applicants] of [['n018','서울교육대학교',8,245,1088],['n040','경인교육대학교',7,402,2819],['n085','청주교육대학교',7,209,1741]]){
  const rows=applications.records.filter(r=>r.sourceId===id),source=applications.sources[id];
  assert.equal(rows.length,count);assert.equal(rows.reduce((n,r)=>n+r.recruitment,0),quota);assert.equal(rows.reduce((n,r)=>n+r.applicants,0),applicants);
  assert.equal(new Set(rows.map(r=>r.major)).size,1);assert.ok(rows.every(r=>r.unitBasis==='single-unit-guide'));
  assert.ok(source.unitEvidence&&source.unitEvidencePages.length);assert.match(source.unitEvidenceSha256,/^[a-f0-9]{64}$/);
  assert.equal(linkApplications([{uni,major:'국어교육심화과정',track:rows[0].track}],applications)[0].application2027,undefined);
 }
 const cje=data.records.find(r=>r.uni==='청주교육대학교'&&r.track==='배움나눔인재전형'&&r.application2027);
 assert.equal(cje.application2027.ratio,23.8);assert.equal(cje.application2027.ratioPrecision,1);
});
test('90 percent attempt reports actual coverage with unchanged denominator',()=>{
 const active=data.records.filter(r=>!r.legacyDisposition2028);
 assert.equal(active.length,21720);
 assert.equal(active.filter(r=>r.application2027).length,18537);
 assert.ok(active.filter(r=>r.application2027).length/active.length>=.85);
 assert.ok(active.filter(r=>r.application2027).length/active.length<.90);
});

test('reviewed major renames exclude split predecessor units',()=>{
 const renamed=data.records.find(r=>r.uni==='부산대학교'&&r.major==='산업공학과'&&r.application2027);
 assert.equal(renamed.application2027.major,'산업공학부');
 assert.ok(renamed.application2027.linkMajorEvidence.includes('https://go.pusan.ac.kr/down/mojib/RF(0)_260611154120.pdf'));
 assert.ok(data.records.filter(r=>r.uni==='부산대학교'&&r.major==='의생명융합공학부').every(r=>!r.application2027));
 const cw=data.records.find(r=>r.uni==='국립창원대학교'&&r.major==='정보통신공학과'&&r.application2027);
 assert.match(cw.application2027.major,/구\. 정보통신공학과/);
});

test('reviewed unit annotations preserve exact unit scope',()=>{
 const d=data.records.find(r=>r.uni==='덕성여자대학교'&&r.major==='자유전공학부'&&r.application2027?.recruitment===50);
 assert.ok(d);assert.equal(d.application2027.applicants,423);assert.equal(d.application2027.ratio,8.46);
 assert.equal(d.application2027.major,'미래인재대학(자유전공학부)');
 assert.ok(d.application2027.linkMajorEvidence.length);
 const grouped=applications.records.find(r=>r.university==='순천향대학교'&&r.major==='의약바이오스쿨');
 assert.ok(grouped);
 const fixture={...applications,programTotals:[],records:[grouped]};
 const base={uni:'순천향대학교',campus:'본교',track:grouped.track};
 assert.ok(linkApplications([{...base,major:'의약바이오스쿨(바이오의약전공/바이오인포매틱스전공/AI의료생명공학전공)'}],fixture)[0].application2027);
 assert.equal(linkApplications([{...base,major:'바이오의약전공'}],fixture)[0].application2027,undefined);
});

test('reviewed predecessor alternatives reject ambiguous history and new tracks',()=>{
 const joined=data.records.find(r=>r.uni==='연세대학교'&&r.track==='종합인재형'&&r.application2027);
 assert.ok(joined);
 const {application2027:source,...target}=joined;
 const fixture={...applications,programTotals:[],records:[source]};
 assert.ok(linkApplications([target],fixture)[0].application2027);
 const other={...source,track:source.track.includes('국제인재')?'학생부종합(활동우수형)':'학생부종합(국제인재)',sourceRow:99999};
 assert.equal(linkApplications([target],{...fixture,records:[source,other]})[0].application2027,undefined);
 for(const [uni,pattern] of [['고신대학교',/일반고서류면접|일반고성장인재/],['경희대학교',/네오.*서류/],['아주대학교',/ACE.*서류/]]){
  const rows=data.records.filter(r=>r.uni===uni&&pattern.test(r.track));
  assert.ok(rows.length,uni);assert.ok(rows.every(r=>!r.application2027),uni);
 }
});

test('campus evidence is source and major scoped and does not rewrite the 2028 plan',()=>{
 const r=data.records.find(r=>r.uni==='호서대학교'&&r.major==='간호학과'&&r.application2027);
 assert.ok(r);assert.equal(r.application2027.linkCampus2027,'아산');
 assert.equal(r.campus,'충남(학과별 캠퍼스 확인)');
 const {application2027:source,...target}=r;
 const fixture={...applications,programTotals:[],records:[source]};
 assert.equal(linkApplications([{...target,official:null}],fixture)[0].application2027,undefined);
 assert.equal(linkApplications([target],{...fixture,records:[{...source,campus:'천안'}]})[0].application2027,undefined);
 assert.equal(linkApplications([target],{...fixture,sources:{...fixture.sources,unreviewed:fixture.sources[source.sourceId]},records:[{...source,sourceId:'unreviewed'}]})[0].application2027,undefined);
 assert.equal(linkApplications([{...target,major:'컴퓨터공학부'}],{...fixture,records:[{...source,major:'컴퓨터공학부'}]})[0].application2027,undefined);
});

test('whole-unit aliases never allocate parent quotas to constituent majors',()=>{
 const rule=require('../../../data/application-2027-major-labels.json').rules.find(r=>r.university==='가톨릭꽃동네대학교');
 const source=applications.records.find(r=>r.university===rule.university&&r.major===rule.source);
 assert.ok(source);
 const fixture={...applications,programTotals:[],records:[source]};
 const target={uni:rule.university,major:rule.target,track:source.track};
 assert.ok(linkApplications([target],fixture)[0].application2027);
 assert.equal(linkApplications([{...target,major:'사회복지학전공'}],fixture)[0].application2027,undefined);
 assert.equal(linkApplications([target],{...fixture,records:[source,{...source,sourceRow:99999}]})[0].application2027,undefined);
});
test('reviewed research rows require their allowlisted identity and preserve plan status',()=>{
 const rules=require('../../../data/application-2027-link-rules.json').rules;
 let checked=0;
 for(const rule of rules.filter(r=>r.recordIds?.length)){
  const r=data.records.find(r=>!r.official&&rule.recordIds.includes(r.id)&&r.application2027);
  if(!r)continue;
  const {application2027:source,...target}=r;
  const fixture={...applications,programTotals:[],records:[source]};
  const linked=linkApplications([target],fixture)[0];
  assert.ok(linked.application2027);assert.deepEqual(linked.official,target.official);
  assert.equal(linkApplications([{...target,id:'UNREVIEWED-RESEARCH'}],fixture)[0].application2027,undefined);
  checked++;
 }
 assert.equal(checked,4);
});
test('research campus proofs reject unreviewed IDs and wrong source campus',()=>{
 const r=data.records.find(r=>r.uni==='국립한국교통대학교'&&!r.official&&r.application2027?.linkCampus2027==='충주');
 assert.ok(r);
 const {application2027:source,...target}=r;
 const fixture={...applications,programTotals:[],records:[source]};
 assert.ok(linkApplications([target],fixture)[0].application2027);
 assert.equal(linkApplications([{...target,id:'UNREVIEWED-CAMPUS'}],fixture)[0].application2027,undefined);
 assert.equal(linkApplications([target],{...fixture,records:[{...source,campus:'의왕'}]})[0].application2027,undefined);
 assert.equal(linkApplications([target],{...fixture,records:[{...source,campus:''}]})[0].application2027,undefined);
});
test('highschool context preserves campus, historical year and aggregate scope', () => {
 const contextData=JSON.parse(fs.readFileSync(path.join(root,'data','highschool-context.json'),'utf8'));
 const c={HIGHSCHOOL_CONTEXT:contextData};vm.createContext(c);vm.runInContext(realUi,c);
 assert.equal(c.highschoolContext({uni:'한양대학교',campus:'서울'}),null);
 assert.equal(c.highschoolContext({uni:'한양대학교',campus:'본교'}),null);
 assert.equal(c.highschoolContext({uni:'연세대학교',campus:'미래캠퍼스'}),null);
 assert.equal(c.highschoolContext({uni:'연세대학교',campus:'서울·국제(학년·전공별)'}).year,2024);
 assert.equal(c.highschoolContext({uni:'한양대학교',campus:'ERICA캠퍼스'}).tracks[0].total,533);
 const cau=c.highschoolContext({uni:'중앙대학교',campus:'서울'});
 assert.deepEqual(Array.from(cau.tracks,t=>t.groups[0][1]),[89,41]);
 assert.equal(c.highschoolContext({uni:'고려대학교',campus:'서울'}),null);
 assert.equal(c.highschoolContext({uni:'건국대학교',campus:'글로컬캠퍼스'}),null);
 assert.equal(c.highschoolContext({uni:'건국대학교',campus:'서울'}).tracks[0].summary,'일반고 80% 이상');
 assert.equal(c.highschoolContext({uni:'서울대학교'}).population,'최초합격자');
 for(const t of c.highschoolContext({uni:'서울대학교'}).tracks){assert.equal(t.counts.reduce((sum,g)=>sum+g[1],0),t.total);t.groups.forEach((g,i)=>assert.ok(Math.abs(g[1]-t.counts[i][1]*100/t.total)<=0.051))}
 assert.equal(c.highschoolContext({uni:'세종대학교'}).tracks[1].groups[0][1],82.4);
 for(const u of contextData.universities){assert.ok(u.pdfPage>0||u.pageLabel);assert.equal(new URL(u.source).protocol,'https:');for(const t of u.tracks)for(const [name,pct] of t.groups){assert.ok(name);assert.ok(pct>=0&&pct<=100)}}
 assert.ok(html.includes('const HIGHSCHOOL_CONTEXT='+JSON.stringify(contextData)));
 assert.ok(realUi.includes('dialog.showModal()'));
 assert.ok(!realUi.includes('출신 고교 구성 자료 미확인'));
 assert.ok(!realUi.includes("detailRow([['공식 근거'"));
});
console.log(`PASS ${checks} integrated 2028 checks`);

fs.writeFileSync(path.join(root, 'data', 'verification.json'), `${JSON.stringify({
  checks,
  passed: true,
  records: data.records.length,
  current2028Candidates: data.meta.current2028Candidates,
  current2028Verified: data.meta.current2028Verified,
  needsResearch: 1567,
  type: 'integrated module data, build, privacy and candidate-group checks'
}, null, 2)}\n`, 'utf8');
