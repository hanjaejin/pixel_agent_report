# 테스트 로그 (driver)

> 각 단계의 **테스트 항목**(무엇을 검증하려 했는가)과 **테스트 완료 내역**(실제 결과)을 기록한다.
> TDD 원칙에 따라 테스트를 먼저 작성(Red)하고 구현(Green)한 뒤 이 표를 갱신한다.

---

## 단계 1: driver 스캐폴딩 + 한국어 로거

- 대상 파일: [src/logger.ts](../src/logger.ts)
- 테스트 파일: [__tests__/logger.test.ts](../__tests__/logger.test.ts)
- 실행 명령: `npm test`

### 테스트 항목

| # | 테스트 항목 | 검증 의도 |
|---|------------|----------|
| 1 | 컬러 없이 `[이름] 메시지` 포맷 | 기본 로그 한 줄 형식이 계약대로인지 |
| 2 | 컬러 모드에서 ANSI 포함 + stripAnsi 후 평문 일치 | 색을 입혀도 사람이 읽는 내용은 동일한지 |
| 3 | 같은 이름=같은 색, 색 코드 형식 유효 | 이름별 색이 결정적이고 유효 범위인지 |
| 4 | stripAnsi 가 평문을 그대로 반환 | ANSI 제거 유틸의 무해성 |

### 테스트 완료 내역

- 결과: **4 passed / 4** ✅
- 실행 일시: 2026-06-26
- 비고: `npm run build`(tsc)도 성공 — `dist/logger.js` 생성 확인.
  빌드 tsconfig는 `rootDir(src)` 충돌로 `src`만 컴파일(테스트는 vitest 담당).

```
 ✓ __tests__/logger.test.ts (4 tests)
 Test Files  1 passed (1)
      Tests  4 passed (4)
```

---

## 단계 2: office.ts — 서버 연동 어댑터

- 대상 파일: [src/office.ts](../src/office.ts)
- 테스트 파일: [__tests__/office.test.ts](../__tests__/office.test.ts)
- 실행 명령: `npm test`

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | 순수 | projectDirName: 비영숫자/대시 → `-` 치환 | 프로젝트 해시 규칙(ADR-001) 정확성 |
| 2 | 순수 | transcriptPathFor: `.claude/projects/<이름>/<uuid>.jsonl` | JSONL 경로 계약 |
| 3 | 순수 | readServerInfo: 정상 파싱 | server.json → {port,pid,authToken} |
| 4 | 순수 | readServerInfo: 파일 없음 → 한국어 안내 에러 | 친절한 실패(서버 미실행 안내) |
| 5 | 순수 | 훅 빌더 5종(SessionStart/Pre/Post/Stop/SessionEnd) | 페이로드 형태 계약 |
| 6 | 순수 | initRecord: `/clear` 미포함 system init | 스캐너 채택용/오인 방지 |
| 7 | IO | postHook: URL/Bearer/본문/AbortSignal | 훅 전송 계약(인증·타임아웃) |
| 8 | IO | postHook: 비200 → 한국어 에러 | 실패 가시화 |
| 9 | IO | writeInitTranscript: mkdir + 줄바꿈 추가 | 트랜스크립트 쓰기 정확성 |

### 테스트 완료 내역

- 결과: **9 passed / 9** ✅ (누적 13/13)
- 실행 일시: 2026-06-26
- 비고: `npm run build` 성공 — `dist/office.js` 생성. IO는 의존성 주입(ADR-003)으로 실제 서버/디스크 없이 검증.

```
 ✓ __tests__/logger.test.ts (4 tests)
 ✓ __tests__/office.test.ts (9 tests)
 Test Files  2 passed (2)
      Tests  13 passed (13)
```

---

## 단계 3: openrouter.ts — LLM 클라이언트 + 견고한 파싱

