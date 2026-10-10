import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const admission2028Root = path.join(root, 'modules', 'admission-2028');
const admission2028Html = fs.readFileSync(path.join(admission2028Root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const admission2028DataText = fs.readFileSync(path.join(admission2028Root, 'data', 'nationwide.json'), 'utf8');
const admission2028Data = JSON.parse(admission2028DataText);
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const forbidden = [
  'STUDENT_MOCK_GRADES', 'STUDENT_GRADE_INPUTS', 'studentClass',
  'studentNumber', 'studentLoadStatus'
];
for (const token of forbidden) check(!html.includes(token), `private token: ${token}`);

check(html.includes('2028학년도 V12.0.0'), 'version missing');
check(html.includes('<title>대입 상담 탐색 | 2028학년도 V12.0.0 공개용</title>'), 'public-only title missing');
check(html.includes('id="workspace-tab-search"') && html.includes('id="workspace-tab-admissions"') && html.includes('id="workspace-tab-contracts"') && html.includes('id="workspace-tab-admission2028"'), 'top workspace tabs missing');
check(html.includes('id="workspace-search"') && html.includes('id="workspace-admissions"') && html.includes('id="workspace-contracts"') && html.includes('id="workspace-admission2028"'), 'top workspace panels missing');
check(html.includes('function switchWorkspace(workspace)'), 'top workspace switching logic missing');
check(html.includes('data-src="modules/admission-2028/index.html"'), '2028 module relative path missing');
check(
  html.includes('data-version="12.0.0-cutoff-20261010"')
    && html.includes("if (!frame.getAttribute('src'))")
    && html.includes('frame.setAttribute(\'src\', `${frame.dataset.src}?v=${version}`)'),
  '2028 module versioned lazy-load state preservation missing',
);
check(html.includes('id="admissionsRegionFilters"') && html.includes('id="admissionsDirectory"'), 'admissions directory UI missing');
check(html.includes('const UNIVERSITY_CAMPUS_LABELS'), 'campus display mapping missing');
check(html.includes('const ADMISSIONS_OFFICE_LINKS'), 'verified admissions-office links missing');
check(html.includes('const PROGRAM_TAGS'), 'verified program tags missing');
check(html.includes('const CONTRACT_PROGRAM_DETAILS'), 'contract program details missing');
check(html.includes('id="programTypeFilter"') && html.includes('id="programTypeHelp"'), 'program type filter missing');
check(html.includes('data-contract-id="${esc(detail.id)}"'), 'contract badge navigation missing');
check(html.includes('id="contractProgramSearch"') && html.includes('id="contractTypeFilter"'), 'contract directory filters missing');
check(html.includes('function openContractProgram(id)'), 'contract detail navigation logic missing');
check(html.includes("byId('contractProgramSearch').value = ''") && html.includes("byId('contractTypeFilter').value = ''"), 'contract badge navigation must clear hidden directory filters');
check(html.includes('function renderContractAdmissionResults(program)') && html.includes('class="contract-admission-table"'), 'contract admission-result renderer missing');
check(html.includes('id="contractGradeInput"') && html.includes('id="contractRangeInput"') && html.includes('id="contractMatchCount"'), 'contract grade-range controls missing');
check(html.includes('function contractProgramMatchesGrade(program)') && html.includes('grade-match'), 'contract grade-range highlight logic missing');
check(html.includes('function renderContractWebSources(program)') && html.includes('contract-web-source'), 'contract official-web source renderer missing');
check(!html.includes('class="criteria-strip"'), 'removed criteria strip returned');
check(!html.includes('공개용 · 학생 성적 미포함'), 'removed public privacy badge returned');
check(html.includes('id="sntK"') && html.includes('id="sntM"'), 'manual CSAT inputs missing');
check(html.includes('id="tab-picked"') && html.includes('function togglePick(payload)'), 'candidate comparison missing');
check(!html.includes('id="resultInsight"') && !html.includes('id="counselBoard"') && !html.includes('class="result-header"'), 'removed search top panels returned');

const admission2028Active = admission2028Data.records.filter(record => !record.legacyDisposition2028);
const admission2028Verified = admission2028Active.filter(record => record.official);
const admission2028Research = admission2028Active.filter(record => !record.official);
check(admission2028Data.records.length === 22751, `2028 record count: ${admission2028Data.records.length}`);
check(admission2028Active.length === 21720, `2028 active denominator: ${admission2028Active.length}`);
check(admission2028Verified.length === 20153, `2028 verified count: ${admission2028Verified.length}`);
check(admission2028Research.length === 1567, `2028 needs-research count: ${admission2028Research.length}`);
check(admission2028Research.every(record => record.researchStatus === 'needs-research' && record.researchLabel === '추가조사 필요'), '2028 research status boundary changed');
check(admission2028Data.records.length - admission2028Active.length === 1031, '2028 archived count changed');
check(admission2028Data.meta.sourceRecords === 16412, '2028 historical source-row count changed');
check(admission2028Data.meta.current2028Percent === 92.7854511970534, '2028 verified percent changed');
check(!/[A-Z]:\\/i.test(admission2028DataText), '2028 data contains an absolute Windows path');
check(admission2028Html.includes('추가조사 필요') && admission2028Html.includes('과거 입결 참고'), '2028 research labels missing');
check(admission2028Html.includes('id="verifiedOnly" type="checkbox" checked'), '2028 verified-only default missing');
check(admission2028Html.includes("connect-src 'none'"), '2028 no-network CSP missing');
check(!/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket/.test(admission2028Html), '2028 persistent storage or network API returned');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
check(scripts.length > 0, 'inline script missing');
scripts.forEach((code, index) => {
  try { new vm.Script(code, { filename: `inline-${index + 1}.js` }); }
  catch (error) { errors.push(`JavaScript syntax: ${error.message}`); }
});

const admissionsText = fs.readFileSync(path.join(root, 'data', 'baseline', 'admissions.json'), 'utf8').trim();
const minimumText = fs.readFileSync(path.join(root, 'data', 'baseline', 'suneung-minimum.json'), 'utf8').trim();
const admissionsOfficeLinksText = fs.readFileSync(path.join(root, 'data', 'admissions-office-links.json'), 'utf8').trim();
const programTagsText = fs.readFileSync(path.join(root, 'data', 'program-tags.json'), 'utf8').trim();
const contractProgramDetailsText = fs.readFileSync(path.join(root, 'data', 'contract-program-details.json'), 'utf8').trim();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'baseline', 'manifest.json'), 'utf8'));
const admissions = JSON.parse(admissionsText);
const minimums = JSON.parse(minimumText);
const admissionsOfficeLinks = JSON.parse(admissionsOfficeLinksText);
const programTags = JSON.parse(programTagsText);
const contractProgramDetails = JSON.parse(contractProgramDetailsText);
check(admissions.length === 5863, `admissions count: ${admissions.length}`);
const baselineUniversityMajorKeys = new Set(admissions.map(row => `${row.u}\u241f${row.m}`));
check(baselineUniversityMajorKeys.size === 5800, `university-major key count: ${baselineUniversityMajorKeys.size}`);
check(programTags.schemaVersion === 1, 'program tag schema version');
check(programTags.sourceYear === 2027, 'program tag source year');
check(programTags.links.length === 252, `program tag link count: ${programTags.links.length}`);
check(programTags.sources.contract.linkedRows === 35 && programTags.sources.contract.linkedKeys === 35, 'contract linked row/key count');
check(programTags.sources.contract.reviewRows === 42, 'contract review row count');
check(programTags.sources.advanced.linkedRows === 220 && programTags.sources.advanced.linkedKeys === 217, 'advanced linked row/key count');
check(programTags.sources.advanced.reviewRows === 96, 'advanced review row count');
const programLinkKeys = new Set();
const programTypeKeys = { contract: new Set(), advanced: new Set() };
for (const item of programTags.links) {
  const key = `${item.u}\u241f${item.m}`;
  check(!programLinkKeys.has(key), `duplicate program tag link: ${item.u}|${item.m}`);
  programLinkKeys.add(key);
  check(baselineUniversityMajorKeys.has(key), `program tag key not in baseline: ${item.u}|${item.m}`);
  check(Array.isArray(item.tags) && item.tags.length > 0, `program tags missing: ${item.u}|${item.m}`);
  for (const tag of item.tags) {
    check(Object.hasOwn(programTypeKeys, tag.type), `unknown program tag type: ${tag.type}`);
    if (Object.hasOwn(programTypeKeys, tag.type)) programTypeKeys[tag.type].add(key);
    check(Array.isArray(tag.pages) && tag.pages.length > 0, `program source pages missing: ${item.u}|${item.m}`);
    check(tag.pages.every(page => Number.isInteger(page) && page > 0 && page <= programTags.sources[tag.type].pages), `program source page range: ${item.u}|${item.m}`);
    check(new Set(tag.pages).size === tag.pages.length, `duplicate program source page: ${item.u}|${item.m}`);
  }
}
check(programTypeKeys.contract.size === 35, `contract program key count: ${programTypeKeys.contract.size}`);
check(programTypeKeys.advanced.size === 217, `advanced program key count: ${programTypeKeys.advanced.size}`);
check(contractProgramDetails.schemaVersion === 1, 'contract detail schema version');
check(contractProgramDetails.sourceYear === 2027, 'contract detail source year');
check(contractProgramDetails.source.publisher === '한국대학교육협의회', 'contract detail publisher');
check(contractProgramDetails.source.pages === 15, 'contract detail source page count');
check(contractProgramDetails.programs.length === 35, `contract detail count: ${contractProgramDetails.programs.length}`);
const contractDetailIds = new Set();
const contractDetailKeys = new Set();
let contractWebSourcePrograms = 0;
let contractWebSourceLinks = 0;
const uniqueContractWebSourceUrls = new Set();
for (const item of contractProgramDetails.programs) {
  const key = `${item.u}\u241f${item.m}`;
  check(typeof item.id === 'string' && /^contract-\d{3}$/.test(item.id), `contract detail id format: ${item.id}`);
  check(!contractDetailIds.has(item.id), `duplicate contract detail id: ${item.id}`);
  contractDetailIds.add(item.id);
  check(!contractDetailKeys.has(key), `duplicate contract detail key: ${item.u}|${item.m}`);
  contractDetailKeys.add(key);
  check(programTypeKeys.contract.has(key), `contract detail key not tagged: ${item.u}|${item.m}`);
  check(typeof item.category === 'string' && item.category.length > 0, `contract detail category missing: ${item.u}|${item.m}`);
  for (const field of ['partners', 'support', 'selection', 'obligations', 'cautions']) {
    check(Array.isArray(item[field]), `contract detail ${field} must be an array: ${item.u}|${item.m}`);
    check(Array.isArray(item[field]) && item[field].every(value => typeof value === 'string' && value.length > 0), `contract detail ${field} value: ${item.u}|${item.m}`);
  }
  check(Array.isArray(item.sourcePages) && item.sourcePages.length > 0, `contract detail source page missing: ${item.u}|${item.m}`);
  check(item.sourcePages.every(page => Number.isInteger(page) && page > 0 && page <= 15), `contract detail source page range: ${item.u}|${item.m}`);
  if (item.webSources !== undefined) {
    check(Array.isArray(item.webSources) && item.webSources.length > 0, `contract web sources must be a non-empty array: ${item.u}|${item.m}`);
    contractWebSourcePrograms += 1;
    for (const source of item.webSources) {
      check(typeof source.title === 'string' && source.title.length > 0, `contract web source title: ${item.u}|${item.m}`);
      check(/^https:\/\//.test(source.url), `contract web source must use HTTPS: ${item.u}|${item.m}`);
      check(/^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt), `contract web source verification date: ${item.u}|${item.m}`);
      contractWebSourceLinks += 1;
      uniqueContractWebSourceUrls.add(source.url);
    }
  }
}
check(contractDetailKeys.size === programTypeKeys.contract.size, 'contract detail/tag key count mismatch');
for (const key of programTypeKeys.contract) check(contractDetailKeys.has(key), `tagged contract key missing detail: ${key}`);
check(contractWebSourcePrograms === 12, `contract programs with official web enrichment: ${contractWebSourcePrograms}`);
check(contractWebSourceLinks === 17, `contract official web source link count: ${contractWebSourceLinks}`);
check(uniqueContractWebSourceUrls.size === 4, `unique contract official web source URL count: ${uniqueContractWebSourceUrls.size}`);
const contractAdmissionSlots = [
  ['교과', 'k1'], ['교과', 'k2'], ['교과', 'k3'], ['종합', 'j1'], ['종합', 'j2']
];
let contractProgramsWithPublishedScores = 0;
let contractDisplayedEntranceRows = 0;
let contractPublishedEntranceRows = 0;
for (const item of contractProgramDetails.programs) {
  const sourceRows = admissions.filter(row => row.u === item.u && row.m === item.m);
  const exactEntries = new Map();
  for (const row of sourceRows) {
    for (const [type, prefix] of contractAdmissionSlots) {
      if (!row[`${prefix}n`]) continue;
      const entry = { type, name: row[`${prefix}n`], s50: row[`${prefix}a`] || '', s70: row[`${prefix}b`] || '' };
      exactEntries.set([entry.type, entry.name, entry.s50, entry.s70].join('\u241f'), entry);
    }
  }
  const entries = [...exactEntries.values()];
  const namesWithPublishedScore = new Set(entries
    .filter(entry => entry.s50 || entry.s70)
    .map(entry => `${entry.type}\u241f${entry.name}`));
  const displayed = entries.filter(entry => entry.s50 || entry.s70 || !namesWithPublishedScore.has(`${entry.type}\u241f${entry.name}`));
  const published = displayed.filter(entry => entry.s50 || entry.s70).length;
  if (published) contractProgramsWithPublishedScores += 1;
  contractDisplayedEntranceRows += displayed.length;
  contractPublishedEntranceRows += published;
}
check(contractProgramsWithPublishedScores === 23, `contract programs with published admissions scores: ${contractProgramsWithPublishedScores}`);
check(contractDisplayedEntranceRows === 53, `contract displayed entrance row count: ${contractDisplayedEntranceRows}`);
check(contractPublishedEntranceRows === 35, `contract published entrance row count: ${contractPublishedEntranceRows}`);
const contractGradeMatchCount = (grade, range) => contractProgramDetails.programs.filter(item => {
  const sourceRows = admissions.filter(row => row.u === item.u && row.m === item.m && !row.su);
  return sourceRows.some(row => contractAdmissionSlots.some(([, prefix]) =>
    [`${prefix}a`, `${prefix}b`].some(field => {
      const score = parseFloat(row[field]);
      return Number.isFinite(score) && score >= grade - range && score <= grade + range;
    })
  ));
}).length;
check(contractGradeMatchCount(2.5, 0.3) === 4, `contract grade match sample 2.50 ±0.30: ${contractGradeMatchCount(2.5, 0.3)}`);
check(contractGradeMatchCount(4.5, 0.3) === 9, `contract grade match sample 4.50 ±0.30: ${contractGradeMatchCount(4.5, 0.3)}`);
const directoryRegionAliases = { '수도권': '경인권', '호남권': '전라권' };
const universityDirectoryPairs = new Set(admissions.map(row => `${directoryRegionAliases[row.r] || row.r}|${row.u}`));
check(universityDirectoryPairs.size === 223, `university-campus directory count: ${universityDirectoryPairs.size}`);
const seoulDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('서울|')));
check(seoulDirectoryPairs.size === 41, `Seoul university-campus directory count: ${seoulDirectoryPairs.size}`);
const gyeonginDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('경인권|')));
check(gyeonginDirectoryPairs.size === 46, `Gyeongin university-campus directory count: ${gyeonginDirectoryPairs.size}`);
const jejuDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('제주권|')));
check(jejuDirectoryPairs.size === 2, `Jeju university-campus directory count: ${jejuDirectoryPairs.size}`);
const gangwonDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('강원권|')));
check(gangwonDirectoryPairs.size === 10, `Gangwon university-campus directory count: ${gangwonDirectoryPairs.size}`);
const chungcheongDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('충청권|')));
check(chungcheongDirectoryPairs.size === 48, `Chungcheong university-campus directory count: ${chungcheongDirectoryPairs.size}`);
const jeollaDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('전라권|')));
check(jeollaDirectoryPairs.size === 28, `Jeolla university-campus directory count: ${jeollaDirectoryPairs.size}`);
const gyeongsangDirectoryPairs = new Set([...universityDirectoryPairs].filter(key => key.startsWith('경상권|')));
check(gyeongsangDirectoryPairs.size === 48, `Gyeongsang university-campus directory count: ${gyeongsangDirectoryPairs.size}`);
check(admissionsOfficeLinks.schemaVersion === 1, 'admissions-office link schema version');
const linkedUniversityPairs = Object.keys(admissionsOfficeLinks.links);
const missingSeoulLinks = [...seoulDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const missingGyeonginLinks = [...gyeonginDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const missingJejuLinks = [...jejuDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const missingGangwonLinks = [...gangwonDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const missingChungcheongLinks = [...chungcheongDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const missingJeollaLinks = [...jeollaDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const missingGyeongsangLinks = [...gyeongsangDirectoryPairs].filter(key => !admissionsOfficeLinks.links[key]);
const completedRegionPairs = new Set([...seoulDirectoryPairs, ...gyeonginDirectoryPairs, ...jejuDirectoryPairs, ...gangwonDirectoryPairs, ...chungcheongDirectoryPairs, ...jeollaDirectoryPairs, ...gyeongsangDirectoryPairs]);
const extraOutsideCompletedRegions = linkedUniversityPairs.filter(key => !completedRegionPairs.has(key));
check(linkedUniversityPairs.length === 223, `verified admissions-office link count across all regions: ${linkedUniversityPairs.length}`);
check(missingSeoulLinks.length === 0, `missing Seoul admissions-office links: ${missingSeoulLinks.join(', ')}`);
check(missingGyeonginLinks.length === 0, `missing Gyeongin admissions-office links: ${missingGyeonginLinks.join(', ')}`);
check(missingJejuLinks.length === 0, `missing Jeju admissions-office links: ${missingJejuLinks.join(', ')}`);
check(missingGangwonLinks.length === 0, `missing Gangwon admissions-office links: ${missingGangwonLinks.join(', ')}`);
check(missingChungcheongLinks.length === 0, `missing Chungcheong admissions-office links: ${missingChungcheongLinks.join(', ')}`);
check(missingJeollaLinks.length === 0, `missing Jeolla admissions-office links: ${missingJeollaLinks.join(', ')}`);
check(missingGyeongsangLinks.length === 0, `missing Gyeongsang admissions-office links: ${missingGyeongsangLinks.join(', ')}`);
check(extraOutsideCompletedRegions.length === 0, `unexpected links outside completed regions: ${extraOutsideCompletedRegions.join(', ')}`);
for (const [key, link] of Object.entries(admissionsOfficeLinks.links)) {
  check(universityDirectoryPairs.has(key), `admissions-office link key not in baseline: ${key}`);
  check(typeof link.displayName === 'string' && link.displayName.length > 0, `admissions-office display name missing: ${key}`);
  check(link.official === true, `admissions-office link not official: ${key}`);
  const usesOfficialProtocol = /^https:\/\//.test(link.url)
    || (key === '경인권|칼빈대' && /^http:\/\/www\.calvin\.ac\.kr\//.test(link.url))
    || (key === '충청권|중원대' && /^http:\/\/ipsi\.jwu\.ac\.kr\//.test(link.url));
  check(usesOfficialProtocol, `admissions-office link must use HTTPS, except verified official HTTP pages: ${key}`);
  check(link.target === '수시 모집요강', `admissions-office link target mismatch: ${key}`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(link.verifiedAt), `admissions-office link verification date: ${key}`);
  if (link.linkLabel !== undefined) {
    check(typeof link.linkLabel === 'string' && link.linkLabel.length > 0, `admissions-office link label: ${key}`);
  }
}
check(admissionsOfficeLinks.links['서울|고려대']?.url === 'https://oku.korea.ac.kr/oku/cms/FR_CON/index.do?MENU_ID=680', 'Korea University Seoul guideline URL');
check(admissionsOfficeLinks.links['서울|건국대']?.url === 'https://admission.konkuk.ac.kr/admission/37859/subview.do', 'Konkuk University Seoul guideline URL');
check(admissionsOfficeLinks.links['서울|세종대']?.url === 'https://ipsi.sejong.ac.kr/sub_page/sub1/0106_view.asp?B_CATEGORY=1&B_CODE=BOARD_1455878015&IDX=1128&gotopage=35&search_category=&searchstring=&tab1=1', 'Sejong University guideline URL');
check(admissionsOfficeLinks.links['강원권|가톨릭관동대']?.url === 'https://ipsi.cku.ac.kr/bbs/iphak/1059/365245/artclView.do', 'Catholic Kwandong University guideline URL');
check(admissionsOfficeLinks.links['충청권|금강대']?.url === 'https://www.ggu.ac.kr/matriculation/sub0401/view/id/56385', 'Geumgang University guideline URL');
check(admissionsOfficeLinks.links['경상권|경남대']?.url === 'https://ipsi.kyungnam.ac.kr/bbs/ipsi/1213/25547/artclView.do?layout=unknown', 'Kyungnam University guideline URL');
check(admissionsOfficeLinks.links['경상권|계명대']?.url === 'https://webtoon.kmu.ac.kr/webtoon/7314/subview.do', 'Keimyung University guideline URL');
check(admissionsOfficeLinks.links['경상권|부산교대']?.url === 'https://enter.bnue.ac.kr/content/susi01', 'Busan National University of Education guideline URL');
check(admissionsOfficeLinks.links['경인권|루터대']?.url === 'https://www.adiga.kr/cmm/com/file/fileDown.do?fileId=00000000000000251956&fileSn=1&menuId=PCUVTINF2000&downLogYn=Y&unvCd=0000108&searchSyr=2027', 'Luther University public portal guideline URL');
check(admissionsOfficeLinks.links['경인권|루터대']?.linkLabel === '대입정보포털 원문 ↗', 'Luther University public portal source label');
check(admissionsOfficeLinks.links['경인권|한세대']?.url === 'https://ipsi.hansei.ac.kr/view.do?no=1071', 'Hansei University guideline URL');
check(admissionsOfficeLinks.links['충청권|가톨릭꽃동네대']?.url === 'https://www.kkot.ac.kr/ipsi/board/read?boardManagementNo=1143&boardNo=26171&menuLevel=2&menuNo=120', 'Catholic Kkottongnae University guideline URL');
check(admissionsOfficeLinks.links['충청권|공군사관']?.url === 'https://www.goesn.kr/upload/sunae-h/na/bbs_14330/2026/05/10A2157C-604E-E695-74C8-23418E723695.pdf', 'Republic of Korea Air Force Academy education-office copy URL');
check(admissionsOfficeLinks.links['충청권|공군사관']?.linkLabel === '교육청 원문 사본 ↗', 'Republic of Korea Air Force Academy education-office source label');
check(admissionsOfficeLinks.links['충청권|대전신학대']?.url === 'https://ipsi.daejeon.ac.kr/', 'Daejeon Theological University guideline URL');
check(admissionsOfficeLinks.links['충청권|중원대']?.url === 'http://ipsi.jwu.ac.kr/site/siteView.jwu?categoryId=D2_4461&depth=2', 'Jungwon University guideline URL');
check(admissionsOfficeLinks.links['경상권|대신대']?.url === 'https://www.daeshin.ac.kr/html/02_admission/01_1.php', 'Daeshin University guideline URL');
check(admissionsOfficeLinks.links['경상권|영남신학대']?.url === 'https://entra.ytus.ac.kr/board/view/early_admissions/281', 'Youngnam Theological University guideline URL');
check(admissionsOfficeLinks.links['경상권|해군사관']?.url === 'https://www.navy.ac.kr:4443/iphak/1637/subview.do', 'Republic of Korea Naval Academy guideline URL');
check(Object.keys(minimums).length === 3576, `CSAT minimum count: ${Object.keys(minimums).length}`);
check(sha256(admissionsText) === manifest.admissions.sha256, 'admissions hash mismatch');
check(sha256(minimumText) === manifest.suneungMinimum.sha256, 'CSAT minimum hash mismatch');

let generated = fs.readFileSync(path.join(root, 'src', 'index.template.html'), 'utf8').replace(/\r\n/g, '\n');
generated = generated.replace('__RAW_DATA__', admissionsText).replace('__SNT_DATA__', minimumText);
generated = generated.replace('__CUTOFF_CURRENT__',JSON.stringify(JSON.parse(fs.readFileSync(path.join(root,'data/cutoff-current.json'),'utf8')).baseline));
generated = generated.replace('__ADMISSIONS_OFFICE_LINKS__', admissionsOfficeLinksText);
generated = generated.replace('__PROGRAM_TAGS__', programTagsText);
generated = generated.replace('__CONTRACT_PROGRAM_DETAILS__', contractProgramDetailsText);
check(!generated.includes('__RAW_DATA__') && !generated.includes('__SNT_DATA__') && !generated.includes('__ADMISSIONS_OFFICE_LINKS__') && !generated.includes('__PROGRAM_TAGS__') && !generated.includes('__CONTRACT_PROGRAM_DETAILS__'), 'build placeholder remains');
check(generated === html, 'generated HTML differs from index.html');

const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'sources', 'source-manifest.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data-update-audit-260813.json'), 'utf8'));
const programAudit = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'program-tags-audit-270830.json'), 'utf8'));
check(sourceManifest.sources.length === 4, 'official source manifest count');
const sourcesByRole = Object.fromEntries(sourceManifest.sources.map(source => [source.role, source]));
check(sourcesByRole['contract-program-directory']?.pages === 15, 'contract source manifest pages');
check(sourcesByRole['contract-program-directory']?.sha256 === '918E0090B796FB5317E5B422F57E990452C2904A1B2EE117D139F3A55330A6F1', 'contract source manifest hash');
check(sourcesByRole['advanced-program-directory']?.pages === 62, 'advanced source manifest pages');
check(sourcesByRole['advanced-program-directory']?.sha256 === '09B127CF881847582D32652CC8742CFDCE70FCF3E7ACE3A40F422CB92AB279AB', 'advanced source manifest hash');
check(audit.comparison.baselineKeysMissingFromWorkbook === 0, 'baseline key missing from 260813 workbook');
check(audit.comparison.workbookKeysNotInBaseline === 134, '260813 new key count changed');
check(audit.comparison.exactBaselineRowsPresent === 5807, 'exact baseline row count changed');
check(audit.comparison.baselineRowsChangedCorrectedOrUnmatched === 56, 'changed/corrected row count changed');
check(audit.comparison.unmatchedRowsWithDonggukOfficialCorrection === 51, 'Dongguk correction count changed');
check(!JSON.stringify(audit).includes('D:\\\\'), 'audit report contains an absolute Windows path');
check(programAudit.publicLinkCount === 252, 'program audit public link count');
check(programAudit.sources.contract.futureNewKeyExact.length === 1, 'contract future exact key count');
check(programAudit.sources.advanced.futureNewKeyExact.length === 9, 'advanced future exact key count');
check(!JSON.stringify(programAudit).includes('D:\\\\'), 'program audit contains an absolute Windows path');

const ignoredLocalDirectories = new Set(['.git', '.venv']);

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory() && ignoredLocalDirectories.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}
for (const file of listFiles(root)) {
  check(!/\.(xlsx?|pdf)$/i.test(file), `source binary must not be committed: ${path.relative(root, file)}`);
}

const allowedRoot = new Set([
  '.git', '.gitignore', 'README.md', 'data', 'docs', 'index.html',
  'modules', 'package.json', 'requirements.txt', 'scripts', 'sources', 'src'
]);
for (const entry of fs.readdirSync(root)) {
  if (ignoredLocalDirectories.has(entry)) continue;
  check(allowedRoot.has(entry), `unexpected public path: ${entry}`);
}
for (const file of fs.readdirSync(path.join(root, 'scripts'))) {
  check(['audit-source.py', 'build.mjs', 'extract-baseline.mjs', 'generate-program-tags.py', 'validate-public.mjs', 'link-application-2027.cjs', 'audit-cutoff-workbook.py', 'audit-cutoffs.cjs', 'import-cutoff-current.cjs', 'verify-cutoff-metrics.cjs'].includes(file), `unexpected script: ${file}`);
}

const admission2028Allowed = new Set([
  'README.md',
  'data/nationwide.json',
  'data/recommended-courses.json',
  'data/highschool-context.json',
  'scripts/course-ui.js',
  'courses.html',
  'src/courses.template.html',
  'data/verification.json',
  'index.html',
  'scripts/build.mjs',
  'scripts/link-baseline.cjs',
  'scripts/grade-ui.js',
  'scripts/real-ui.js',
  'scripts/verify.cjs',
  'src/index.template.html'
]);
for (const file of listFiles(admission2028Root)) {
  const relative = path.relative(admission2028Root, file).replaceAll('\\', '/');
  check(admission2028Allowed.has(relative), `unexpected 2028 module path: ${relative}`);
}
for (const expected of admission2028Allowed) {
  check(fs.existsSync(path.join(admission2028Root, ...expected.split('/'))), `missing 2028 module path: ${expected}`);
}

const contractsRoot=path.join(root,'modules','contracts-2028');
const contractsAllowed=new Set(['data.json','template.html','ui.js','build.mjs','verify.cjs','index.html']);
for(const file of listFiles(contractsRoot))check(contractsAllowed.has(path.relative(contractsRoot,file).replaceAll('\\','/')),`unexpected contract module file: ${path.relative(contractsRoot,file)}`);
for(const file of contractsAllowed)check(fs.existsSync(path.join(contractsRoot,file)),`missing contract module file: ${file}`);
const contractsHtml=fs.readFileSync(path.join(contractsRoot,'index.html'),'utf8');
check(contractsHtml.includes("connect-src 'none'"),'contract module no-network CSP missing');
check(!/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket/.test(contractsHtml),'contract module storage/network API found');
check(html.includes('id="contracts2028Frame"')&&html.includes("switchWorkspace('search');"),'default admissions-results workspace and separate contract frame missing');
const courses=JSON.parse(fs.readFileSync(path.join(admission2028Root,'data','recommended-courses.json'),'utf8'));
const courseHtml=fs.readFileSync(path.join(admission2028Root,'courses.html'),'utf8');
check(html.includes('id="workspace-tab-courses"')&&html.includes('id="coursesFrame"'),'separate recommended-courses tab missing');
check(courseHtml.includes("connect-src 'none'")&&!/localStorage|sessionStorage|indexedDB|sendBeacon|fetch\(|XMLHttpRequest|WebSocket/.test(courseHtml),'course document network/storage boundary failed');
check(courses.rows.length===914&&new Set(courses.rows.map(r=>r.university)).size===44&&courses.policies.length===45,'public recommended-course dataset coverage changed');

if (errors.length) {
  console.error(errors.map(error => `[FAIL] ${error}`).join('\n'));
  process.exit(1);
}
console.log('[PASS] V12.0.0 public label, top workspace tabs, core UI, and inline JavaScript');
console.log('[PASS] student mock-exam data and loader remain excluded');
console.log('[PASS] baseline counts, 223 university-campus directory entries, and SHA-256 fingerprints');
console.log(`[PASS] all ${seoulDirectoryPairs.size} Seoul and all ${gyeonginDirectoryPairs.size} Gyeongin university-campus entries have verified rolling-admissions guideline links`);
console.log(`[PASS] all ${jejuDirectoryPairs.size} Jeju university-campus entries have verified official rolling-admissions guideline links`);
console.log(`[PASS] all ${gangwonDirectoryPairs.size} Gangwon university-campus entries have verified official rolling-admissions guideline links`);
console.log(`[PASS] all ${chungcheongDirectoryPairs.size} Chungcheong university-campus entries have verified rolling-admissions guideline links`);
console.log(`[PASS] all ${jeollaDirectoryPairs.size} Jeolla university-campus entries have verified official rolling-admissions guideline links`);
console.log(`[PASS] all ${gyeongsangDirectoryPairs.size} Gyeongsang university-campus entries have verified rolling-admissions guideline links`);
console.log('[PASS] fallback source labels identify the public admissions portal and education-office copy');
console.log('[PASS] template build reproduces index.html');
console.log('[PASS] 252 verified contract/advanced program keys, filters, badges, and source pages');
console.log('[PASS] 35 contract-program detail records and badge-to-detail navigation structure');
console.log('[PASS] contract detail admissions results: 23 programs, 35 published rows, 18 unpublished rows');
console.log('[PASS] synchronized contract grade-range controls and light-red match-card rules');
console.log('[PASS] official-web enrichment: 12 programs, 17 source links, 4 unique official URLs');
console.log('[PASS] integrated 2028 explorer: 21,720 active, 20,153 verified, 1,567 needs research');
console.log('[PASS] 260813 and program-tag source audits plus public source-binary boundary');
console.log('[PASS] recovery project file allowlist');
