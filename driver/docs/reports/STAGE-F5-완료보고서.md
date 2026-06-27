# 기능 단계 F5 완료 보고서 — 오피스 화면에서 에이전트별 모델 선택 (풀스택)

- 날짜: 2026-06-27
- 상태: ✅ 완료 (F5-1 ~ F5-5)
- 관련: PLAN_2 F5

## 목표
오피스 화면(Settings)에서 에이전트별 모델을 골라 **다음 행동부터 즉시 교체**. driver·core·server·webview 풀스택.

## 서브스텝별 결과
| 서브스텝 | 내용 | 검증 |
|----------|------|------|
| F5-1 (driver) | `Agent.getModel/setModel` 런타임 hot-swap | 단위 +2 (89/89) |
| F5-2 (core) | `asyncapi.yaml`에 `agentModels`/`setAgentModel`/`AgentModelEntry` + messages.ts 재생성 | validate/generate/check-types/드리프트 ✅ |
| F5-3 (server) | `driverControl.ts` + `POST /api/driver/state`·`GET /api/driver/commands` + `setAgentModel` 핸들 + sessionId↔agentId 매핑 + `agentModels` broadcast | server 단위(driverControl) + 격리 81 ✅ |
| F5-4 (driver) | `office.reportDriverState/pollCommands` + `runControlTick` 1.5s 제어 루프 | 단위 +5 (94/94) |
| F5-5 (webview) | `agentModels` 수신 → Settings "Agent Models" 드롭다운 → `setAgentModel` 송신 | typecheck/lint/build/webview 41 ✅ |

## 전체 흐름
```
driver(setModel 가능) ─POST /api/driver/state→ server ─agentModels broadcast→ webview(드롭다운)
webview ─setAgentModel→ server(agentId→sessionId, 명령 큐) ←GET /api/driver/commands─ driver(setModel)
```

## 주요 결정 (ADR)
- [ADR-017](../adr/ADR-017-runtime-model-hotswap.md): 모델 런타임 hot-swap
- [ADR-019](../adr/ADR-019-server-driver-control-channel.md): server↔driver 제어 채널(보고+명령 폴링)
- [ADR-020](../adr/ADR-020-asyncapi-protocol-extension.md): AsyncAPI 프로토콜 확장 절차

## 검증 결과
- driver 단위: **94/94** ✅, server 격리: **81** ✅, webview 단위: **41** ✅
- `check-types`(root+server+webview), webview build, webview eslint(픽셀 규칙) 모두 통과
- core 프로토콜 재생성 멱등(드리프트 0)

## 완료 기준 충족 / 남은 것
- [x] 화면(Settings)에서 모델 선택 → driver `setModel` 반영 경로 완성(각 계층 단위 검증)
- [x] 기존 server/webview 회귀 0(관련 테스트 그린, 픽셀 ESLint 0 위반)
- [ ] (후속 권장) 드라이버↔서버↔webview **왕복 E2E** — 현 e2e 하니스는 mock-claude 기반이라 별도 작업 필요
- 비고: 전체 server 스위트의 일부 타임아웃은 프로세스/타이머 테스트의 병렬 부하 플레이키(본 변경 무관)

## 다음 단계
- F6: 오피스 화면 한↔영 전환(webview i18n + 드라이버 라벨 i18n).
