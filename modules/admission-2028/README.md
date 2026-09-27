# 2028 대입 탐색 모듈

수시 입결 검색기의 `2028 대입 탐색` 탭에서 한 번만 지연 로드되는 독립 모듈입니다. 탭을 전환해도 iframe을 다시 만들지 않으므로 입력 상태가 페이지 메모리에 유지됩니다.

## 기준선

- 전체 데이터 레코드: 22,751개
- 2028 현재 탐색 분모: 21,720개
- 2028 공식 확인: 20,153개
- 추가조사 필요: 1,567개
- 보관 처리: 1,031개 (`legacyDisposition2028`, 검색 제외)
- 과거 입결 원본 행: 16,412개
- 확인율: 92.7854511970534%

`researchStatus="needs-research"`인 항목은 공식 확인으로 승격하지 않으며, 화면에서 `추가조사 필요`와 `과거 입결 참고`로 표시합니다.

## 구조와 명령

```text
index.html                 # 정적 실행 파일
src/index.template.html    # 데이터·UI 삽입 전 템플릿
data/nationwide.json       # 현재 2028 탐색 데이터
data/verification.json     # 통합 검증 결과
scripts/real-ui.js         # 후보·지원자격·필터 로직
scripts/grade-ui.js        # 과목별 내신 입력 로직
scripts/build.mjs          # 템플릿에서 index.html 재생성
scripts/verify.cjs         # 통합 회귀 검사
```

```powershell
node modules/admission-2028/scripts/build.mjs --check
node modules/admission-2028/scripts/verify.cjs
```

학생 입력은 서버·외부 API·텔레메트리·브라우저 영구 저장소로 전송하거나 저장하지 않습니다. `data/nationwide.json`에는 공개 입시자료만 포함하며, 로컬 원본 CSV의 절대경로는 제거하고 SHA-256만 보존합니다.
