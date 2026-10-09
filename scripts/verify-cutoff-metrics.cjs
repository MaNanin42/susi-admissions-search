const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const db=JSON.parse(read('data/cutoff-current.json')),raw=JSON.parse(read('modules/admission-2028/data/nationwide.json')).records;
const html=read('modules/admission-2028/index.html'),built=JSON.parse(html.match(/const DATA=(.*);\r?\n/)[1]);
const c={};vm.createContext(c);vm.runInContext(read('modules/admission-2028/scripts/real-ui.js'),c);
const points=s=>s?.status==='matched'&&(s.perfectScore>0||(!Number.isFinite(s.grade50)&&!Number.isFinite(s.grade70)&&[s.point50,s.point70].some(Number.isFinite)));
assert.equal(built.length,raw.length);
let count=0,unmatched=0;
for(const r of built){
 assert.deepEqual(r.cutoffCurrent,db.national[r.id]);
 assert.deepEqual(r.cut70,raw.find(x=>x.id===r.id).cut70,'raw source preserved');
 if(r.cutoffCurrent?.status==='matched'&&r.cutoffCurrent.year===2026&&points(r.cutoffCurrent)){
  count++;assert.equal(c.historicalCut70(r),null);assert.equal(c.cutRangeMatch(r,{cutMin:1,cutMax:9}),false);
  assert.equal(c.dataModeMatch(r,{dataMode:'grades'}),false);assert.equal(c.dataModeMatch(r,{dataMode:'points'}),true);
  assert.match(c.cutDisplay2026(r),/환산 70%.*만점/);
 }else if(r.cutoffCurrent?.status!=='matched'){unmatched++;assert.equal(c.historicalCut70(r),null)}
}
const ky=built.find(r=>r.id==='RES-007710'),kyJ=built.find(r=>r.id==='RES-007862');
assert.equal(ky.cutoffCurrent.perfectScore,80);assert.equal(ky.cutoffCurrent.point70,80);assert.equal(c.historicalCut70(ky),null);
assert.equal(kyJ.cutoffCurrent.grade70,5.24);assert.equal(c.historicalCut70(kyJ),5.24);assert.equal(c.pointSource2026(kyJ),null);
const de=built.find(r=>r.id==='RES-011706');assert.equal(de.cutoffCurrent.point70,910);assert.equal(de.cutoffCurrent.perfectScore,1000);assert.equal(c.historicalCut70(de),null);
const kn=built.find(r=>r.id==='RES-004572');assert.equal(c.rawCut2026(kn),1);assert.equal(c.pointSource2026(kn),null,'1 alone never proves a points system');
const template=read('src/index.template.html'),rc={};vm.createContext(rc);
vm.runInContext(template.slice(template.indexOf('function cutoffHasPoints'),template.indexOf('const SN  =')),rc);
function fn(name){const start=template.indexOf('function '+name+'(');assert.ok(start>=0);return template.slice(start,template.indexOf('\n}',start)+2)}
vm.runInContext(['entranceInGradeRange','scoreValuesByType','getMin50'].map(fn).join('\n'),rc);
let baselinePoints=0;
for(const [row,slots] of Object.entries(db.baseline))for(const [slot,s] of Object.entries(slots)){
 const source=rc.cutoffEntrance({cutoffCurrent:{[slot]:s}},slot);
 if(points(s)){baselinePoints++;assert.equal(source.isScore,true);assert.equal(source.s70,s.point70===null?'':String(s.point70));assert.equal(rc.entranceInGradeRange(source,{}, {grade:1,showScoreType:true}),false);assert.equal(rc.getMin50({jtypes:[source]}),Infinity);assert.equal(rc.scoreValuesByType({jtypes:[{...source,type:'교과'}]},'교과').length,0)}
}
const cc={DB:{records:[]},URL,document:{},Set};vm.createContext(cc);vm.runInContext(read('modules/contracts-2028/ui.js').replace(/init\(\);\s*$/,''),cc);
assert.match(cc.historyMetric({year:2026,cut70:1,cutoffCurrent:de.cutoffCurrent}),/910점.*1000/);
assert.equal(cc.historyMetric({gradeMean:4}),'평균 4.00등급');
assert.ok(html.includes("cutDisplay2026(d)"));assert.ok(read('src/index.template.html').includes('t.isScore ?'));
console.log(JSON.stringify({passed:true,actualBuilt2026PointRows:count,baselinePointSlots:baselinePoints,unknownNationalRows:unmatched,checks:'all source-backed point rows excluded from grade filters and numeric sorting; Keimyung category separation; Dong-eui 910/1000; unknown boundaries; mean preservation'},null,2));
