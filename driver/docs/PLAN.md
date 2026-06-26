# 실행계획: pixel-agents OpenRouter 드라이버 전환

> 작성일: 2026-06-26
> 목적: Claude Code CLI 없이 `driver/` 한 폴더가 N개 에이전트를 OpenRouter SLM으로 구동,
> 그 행동을 기존 픽셀 오피스 서버가 이해하는 훅 신호로 변환해 캐릭터를 움직인다.

---

## ⚠️ 사전 발견: 메타 프롬프트의 "핵심 제약"이 현재 코드와 다름

[fileWatcher.ts:801-871](../server/src/fileWatcher.ts#L801) 의 `adoptExternalSessionFromHook` 에는 **두 갈래**가 있다.

- `transcript_path` **있음** → JSONL 파일 감시 기반 채택 (메타 프롬프트가 가정한 경로 — JSONL 파일 필요)
- `transcript_path` **없음(cwd만)** → **훅 전용(hooks-only) 채택**: `jsonlFile: ''` 로 에이전트 생성, **JSONL 파일 불필요**

즉 "훅 POST만으로 캐릭터가 안 생긴다"는 제약은 **현재 서버에선 부분적으로만 참**이다.
`SessionStart(cwd, transcript_path 없음)` → 확인 이벤트(Stop/PreToolUse 등) 순서로 보내면 JSONL 없이도 캐릭터가 생긴다.
**단, 게이트가 있음**: [agentRuntime.ts:99](../server/src/agentRuntime.ts#L99) 에서 `isTrackedProjectDir(cwd)` 가 true 이거나
**Watch All Sessions 가 ON** 이어야 채택된다. 이 한 가지가 1단계 설계의 분기점이라 ADR-002로 명시한다.

---

## 전제 확인

### 재사용할 것 (수정 금지)
- `server/`, `webview-ui/`, `core/`, `adapters/vscode/` — 1·2단계에서 import도 수정도 안 함
- 훅 입구 `POST /api/hooks/claude` (Bearer 인증, 2초 타임아웃)
- 연결 정보 `~/.pixel-agents/server.json` → `{ port, pid, authToken }`
- 외부 세션 채택 경로(스캐너 + 훅 confirm) → 캐릭터 생성

### 새로 만들 것
- `driver/` 폴더 전체 (독립 Node 프로세스, 기존 코드 import 없음)
- 에이전트별 OpenRouter 클라이언트, 행동 루프, 신호 변환기, 한국어 로그

### 핵심 제약 사항
1. **캐릭터 생성 두 경로**: ⓐ JSONL 파일 + `transcript_path`(파일 기반) / ⓑ `cwd`만 + 확인 이벤트(훅 전용).
   둘 다 `isTrackedProjectDir(cwd)` 또는 Watch All Sessions ON 게이트를 통과해야 함.
2. **프로젝트 해시**: 경로의 `:` `\` `/` → `-` (예: `C:\aistudy\pixel → C--aistudy-pixel`).
   JSONL 경로 `~/.claude/projects/<해시>/<uuid>.jsonl`.
3. **도구→애니메이션**: `Read/Grep/Glob/WebFetch`=읽기, `Edit/Write/Bash/Task`=타이핑.
4. **확인 이벤트 필요**: SessionStart만으론 pending. Stop/PreToolUse/PermissionRequest 중 하나가 와야 캐릭터 확정
   ([hookEventHandler.ts:265-280](../server/src/hookEventHandler.ts#L265)).
5. **TDD·ADR·한국어** 원칙: 변수/함수명만 영어, 나머지 한국어. 각 단계 완료 기준에 테스트 통과 포함.
6. **claude 프로세스 절대 미실행**.

---

## 단계별 계획

### 단계 0: 사전 검증 & 채택 경로 결정 (코드 없이)
**목표**: 실행 환경에서 서버 동작과 채택 게이트를 손으로 확인해 1단계 설계를 확정.
**작업 항목**:
  - [ ] `npx pixel-agents` 실행 → `~/.pixel-agents/server.json` 생성 확인, `GET /api/health` 200 확인
  - [ ] `manual-hook-events.http` 로 `SessionStart(cwd=서버 워크스페이스, transcript_path 없음)` → `Stop` 순서로 수동 POST → 캐릭터 등장 여부 확인 (= 훅 전용 경로 가용성 실측)
  - [ ] 같은 실험을 `transcript_path`+최소 JSONL 파일로 1회 (= 파일 기반 경로 실측)
  - [ ] Watch All Sessions ON/OFF, cwd=워크스페이스 일치/불일치 4조합에서 어떤 게 채택되는지 표로 정리
**ADR**: ADR-001 "픽셀 오피스 연동 계약 고정" (엔드포인트·페이로드·인증·해시 규칙을 드라이버 가정으로 동결)
**완료 기준**: 두 채택 경로 중 **무엇이 이 환경에서 실제로 동작하는지** 실측 표 확보.

### 단계 1: driver 스캐폴딩 + 테스트 하네스
**목표**: 독립 빌드/테스트 가능한 `driver/` 골격 + 한국어 로거.
**작업 항목**:
  - [ ] (Red) `logger.test.ts`: `[이름] 이모지 메시지` 포맷·색상 코드 출력 검증
  - [ ] (Green) `driver/package.json`(`type:module`, vitest, tsx), `tsconfig.json`, `src/logger.ts`
  - [ ] 루트 워크스페이스에 영향 없도록 `driver/`를 **별도 npm 프로젝트**로 (루트 package.json 미수정 — server/webview 불변 원칙)
**ADR**: ADR-002 **"캐릭터 등장 방식: JSONL 파일 기반 vs 훅 전용"** — 단계 0 실측 기반으로 결정.
(권장: 신선한 standalone에서 가장 견고한 **JSONL 파일 기반**을 1차로, 훅 전용은 가능하면 단순화 옵션으로)
**완료 기준**: `cd driver && npm test` 통과, `npm run build` 성공.

### 단계 2: office.ts — 서버 연동 어댑터 (TDD)
**목표**: server.json 읽기 + 훅 POST + (필요 시) JSONL 쓰기 + 해시 계산.
**작업 항목**:
  - [ ] (Red) `office.test.ts`: ① 프로젝트 해시 계산 ② server.json 파싱(없을 때 친절한 한국어 에러) ③ 훅 페이로드 빌더(SessionStart/PreToolUse/PostToolUse/Stop) ④ Bearer 헤더·타임아웃 ⑤ JSONL init 라인 포맷
  - [ ] (Green) `src/office.ts` 구현 — `fetch` 기반, HTTP는 주입 가능한 인터페이스로(테스트 시 fake)
  - [ ] uuid 생성(외부 의존 최소화: `crypto.randomUUID`)
**ADR**: ADR-003 "네트워크/파일 IO 경계 추상화" (테스트에서 실제 서버 없이 검증 가능하도록 transport 주입)
**완료 기준**: office 단위테스트 전부 Green. 실서버에 단발 POST → 캐릭터 1회 등장 수동 확인.

### 단계 3: openrouter.ts — LLM 클라이언트 + 견고한 파싱 (TDD)
**목표**: OpenRouter(OpenAI 호환) 호출 + `{action,target,reason}` 파싱, 실패 시 `rest` 폴백.
**작업 항목**:
  - [ ] (Red) `openrouter.test.ts`: ① 정상 JSON 파싱 ② 코드펜스/잡텍스트 섞인 응답에서 JSON 추출 ③ enum 외 action → `rest` 폴백 ④ 429/5xx → 예외 ⑤ 요청 바디(model·system·response_format) 구성
  - [ ] (Green) `src/openrouter.ts` — `OPENROUTER_API_KEY` env, 모델별 인스턴스, 강제 JSON 프롬프트 + 정규식 추출 폴백
**ADR**: ADR-004 "SLM 출력 안정화: enum 4종 제한 + 프롬프트 강제 JSON + 파싱 폴백" / ADR-005 "에이전트별 모델·키 주입 전략"
**완료 기준**: 파싱 테스트(특히 깨진 응답 케이스) 전부 Green. 실제 OpenRouter 호출 1회 스모크.

### 단계 4: actions.ts — 행동→신호 매핑 (TDD)
**목표**: `action` → `tool_name` + 한국어 로그 템플릿 (모델은 `reason`만 생성).
**작업 항목**:
  - [ ] (Red) `actions.test.ts`: 표대로 `read→Read`, `write→Edit`, `run→Bash`, `rest→Stop(없음)` + 한국어 문구·이모지·target 치환 검증
  - [ ] (Green) `src/actions.ts` — 순수 함수, 부수효과 없음
**ADR**: ADR-006 "한국어 문구는 드라이버 고정 템플릿, 모델 생성은 reason 한 줄로 한정" (SLM 안정성·비용)
**완료 기준**: 매핑 테스트 Green. `tool_name` 이 서버가 아는 값 집합에 속함을 단언.

### 단계 5: agent.ts — 단일 에이전트 행동 루프 (TDD, fake 주입)
**목표**: 한 에이전트의 등장→LLM 결정→행동 신호→지속→종료→반복 루프.
**작업 항목**:
  - [ ] (Red) `agent.test.ts`: fake office + fake openrouter 주입 → ① 시작 시 SessionStart(+필요시 JSONL) ② 확인 이벤트 발생으로 채택 트리거 ③ read 결정 시 PreToolUse(Read)→대기→PostToolUse 순서 ④ rest 시 Stop ⑤ 루프 N회 후 정지 신호로 종료 ⑥ LLM 예외 시 rest 폴백 + 백오프
  - [ ] (Green) `src/agent.ts` — 루프 주기·행동 지속시간 상수화, `AbortController` 로 graceful stop
**ADR**: ADR-007 "행동 루프 타이밍 모델 (주기/지속/턴종료 빈도)" / ADR-008 "PoC는 실제 파일 미조작 — 행동은 데모용, action 핸들러 분리로 추후 실작업 교체 가능"
**완료 기준**: 루프 테스트 Green. 실서버에서 에이전트 1명이 걷고·타이핑·읽기·대기를 반복.

### 단계 6: index.ts + config.ts — N명 병렬 + 통합 검증
**목표**: 설정 기반 N개 에이전트 동시 구동, 각자 다른 모델.
**작업 항목**:
  - [ ] (Red) `config.test.ts`: 에이전트 정의 검증(이름 유니크, 모델 필수), `index` 가 N개 루프를 독립 spawn하는지(한 명 실패가 다른 명에 영향 없음)
  - [ ] (Green) `src/config.ts`(김대리/박사원/이주임 + 모델), `src/index.ts`(병렬 실행, SIGINT graceful shutdown으로 전원 SessionEnd)
  - [ ] 통합 스모크: `npx pixel-agents` + `node driver` → 3 캐릭터 등장·독립 동작·한국어 로그 1:1 대응 육안 확인
**ADR**: ADR-009 "프로세스 종료 시 세션 정리(SessionEnd 전송)" / ADR-010 "에이전트 격리 — 한 명 크래시 비전파"
**완료 기준**: 최종 완료 기준 5개 중 1·2·3·5 충족 (4는 설계상 자명).

### 단계 7: 비용·레이트리밋·복원력 (TDD)
**목표**: 호출량 통제와 429 백오프, 끊김 시 캐릭터 "대기" 표시.
**작업 항목**:
  - [ ] (Red) 테스트: 루프 최소 주기 보장, 429 시 지수 백오프(상한), 백오프 중 에이전트 Stop(대기) 신호, 동시 호출 상한(세마포어)
  - [ ] (Green) 백오프·동시성 가드 구현, env로 주기/상한 조절
**ADR**: ADR-011 "비용·레이트리밋 정책 (주기·동시성·백오프 상한·일일 호출 가드)"
**완료 기준**: 백오프/레이트 테스트 Green. 인위적 429 주입 시 크래시 없이 대기 전환.

### 단계 8: 문서화 & GitHub 공개 준비
**목표**: 외부인이 클론→실행 가능한 상태.
**작업 항목**:
  - [ ] `driver/README.md`(한국어): 사전요건, `.env.example`(`OPENROUTER_API_KEY`), 실행 2터미널 절차, 트러블슈팅(채택 안 됨→Watch All Sessions/ cwd)
  - [ ] `driver/docs/adr/` 정리(ADR-001~011), 비밀키 커밋 방지(`.gitignore`, key 마스킹)
  - [ ] 라이선스/기여 안내, 최종 `npm test` 그린 확인
**ADR**: ADR-012 "공개 범위와 비밀 관리(키는 env, 저장소 미포함)"
**완료 기준**: 깨끗한 환경에서 README만 보고 재현 성공.

---

## 리스크 및 주의사항
- **채택 게이트(가장 큰 리스크)**: `isTrackedProjectDir(cwd)`/Watch All Sessions. 신선한 standalone에선 cwd가 서버 워크스페이스와 다르면 훅 전용 경로가 막힐 수 있음 → **JSONL 파일 기반을 1차 폴백**으로 항상 준비. 단계 0에서 반드시 실측.
- **확인 이벤트 누락**: SessionStart 후 확인 이벤트(Stop/PreToolUse)를 안 보내면 영원히 pending. 루프 시작 시 첫 행동을 즉시 보내도록.
- **SLM JSON 불안정**: strict JSON mode 미지원 모델 다수 → 프롬프트 강제 + 정규식 추출 + `rest` 폴백 3중 방어.
- **Windows 경로/해시**: `\`·드라이브 문자 대소문자. 서버는 경로 비교를 lowercase+resolve로 함 → 해시·cwd도 동일 규칙 적용.
- **비용 폭주**: 짧은 루프 × N에이전트 → 주기 하한·동시성 상한·일일 가드 필수.
- **JSONL 부분 줄/배칭**: init 한 줄이면 충분(서버가 부분 줄 버퍼링). `agentToolDone` 300ms 지연 때문에 행동 지속시간은 ≥0.5s 권장.

## 예상 소요 시간 (집중 작업 기준, 대략)
- 단계 0: 1–2h · 단계 1: 1h · 단계 2: 2–3h · 단계 3: 2–3h · 단계 4: 1h · 단계 5: 3–4h · 단계 6: 2–3h · 단계 7: 2h · 단계 8: 1–2h
- **합계 약 15–21h** (1단계 PoC 완성 = 단계 0~6, 약 11–16h)

## 최종 검증 체크리스트
- [ ] `node driver` 실행 → 오피스에 N개 캐릭터 등장
- [ ] 각 캐릭터가 독립적으로 타이핑/읽기/대기 애니메이션 반복
- [ ] 터미널 한국어 업무 로그 ↔ 화면 동작 1:1 대응
- [ ] `claude` 프로세스 전혀 미실행 (`tasklist`/`ps` 로 확인)
- [ ] 에이전트마다 다른 OpenRouter SLM 모델 사용(로그/요청 바디로 확인)
- [ ] `cd driver && npm test` 전부 Green, ADR-001~012 작성, README 재현 성공
</content>
</invoke>
