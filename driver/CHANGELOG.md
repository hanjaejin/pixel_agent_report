# 변경 이력 (Changelog) — Pixel Agents OpenRouter 드라이버

`driver/`(OpenRouter 드라이버) 작업의 버전별 변경 이력입니다.
형식은 [Keep a Changelog](https://keepachangelog.com/ko/) 를 따르며, 최신 버전이 위에 옵니다.

분류: **Features**(추가 기능) · **Fixes**(버그 수정) · **Maintenance**(빌드/테스트/구조) · **Docs**(문서) · **Known Issues**(알려진 한계)

---

## [V1.1.2] — 2026-06-27 · 추가기능 F1~F6 (PLAN_2)

> 1차 PoC 위에 6가지 기능을 얹음. F1~F4는 `driver/`만, **F5·F6은 (승인하에) 원본 `core/`·`server/`·`webview-ui/`까지 수정**.

### ✨ Features
- **F1 — 에이전트 정의 외부화(`agents.json`)**: 코드 수정 없이 에이전트 추가/수정. 필드 단위 검증 + 위치 포함 친절한 한국어 에러. 파일 없으면 기본값 폴백(회귀 0). 환경변수 `PIXEL_AGENTS_FILE`.
- **F2 — 페르소나(성격/말투)**: `persona` 필드를 시스템 프롬프트에 주입 → 행동·이유(reason)에 성격 반영.
- **F3 — SKILL.md 참조**: `skillFile` 마크다운을 "참고 자료"로 주입. 길이 상한(4000자)으로 토큰 비용 보호, 없는 파일 graceful.
- **F4 — 모델 폴백(자동 대체)**: 영구 에러(404/402/401)면 `fallbackModels`로 자동 전환, 일시 에러(429/5xx)는 지수 백오프. `OpenRouterError{status}` 도입.
- **F5 — 화면에서 모델 선택(풀스택)**: 브라우저 Settings의 "Agent Models" 드롭다운으로 모델 변경 → 다음 행동부터 즉시 적용. `server↔driver` 제어 채널(`POST /api/driver/state`, `GET /api/driver/commands`) + `Agent.getModel/setModel` 런타임 hot-swap. 환경변수 `PIXEL_PANEL`.
- **F6 — 한↔영 전환**: 화면 UI 텍스트(Settings) ko/en 토글(localStorage) + 드라이버 로그 ko/en(`PIXEL_LANG`). (오피스 활동 라벨은 서버 공유 부분이라 영어 유지.)

### 🐛 Fixes
- **마젠타 화면(바닥/가구 안 보임)**: 저장된 `~/.pixel-agents/layout.json` 손상(30×15인데 타일 1개)으로 기본 오피스를 덮어씀 → 손상 파일 삭제로 기본 레이아웃 복구(README 문제해결에 반영).
- **진짜 AI 401**: API 키를 루트 `.env`에 넣어 발생(드라이버는 `driver/.env` 사용) → 키 이동 + CRLF 정리.
- **모델 404/402/429**: 예시 모델 ID 무효·무료모델 한도/레이트리밋 → 유효한 저렴 유료 소형모델 + F4 폴백으로 해소.

### 🧰 Maintenance
- 단위 테스트 **58 → 98**(driver). server `driverControl.test.ts`, webview `i18n.test.ts` 추가.
- `core/asyncapi.yaml`에 `agentModels`/`setAgentModel`/`AgentModelEntry` 추가 → `messages.ts` 재생성(드리프트 0).
- webview 픽셀 ESLint(색상/섀도/폰트) 0 위반, 기존 server/webview 테스트 회귀 0, 전 패키지 타입체크 통과.
- `agents.json`을 `.gitignore`에 추가(템플릿은 `agents.example.json`).

### 📖 Docs
- ADR **013~020** 추가, 단계 보고서 **STAGE-F1~F6** 추가, `TEST_LOG.md` 갱신.
- `PLAN_2.md`(추가기능 계획), `리얼테스트_가이드.md` 신규.
- README/종합 리포트에 기능별 동작 방법·예시 + 원본 대비 변경점(파일별) 상세화.

### ⚠️ Known Issues
- **오피스 화면 라벨이 전부 `driver`**: 에이전트 이름(김대리…)은 드라이버 터미널 로그에만 표시(오피스 라벨은 워크스페이스 폴더명 사용). 화면 표시는 F5 제어 채널 추가 확장 필요(향후).

---

## [V1.1.1] — 2026-06-26 · 최초/1차 (OpenRouter 드라이버 PoC)

> Claude Code 없이 OpenRouter 작은 모델(SLM)로 N명 에이전트를 구동해 기존 픽셀 오피스에 캐릭터로 표시하는 `driver/` 신규 개발.

### ✨ Features
- **OpenRouter 드라이버(`driver/`)**: 한 프로세스가 N명 에이전트를 병렬 구동. 각 에이전트가 OpenRouter로 다음 행동(`read/write/run/rest`)을 결정.
- **행동 → 훅 신호 변환**: 행동을 서버가 이해하는 Claude 훅(`SessionStart/PreToolUse/PostToolUse/Stop/SessionEnd`)으로 변환 → 캐릭터가 걷기/타이핑/읽기/대기.
- **에이전트별 다른 모델**: 김대리·박사원·이주임이 각각 다른 SLM 모델 사용.
- **한국어 컬러 로그**: `[이름] 이모지 메시지` 형식, 화면 동작과 1:1 대응.
- **SLM 출력 안정화**: action 4종 enum + JSON 강제 + 파싱 폴백(rest).
- **비용·레이트리밋 보호**: 루프 주기 하한 + 동시 호출 세마포어 + 지수 백오프.
- **체험 모드(`npm run smoke`)**: 키 없이 가짜 AI로 캐릭터 동작 확인. `check:integration` 자동 점검 스크립트.

### 🐛 Fixes
- **`server.json` 인증**: 실제 CLI는 `authToken`이 아니라 **`token`** 필드 사용(문서 오류) → `token` 우선 + `authToken` 폴백.
- **`npx pixel-agents` 안 됨**: npm 배포본 1.0.2는 CLI bin 없음 → 로컬 레포 빌드 후 `node dist/cli.js`.
- **빌드 TS5097**: 첫 로컬 value import(`.ts`)에서 tsc 방출 거부 → `noEmit`+`allowImportingTsExtensions`, 실행은 `tsx`, build=타입체크.

### 🧰 Maintenance
- **TDD**: 단위 테스트 **58개**(네트워크/디스크 없이 IO 주입). 모든 함수 한국어 주석.
- **기존 코드 무수정**: `server/`·`webview-ui/`·`core/`·`adapters/vscode/` 소스 변경 0건(빌드만).
- 독립 npm 프로젝트(`type:module`, vitest/tsx).

### 📖 Docs
- ADR **001~012**, 단계 보고서 **STAGE-1~8**, `TEST_LOG.md`, `PLAN.md`.
- README + 초보자용 `사용설명서.md`, 종합 리포트.

### ⚠️ Known Issues
- **웹뷰 새로고침 시 캐릭터 사라짐**: 상위 webview 버그(`existingAgents`가 `layoutLoaded` 뒤 도착) → 운영수칙(서버→브라우저→드라이버 순서, 새로고침 금지)으로 회피.