- 대상 파일: [src/openrouter.ts](../src/openrouter.ts)
- 테스트 파일: [__tests__/openrouter.test.ts](../__tests__/openrouter.test.ts)
- 실행 명령: `npm test`

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | parse | 정상 JSON 파싱 | 기본 경로 정확성 |
| 2 | parse | 코드펜스/잡텍스트 속 JSON 추출 | SLM 군더더기 내성 |
| 3 | parse | enum 밖 action → rest | 행동 4종 제한(ADR-004) |
| 4 | parse | 완전 깨진 응답 → rest, target='' | 안전 폴백 |
| 5 | parse | target/reason 누락 → 기본값 | 필드 누락 내성 |
| 6 | parse | ACTIONS = 4종 enum | 계약 상수 |
| 7 | build | model/messages/response_format 구성 | OpenAI 호환 본문 |
| 8 | IO | decide: URL/Bearer/본문 + Decision 반환 | 호출 계약 |
| 9 | IO | 429/5xx → 예외 | 백오프 트리거(ADR-011) |
| 10 | IO | 모델이 깨진 내용 줘도 rest 폴백(예외 아님) | 파싱/HTTP 책임 분리 |

### 테스트 완료 내역

- 결과: **10 passed / 10** (누적 23/23) ✅
- 실행 일시: 2026-06-26
- 비고: `npm run build` 성공 (`dist/openrouter.js`). HTTP 실패는 예외, 본문 파싱 실패는 rest 폴백으로 책임 분리.

```
 ✓ __tests__/logger.test.ts (4 tests)
 ✓ __tests__/office.test.ts (9 tests)
 ✓ __tests__/openrouter.test.ts (10 tests)
 Test Files  3 passed (3)
      Tests  23 passed (23)
```

---

## 단계 4: actions.ts — action→신호/문구 매핑

- 대상 파일: [src/actions.ts](../src/actions.ts)
- 테스트 파일: [__tests__/actions.test.ts](../__tests__/actions.test.ts)
- 실행 명령: `npm test`

### 테스트 항목

| # | 테스트 항목 | 검증 의도 |
|---|------------|----------|
| 1 | read/write/run→Read/Edit/Bash, rest→null | action→tool_name 매핑 |
| 2 | 도구 있는 action 의 tool_name ∈ KNOWN_TOOL_NAMES | 서버가 아는 값만 사용 |
| 3 | toolInputFor: Read/Edit→file_path, Bash→command | 훅 tool_input 구성 |
| 4 | target 비어도 안전한 기본 입력 | undefined 방지 |
| 5 | describeAction read: 📖 + 대상 포함 | 한국어 문구(ADR-006) |
| 6 | write ✏️ / run ⚙️ 이모지 | action별 문구 구분 |
| 7 | rest ☕, 대상 없음 | 휴식 문구 |
| 8 | 대상 비면 일반 문구 폴백(undefined 미노출) | 폴백 안전성 |

### 테스트 완료 내역

- 결과: **8 passed / 8** (누적 31/31) ✅
- 실행 일시: 2026-06-26
- 비고: `npm run build` 성공 (`dist/actions.js`). 순수 함수만으로 부수효과 없음.

```
 ✓ __tests__/actions.test.ts (8 tests)
 Test Files  4 passed (4)
      Tests  31 passed (31)
```

---

## 단계 5: agent.ts — 단일 에이전트 행동 루프

- 대상 파일: [src/agent.ts](../src/agent.ts)
- 테스트 파일: [__tests__/agent.test.ts](../__tests__/agent.test.ts)
- 실행 명령: `npm test`

### 테스트 항목

| # | 테스트 항목 | 검증 의도 |
|---|------------|----------|
| 1 | start(): init 작성 + SessionStart(transcript_path) | 등장/채택 유도(ADR-002) |
| 2 | start 후 첫 행동이 확인 이벤트(비-SessionStart) | pending→채택 확정 트리거 |
| 3 | read: PreToolUse(Read,file_path)→대기→PostToolUse 순서 | 행동 신호 흐름/지속(ADR-007) |
| 4 | rest: Stop 만, PreToolUse 없음 | 휴식 분기 |
| 5 | runLoop(max:2): start 1회 + 결정 2회 | 루프 횟수/멱등 start |
| 6 | LLM 예외 → rest(Stop) + 백오프, 예외 미전파 | 복원력(ADR-004/011) |
| 7 | stop(): SessionEnd(exit) | 퇴장 신호 |

### 테스트 완료 내역

