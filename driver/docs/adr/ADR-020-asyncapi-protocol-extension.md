# ADR-020: AsyncAPI 프로토콜 확장 절차 (모델 선택 메시지)

- 상태: 채택(Accepted)
- 날짜: 2026-06-27
- 관련: PLAN_2 F5 (F5-2)

## 맥락

오피스 화면에서 에이전트 모델을 선택하려면 webview↔server 사이에 새 메시지가 필요하다.
`core/asyncapi.yaml`은 프로토콜의 단일 진실원천이고, `core/src/messages.ts`는 그로부터
자동 생성되며 CI가 드리프트(불일치)를 막는다. 따라서 정해진 절차를 지켜야 한다.

## 결정

다음 메시지를 추가한다.

- **AgentModels** (server→client): `{ type:'agentModels', agents: AgentModelEntry[], availableModels: string[] }`
  — 에이전트별 현재 모델 + 선택 가능한 모델 목록(드라이버가 서버에 보고 → 서버가 broadcast).
- **AgentModelEntry**: `{ id:int, model:string }` — 인라인 익명 스키마를 피하려고 **명명 스키마로 추출**.
- **SetAgentModel** (client→server): `{ type:'setAgentModel', id:int, model:string }` — webview의 선택 요청.

### 확장 절차(준수 사항)
1. `components/schemas`에 스키마 추가(`additionalProperties:false`, `required`, `type.const`).
   중첩 객체는 **익명 스키마 누수 경고**가 나므로 명명 스키마로 추출한다(AgentModelEntry).
2. `ServerMessage`/`ClientMessage`의 `oneOf`에 `$ref` 등록(`discriminator: type` 유지).
3. `npm run asyncapi:generate` 로 `core/src/messages.ts` 재생성(수기수정 금지).
4. `npx asyncapi validate` 통과(3.0.0 유지 — Modelina 제약), `npm run check-types` 통과,
   재생성 멱등성 확인(드리프트 0).

## 결과

- webview는 생성된 타입으로 모델 선택 UI/메시지를 타입 안전하게 다룬다(F5-5).
- 드라이버는 이 WS 프로토콜이 아니라 별도 HTTP 제어 채널을 쓰므로(ADR-019, F5-3) messages.ts에
  의존하지 않는다.
- 기존 메시지/코드 회귀 없음(비-exhaustive 분기라 새 변형은 default로 흘러감).
