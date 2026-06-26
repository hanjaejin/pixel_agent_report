# 📋 작업 결과 종합 리포트 — Pixel Agents OpenRouter 드라이버

- 작성: 한재진 (jaejin.han@gmail.com)
- 작성일: 2026-06-27
- 대상 프로젝트: `pixel-agents` (픽셀 아트 오피스에 AI 에이전트를 캐릭터로 시각화)
- 이번 작업: **Claude Code 없이 OpenRouter 작은 모델(SLM)로 N명 에이전트를 구동하는 `driver/` 신규 개발**

---

## 0. 한눈에 보기 (요약)

| 항목 | 내용 |
|------|------|
| 목표 | `claude` 프로세스 없이, 한 프로세스가 N명 에이전트를 OpenRouter로 구동 → 기존 픽셀 오피스에 캐릭터로 표시 |
| 결과 | ✅ 신규 `driver/` 완성. 단위 테스트 **58개 전부 통과**, 타입체크 통과 |
| 방식 | **TDD**(테스트 먼저) + **ADR**(설계 결정 기록) + **한국어 원칙**(주석·로그·문서) + **단계별** |
| 기존 코드 | `server/` `webview-ui/` `core/` `adapters/vscode/` **수정 0건** (불변 원칙 준수, 빌드만 수행) |
| 라이브 검증 | 실서버 기동 → 훅 200, 에이전트 채택/활동/퇴장 확인. 실제 OpenRouter로 3명 한국어 추론 동작 확인 |
| 산출물 | 소스 9모듈 + 스크립트 2 + 테스트 9파일 + ADR 12 + 단계보고서 8 + 테스트로그 + README + 초보자 매뉴얼 |

---

## 1. 이 프로그램이 하는 일

```
[driver (Node 프로세스 1개)]                         [기존 픽셀 오피스]
  김대리 → OpenRouter(작은 AI) ─┐
  박사원 → OpenRouter(작은 AI) ─┤→ 훅 신호 전송 → 서버 → 브라우저 화면에
  이주임 → OpenRouter(작은 AI) ─┘                       캐릭터가 움직임 🎮
```

- 각 에이전트는 OpenRouter로 "다음 행동"을 물어봄 → `read / write / run / rest` 중 하나로 답을 받음.
- 그 행동을 기존 오피스 서버가 이해하는 **Claude 훅 신호**(`PreToolUse`/`PostToolUse`/`Stop` 등)로 변환해 전송.
- 화면에서 캐릭터가 책상으로 걸어가 📖읽기 / ✏️타이핑 / ⚙️실행 / ☕대기를 반복.
- 1단계(PoC)에서는 **실제 파일을 건드리지 않음**(안전). "일하는 척"만 함.

---

## 2. 기존 프로젝트 구조 (참고 — 건드리지 않은 영역)

엄격한 계층: `core` ← `server` ← `adapters/vscode`; `core` ← `webview-ui`.

| 폴더 | 역할 | 이번 작업에서 |
|------|------|--------------|
| `core/` | 프로토콜·인터페이스(AsyncAPI, 메시지 타입) | **수정 안 함** |
| `server/` | 런타임·Fastify 서버(훅 입구, WebSocket, 스캐너) | **수정 안 함** (빌드만) |
| `webview-ui/` | React+Canvas 픽셀 오피스 UI | **수정 안 함** (빌드만) |
| `adapters/vscode/` | VS Code 확장 | **수정 안 함** |
| **`driver/`** | **이번에 새로 만든 폴더** | **전부 신규** |

데이터 흐름(재사용): `훅 POST → /api/hooks/claude → hookEventHandler → agentRuntime → agentStateStore → WebSocket broadcast → webview`.

---

## 3. 내가 한 일 (신규 생성 / 수정 내역)

### 3-1. 신규 생성 — `driver/` 폴더 전체

소스 9개 모듈(전부 신규):

| 파일 | 역할 |
|------|------|
| `src/index.ts` | 진입점. 설정 로드 → N명 생성 → 병렬 구동(`runAll`) → SIGINT 종료(`stopAll`) |
| `src/config.ts` | 에이전트 정의(이름·모델) + 환경변수 설정 로드/검증 |
| `src/agent.ts` | 에이전트 1명의 행동 루프(등장→결정→행동→반복→퇴장) |
| `src/openrouter.ts` | OpenRouter(OpenAI 호환) 호출 + `{action,target,reason}` 견고한 파싱 |
| `src/actions.ts` | action → 훅 tool_name + 한국어 문구 매핑 |
| `src/office.ts` | 서버 연동(server.json 읽기, 훅 POST, JSONL 쓰기, 해시 계산) |
| `src/logger.ts` | 한국어 컬러 로그(`[이름] 메시지`) |
| `src/backoff.ts` | 지수 백오프 계산 |
| `src/semaphore.ts` | OpenRouter 동시 호출 제한 |