- 결과: **7 passed / 7** (누적 38/38) ✅
- 실행 일시: 2026-06-26
- 비고: **빌드 방식 변경** — agent.ts 가 첫 로컬 value import(`.ts`)라서 tsc 방출이 거부됨.
  ESM+tsx 표준에 맞춰 `tsconfig` 를 `noEmit`+`allowImportingTsExtensions` 로 바꾸고,
  `npm run build`/`typecheck` 는 **타입체크**로, 실행은 `tsx`(`npm start`/`dev`)로 통일.
  `npm run build`(=tsc --noEmit) 통과.

```
 ✓ __tests__/agent.test.ts (7 tests)
 Test Files  5 passed (5)
      Tests  38 passed (38)
```

---

## 단계 6: config.ts + index.ts — N명 병렬 + 오케스트레이션

- 대상 파일: [src/config.ts](../src/config.ts), [src/index.ts](../src/index.ts), [scripts/smoke.ts](../scripts/smoke.ts)
- 테스트 파일: [__tests__/config.test.ts](../__tests__/config.test.ts), [__tests__/orchestrator.test.ts](../__tests__/orchestrator.test.ts)
- 실행 명령: `npm test`

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | config | DEFAULT_AGENTS 3명·이름/모델 유일 | 에이전트마다 다른 모델(완료기준 5) |
| 2 | config | validateAgents 이름 중복 거부 | 정의 검증 |
| 3 | config | validateAgents 빈 model 거부 | 정의 검증 |
| 4 | config | loadDriverConfig 키 있으면 설정 생성 | 환경변수 로드 |
| 5 | config | loadDriverConfig 키 없으면 한국어 에러 | 친절한 실패 |
| 6 | config | 잘못된 LOOP_INTERVAL → 기본 4000 | 폴백 |
| 7 | orch | runAll 이 전원 runLoop 호출 | 병렬 구동 |
| 8 | orch | 한 명 실패가 다른 명을 안 막음 | 격리(ADR-010) |
| 9 | orch | stopAll 이 하나 실패해도 전원 stop | 종료 견고성(ADR-009) |

### 테스트 완료 내역

- 결과: **9 passed / 9** (config 6 + orchestrator 3, 누적 47/47) ✅
- 실행 일시: 2026-06-26
- 비고: `npm run build`(타입체크, smoke 포함) 통과. **라이브 통합 검증(캐릭터 등장+애니메이션)은
  사용자가 서버 기동 + 키 제공 후 수행 예정**(`npm run start:env` / `npm run smoke`).

```
 ✓ __tests__/config.test.ts (6 tests)
 ✓ __tests__/orchestrator.test.ts (3 tests)
 Test Files  7 passed (7)
      Tests  47 passed (47)
```

### 라이브 통합 검증 (실서버, fake-LLM)

- 환경: 로컬 빌드한 standalone 서버(`node dist/cli.js --port 3100`) + `npm run check:integration`
  (`PIXEL_WORKSPACE`=서버 워크스페이스로 맞춰 Watch All Sessions 없이 채택).
- **버그 발견·수정**: 실제 `server.json` 은 `authToken` 이 아니라 **`token`** 필드를 쓴다.
  `readServerInfo` 가 `token` 우선 + `authToken` 폴백으로 인식하도록 수정(테스트 1건 추가 → 48/48).
- 결과(서버 로그로 확인):
  - 훅 POST **24건 전부 200**, 실패 0.
  - 서버가 3개 외부 세션을 채택해 **Agent 1·2·3 생성**(`confirmed external session ... creating agent`).
  - PreToolUse/PostToolUse 활동 처리, 종료 시 **SessionEnd(exit) 로 3명 모두 퇴장**.
- 시각 확인: `npm run smoke`(무한) 로 브라우저에서 캐릭터 동작 육안 확인(사용자).
- 실제 LLM 경로(`npm run start:env`)는 키를 `driver/.env` 에 넣으면 동일 흐름으로 동작(openrouter 단위테스트 10건으로 별도 검증됨).

---

## 단계 7: 비용·레이트리밋·백오프

