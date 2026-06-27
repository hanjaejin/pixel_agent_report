# ADR-019: server↔driver 제어 채널(모델 보고 + 명령 폴링)

- 상태: 채택(Accepted)
- 날짜: 2026-06-27
- 관련: PLAN_2 F5 (F5-3)

## 맥락

드라이버는 서버로 **훅을 POST만** 하고 명령을 받지 않는다. 오피스 화면에서 모델을 바꾸려면
서버가 드라이버에게 "이 에이전트 모델을 바꿔라"를 전달할 채널이 필요하다. 또 webview가
모델 드롭다운을 그리려면 에이전트별 현재 모델·선택 가능 목록을 알아야 한다.

## 결정

기존 훅 인증(Bearer)을 재사용하는 **두 개의 HTTP 엔드포인트**를 추가한다(서버는 127.0.0.1 바인딩).

- `POST /api/driver/state` (driver→server): `{ availableModels:[], agents:[{sessionId, model}] }`.
  서버가 `DriverControlState`에 저장하고, store로 `sessionId→agentId`를 매핑해
  `agentModels`(ADR-020)를 모든 webview로 broadcast.
- `GET /api/driver/commands` (driver→server, 폴링): 대기 중인 모델 변경 명령을 반환하고 큐를 비운다.
- `setAgentModel`(webview→server, ADR-020): `agentId`를 `sessionId`로 변환해 명령 큐에 적재 +
  낙관적 갱신 후 `agentModels` 재broadcast.
- `webviewReady` 시 보고된 모델이 있으면 `agentModels`를 보낸다(없으면 기존 연결 시퀀스 보존 → 회귀 0).

### 식별자 매핑
- 드라이버는 자신을 **session_id**로 식별(서버가 부여한 agent_id를 모름).
- 서버가 `store`(agent.sessionId)로 **session_id ↔ agent_id**를 변환.
- `DriverControlState`는 transport/Fastify를 모르는 **순수 상태**(테스트 용이, ADR-003 연장).

## 결과

- webview(F5-5)는 `agentModels`로 드롭다운을 그리고 `setAgentModel`로 변경을 요청한다.
- 드라이버(F5-4)는 `/api/driver/state`로 보고하고 `/api/driver/commands`를 폴링해 `setModel`(ADR-017)한다.
- 기존 server 동작 회귀 0(변경 관련 server 테스트 81개 통과; 전체 스위트의 일부 타임아웃은
  프로세스/타이머 테스트가 병렬 부하에서 난 환경적 플레이키로 본 변경과 무관).
