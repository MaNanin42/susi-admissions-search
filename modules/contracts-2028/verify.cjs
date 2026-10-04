const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=__dirname,read=f=>fs.readFileSync(path.join(root,f),'utf8').replace(/\r\n/g,'\n'),db=JSON.parse(read('data.json')),ui=read('ui.js'),html=read('index.html');
const known=db.records.filter(r=>r.status==='plan2028');
assert.equal(new Set(db.records.map(r=>r.id)).size,db.records.length);
assert.equal(known.length,43);assert.equal(new Set(known.map(r=>r.uni)).size,13);
for(const [uni,total] of [['한국공학대학교',120],['경일대학교',140],['한양대학교 ERICA',150],['가천대학교',260],['동의대학교',75],['순천향대학교',130],['유원대학교',120],['한국기술교육대학교',40]])assert.equal(known.filter(r=>r.uni===uni&&r.kind==='early').reduce((n,r)=>n+r.quota,0),total,uni+' 2028 plan total');
for(const r of db.records){assert.ok(typeof r.region==='string'&&r.region.length);assert.ok(r.sourceIds.length);r.sourceIds.forEach(k=>assert.ok(db.sources[k]));assert.equal(r.schoolTypeEvidence,'unknown');if(r.status==='plan2028'){assert.equal(r.year,2028);assert.ok(r.sourceIds.every(k=>db.sources[k].year===2028));assert.ok((Number.isInteger(r.quota)&&r.quota>0)||(r.quota===null&&r.sourceIds.includes('jnu')&&r.quotaNote.includes('전체 90명')))}else{assert.equal(r.quota,null);assert.equal(r.graduateEligible,null)}r.history.forEach(h=>{assert.ok(h.year<2028);assert.equal(h.schoolType,'unknown')});}
assert.equal(known.filter(r=>r.uni==='선문대학교').reduce((n,r)=>n+r.quota,0),90);
assert.equal(known.filter(r=>r.uni==='백석대학교').reduce((n,r)=>n+r.quota,0),90);
assert.equal(known.filter(r=>r.uni==='전남대학교'&&r.quota===null).length,4);
const c={DB:db,URL,document:{},Set};vm.createContext(c);vm.runInContext(ui.replace(/init\(\);\s*$/,''),c);
const base={query:'',field:'',region:'',kind:'',work:'',evaluation:'',resultSchool:'',graduate:true,noMinimum:false,references:false,dorm:false};
const search=p=>db.records.filter(r=>c.matches(r,{...base,...p}));
assert.equal(search({}).length,42);assert.equal(search({evaluation:'sincerity'}).length,4);assert.ok(search({evaluation:'interview'}).every(r=>r.interviewWeight>=50));assert.equal(search({region:'부산'}).length,3);assert.equal(search({resultSchool:'general'}).length,0);assert.equal(search({resultSchool:'science'}).length,0);assert.equal(search({kind:'worker'}).length,0);assert.equal(search({kind:'worker',graduate:false}).length,1);assert.equal(search({work:'no'}).length,12);assert.equal(search({graduate:false,references:true}).length,61);assert.equal(search({dorm:true}).length,42);assert.equal(vm.runInContext("safeUrl('javascript:alert(1)')",c),null);
assert.ok(html.includes(ui));assert.ok(html.includes("connect-src 'none'"));assert.ok(!/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket/.test(html));new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
const histories=db.records.flatMap(r=>r.history);
assert.equal(db.records.filter(r=>r.history.length).length,13);assert.equal(histories.length,15);
assert.equal(histories.filter(h=>h.sourceType==='official').length,9);
assert.equal(histories.filter(h=>Number.isFinite(h.competitionRatio)).length,9);
for(const h of histories){assert.ok(Number.isFinite(h.cut70)||Number.isFinite(h.gradeMean));for(const key of ['cut50','cut70','gradeMean'])if(h[key]!=null)assert.ok(h[key]>=1&&h[key]<=9);if(h.sourceType==='official'){assert.match(h.sourceSha256,/^[a-f0-9]{64}$/);assert.ok(h.sourceLocation);assert.equal(h.year,2026);assert.ok(h.note)}}
const g=db.records.find(r=>r.uni==='가천대학교'&&r.major==='게임·영상학과').history[0];assert.equal(g.cut70,4.95);assert.equal(g.competitionRatio,25.67);
const t=db.records.find(r=>r.uni==='한국공학대학교'&&r.major==='IT융합디자인공학과').history[0];assert.equal(t.gradeMean,5.1);assert.equal(t.cut70,undefined);assert.equal(c.historyMetric(t),'평균 5.10등급');assert.equal(c.historyMetric(g),'70% 컷 4.95등급');assert.equal(c.historyText({history:[]} ),'-');assert.equal(c.competitionText({}),'-');assert.equal(c.competitionText(g),'25.67:1');
const samples=[{id:'b',uni:'나',major:'학과',quota:10,history:[{year:2026,cut70:2,competitionRatio:10}]},{id:'a',uni:'가',major:'학과',quota:2,history:[{year:2025,cut70:1,competitionRatio:20},{year:2026,cut70:4,competitionRatio:2}]},{id:'m',uni:'다',major:'학과',quota:4,history:[{year:2026,gradeMean:1}]},{id:'z',uni:'라',major:'학과',quota:null,history:[]}];
const order=(key,dir)=>samples.slice().sort((a,b)=>c.compareRows(a,b,key,dir)).map(r=>r.id).join(',');
assert.equal(order('quota',1),'a,m,b,z');assert.equal(order('quota',-1),'b,m,a,z');
assert.equal(order('competition',1),'a,b,m,z');assert.equal(order('competition',-1),'b,a,m,z');
assert.equal(order('history',1),'b,a,m,z');assert.equal(order('history',-1),'a,b,m,z');
assert.equal(order('uni',1),'a,b,m,z');assert.equal(order('uni',-1),'z,m,b,a');
console.log('PASS contracts: 43 current / 18 reference, 8 early-program quota totals, qualification/work/school-type filters, sources, privacy and syntax');