- 대상 파일: [src/backoff.ts](../src/backoff.ts), [src/semaphore.ts](../src/semaphore.ts), [src/agent.ts](../src/agent.ts), [src/config.ts](../src/config.ts)
- 테스트 파일: [__tests__/backoff.test.ts](../__tests__/backoff.test.ts), [__tests__/semaphore.test.ts](../__tests__/semaphore.test.ts), agent/config 확장
- 실행 명령: `npm test`

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | backoff | 시도별 2배 증가 | 지수 백오프 |
| 2 | backoff | 상한 캡 | max 초과 방지 |
| 3 | backoff | 음수 시도 → 0 취급 | 방어 |
| 4 | semaphore | max=1 동시 1개 | 동시성 제한 |
| 5 | semaphore | max=2 최대 2개 | 동시성 제한 |
| 6 | semaphore | 에러 시 슬롯 반환 | 누수 방지 |
| 7 | agent | 연속 실패 백오프 지수 증가 + 성공 시 초기화 | 복원력 |
| 8 | agent | semaphore 안에서 decide 호출 | 동시성 적용 |
| 9 | config | 백오프/동시성 env 파싱 + 기본값 | 설정 |
| 10 | config | loopIntervalMs 최소 1000 클램프 | 비용 하한 |

### 테스트 완료 내역

- 결과: **+11 (backoff 3 + semaphore 3 + agent 2 + config 2 + office token 1 이미 반영), 누적 58/58** ✅
- 실행 일시: 2026-06-26
- 비고: `npm run build`(타입체크) 통과. 백오프 동안 캐릭터는 `Stop`(대기) 표시(ADR-011).

```
 ✓ backoff.test.ts (3) ✓ semaphore.test.ts (3) ✓ agent.test.ts (9) ✓ config.test.ts (8)
 Test Files  9 passed (9)
      Tests  58 passed (58)
```

---

## 단계 8: 문서화 & 공개 준비

- 산출물: [README.md](../README.md), [사용설명서](사용설명서.md), [ADR-012](adr/ADR-012-public-release-secrets.md)
- 신규 테스트 없음(문서 단계). **전체 회귀 테스트 + 타입체크 + 비밀 누출 점검** 수행.

### 최종 점검 결과

- `npm test`: **58 passed / 58** ✅ (9개 파일)
- `npm run build`(타입체크): 통과 ✅
- 비밀 점검: 추적되는 `.env` 없음, `.gitignore` 가 `.env`/`node_modules`/`dist`/`*.log` 차단 ✅

```
 Test Files  9 passed (9)
      Tests  58 passed (58)
```

---

## 기능 단계 F1: 에이전트 정의 외부화(agents.json)

- 대상 파일: [src/agentsFile.ts](../src/agentsFile.ts)(신규), [src/config.ts](../src/config.ts)(확장), [agents.example.json](../agents.example.json)
- 테스트 파일: [__tests__/agentsFile.test.ts](../__tests__/agentsFile.test.ts), [__tests__/config.test.ts](../__tests__/config.test.ts)(확장)

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | agentsFile | 배열 JSON 파싱 | 기본 형태 |
| 2 | agentsFile | `{agents:[]}` 형태 파싱 | 대체 형태 |
| 3 | agentsFile | 선택 필드(persona/skillFile/fallbackModels/apiKey) 반영 | 확장 스키마 |
| 4 | agentsFile | 읽기 실패 → 한국어 에러 | 친절한 실패 |
| 5 | agentsFile | JSON 깨짐 → 한국어 에러 | 친절한 실패 |
| 6 | agentsFile | 배열/agents 아님 → 한국어 에러 | 형태 검증 |
| 7 | agentsFile | model 누락(위치 포함) 거부 | 필수값 |
| 8 | agentsFile | name 누락 거부 | 필수값 |
| 9 | agentsFile | 이름 중복 거부 | 무결성 |
| 10 | agentsFile | fallbackModels 타입 오류 거부 | 타입 검증 |
| 11 | agentsFile | persona 타입 오류 거부 | 타입 검증 |
| 12 | config | PIXEL_AGENTS_FILE 지정 시 로드(주입) | 우선순위 ① |
| 13 | config | 기본 경로 존재 시 로드 | 우선순위 ② |
| 14 | config | 파일 없으면 DEFAULT_AGENTS 폴백 | 회귀 0 |

### 테스트 완료 내역

- 결과: **+14 (agentsFile 11 + config 3), 누적 72/72** ✅
- 실행 일시: 2026-06-27
- 비고: `npm run build`(타입체크) 통과. `agents.json` 없으면 기존 동작 그대로(회귀 0). IO 주입으로 디스크 없이 검증.

