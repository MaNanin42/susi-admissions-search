# 수시 입결 검색기 V10.6 인계서

## 현재 상태

- 기준일: 2026-08-16
- GitHub 저장소: `MaNanin42/susi-admissions-search`
- GitHub Pages: `https://mananin42.github.io/susi-admissions-search/`
- 복구 기준 커밋: `6b816606a56ca9324e44e8a9ddec7e8db921a034`
- 공개 기준선: 입결 5,863행, 대학·모집단위 키 5,800개, 수능최저 3,576건
- 개인정보 경계: 학생 모의고사 성적, 반·번호 선택기, 자동 성적 불러오기 코드는 공개본에 없음

## 복구된 구조

- `index.html`: GitHub Pages가 제공하는 현재 공개 산출물
- `src/index.template.html`: 대용량 데이터만 플레이스홀더로 분리한 HTML 소스
- `data/baseline/admissions.json`: V10.6 입결 기준 데이터
- `data/baseline/suneung-minimum.json`: V10.6 수능최저 기준 데이터
- `data/baseline/manifest.json`: 데이터 건수와 SHA-256
- `scripts/build.mjs`: 템플릿과 기준 데이터로 `index.html` 재구성 및 동등성 검사
- `scripts/validate-public.mjs`: 문법, 기능 표식, 개인정보 경계, 데이터 해시, 빌드 동등성 검사
- `scripts/audit-source.py`: 공식 XLSX/PDF와 기준선 비교
- `sources/source-manifest.json`: 원본 위치, 크기, 해시, 구조 기록

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
6. 새 버전은 V10.6을 덮어쓰지 말고 V10.7 이상으로 만든다.
7. 공개 전 `node scripts/validate-public.mjs`와 실제 Pages HTTP 검사를 모두 통과시킨다.

## 금지 사항

- 학생 이름·반·번호·모의고사 성적을 이 공개 저장소에 추가하지 않는다.
- 공식 XLSX/PDF 바이너리를 현재 공개 저장소에 직접 커밋하지 않는다.
- 검증 없이 `index.html`만 수동 편집하거나 260813 데이터로 일괄 교체하지 않는다.
- GitHub Pages의 `main` 루트 배포 설정을 임의로 변경하지 않는다.
