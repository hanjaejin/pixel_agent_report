# 추가기능 계획: pixel-agents (PLAN_2)

> 작성일: 2026-06-27 (개정 2: F5·F6를 **오피스 캔버스 풀스택**으로 구현)
> 기반: 1차 PoC 완료(드라이버 테스트 58개 그린, 라이브 검증 완료) 위에 추가기능을 얹는다.
> 작업 원칙: TDD(테스트 먼저) · ADR(013~) · 한국어 원칙 · 상세 주석 · 기존 테스트 그린 유지.

---

## 전제 확인

### 추가할 기능 (작성자 요청 6종)
| # | 기능 | 범위 |
|---|------|------|
| F1 | 에이전트 정의 **agents.json 외부화** + 스키마 검증·한국어 에러 | driver |
| F2 | 에이전트별 **페르소나**(성격/말투) | driver |
| F3 | 에이전트별 **SKILL.md** 참조 | driver |
| F4 | **모델 폴백**(하드 에러 시 대체 모델 자동 전환) | driver |
| F5 | 에이전트별 **사용 모델을 오피스 화면에서 선택** | **풀스택(core·server·webview·driver)** |
| F6 | **오피스 화면 한글/영어 전환** | **풀스택(core·server·webview·driver)** |

### ⚠️ 제약 변경 (사용자 승인)
- **F5·F6에 한해 `webview-ui/`·`core/`·`server/`·`adapters/` 수정을 허용**한다(오피스 캔버스에 직접 UI 추가).
- **F1~F4는 여전히 driver-only**(상위 코드 무수정).
- 단, 다음 프로젝트 규칙을 반드시 준수:
  - `core/asyncapi.yaml`이 프로토콜 단일 진실원천 → 메시지 추가 후 `npm run asyncapi:generate`로
    `core/src/messages.ts` 재생성(**CI 드리프트 체크 통과 필수**, messages.ts 수기수정 금지).
  - webview 커스텀 ESLint 규칙 준수(인라인 색상 금지·픽셀 섀도·픽셀 폰트), 상수는 `constants.ts`.
  - 새 동작은 **E2E(Playwright)** 로 사용자 관점 검증(프로젝트 방침: webview는 e2e 우선).

### 핵심 아키텍처 과제 (F5·F6 공통)
드라이버는 현재 **서버로 훅을 POST만** 하고, 서버로부터 명령을 **받지 않는다**. 오피스 화면에서
드라이버를 제어하려면 **server→driver 제어 채널**이 필요하다. 설계:
- 드라이버 → 서버: `POST /api/driver/state`(가용 모델·에이전트별 현재 모델·언어 보고) — 서버 신규 엔드포인트.
- 서버 → webview: 신규 ServerMessage `agentModels`(에이전트별 현재/가용 모델) broadcast.
- webview → 서버: 신규 ClientMessage `setAgentModel{agentId,model}`, `setLanguage{lang}`.
- 서버 → 드라이버: 드라이버가 `GET /api/driver/commands`(짧은 폴링)로 대기 명령 수신.
- 매핑: 드라이버는 `sessionId` 기준 보고 → 서버가 `agentId`로 변환(SessionRouter) → webview는 `agentId` 사용 → 명령은 `agentId→sessionId` 역변환.

### 보존해야 할 동작·계약 (회귀 금지)
- 훅 입구 `POST /api/hooks/claude`(Bearer), `server.json`의 `token` 필드, 행동 4종 enum 매핑.
- 비용/레이트리밋 정책(ADR-011). 드라이버 기존 58개 테스트 + 서버/webview 기존 테스트 그린.

---

## 단계별 계획

### F1: 에이전트 정의 외부화(agents.json) + 스키마 검증  *(driver)*
**목표**: 코드 수정 없이 `agents.json`으로 에이전트 추가/수정, 잘못된 설정은 친절한 한국어 에러.
**대상/신규**: `src/agentsFile.ts`, `src/config.ts`(확장), `agents.example.json`, `__tests__/agentsFile.test.ts`
**작업(TDD)**:
  - [ ] (Red) 정상 파싱 / 이름중복·model누락 거부 / 타입오류 한국어 에러 / 파일 없으면 `DEFAULT_AGENTS` 폴백
  - [ ] (Green) `loadAgentsFile(path, readFileFn?)`, `config`가 `PIXEL_AGENTS_FILE` 사용
  - [ ] `AgentDefinition` 확장: `persona?`, `skillFile?`, `fallbackModels?`
**ADR**: ADR-013 "에이전트 정의 외부화"
**완료**: 신규 테스트 그린 + 회귀 0 + 타입체크 + 보고서/TEST_LOG