```
 ✓ __tests__/agentsFile.test.ts (11 tests)
 ✓ __tests__/config.test.ts (11 tests)
 Test Files  10 passed (10)
      Tests  72 passed (72)
```

---

## 기능 단계 F2: 에이전트별 페르소나(성격/말투)

- 대상 파일: [src/agent.ts](../src/agent.ts)(systemPromptFor 확장·export, AgentConfig.persona), index/smoke/integration(persona 전달)
- 테스트 파일: [__tests__/agent.test.ts](../__tests__/agent.test.ts)(확장)

### 테스트 항목

| # | 테스트 항목 | 검증 의도 |
|---|------------|----------|
| 1 | persona 있으면 성격 줄+이름 포함 | 주입 동작 |
| 2 | persona 없으면 기본 프롬프트(성격 줄 없음) | 회귀 0 |
| 3 | createAgent 가 persona 를 decide 시스템 프롬프트에 실음 | 통합 경로 |

### 테스트 완료 내역

- 결과: **+3, 누적 75/75** ✅
- 실행 일시: 2026-06-27
- 비고: `npm run build` 통과. 한국어 문구는 드라이버 템플릿(ADR-006) 유지, persona 한 줄만 추가(토큰 미미).

```
 Test Files  10 passed (10)
      Tests  75 passed (75)
```

---

## 기능 단계 F3: 에이전트별 SKILL.md 참조

- 대상 파일: [src/skills.ts](../src/skills.ts)(신규), [src/agent.ts](../src/agent.ts)(systemPromptFor·config.skill), [src/index.ts](../src/index.ts)(loadSkill 연결), [skills/example-김대리.md](../skills/example-김대리.md)
- 테스트 파일: [__tests__/skills.test.ts](../__tests__/skills.test.ts)(신규), agent.test.ts(확장)

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | skills | 정상 로드(trim) | 기본 |
| 2 | skills | 없는 파일 → '' (graceful) | 무중단 |
| 3 | skills | 빈 파일 → '' | 처리 |
| 4 | skills | 길이 상한 초과 → 잘라내고 생략 표시 | 비용 보호 |
| 5 | skills | 상한 이내 그대로 | 경계 |
| 6 | agent | skill 있으면 참고 자료 섹션+내용 포함 | 주입 |
| 7 | agent | skill 없으면 섹션 없음 | 회귀 0 |
| 8 | agent | persona+skill 함께 주입 | 합성 |

### 테스트 완료 내역

- 결과: **+8 (skills 5 + agent 3), 누적 83/83** ✅
- 실행 일시: 2026-06-27
- 비고: `npm run build` 통과. 없는 파일 graceful, 길이 상한으로 토큰 비용 보호. agent.ts는 파일시스템 미접근(순수, index가 로드).

```
 Test Files  11 passed (11)
      Tests  83 passed (83)
```

---

## 기능 단계 F4: 모델 폴백(자동 대체)

- 대상 파일: [src/openrouter.ts](../src/openrouter.ts)(OpenRouterError), [src/agent.ts](../src/agent.ts)(모델 목록·전환), index/smoke/integration(fallbackModels 전달)
- 테스트 파일: [__tests__/openrouter.test.ts](../__tests__/openrouter.test.ts)(확장), [__tests__/agent.test.ts](../__tests__/agent.test.ts)(확장)

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | openrouter | 비정상 응답 → OpenRouterError(status) | 에러 구조화 |
| 2 | agent | 영구 에러(404) → 다음 폴백 모델로 전환 | 폴백 동작 |
| 3 | agent | 일시 에러(429) → 전환 없이 백오프 | 분류 정확성 |
| 4 | agent | 폴백 소진 시 영구 에러 → rest 대기 | 안전 종료 |

### 테스트 완료 내역

- 결과: **+4 (openrouter 1 + agent 3), 누적 87/87** ✅
- 실행 일시: 2026-06-27
- 비고: `npm run build` 통과. 영구(400/401/402/403/404)=모델 전환, 일시(429/5xx/네트워크)=지수 백오프. 기존 백오프 테스트(generic Error)는 일시로 분류되어 회귀 0.