스크립트 2개:

| 파일 | 역할 |
|------|------|
| `scripts/smoke.ts` | 키 없이 체험(가짜 AI가 정해진 행동 무한 반복) |
| `scripts/integration-check.ts` | 실서버 대상 자동 점검(훅 200/채택 확인 후 종료) |

설정/문서:

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`
- `README.md`, `docs/사용설명서.md`(초보자용), `docs/TEST_LOG.md`
- `docs/adr/ADR-001 ~ 012`, `docs/reports/STAGE-1 ~ 8`

### 3-2. 라이브 중 발견·수정한 버그/이슈

| # | 발견 | 원인 | 해결 |
|---|------|------|------|
| 1 | `server.json` 인증 실패 | 실제 CLI는 `authToken`이 아니라 **`token`** 필드 사용(문서 오류) | `office.ts`의 `readServerInfo`를 `token` 우선 + `authToken` 폴백으로 수정 (+테스트) |
| 2 | `npx pixel-agents` 안 됨 | npm 배포본 1.0.2는 **CLI bin 없음**(구버전) | 로컬 레포 빌드 후 `node dist/cli.js`로 기동 |
| 3 | 빌드(tsc) 방출 실패 | 첫 로컬 value import(`.ts`)에서 TS5097 | ESM+tsx 표준으로 전환: `noEmit`+`allowImportingTsExtensions`, 실행은 `tsx`, build=타입체크 |
| 4 | 새로고침 시 캐릭터 사라짐 | 웹뷰 상위 버그(`existingAgents`가 `layoutLoaded` 뒤 도착 → 버퍼 미flush) | **운영수칙**으로 회피(서버→브라우저→드라이버 순서, 새로고침 금지). 웹뷰 불변 원칙 유지 |
| 5 | 진짜 AI 모드 401 | API 키를 **루트 `.env`**에 넣음(드라이버는 `driver/.env` 사용) | 키를 `driver/.env`로 이동(+CRLF 정리) |
| 6 | 모델 404/402/429 | `ministral-3b`(404), 무료모델 한도(402)·레이트리밋(429) | 유효한 저렴 유료 소형모델로 교체: llama-3.2-3b / qwen-2.5-7b / **ministral-3b-2512** |

### 3-3. 기존 코드 수정 = 0건

`server/` `webview-ui/` `core/` `adapters/vscode/`의 **소스는 한 줄도 고치지 않았습니다.**
(서버를 띄우기 위해 `npm install` + 빌드만 수행 → `dist/` 생성. 이는 산출물이며 소스 변경 아님.)

---

## 4. `driver/` 디렉토리 구조

```
driver/
  package.json              # 독립 npm 프로젝트(type:module). 스크립트: dev/start/start:env/smoke/check:integration/test/build
  tsconfig.json             # noEmit + allowImportingTsExtensions (tsx로 실행, tsc는 타입체크 전용)
  vitest.config.ts          # 테스트 설정(node 환경)
  .gitignore                # node_modules/ dist/ .env *.log 차단
  .env.example              # 환경변수 예시(키 없음)
  README.md                 # 프로젝트 소개·빠른 시작·설정·FAQ·ADR 인덱스
  src/
    index.ts                # 진입점 + 오케스트레이션(runAll/stopAll)
    config.ts               # 에이전트 정의 + 설정 로드/검증
    agent.ts                # 행동 루프(start/tickOnce/runLoop/stop)
    openrouter.ts           # LLM 클라이언트 + parseDecision(폴백)
    actions.ts              # action→tool_name+한국어 문구
    office.ts               # 서버 연동(server.json/훅/JSONL/해시)
    logger.ts               # 한국어 컬러 로그
    backoff.ts              # 지수 백오프
    semaphore.ts            # 동시 호출 제한
  scripts/
    smoke.ts                # 체험 모드(무한)
    integration-check.ts    # 자동 통합 점검(종료형)
  __tests__/                # 단위 테스트 9파일 / 58개
    logger / office / openrouter / actions / agent / config / orchestrator / backoff / semaphore .test.ts
  docs/
    사용설명서.md            # 초보자용 초상세 매뉴얼
    TEST_LOG.md             # 단계별 테스트 항목·결과 기록
    PLAN.md                 # 실행계획(전체 단계)
    adr/ADR-001 ~ 012.md    # 설계 결정 기록 12건
    reports/STAGE-1 ~ 8.md  # 단계별 완료 보고서 8건
