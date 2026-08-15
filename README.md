# 수시 입결 검색기 V10.6 공개용

2027학년도 수시 상담을 위한 단일 HTML 검색 도구입니다. GitHub Pages에는 학생 개인정보를 제거한 공개본만 배포합니다.

## 사이트

- 공개 주소: https://mananin42.github.io/susi-admissions-search/
- 배포 방식: GitHub Pages, `main` 브랜치 루트

## 기능

- 대학·모집단위별 교과/종합 입결 검색
- 수능최저 참고 판정과 수동 등급 입력
- 상담 후보 담기·비교·인쇄
- 학생 모의고사 원본, 반·번호별 성적, 자동 성적 불러오기는 포함하지 않음

## 개발 구조

현재 배포 HTML에서 데이터와 템플릿을 분리해 재구성 가능한 기준선을 복구했습니다.

```text
index.html                         # 배포 산출물
src/index.template.html            # HTML/JS/CSS 템플릿
data/baseline/admissions.json      # 입결 5,863행
data/baseline/suneung-minimum.json # 수능최저 3,576건
scripts/build.mjs                  # 재구성·동등성 검사
scripts/validate-public.mjs        # 공개본 종합 검사
scripts/audit-source.py            # 공식 원본 대조
docs/HANDOFF.md                    # 후속 작업 인계서
```

## 검증

```powershell
node scripts/build.mjs --check
node scripts/validate-public.mjs
```

## 최신 공식 원본

원본 XLSX/PDF는 인접한 로컬 진로진학자료집 폴더에 보관하고 공개 저장소에는 커밋하지 않습니다. 위치와 SHA-256은 `sources/source-manifest.json`에 기록했습니다.

260813 XLSX에는 현재 V10.6의 대학·모집단위 키가 모두 남아 있고 신규 키 134개가 있습니다. 기존 5,863행 중 5,807행은 값까지 일치하며, 다른 56행 중 51행은 동국대 공식 보정 항목입니다. 신규 항목과 나머지 차이는 유실된 연결·보정 규칙을 복구한 뒤 새 버전에서 반영해야 하며, 현재 V10.6에는 아직 적용하지 않았습니다.

자세한 상태와 후속 절차는 `docs/HANDOFF.md`를 확인하십시오.

## 주의

입결과 수능최저 표시는 상담 참고용입니다. 대학의 최종 모집요강과 공식 발표 자료를 반드시 함께 확인하십시오.
