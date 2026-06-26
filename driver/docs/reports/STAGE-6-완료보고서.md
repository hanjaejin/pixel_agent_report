# 단계 6 완료 보고서 — index.ts + config.ts + 라이브 통합 검증

- 날짜: 2026-06-26
- 상태: ✅ 완료 (office 연동 라이브 검증 PASS)

## 목표
설정 기반으로 N명 에이전트를 병렬 구동하고, **실서버에서 캐릭터 등장→행동→퇴장**을 검증한다.

## 만든 것
| 파일 | 역할 |
|------|------|
| [src/config.ts](../../src/config.ts) | 에이전트 정의(김대리/박사원/이주임 + 각자 다른 모델), `loadDriverConfig`, `validateAgents` |
| [src/index.ts](../../src/index.ts) | 진입점 `main` + 오케스트레이션(`runAll`/`stopAll`), SIGINT graceful 종료 |
| [scripts/smoke.ts](../../scripts/smoke.ts) | 키 없이 무한 구동(브라우저 육안 확인용) |
| [scripts/integration-check.ts](../../scripts/integration-check.ts) | 키 없이 bounded 통합 검증(훅 200/채택 자동 판정) |
| [__tests__/config.test.ts](../../__tests__/config.test.ts), [__tests__/orchestrator.test.ts](../../__tests__/orchestrator.test.ts) | 단위 테스트 9건 |

## 주요 결정 (ADR)
- [ADR-009](../adr/ADR-009-graceful-shutdown.md): 종료 시 SessionEnd 로 캐릭터 퇴장
- [ADR-010](../adr/ADR-010-agent-isolation.md): 에이전트 격리(한 명 실패 비전파)

## 라이브 검증 절차 (실제 수행)
1. npm 배포본(`pixel-agents` 1.0.2)은 **CLI bin 이 없어** `npx`로 서버 기동 불가 → **로컬 레포(1.3.0) 빌드**.
   - 루트 `npm install --ignore-scripts` → `node esbuild.js`(cli/hooks/assets) → webview `vite build`.
   - `node dist/cli.js --port 3100` 으로 standalone 서버 기동.
2. `PIXEL_WORKSPACE`=서버 워크스페이스로 맞춰 `npm run check:integration` 실행.

## 검증 결과
- 단위 테스트: **9 passed**(누적 **48/48**, token 버그 수정 테스트 포함) ✅
- 라이브(서버 로그 확인):
  - 훅 POST **24건 전부 200**, 실패 0.
  - **Agent 1·2·3 생성**(외부 세션 채택), PreToolUse/PostToolUse 활동, **SessionEnd(exit) 퇴장**.
  - 드라이버 터미널에 한국어 로그가 화면 동작과 1:1 대응(🚪/📖/✏️/⚙️/🏠).

## 발견·수정한 버그
- **server.json 필드**: 실제 CLI 는 `authToken` 이 아니라 **`token`** 사용 → `readServerInfo` 를
  `token` 우선 + `authToken` 폴백으로 수정. ADR-001 정정.

## 완료 기준 충족 (최종 5개 중)
- [x] 1. 드라이버 실행 → 오피스에 N개 캐릭터 등장 (서버 로그로 확인)
- [x] 2. 각 캐릭터 독립 행동(타이핑/읽기/대기) 반복 (브라우저 육안 + 로그)
- [x] 3. 한국어 업무 로그 ↔ 화면 동작 1:1 대응
- [x] 4. `claude` 프로세스 전혀 미실행 (드라이버 + fake/실 LLM 만 사용)
- [x] 5. 에이전트마다 다른 OpenRouter 모델 (config 의 3개 모델; 실 LLM 경로는 키 투입 시)

## 남은 선택 항목
- 실제 LLM end-to-end: `driver/.env` 에 `OPENROUTER_API_KEY` 넣고 `npm run start:env`.
  openrouter 단위테스트(10건)로 파싱/호출은 검증됨 → 키만 있으면 동일 흐름.

## 알려진 이슈 — 웹뷰 새로고침 시 캐릭터 사라짐 (드라이버 무관)

- 증상: 브라우저를 **새로고침**하면 이미 떠있던 캐릭터가 화면에서 사라진다(서버엔 살아있음).
- 원인: 웹뷰 상위 버그. webviewReady 응답 순서가 `layoutLoaded`(3번) → `existingAgents`(6번)인데,
  웹뷰의 `existingAgents` 핸들러는 "이후에 올 `layoutLoaded`"를 기다리며 버퍼링한다
  ([useExtensionMessages.ts:242](../../../webview-ui/src/hooks/useExtensionMessages.ts#L242)).
  `layoutLoaded` 가 이미 지나갔으므로 버퍼가 비워지지 않는다.
  → **연결된 상태에서 새로 생성되는 `agentCreated` 만 렌더된다.**
- 결정(사용자): **웹뷰는 수정하지 않고 운영수칙으로 회피**(1단계 webview 불변 원칙 유지).
- 운영수칙(README 반영): **① 서버 기동 → ② 브라우저 열기 → ③ 드라이버 실행** 순서로 하고,
  **브라우저를 새로고침하지 않는다.** 새로고침했다면 드라이버를 재시작하면 다시 보인다.

## 다음 단계
- 단계 7 (비용·레이트리밋·백오프 TDD), 단계 8 (문서화·공개 준비 — 운영수칙 README 명시).