```

---

## 5. 작업 방식 (어떻게 작업했는가)

### 5-1. TDD (테스트 주도 개발)
모든 모듈을 **테스트 먼저(Red) → 구현(Green) → 정리(Refactor)** 순으로 만들었습니다.
의존성(네트워크 `fetch`, 파일 `fs`, 타이머 `sleep`)을 모두 **주입 가능**하게 설계해(ADR-003),
실제 서버/디스크/네트워크 없이 58개 테스트가 빠르게(<1초) 돌아갑니다.

### 5-2. 단계별 진행 (단계 0 ~ 8)
| 단계 | 내용 |
|------|------|
| 0 | 채택 경로 결정(코드 분석으로 ADR-002 확정) |
| 1 | 스캐폴딩 + 한국어 로거 |
| 2 | office.ts(서버 연동) |
| 3 | openrouter.ts(LLM+파싱) |
| 4 | actions.ts(매핑) |
| 5 | agent.ts(행동 루프) |
| 6 | index/config(N명 병렬) + 라이브 통합 검증 |
| 7 | 비용·레이트리밋·백오프 |
| 8 | 문서화 & 공개 준비 |

각 단계 끝에 **테스트 통과 + 타입체크 + 완료 보고서**를 남기고 다음 단계로 넘어갔습니다.

### 5-3. 한국어 원칙
주석·로그·문서·ADR·보고서를 **전부 한국어**로 작성(변수명/함수명만 영어).
캐릭터 로그는 화면 동작과 1:1 대응되도록 고정 템플릿으로 생성(ADR-006).

---

## 6. ADR (설계 결정 기록) 설명 — `driver/docs/adr/`

ADR(Architecture Decision Record)은 "왜 이렇게 만들었는가"를 남기는 짧은 문서입니다.
각 결정의 **맥락 → 결정 → 결과**를 기록해, 나중에 봐도 이유를 알 수 있게 했습니다.

| ADR | 제목 | 핵심 요지 |
|-----|------|----------|
| 001 | 픽셀 오피스 연동 계약 고정 | 서버가 이해하는 엔드포인트/페이로드/해시 규칙을 계약으로 동결(서버 무수정) |
| 002 | 캐릭터 등장 방식 | JSONL 파일 기반 채택 + 훅 활동(가장 견고). 게이트(tracked dir/Watch All) 분석 |
| 003 | IO 경계 주입 | fetch/fs/sleep을 주입 가능하게 → 실서버 없이 테스트 |
| 004 | SLM 출력 안정화 | action 4종 enum + JSON 강제 + 파싱 폴백(rest) 3중 방어 |
| 005 | 에이전트별 모델·키 | 키 1개로 여러 모델, 모델은 호출 인자로 |
| 006 | 한국어 문구 템플릿 | 문구는 드라이버 고정 템플릿, 모델은 reason 한 줄만 생성 |
| 007 | 루프 타이밍 | 행동지속 1.5s / 루프 4s / 백오프 base 2s (애니메이션 가시성·비용) |
| 008 | PoC 실제 작업 미수행 | 데모용 신호만, 추후 실작업으로 교체 가능하게 분리 |
| 009 | 종료 시 SessionEnd | Ctrl+C에 전원 퇴장(유령 캐릭터 방지) |
| 010 | 에이전트 격리 | 한 명 실패가 다른 명 전파 안 됨(allSettled) |
| 011 | 비용·레이트리밋 정책 | 루프 하한 + 동시성 세마포어 + 지수 백오프 |
| 012 | 공개·비밀 관리 | 키는 `.env`(gitignore), 체험 모드로 진입장벽↓, MIT |

---

## 7. 단계별 완료 보고서 설명 — `driver/docs/reports/`

각 단계가 끝날 때마다 **무엇을 만들었고/어떤 결정을 했고/테스트 결과가 어떤지/완료 기준을 충족했는지**를
한 장으로 정리한 문서입니다(STAGE-1 ~ STAGE-8). 형식:

```
목표 → 만든 것(파일 표) → 주요 결정(ADR) → 테스트 결과 → 완료 기준 충족 → 다음 단계
```

특히 **STAGE-6**에는 라이브 통합 검증 절차와 발견 버그(token), 웹뷰 새로고침 이슈/운영수칙이,
**STAGE-8**에는 최종 완료 기준 5개 충족 여부와 전체 산출물 요약이 담겨 있습니다.

---

## 8. 테스트 로그 설명 — `driver/docs/TEST_LOG.md`

각 단계의 **테스트 항목(무엇을 검증하려 했는가)**과 **완료 내역(실제 통과 결과)**을 표로 기록합니다.
TDD 원칙에 따라 테스트를 먼저 쓰고 통과시킨 뒤 갱신했습니다.

### 누적 테스트 요약 (총 58개)

| 모듈 | 개수 | 주요 검증 |
|------|------|----------|
| logger | 4 | 한국어 포맷/색/ANSI 제거 |
| office | 10 | 해시·페이로드·server.json(token 포함)·훅 POST·JSONL |
| openrouter | 10 | 정상/깨진 JSON 파싱·enum 폴백·429/5xx 예외 |
| actions | 8 | action→tool_name·한국어 문구·기본값 |
| agent | 9 | 등장·행동순서·휴식·루프·백오프·세마포어·퇴장 |
| config | 8 | 정의 검증·env 파싱·루프 하한 |
| orchestrator | 3 | 병렬 구동·격리·전원 종료 |
| backoff | 3 | 지수 증가·상한·음수 방어 |
| semaphore | 3 | 동시성 제한·슬롯 반환 |
| **합계** | **58** | `npm test` → 58 passed |

---

## 9. 라이브 테스트 결과

1. **빌드/기동**: 루트 `npm install` + 빌드 → `node dist/cli.js --port 3100`로 standalone 서버 기동 성공.
2. **자동 통합 검증**(STAGE-6, 가짜 AI): 훅 **24건 전부 200**, 서버가 **Agent 3명 생성**(외부 세션 채택) →
   활동 → **SessionEnd로 퇴장** 확인.
3. **진짜 AI 검증**: `driver/.env`에 OpenRouter 키 투입 → 3명이 실제 모델로 동작.
   예: 이주임이 *"오늘의 작업 계획을 확인하려고 requirements.txt를 읽어본다"* 같은 **AI 생성 한국어 이유**까지 출력.
4. **유의점(가시화)**: 캐릭터가 화면에 뜨려면 ① 드라이버 워크스페이스가 서버의 추적 폴더와 일치하거나
   **Watch All Sessions ON**, ② 브라우저가 **에이전트 생성 전에 연결**돼 있어야 함(새로고침 금지).
   데모 환경에서는 서버가 **실행 중인 Claude Code 세션**도 캐릭터로 함께 잡는 부수효과가 관찰됨.

---

## 10. 최종 완료 기준 (5개 — 충족 현황)

| # | 기준 | 상태 |
|---|------|------|
| 1 | 드라이버 실행 → 오피스에 N개 캐릭터 등장 | ✅ (자동 통합검증에서 Agent 3명 생성 확인) |
| 2 | 각 캐릭터 독립 행동(타이핑/읽기/대기) 반복 | ✅ |
| 3 | 한국어 업무 로그 ↔ 화면 동작 1:1 대응 | ✅ |
| 4 | `claude` 프로세스 전혀 미실행 | ✅ (OpenRouter/가짜 AI만 사용) |
| 5 | 에이전트마다 다른 OpenRouter SLM 모델 | ✅ (llama-3.2-3b / qwen-2.5-7b / ministral-3b-2512) |

---

## 11. 사용법 요약 (자세한 건 `driver/docs/사용설명서.md`)

```
# ① 서버 (저장소 루트)
npm install ; npm run build ; node dist/cli.js --port 3100

