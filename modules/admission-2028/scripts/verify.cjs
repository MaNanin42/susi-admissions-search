const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const data = JSON.parse(fs.readFileSync(path.join(root, 'data', 'nationwide.json'), 'utf8'));
const realUi = fs.readFileSync(path.join(root, 'scripts', 'real-ui.js'), 'utf8');
const gradeUi = fs.readFileSync(path.join(root, 'scripts', 'grade-ui.js'), 'utf8');
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
  assert.ok(rows.every(r=>r.official&&!r.legacyDisposition2028&&!Number.isFinite(r.cut70)));
  assert.equal(rows.length,c.candidates({...p,dataMode:'no-cut'}).length);
  const narrowed=c.candidates({...p,dataMode:'no-cut',fields:['자연·공학계열'],interview:'no'});
  assert.ok(narrowed.length>0);assert.ok(narrowed.every(r=>r.field==='자연·공학계열'&&r.interview===false));
  assert.ok(c.candidates({...p,dataMode:'with-cut',cutMin:2,cutMax:3}).every(r=>r.cut70>=2&&r.cut70<=3));
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

fs.writeFileSync(path.join(root, 'data', 'verification.json'), `${JSON.stringify({
  checks,
  passed: true,
  records: data.records.length,
  current2028Candidates: data.meta.current2028Candidates,
  current2028Verified: data.meta.current2028Verified,
  needsResearch: 1567,
  type: 'integrated module data, build, privacy and candidate-group checks'
}, null, 2)}\n`, 'utf8');
console.log(`PASS ${checks} integrated 2028 checks`);
