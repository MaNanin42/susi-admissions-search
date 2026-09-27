# 수시 입결 검색기 V11.0.0 인계서

## 현재 상태

- 기준일: 2026-08-30
- GitHub 저장소: `MaNanin42/susi-admissions-search`
- GitHub Pages: `https://mananin42.github.io/susi-admissions-search/`
- 복구 기준 커밋: `6b816606a56ca9324e44e8a9ddec7e8db921a034`
- 공개 기준선: 입결 5,863행, 대학·모집단위 키 5,800개, 수능최저 3,576건
- 개인정보 경계: 학생 모의고사 성적, 반·번호 선택기, 자동 성적 불러오기 코드는 공개본에 없음
- V11.0.0 기능: V10.7.2의 계약·첨단학과 기능과 `2028 대입 탐색` 독립 모듈을 네 번째 작업 탭으로 통합
- 배포 상태: V11.0.0 GitHub Pages 배포본
- 입결·수능최저 데이터: V10.6 검증 기준선 5,863행·3,576건을 그대로 유지

## 복구된 구조

- `index.html`: V11.0.0 배포 산출물
- `src/index.template.html`: 대용량 데이터만 플레이스홀더로 분리한 HTML 소스
- `data/baseline/admissions.json`: V10.6 입결 기준 데이터
- `data/baseline/suneung-minimum.json`: V10.6 수능최저 기준 데이터
- `data/baseline/manifest.json`: 데이터 건수와 SHA-256
- `data/program-tags.json`: 현재 기준선과 유일 정확 일치한 계약·첨단학과 태그 252개
- `data/contract-program-details.json`: 연결된 계약학과 35개의 유형·협약기관·지원·선발·의무조건·주의사항 요약
- 계약학과 현재 입결 연결: 35개 중 공개 수치가 있는 모집단위 23개, 공개 전형 35건, 미공개 전형 18건
- 계약학과 공식 웹 보완: 가천대 5개·경일대 4개·유원대 3개, 총 12개 모집단위에 공식 URL과 2026-08-31 확인일 기록
- `scripts/build.mjs`: 템플릿과 기준 데이터로 `index.html` 재구성 및 동등성 검사
- `scripts/validate-public.mjs`: 문법, 기능 표식, 개인정보 경계, 데이터 해시, 빌드 동등성 검사
- `scripts/audit-source.py`: 공식 XLSX/PDF와 기준선 비교
- `scripts/generate-program-tags.py`: 대교협 PDF 표 재추출, 대학 약칭 정규화, 유일 정확 일치 태그 생성
- `docs/program-tags-audit-270830.json`: 393행의 연결·검토 건수와 매핑 정책 기록
- `sources/source-manifest.json`: 원본 위치, 크기, 해시, 구조 기록
- `modules/admission-2028`: 2028 탐색 실행 HTML, 21,720개 현재 후보 데이터, UI 원본, 재생성·통합 검증 스크립트
- 2028 탐색 기준선: 공식 확인 20,153개, 추가조사 필요 1,567개, 보관·검색 제외 1,031개, 과거 입결 원본 16,412행, 확인율 92.7854511970534%
- 2028 개인정보 경계: 학생 입력은 iframe 페이지 메모리에만 유지하며 서버 저장·외부 전송·AI API·텔레메트리·영구 저장소 없음

## 260813 원본과의 차이

현재 V10.6의 5,800개 대학·모집단위 키는 260813 XLSX에 전부 존재한다. 삭제된 키는 0개다. 다만 XLSX에는 V10.6에 없는 키가 134개 추가되어 있다. 행의 전형·입결 값까지 비교하면 5,863행 중 5,807행이 정확히 일치하고 56행은 다르다. 이 중 51행은 `donggukOfficial` 보정 항목이다.

동국대 외 확인 대상 5행은 인천가톨릭대 간호학과·자유전공·문화콘텐츠학과·신학과와 경인교대 초등교육과다. 상세 목록과 신규 키 134개 전체 목록은 `docs/data-update-audit-260813.json`에 있다.

이 134개는 아직 배포본에 넣지 않았다. 유실된 기존 작업에는 다음과 같은 별도 규칙이 있었기 때문이다.

- 2027 모집단위와 2026 입결의 연결·중복 처리
- 교과/종합 전형 슬롯 선택과 빈 값 처리
- 수능최저 전형명 연결 및 자동판정 제한
- 동국대 학교장추천인재 공식 PDF 보정값과 원본 NAVI 값의 분리 표시
- 상담 후보 담기, 비교, 인쇄 기능의 식별자 안정성

134개를 단순 추가하거나 XLSX 전체를 그대로 변환하면 이 규칙을 훼손할 수 있다. 후속 작업에서는 `docs/data-update-audit-260813.json`을 출발점으로 삼는다.

## 검증 명령

```powershell
node scripts/build.mjs --check
node scripts/validate-public.mjs
node modules/admission-2028/scripts/build.mjs --check
node modules/admission-2028/scripts/verify.cjs
```

대교협 PDF 태그 재생성·동등성 확인:

```powershell
& <pdfplumber-installed-python> scripts/generate-program-tags.py
```

공식 원본 대조:

```powershell
& <bundled-python> scripts/audit-source.py `
  --workbook "<260813-xlsx-path>" `
  --guidebook "<260713-pdf-path>" `
  --output docs/data-update-audit-260813.json
```

## 후속 작업 순서

1. 134개 신규 키의 실제 전형·입결 값과 중복 여부를 분류한다.
2. 값이 다른 56행 중 동국대 공식 보정 51행을 제외한 5행의 원인을 확인한다.
3. 기존 5,863행이 바뀌지 않는 증분 변환기를 만든다.
4. 동국대 보정 필드 `k1navi50`, `k1navi70`, `k1appAvg`, `k1metric`을 보존한다.
5. 수능최저 3,576건의 연결률과 자동판정 상태를 별도로 비교한다.
6. 계약학과 검토 42행·첨단학과 검토 96행은 공식 모집단위 구조를 확인한 뒤 명시적 매핑만 추가한다.
7. 260813 데이터 갱신은 현재 V11.0.0 기준선을 직접 덮어쓰지 말고 검증된 후속 데이터 버전으로 만든다.
8. 공개 전 `node scripts/validate-public.mjs`와 실제 Pages HTTP 검사를 모두 통과시킨다.

## 금지 사항

- 학생 이름·반·번호·모의고사 성적을 이 공개 저장소에 추가하지 않는다.
- 공식 XLSX/PDF 바이너리를 현재 공개 저장소에 직접 커밋하지 않는다.
- 계약학과를 일괄적으로 채용 보장으로 표시하거나 첨단학과 자료를 입결·경쟁률로 해석하지 않는다.
- 계약학과 상세정보의 빈 항목을 `조건 없음`으로 해석하거나, 특정 전형·기업 인원 조건을 학과 전체 조건으로 확대하지 않는다.
- 검증 없이 `index.html`만 수동 편집하거나 260813 데이터로 일괄 교체하지 않는다.
- GitHub Pages의 `main` 루트 배포 설정을 임의로 변경하지 않는다.