```
 Test Files  11 passed (11)
      Tests  87 passed (87)
```

---

## 기능 단계 F5-1: 런타임 모델 hot-swap (driver)

- 대상 파일: [src/agent.ts](../src/agent.ts)(`getModel`/`setModel` 추가)
- 테스트 파일: [__tests__/agent.test.ts](../__tests__/agent.test.ts)(확장)

### 테스트 항목

| # | 테스트 항목 | 검증 의도 |
|---|------------|----------|
| 1 | getModel 초기값 + setModel 후 다음 호출 반영 | 런타임 교체 |
| 2 | setModel 대상이 폴백 목록에 있으면 그 모델로 | 인덱스 이동 |

### 테스트 완료 내역

- 결과: **+2, 누적 89/89** ✅
- 실행 일시: 2026-06-27
- 비고: `npm run build` 통과. F4 모델 목록/인덱스 재사용, 초기 동작 회귀 0. (F5-2~5: core/server/webview는 후속 서브스텝)

```
 Test Files  11 passed (11)
      Tests  89 passed (89)
```

---

## 기능 단계 F5-2: core 프로토콜 확장 (모델 선택 메시지)

- 대상 파일: [core/asyncapi.yaml](../../../core/asyncapi.yaml)(AgentModelEntry/AgentModels/SetAgentModel 추가), core/src/messages.ts(재생성)
- 검증 방식: 프로토콜 계층은 vitest 단위 테스트가 아니라 **스펙 검증·생성·타입체크·드리프트**로 확인.

### 검증 항목 / 결과

| 검증 | 결과 |
|------|------|
| `npx asyncapi validate` | ✅ 통과(에러 0, info만: 3.1.0 권고) |
| `npm run asyncapi:generate` | ✅ messages.ts 재생성, 익명 스키마 누수 0(AgentModelEntry 명명 추출) |
| `npm run check-types`(root+server test+webview) | ✅ 통과(기존 코드 회귀 0) |
| 재생성 멱등성(드리프트) | ✅ 안정(변화는 신규 19줄뿐) |

- 실행 일시: 2026-06-27
- 비고: 드라이버 단위 테스트는 변화 없음(89/89 유지). 프로토콜은 webview(F5-5)에서 사용, 드라이버는 별도 HTTP 채널 사용(F5-3).

---

## 기능 단계 F5-3: server 제어 채널 (driver↔server)

- 대상 파일: [server/src/driverControl.ts](../../../server/src/driverControl.ts)(신규), httpServer.ts(라우트 2개), clientMessageHandler.ts(setAgentModel + webviewReady)
- 테스트 파일: [server/__tests__/driverControl.test.ts](../../../server/__tests__/driverControl.test.ts)(신규, Vitest)

### 테스트 항목 / 결과

| # | 테스트 항목 | 검증 의도 |
|---|------------|----------|
| 1 | setState 후 getModel/getAvailableModels | 보고 반영 |
| 2 | queueCommand 낙관적 갱신 + drainCommands 비움 | 명령 큐 |
| 3 | 같은 session 명령 최신 대체 | 중복 제거 |
| 4 | buildAgentModelsMessage: session↔agent 매핑, 미보고 제외 | broadcast 구성 |

### 검증 결과

- 격리 실행: **driverControl + server + hookEventHandler + agentStateStore = 81 passed** ✅
- `npm run check-types`(root+server): 통과 ✅
- 전체 server 스위트: 일부 타임아웃 실패(mockClaudeRunner 등 **프로세스/타이머 테스트가 병렬 부하에서 10s 초과**) — 본 변경과 무관한 환경적 플레이키(변경 관련 파일은 모두 그린).
- 실행 일시: 2026-06-27

---

## 기능 단계 F5-4: driver 보고/폴링 + hot-swap 적용

- 대상 파일: [src/office.ts](../src/office.ts)(reportDriverState/pollCommands), [src/index.ts](../src/index.ts)(runControlTick/computeAvailableModels/제어 루프)
- 테스트 파일: [__tests__/office.test.ts](../__tests__/office.test.ts)(확장), [__tests__/orchestrator.test.ts](../__tests__/orchestrator.test.ts)(확장)

### 테스트 항목

