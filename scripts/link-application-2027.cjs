'use strict';
const reviewedRules=require('../data/application-2027-link-rules.json').rules;
const majorLabelRules=require('../data/application-2027-major-labels.json').rules;
const campusEvidenceRules=require('../data/application-2027-campus-evidence.json').rules;
// Keep the application cycle separate from historical grades and 2028 plans.
const clean=s=>String(s||'').normalize('NFKC').replace(/\s|[()（）\[\]【】·ㆍᆞ⋅∙‧․•・.,-]/g,'');
function trackKey(name){
 let text=String(name||'').normalize('NFKC').replace(/[【\[]/g,'(').replace(/[】\]]/g,')').trim();
 text=text.replace(/학생부\s+(교과|종합)/g,'학생부$1');
 // Quota type is checked separately; it is not part of the track's name.
 text=text.replace(/\(?정원\s*(내|외)\)?/g,'').replace(/^\s*[-_]\s*/,'').trim().replace(/^모집\s*/,'');
 if(/^(학생부교과|학생부종합)\s*전형$/.test(text))return clean(text).replace(/전형/g,'');
 // Descriptive scoring notes are not aliases for a different interview/written track.
 text=text.replace(/\s*-\s*(?=(?:(?:교과|서류(?:평가)?|실기)\s*\d|1단계\s*:)).*$/,'');
 text=text.replace(/\s*\((?:[^()]*(?:\d\s*%|면접X)[^()]*)\)\s*$/,'');
 text=text.replace(/\s*\((?:학생부위주\((?:교과|종합)\)|학생부교과|학생부종합|논술위주|실기\/실적)\)\s*$/,'');
 text=text.replace(/^\((학생부교과|학생부종합|실기\/실적|논술)(?:위주)?\)\s*/,'');
 text=text.replace(/\((서류|면접)\)/g,'($1형)');
 text=text.replace(/전형$/,'');
 text=text.replace(/^(학생부교과|학생부종합|실기\/실적|논술)(?:전형|위주|형)?\s*(?:\((.*)\)$|[\s_-]+(.+)$)/,(_,category,wrapped,plain)=>wrapped||plain);
 return clean(text).replace(/전형/g,'');
}
function category(name){return String(name||'').replace(/학생부\s+(교과|종합)/g,'학생부$1').replace(/학생부위주\((교과|종합)\)/g,'학생부$1').match(/학생부교과|학생부종합|논술|실기\/실적/)?.[0]||''}
function quotaType(name){return String(name||'').match(/정원\s*(내|외)/)?.[1]||''}
function majorKey(name){return clean(String(name||'').replace(/\s*[\[【(]\s*(?:교직|사범|사범계열|첨단|간호교육인증|보건의료정보관리교육인증|의학교육인증|세계교육기준인증)\s*[\]】)]/g,''))}
function sourceMajor(row){
 let name=row.major;
 // These are source-page annotations, not major renames; retain the raw major in the payload.
 if(row.university==='경남대학교')name=name.replace(/\s*\[(?:앵커|교직|취업연계|간호|WFOT|보건|KAI|초거대AI|반도체|KAAB|SW|게임)\]/g,'');
 if(row.university==='영산대학교')name=name.replace(/\s*\[(?:IPP|대학혁신사업|부산앵커사업|WACS)\]/g,'').replace(/\s*-\s*$/,'');
 if(row.university==='강서대학교')name=name.replace(/\((일반학생|교과우수자|사회통합)\)$/,(_,track)=>trackKey(track)===trackKey(row.track)?'':`(${track})`);
 if(row.university==='금강대학교')name=name.split(' | ')[0];
 if(row.university==='충남대학교')name=name.replace(/\*+$/,'');
 if(row.university==='국립부경대학교')name=name.replace(/\([^()]*,[^()]*\)$/,'');
 if(row.university==='명지대학교')name=name.replace(/^\S+학부\s+(?=\S+전공$)/,'');
 if(row.university==='백석대학교')name=name.replace(/^(보건학부|사범학부)\s+/,'');
 if(row.university==='백석대학교'&&row.aggregation==='company-total')name=name.replace(/^(관광학부|외식산업학부|AI컴퓨터공학부|문화예술학부)\s+/,'');
 if(row.university==='우석대학교')name=name.replace(/\((전주|진천)\)/g,'');
 if(row.university==='남부대학교')name=name.replace(/\s*\[(?:사범계열|간호교육인증평가 인증학과)\]/g,'');
 if(row.university==='대구가톨릭대학교')name=name.replace(/\s+(?:교직|앵커사업|보건의료정보관리교육인증|산학융합지구사업|부트캠프사업)(?=\s|$)/g,'').replace(/\s*\([^()]*,[^()]*\)$/,'');
 if(row.university==='안양대학교')name=name.replace(/^사범계_/, '');
 if(row.university==='목원대학교')name=name.replace(/\s*\[(?:교직|SW)\]/g,'').replace(/\s*\(.*[,·].*\)$/,'').replace(/\s*\(사범\/.*\)$/,'');
 if(row.university==='동명대학교')name=name.replace(/\s+(?:간호교육인증|사범|교직)$/,'').replace(/\s+건축학교육인증, 4년제·5년제 선택$/,'').replace(/\s+\[.*\]$/,'');
 if(row.university==='신라대학교')name=name.replace(/\s*\[(?:간호교육인증|교직|동물보건사 양성기관 인증|등록자 전원 첫 학기 전액 장학)\]/g,'').replace(/\s*\([^()]*전공[^()]*,[^()]*\)$/,'');
 if(row.university==='인제대학교')name=name.replace(/\s*\[(?:계열|교직|KABONE|WFOT|사범|KIMEE|KACPE)\]/g,'').replace(/⋅/g,'·');
 if(row.university==='경상국립대학교')name=name.replace(/\([^()]*전공\/[^()]*\)$/,'');
 if(row.university==='경성대학교')name=name.replace(/\s*\[(?:사범|건축학교육인증|약학교육인증|간호교육인증|동물보건사양성인증)\]/g,'');
 if(row.university==='동서대학교')name=name.replace(/\s*\[(?:교육부 장학금 지원|동서대\+부경대 공동학위|간호교육인증|세계작업치료사연맹 교육인증|보건의료정보관리 교육인증)\]/g,'').replace(/\s+-\s+.*$/,'');
 if(row.university==='한림대학교')name=name.replace(/\([^()]*,[^()]*\)$/,'').replace(/\s+전 모집단위\(의학과, 간호학과 제외\)$/,'');
 if(row.university==='청주대학교')name=name.replace(/\s*\((?:교직|사범)\)/g,'');
 if(row.university==='대진대학교')name=name.replace(/\s*\[문화예술사\]/g,'');
 if(row.university==='국립부경대학교')name=name.replace(/[＜<]4년[＞>]$/,'');
 if(row.university==='광주대학교')name=name.replace(/\s*\[(?:간호교육인증|WFOT교육인증|보건의료정보관리교육인증|국제응급구조사협회 전문교육기관 지정|문화예술교육사|사범계열|건축학교육전문학위인증)\]/g,'');
 if(row.university==='상명대학교')name=name.replace(/^(?:인문콘텐츠학부|지능·데이터융합학부|SW융합학부|생명화학공학부)\s+(?=\S+전공$)/,'');
 if(row.university==='대구대학교')name=name.replace(/\s+(?:간호교육인증|보건의료정보관리교육평가·인증|공학교육인증|차세대반도체혁신융합대학사업|첨단산업인재양성부트캠프사업|SW중심대학사업)(?=\s|$)/g,'');
 if(row.university==='영산대학교')name=name.replace(/\s*\[(?:간호교육 5년인증|간호대학 실습교육 지원사업|경남앵커사업|대학혁신지원사업|K-Move)\]/g,'');
 if(row.university==='광주여자대학교')name=name.replace(/[▲◆■]/g,'').replace(/\s*\[(?:한국물리치료교육평가원 물리치료교육 인증|한국치위생학교육평가원 치위생학교육 인증|한국간호평가원 3주기 간호교육인증 5년)\]/g,'');
 if(row.university==='부산가톨릭대학교')name=name.replace(/\s+(?:KABONE|K-MOVE|KAHIME)$/,'');
 if(row.university==='신한대학교')name=name.replace(/\*+$/,'');
 return majorKey(name);
}
function sourceTrack(row){
 let name=row.track;
 if(row.university==='신한대학교')name=name.replace('(약술형)','');
 if(row.university==='한경국립대학교')name=name.replace(/_정원[내외]$/,'');
 if(row.university==='울산대학교')name=name.replace(/\s*특별전형/g,'전형');
 if(row.university==='백석대학교')name=name.replace(/학생부 교과 \+ 면접 /,'학생부교과 ');
 if(row.university==='강원대학교')name=name.replace(/^삼척\(도계 포함\) 캠퍼스 /,'');
 if(row.university==='호남대학교')name=name.replace(/_(교과중심|면접중심)$/,'');
 if(row.university==='남서울대학교')name=name.replace(/^학생부교과\/실기\(/,'학생부교과(');
 if(row.university==='경희대학교')name=name.replace(/\(국가보훈·농어촌·수급자·자립아동 등\)/,'');
 if(row.university==='인제대학교'&&/^정원내 학생부교과 전형$/.test(name))name='학생부교과';
 if(row.university==='국립한국해양대학교')name=name.replace(/(아치해양인재전형Ⅰ)_일반$/,'$1').replace(/(아치해양인재전형Ⅱ)_사회적배려대상자$/,'$1');
 if(row.university==='감리교신학대학교')name=name.replace(/추천자전형\(담임교역자,교목,교사\)/,'추천자전형');
 if(row.university==='협성대학교')name=name.replace(/(융합인재Ⅰ)\(서류\)/,'$1').replace(/(융합인재Ⅱ)\(면접\)/,'$1').replace('기초생활수급자/차상위계층/한부모가족','기초생활수급자·차상위계층·한부모가족특별');
 if(row.university==='선문대학교')name=name.replace(/\s*\[(?:교과|실기|서류)[^\]]*%[^\]]*\](?:\s*\/\s*\[(?:교과|실기|서류)[^\]]*%[^\]]*\])?\s*$/,'');
 return trackKey(name);
}
function sourceMajorKeys(row){
 const aliases=majorLabelRules.filter(rule=>rule.university===row.university&&rule.source===row.major&&rule.sourceIds.includes(row.sourceId));
 return [...new Set([sourceMajor(row),...aliases.map(rule=>majorKey(rule.target))])];
}
function campusKey(name){return clean(name).replace(/캠퍼스/g,'').replace(/경기도/g,'').replace(/성심부천/,'성심').replace(/성의서울/,'성의').replace(/국제용인/,'국제').replace(/글로벌용인/,'글로벌').replace(/인문서울/,'인문서울').replace(/자연용인/,'자연용인').replace(/고양창의/,'고양').replace(/충청국제/,'충청').replace(/메트로폴양주/,'메트로폴양주').replace(/메디컬원주문막/,'메디컬원주').replace(/도계삼척제2/,'도계').replace(/송도국제/,'송도')}
function campusMatches(r,row,source){
 const proof=campusEvidenceRules.find(x=>x.university===r.uni&&x.unresolvedCampus===r.campus&&x.sourceIds.includes(row.sourceId)&&x.campuses[r.major]);
 if(proof&&(r.official||proof.recordIds?.includes(r.id)))return ((r.official||proof.allowUnspecifiedSourceCampus===true)&&!row.campus)||campusKey(row.campus)===campusKey(proof.campuses[r.major]);
 if(/확인 필요|학과별 확인|학과별 캠퍼스 확인/.test(r.campus||''))return false;
 const split={건국대학교:['글로컬','본교','서울'],고려대학교:['세종','본교','서울'],동국대학교:['WISE','서울','바이오메디고양'],연세대학교:['미래','서울국제학년전공별'],한양대학교:['ERICA','본교','서울'],상명대학교:['천안','본교','서울','제2'],홍익대학교:['세종','서울']};
 const spec=split[r.uni],target=campusKey(r.campus);
 if(spec&&r.campus){
  const branch=String(source.sourceCampus||'').includes(spec[0]);
  const targetBranch=target.includes(spec[0])||(r.uni==='상명대학교'&&target==='제2');
  if(branch!==targetBranch)return false;
 }
 const sourceCampus=row.campus||(row.university==='우석대학교'?row.major.match(/\((전주|진천)\)/)?.[1]:'');
 if(!sourceCampus||!r.campus)return true;
 const from=campusKey(sourceCampus);
 if(from===target)return true;
 if(target==='본교'&&spec&&!String(source.sourceCampus||'').includes(spec[0])&&from==='서울')return true;
 return false;
}
function targetTrack(r){
 const rule=reviewedRule(r);if(rule)return trackKey(rule.source);
 if(r.uni==='가천대학교'&&r.kind==='early')return '조기취업형계약학과';
 const key=trackKey(r.track);
 if(r.uni==='한국외국어대학교'&&/^학생부종합(서류형|면접형)$/.test(key))return key.replace(/^학생부종합/,'');
 if(r.uni==='중원대학교')return key.replace(/II$/,'2').replace(/I$/,'1');
 if(r.uni==='한양대학교'&&category(r.category)==='학생부교과'&&key==='학생부교과추천형')return '추천형';
 // The 2027 source spells out the school recommendation qualifier.
 if(r.uni==='숭실대학교'&&key==='교과우수자')return '교과우수자학교장추천';
 if(r.uni==='신라대학교')return trackKey(String(r.track).replace(/^(교과|종합)\((.*)\)$/,'$2'));
 if(r.uni==='동덕여자대학교'&&key==='학생부교과우수자')return trackKey('학생부교과우수자 특별전형');
 if(r.uni==='한라대학교')return trackKey(String(r.track).replace('(교과중심)','(교과)').replace('(면접중심)','(면접)'));
 return key;
}
function targetTracks(r){
 const rule=reviewedRule(r);
 return [...new Set([targetTrack(r),...(rule?.sourceAlternatives||[]).map(trackKey)])];
}
function reviewedRule(r){return reviewedRules.find(x=>(r.official||x.recordIds?.includes(r.id))&&x.university===r.uni&&x.category===category(r.category)&&trackKey(x.target)===trackKey(r.track)&&(!x.campuses||x.campuses.some(c=>campusKey(c)===campusKey(r.campus))))||null}
function programTotals(data){
 return (data.programTotals||[]).map(total=>{
  const parts=data.records.filter(r=>r.sourceId===total.sourceId&&r.sourceTable===total.sourceTable&&r.university===total.university&&r.track===total.track&&r.major.startsWith(total.major+' '));
  const rows=total.componentRows||[];
  if(total.aggregation!=='company-total'||!parts.length||rows.length!==parts.length||new Set(rows).size!==rows.length||!parts.every(r=>rows.includes(r.sourceRow)&&r.year===2027&&r.status==='final'&&r.campus===total.campus)||parts.reduce((n,r)=>n+r.recruitment,0)!==total.recruitment||parts.reduce((n,r)=>n+r.applicants,0)!==total.applicants)throw Error('Invalid company program total');
  return total;
 });
}
function linkApplications(records,data){
 if(data.year!==2027||data.season!=='수시'||data.status!=='final')throw Error('Expected final 2027 rolling applications');
 const index=new Map(),validRows=[];
 for(const row of [...data.records,...programTotals(data)]){
  const source=data.sources[row.sourceId];
  if(row.year!==2027||row.season!=='수시'||row.status!=='final'||source?.status!=='final')continue;
  const precision=row.ratioPrecision??2;
  if(![1,2].includes(precision)||!Number.isInteger(row.recruitment)||row.recruitment<=0||!Number.isInteger(row.applicants)||row.applicants<0||!Number.isFinite(row.ratio)||Math.abs(row.applicants/row.recruitment-row.ratio)>.5*10**(-precision)+.00001)throw Error('Invalid 2027 application figures');
  validRows.push(row);
  for(const major of sourceMajorKeys(row)){
   const key=[row.university,major,sourceTrack(row)].join('|');
   if(!index.has(key))index.set(key,[]);index.get(key).push(row);
  }
 }
 return records.map(original=>{
  const r=original.uni==='한양대학교 ERICA'?{...original,uni:'한양대학교',campus:'ERICA캠퍼스'}:original;
  if(r.legacyDisposition2028||/정시/.test(r.official?.admissionsSeason||''))return original;
  const candidates=!r.track&&['early','employment','worker'].includes(r.kind)?validRows.filter(row=>row.university===r.uni&&sourceMajor(row)===majorKey(r.major)&&(r.kind==='early'?/조기취업/.test(clean(row.track)):r.kind==='worker'?/계약.*재교육/.test(row.track):row.aggregation==='company-total'&&/계약학과/.test(row.track))):targetTracks(r).flatMap(track=>index.get([r.uni,majorKey(r.major),track].join('|'))||[]);
  const hits=candidates.filter(row=>{
   const sourceCategory=category(row.track),targetCategory=category(r.category||r.track);
   const sourceQuota=quotaType(row.track),targetQuota=quotaType(r.track);
   const rule=reviewedRule(r),expectedCategory=rule?.sourceCategory||targetCategory;
   return (!sourceQuota||!targetQuota||sourceQuota===targetQuota)&&(!sourceCategory||!expectedCategory||sourceCategory===expectedCategory)&&campusMatches(r,row,data.sources[row.sourceId]);
  });
  // Kyungil's 2028 catalog explicitly combines the two quota groups. Display
  // both published 2027 tracks separately; never average their ratios.
  const splitTracks=['[학생부종합] 조기취업형계약학과 전형','[정원외] 조기취업형계약학과 전형'];
  if(r.uni==='경일대학교'&&r.kind==='early'&&r.quotaNote?.includes('정원내+정원외 합산')&&hits.length===2&&splitTracks.every(track=>hits.filter(h=>h.track===track).length===1)){
   return {...original,application2027Options:splitTracks.map(track=>{const hit=hits.find(h=>h.track===track),source=data.sources[hit.sourceId];return {...hit,quotaGroup:track===splitTracks[0]?'정원내':'정원외',source:source.url,sourceTitle:source.title,reviewed:source.reviewed}})};
  }
  if(hits.length!==1)return original;
  const hit=hits[0],source=data.sources[hit.sourceId];
  const rule=reviewedRule(r);
  const campusProof=campusEvidenceRules.find(x=>x.university===r.uni&&x.unresolvedCampus===r.campus&&x.sourceIds.includes(hit.sourceId)&&x.campuses[r.major]);
  const labelProof=majorLabelRules.find(x=>x.university===r.uni&&x.source===hit.major&&x.sourceIds.includes(hit.sourceId)&&majorKey(x.target)===majorKey(r.major));
  return {...original,application2027:{...hit,source:source.url,sourceTitle:source.title,reviewed:source.reviewed,...(rule?{linkNote:rule.note,linkEvidence:rule.evidence,linkEvidencePage:rule.page,...(rule.sourceCategory&&rule.sourceCategory!==rule.category?{linkCategoryChanged:true}:{})}:{}),...(campusProof?{linkCampus2027:campusProof.campuses[r.major],linkCampusEvidence:campusProof.evidence,linkCampusEvidencePage:campusProof.pdfPage,linkCampusNote:campusProof.note}:{}),...(labelProof?{linkMajorNote:labelProof.note,linkMajorEvidence:labelProof.evidence}:{})}};
 });
}
module.exports={linkApplications,trackKey};
