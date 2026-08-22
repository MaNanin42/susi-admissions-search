import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');

const forbidden = [
  'STUDENT_MOCK_GRADES', 'STUDENT_GRADE_INPUTS', 'studentClass',
  'studentNumber', 'studentLoadStatus'
];
for (const token of forbidden) check(!html.includes(token), `private token: ${token}`);

check(html.includes('2027학년도 V10.7.1'), 'version missing');
check(html.includes('<title>수시 입결 검색기 | 2027학년도 V10.7.1 공개용</title>'), 'public-only title missing');
check(html.includes('id="workspace-tab-search"') && html.includes('id="workspace-tab-admissions"'), 'top workspace tabs missing');
check(html.includes('id="workspace-search"') && html.includes('id="workspace-admissions"'), 'top workspace panels missing');
check(html.includes('function switchWorkspace(workspace)'), 'top workspace switching logic missing');
check(html.includes('id="admissionsRegionFilters"') && html.includes('id="admissionsDirectory"'), 'admissions directory UI missing');
check(html.includes('const UNIVERSITY_CAMPUS_LABELS'), 'campus display mapping missing');
check(html.includes('const ADMISSIONS_OFFICE_LINKS'), 'verified admissions-office links missing');
check(!html.includes('class="criteria-strip"'), 'removed criteria strip returned');
check(!html.includes('공개용 · 학생 성적 미포함'), 'removed public privacy badge returned');
check(html.includes('id="sntK"') && html.includes('id="sntM"'), 'manual CSAT inputs missing');
check(html.includes('id="pickList"') && html.includes('id="comparePickedBtn"'), 'shortlist UI missing');

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
check(scripts.length > 0, 'inline script missing');
scripts.forEach((code, index) => {
  try { new vm.Script(code, { filename: `inline-${index + 1}.js` }); }
  catch (error) { errors.push(`JavaScript syntax: ${error.message}`); }
});

const admissionsText = fs.readFileSync(path.join(root, 'data', 'baseline', 'admissions.json'), 'utf8').trim();
const minimumText = fs.readFileSync(path.join(root, 'data', 'baseline', 'suneung-minimum.json'), 'utf8').trim();
const admissionsOfficeLinksText = fs.readFileSync(path.join(root, 'data', 'admissions-office-links.json'), 'utf8').trim();
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'data', 'baseline', 'manifest.json'), 'utf8'));
const admissions = JSON.parse(admissionsText);
const minimums = JSON.parse(minimumText);
const admissionsOfficeLinks = JSON.parse(admissionsOfficeLinksText);
check(admissions.length === 5863, `admissions count: ${admissions.length}`);
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
generated = generated.replace('__ADMISSIONS_OFFICE_LINKS__', admissionsOfficeLinksText);
check(!generated.includes('__RAW_DATA__') && !generated.includes('__SNT_DATA__') && !generated.includes('__ADMISSIONS_OFFICE_LINKS__'), 'build placeholder remains');
check(generated === html, 'generated HTML differs from index.html');

const sourceManifest = JSON.parse(fs.readFileSync(path.join(root, 'sources', 'source-manifest.json'), 'utf8'));
const audit = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'data-update-audit-260813.json'), 'utf8'));
check(sourceManifest.sources.length === 2, 'official source manifest count');
check(audit.comparison.baselineKeysMissingFromWorkbook === 0, 'baseline key missing from 260813 workbook');
check(audit.comparison.workbookKeysNotInBaseline === 134, '260813 new key count changed');
check(audit.comparison.exactBaselineRowsPresent === 5807, 'exact baseline row count changed');
check(audit.comparison.baselineRowsChangedCorrectedOrUnmatched === 56, 'changed/corrected row count changed');
check(audit.comparison.unmatchedRowsWithDonggukOfficialCorrection === 51, 'Dongguk correction count changed');
check(!JSON.stringify(audit).includes('D:\\\\'), 'audit report contains an absolute Windows path');

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
  'package.json', 'requirements.txt', 'scripts', 'sources', 'src'
]);
for (const entry of fs.readdirSync(root)) {
  if (ignoredLocalDirectories.has(entry)) continue;
  check(allowedRoot.has(entry), `unexpected public path: ${entry}`);
}
for (const file of fs.readdirSync(path.join(root, 'scripts'))) {
  check(['audit-source.py', 'build.mjs', 'extract-baseline.mjs', 'validate-public.mjs'].includes(file), `unexpected script: ${file}`);
}

if (errors.length) {
  console.error(errors.map(error => `[FAIL] ${error}`).join('\n'));
  process.exit(1);
}
console.log('[PASS] V10.7.1 label, top workspace tabs, core UI, and inline JavaScript');
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
console.log('[PASS] 260813 source audit and public source-binary boundary');
console.log('[PASS] recovery project file allowlist');