# ② 브라우저: http://localhost:3100 → 설정에서 Watch All Sessions ON → (새로고침 금지)

# ③ 드라이버 (driver 폴더)
npm install
npm run smoke        # 키 없이 체험
# 또는
cp .env.example .env # OPENROUTER_API_KEY 입력 후
npm run start:env    # 진짜 AI
```

---

## 12. 남은 과제 (향후, 선택)

- **2단계(Provider 승격)**: `server/src/providers/hook/openrouter/` 정식 provider 추가 → JSONL 의존 제거.
- **3단계(실작업화)**: `actions`의 read/write/run을 실제 파일 작업으로 교체.
- **웹뷰 새로고침 버그**: 상위 프로젝트에 별도 PR로 수정 제안(현재는 운영수칙으로 회피).
- **라이브 가시화 안정화**: 워크스페이스 정합/세션 필터링을 더 명확히 안내·자동화.

---

## 부록: 관련 문서 빠른 링크

- 실행계획: [docs/PLAN.md](docs/PLAN.md)
- 역공학 분석: [docs/REVERSE_ENGINEERING.md](docs/REVERSE_ENGINEERING.md)
- 드라이버 README: [driver/README.md](driver/README.md)
- 초보자 매뉴얼: [driver/docs/사용설명서.md](driver/docs/사용설명서.md)
- 테스트 로그: [driver/docs/TEST_LOG.md](driver/docs/TEST_LOG.md)
- ADR: [driver/docs/adr/](driver/docs/adr/)
- 단계별 보고서: [driver/docs/reports/](driver/docs/reports/)