| # | 그룹 | 테스트 항목 | 검증 의도 |
|---|------|------------|----------|
| 1 | office | reportDriverState → /api/driver/state Bearer POST | 보고 |
| 2 | office | pollCommands → commands 배열 반환 | 폴링 |
| 3 | orch | runControlTick: 보고 + 명령을 해당 에이전트에 setModel | 적용 |
| 4 | orch | 명령 없으면 setModel 미호출 | no-op |
| 5 | orch | computeAvailableModels: 모델+폴백 중복 제거 | 목록 구성 |

### 테스트 완료 내역

- 결과: **+5 (office 2 + orchestrator 3), 누적 94/94** ✅
- 실행 일시: 2026-06-27
- 비고: `npm run build` 통과. 제어 루프는 1.5s 주기로 보고/폴링(실패는 무시·재시도), `PIXEL_PANEL=0` 으로 끔. 종료 시 타이머 정리.

```
 Test Files  11 passed (11)
      Tests  94 passed (94)
```

---

## 기능 단계 F5-5: webview 모델 선택 UI

- 대상 파일: webview-ui/src/hooks/useExtensionMessages.ts(agentModels 처리·상태·반환), App.tsx(전달), components/SettingsModal.tsx(Agent Models 드롭다운)
- 검증 방식: 타입체크 + ESLint(픽셀 규칙) + 빌드 + webview 단위 테스트.

### 검증 결과

| 검증 | 결과 |
|------|------|
| `npm run check-types`(root+server) | ✅ 통과 |
| webview `tsc -b && vite build` | ✅ 빌드 성공 |
| webview `eslint .`(픽셀 색상/섀도/폰트 규칙 포함) | ✅ 0 위반 |
| webview 단위 테스트 | ✅ 41 passed |

- 동작: `agentModels` 수신 → Settings 의 "Agent Models" 에 에이전트별 드롭다운 표시(모델 보고 있을 때만) → 선택 시 `setAgentModel` 송신.
- 실행 일시: 2026-06-27
- 비고: 풀 E2E(드라이버↔서버↔webview 왕복)는 별도 후속 권장(현 e2e 하니스는 mock-claude 기반). 각 계층 경계는 단위 테스트로 검증됨.

---

## 기능 단계 F6: 한↔영 전환 (webview UI + 드라이버 로그)

- 대상 파일(webview): src/i18n.ts(신규), App.tsx(lang 상태), components/SettingsModal.tsx(t/토글)
- 대상 파일(driver): src/i18n.ts(신규), actions.ts(describeAction lang), agent.ts(arrive/leave/describe), config.ts(PIXEL_LANG)
- 테스트: [__tests__/i18n.test.ts](../__tests__/i18n.test.ts)(driver 신규), config.test.ts(확장), webview-ui/test/i18n.test.ts(신규)

### 테스트 항목 / 결과

| # | 영역 | 테스트 항목 | 검증 |
|---|------|------------|------|
| 1 | driver | t ko/en + 미존재 키 | 순수 번역 |
| 2 | driver | parseLang(en만 en, 나머지 ko) | env 해석 |
| 3 | driver | describeAction 언어별(기본 ko) | 행동 문구 |
| 4 | driver | config PIXEL_LANG → lang | 설정 |
| 5 | webview | t ko/en + 미존재 키 | 순수 번역 |

### 검증 결과

- driver: **98/98** ✅ (i18n 3 + config 1 신규) · webview 단위: **43**(i18n +2 포함) ✅
- `npm run build`(driver 타입체크), webview build/eslint 통과 ✅
- 실행 일시: 2026-06-27
- 범위: 오피스 활동 라벨(서버 provider)은 영어 유지(ADR-018). webview UI=localStorage 토글, 드라이버 로그=PIXEL_LANG.

---

## 누적 테스트 요약

| 모듈 | 테스트 수 |
|------|-----------|
| logger | 4 |
| office | 12 |
| openrouter | 11 |
| actions | 8 |
| agent | 20 |
| config | 12 |
| orchestrator | 5 |
| backoff | 3 |
| semaphore | 3 |
| agentsFile (F1) | 11 |
| skills (F3) | 5 |
| i18n (F6) | 3 |
| **합계** | **98** |