### F2: 페르소나(성격/말투)  *(driver)*
**목표**: 에이전트별 성격/말투로 행동·reason 다양화.
**대상/신규**: `src/agent.ts`(systemPrompt 확장), `agents.json`(persona), `__tests__/agent.test.ts`(확장)
**작업(TDD)**:
  - [ ] (Red) `systemPromptFor(name, persona)`가 persona 포함 / 없으면 기본 유지
  - [ ] (Green) 프롬프트 합성 + 예시 페르소나(꼼꼼/열정/느긋)
**ADR**: ADR-014 "페르소나 주입 전략"
**완료**: 테스트 그린 + 회귀 0

### F3: SKILL.md 참조  *(driver)*
**목표**: 에이전트가 자신의 `SKILL.md`를 참고 자료로 활용.
**대상/신규**: `src/skills.ts`, `src/agent.ts`(주입), `skills/*.md`, `__tests__/skills.test.ts`
**작업(TDD)**:
  - [ ] (Red) `loadSkill(path)`: 정상/없는 파일→빈문자열/**길이 상한**(비용 보호)
  - [ ] (Green) 시스템 프롬프트 "참고 자료" 섹션 주입(persona와 병행), `skillFile` 연결
**ADR**: ADR-015 "SKILL.md 컨텍스트 주입(길이 상한)"
**완료**: 테스트 그린 + 토큰 폭증 없음

### F4: 모델 폴백(자동 대체)  *(driver)*
**목표**: 404/402/401 시 대체 모델로 자동 전환해 계속 동작.
**대상/신규**: `src/openrouter.ts`(에러 구조화), `src/agent.ts`(전환), `__tests__/*`(확장)
**작업(TDD)**:
  - [ ] (Red) `OpenRouterError{status}`; 영구에러(404/402/401)→전환, 일시(429/5xx)→백오프, 폴백 소진→rest
  - [ ] (Green) 모델 인덱스 advance + 전환 로그, `fallbackModels` 지원
**ADR**: ADR-016 "에러 분류와 모델 폴백"
**완료**: 분기 테스트 그린(404→전환/429→백오프) + 회귀 0

---

### F5: 오피스 화면에서 에이전트별 모델 선택  *(풀스택)*
**목표**: 오피스 캔버스에서 에이전트(또는 패널)에서 모델을 고르면 **다음 행동부터 즉시 교체**.

**F5-1 (driver) 런타임 모델 교체 토대**
  - [ ] (Red) `agent`의 model을 고정값→`getModel()/setModel()` 핸들로(다음 tick 반영, 초기동작 회귀 0)
  - [ ] (Green) `src/agentHandle.ts`(런타임 상태), `src/modelRegistry.ts`(OpenRouter `/models` 조회·캐시·폴백)

**F5-2 (core) 프로토콜 확장**
  - [ ] `core/asyncapi.yaml`에 `agentModels`(server→client), `setAgentModel{agentId,model}`(client→server) 추가
  - [ ] `npm run asyncapi:generate` → `messages.ts` 재생성, **드리프트 체크 통과**

**F5-3 (server) 제어 채널·릴레이**
  - [ ] (Red, Vitest) `POST /api/driver/state`(드라이버 보고 저장), `GET /api/driver/commands`(대기 명령 반환),
        `setAgentModel` 수신→sessionId 변환→명령 큐 적재, `agentModels` broadcast
  - [ ] (Green) httpServer 라우트 + clientMessageHandler 분기 + SessionRouter 매핑

**F5-4 (driver) 보고·수신·hot-swap**
  - [ ] (Red) 시작/변경 시 상태 publish, `commands` 폴링→`setModel`→재publish (순수 로직 테스트)
  - [ ] (Green) `src/office.ts`/`index.ts` 연결(폴링 주기·정리)

**F5-5 (webview) UI**
  - [ ] 에이전트 선택 시 모델 드롭다운(픽셀 스타일·constants 준수) 표시, 현재 모델 표기
  - [ ] 선택 시 `setAgentModel` 전송, `agentModels` 수신해 갱신
  - [ ] (E2E) 드롭다운 선택 → 드라이버가 교체 적용되는 시나리오

**ADR**: ADR-017 "에이전트 모델 런타임 hot-swap" · ADR-019 "server↔driver 제어 채널(보고+명령 폴링)" · ADR-020 "AsyncAPI 프로토콜 확장 절차"
**완료**: 각 계층 테스트 그린(driver 단위 + server Vitest + webview E2E) + 기존 회귀 0 + 화면 선택→행동 반영

### F6: 오피스 화면 한↔영 전환  *(풀스택)*
**목표**: 오피스 화면의 **UI 텍스트(툴바/모달/오버레이) + 에이전트 상태 라벨**을 ko/en로 전환.

**F6-1 (webview) UI i18n**
  - [ ] (Red/E2E) `webview-ui`에 i18n 모듈(ko/en 카탈로그) + SettingsModal에 언어 토글
  - [ ] (Green) 기존 영어 UI 텍스트를 카탈로그화(constants/ESLint 규칙 준수), 누락 키 폴백

**F6-2 (core·server) 언어 설정 지속·전파**
  - [ ] `core/asyncapi.yaml` 설정 메시지에 `language` 추가 + `setLanguage{lang}` ClientMessage, 재생성
  - [ ] (server) 언어 영속(adapter 설정) + `settingsLoaded`에 포함 + 드라이버 명령으로 전달

**F6-3 (driver) 상태 라벨 i18n 동기화**
  - [ ] (Red) `src/i18n.ts`(ko/en), `describeAction(action,target,lang)` 언어별 문구(ADR-006 카탈로그화)
  - [ ] (Green) `GET /api/driver/commands`(또는 config)로 언어 수신→이후 office 전송 status 텍스트가 언어 반영
  - [ ] 한국어 원칙 유지: **기본 ko**, en 옵션. 소스 주석/문서는 계속 한국어

**ADR**: ADR-018 "오피스 i18n(webview UI + 드라이버 라벨)" · ADR-021 "언어 설정 영속·전파(core/server/driver 동기화)"
**완료**: webview E2E(토글→UI 전환) + 드라이버 i18n 단위 + 라벨 언어 반영 확인 + 회귀 0

---

## 우선순위 / 권장 순서
```
F1 → F2 → F3 → F4        (driver-only, 빠르게 가치)
F5(풀스택)               제어 채널·프로토콜 토대 구축(F5-1~5)
F6(풀스택)               F5의 제어 채널·설정 전파 재사용(언어 동기화)
```
권장: **F1→F2→F3→F4** 먼저 끝내고(독립·저위험), 그다음 **F5→F6**(풀스택, 제어 채널 공유).

## 리스크 및 주의사항
- **프로토콜/CI(F5·F6)**: asyncapi 변경 시 `messages.ts` 재생성·드리프트 체크 필수. 메시지 추가는 `oneOf`+`discriminator`+`additionalProperties:false` 규칙 준수.
- **제어 채널 신설(F5)**: server→driver 통신은 신규 표면 → 보안(127.0.0.1 전용·기존 Bearer 재사용)·폴링 주기(비용) 설계. ADR로 근거 명시.
- **세션↔agentId 매핑(F5)**: 드라이버는 sessionId, webview는 agentId → 서버 변환 정확성(SessionRouter) 테스트 필수.
- **webview 회귀(F5·F6)**: 기존 webview/E2E 그린 유지. 픽셀 ESLint 규칙(색상/섀도/폰트) 위반 시 PR 차단.
- **i18n 범위(F6)**: UI 텍스트 카탈로그화가 광범위 → 화면 단위로 분할. 기본 ko로 회귀 위험↓.
- **드라이버 hot-swap × 폴백(F4×F5)**: 전환 중 모델 교체 상호작용 주의(현재 모델/폴백 인덱스 일관성).

## 예상 소요 시간 (집중 기준)
- F1 2–3h · F2 1–2h · F3 2–3h · F4 3–4h
- F5 **10–16h**(driver+core+server+webview+E2E) · F6 **8–12h**(webview i18n+core/server+driver)
- **합계 약 27–40h**. (driver-only F1~F4: 8–12h / 풀스택 F5~F6: 18–28h)

## 최종 검증 체크리스트
- [ ] F1~F4 각 기능 + 신규 테스트 그린, 드라이버 기존 58개 회귀 0
- [ ] `agents.json` 없이도 기존 동작 유지(폴백)
- [ ] 404→모델 전환 / 429→백오프 분기 검증
- [ ] **(F5)** asyncapi 재생성·드리프트 통과, server Vitest 그린, webview E2E: 화면에서 모델 선택→다음 행동 반영
- [ ] **(F5)** sessionId↔agentId 매핑 정확, 제어 채널 127.0.0.1 전용
- [ ] **(F6)** 언어 토글 → 오피스 **UI 텍스트 + 에이전트 라벨** 모두 ko/en 전환(E2E)
- [ ] webview 픽셀/ESLint 규칙 준수, 기존 webview·server 테스트 회귀 0
- [ ] ADR-013~021 작성, 단계별 완료 보고서 + TEST_LOG 갱신
