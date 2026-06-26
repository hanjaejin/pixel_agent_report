# 메타 프롬프트: pixel-agents OpenRouter 드라이버 전환 실행계획 수립

> **사용법**: 이 프롬프트 전체를 새 AI 대화에 붙여넣는다.
> AI는 이 내용을 읽고 **상세한 실행계획**을 출력해야 한다.
> 실행계획을 확인한 후, 그 계획대로 바이브코딩을 진행한다.

---

## [역할 지정]

당신은 시니어 풀스택 엔지니어이자 TDD 전문가입니다.
아래 프로젝트 맥락과 변경 목표를 읽고,
**단계별 실행계획**을 작성해 주세요.

실행계획 출력 형식은 이 프롬프트 마지막 섹션 [출력 형식]을 따르세요.

---

## [프로젝트 맥락]

### 프로젝트 이름
`pixel-agents` — AI 에이전트가 일하는 모습을 픽셀 아트 캐릭터로 시각화하는 VS Code 확장 + CLI



### 현재 아키텍처 (변경하지 않을 것)

```
[Claude Code CLI 프로세스]
  → 훅 스크립트 실행
  → POST /api/hooks/claude  (Bearer 인증)
  → server/src/httpServer.ts (Fastify)
  → hookEventHandler → agentRuntime → agentStateStore
  → WebSocket broadcast
  → webview-ui (React 19 + Canvas) → 캐릭터 애니메이션
```

### 서버가 이해하는 훅 페이로드 (이 형식 그대로 재사용)

```jsonc
// 세션 시작
{ "session_id": "<uuid>", "hook_event_name": "SessionStart",
  "cwd": "/workspace", "transcript_path": "/path/session.jsonl" }

// 행동 시작
{ "session_id": "<uuid>", "hook_event_name": "PreToolUse",
  "tool_name": "Read", "tool_input": { "file_path": "config.ts" } }

// 행동 종료
{ "session_id": "<uuid>", "hook_event_name": "PostToolUse" }

// 턴 종료(휴식)
{ "session_id": "<uuid>", "hook_event_name": "Stop" }
```

### 캐릭터 등장 필수 조건 (핵심 제약)

```
훅 POST만으로는 캐릭터가 생기지 않는다.

필수 절차:
1. JSONL 파일 생성: ~/.claude/projects/<해시>/<uuid>.jsonl
   최소 1줄: {"type":"system","subtype":"init","cwd":"/workspace"}
2. 서버 스캐너(3초 주기)가 파일 발견 → 에이전트 채택 → 캐릭터 등장
3. 이후 훅 POST로 행동 제어

프로젝트 해시: 경로의 ':', '\', '/' 를 '-' 로 치환
예: C:\Users\user\project → C--Users-user-project
```

### 서버 연결 정보

```javascript
// ~/.pixel-agents/server.json
{ "port": 3100, "pid": 1234, "authToken": "..." }
```

### 도구 이름 → 애니메이션 매핑

| tool_name | 오피스 애니메이션 |
|-----------|----------------|
| `Read`, `Grep`, `Glob` | 읽기 (책 보는 동작) |
| `Edit`, `Write`, `Bash` | 타이핑 (키보드 치는 동작) |

### 재사용 vs 신규 구분

| 구분 | 대상 | 처리 |
|------|------|------|
| 재사용 (수정 금지) | `server/`, `webview-ui/`, `core/`, `adapters/vscode/` | 건드리지 않음 |
| 신규 생성 | `driver/` 폴더 전체 | 새로 만듦 |

---

## [변경 목표]

### 핵심 목표

**Claude Code CLI 없이**, `driver/` 폴더 하나가 N개 에이전트를 동시 구동한다.
각 에이전트는 **OpenRouter API(SLM 모델)** 를 호출해 "다음 행동"을 결정하고,
그 결과를 기존 픽셀 오피스 서버가 이해하는 훅 신호로 변환해 전송한다.

```
[드라이버 단일 프로세스, Node.js]
  에이전트 김대리 → OpenRouter (llama-3.2-3b) ─┐
  에이전트 박사원 → OpenRouter (qwen-2.5-7b)  ─┤→ POST /api/hooks/claude
  에이전트 이주임 → OpenRouter (ministral-3b) ─┘      ↓
                                           기존 서버/웹뷰 그대로 동작
```

### LLM 출력 계약

```jsonc
// 작은 모델 안정화를 위해 4종 enum으로 제한
{
  "action": "read" | "write" | "run" | "rest",
  "target": "config.ts",         // 없으면 빈 문자열
  "reason": "한국어 이유 한 줄"  // 모델이 생성
}
// 파싱 실패 시 rest 로 폴백
```

### 행동 → 신호 매핑

| action | tool_name | 한국어 로그 예시 |
|--------|-----------|----------------|
| `read` | `Read` | `[김대리] 📖 config.ts 파일을 살펴보고 있어요` |
| `write` | `Edit` | `[박사원] ✏️ main.ts 를 수정하는 중이에요` |
| `run` | `Bash` | `[이주임] ⚙️ 명령을 실행하고 있어요` |
| `rest` | (Stop) | `[김대리] ☕ 잠깐 쉬는 중이에요` |

### 필요한 파일 구조 (참고용)

```
driver/
  package.json
  tsconfig.json
  src/
    index.ts        # 진입점: N개 에이전트 병렬 실행
    config.ts       # 에이전트 정의 (이름, 모델)
    agent.ts        # 에이전트 1명의 행동 루프
    openrouter.ts   # OpenRouter API 클라이언트
    office.ts       # server.json 읽기 + 훅 POST + JSONL 쓰기
    actions.ts      # action → tool_name + 한국어 로그 매핑
    logger.ts       # 한국어 컬러 로그
  __tests__/
    *.test.ts
  docs/adr/
    *.md
```

---

## [작업 원칙 (반드시 반영)]

1. **TDD 방법론**: 테스트 먼저(Red) → 구현(Green) → 리팩터(Refactor). 각 단계 완료 기준에 테스트 통과 포함
2. **ADR 문서화**: 모든 설계 결정에 ADR 작성. `driver/docs/adr/ADR-NNN-제목.md`
3. **한국어 원칙**: 주석·로그·문서 전부 한국어. 변수명/함수명만 영어
4. **상세 주석**: 모든 함수에 목적·입출력·의존성을 한국어로 설명
5. **GitHub 공개**: 마지막 단계에 공개 준비 포함
6. **기존 코드 불변**: `server/`, `webview-ui/`, `core/`, `adapters/vscode/` 수정 금지 (1단계)
7. **비용 고려**: 루프 주기, OpenRouter 레이트리밋 처리 포함

---

## [최종 완료 기준]

아래 5가지를 **모두** 충족해야 완료:

1. 드라이버 실행 → 오피스에 N개 캐릭터 등장
2. 각 캐릭터 독립적으로 타이핑/읽기/대기 애니메이션 반복
3. 터미널에 한국어 업무 로그가 흐르고 화면 동작과 1:1 대응
4. `claude` 프로세스 전혀 실행되지 않음
5. 에이전트마다 다른 OpenRouter SLM 모델 사용

---

## [출력 형식]

위 내용을 읽고 아래 형식으로 **실행계획**을 출력해 주세요:

```
# 실행계획: pixel-agents OpenRouter 드라이버 전환

## 전제 확인
- 재사용할 것 / 새로 만들 것 요약
- 핵심 제약 사항 목록

## 단계별 계획

### 단계 N: [단계 제목]
**목표**: 한 줄 요약
**작업 항목**:
  - [ ] 작업 1 (TDD: 테스트 먼저)
  - [ ] 작업 2
**ADR**: 이 단계에서 결정할 아키텍처 항목
**완료 기준**: 이 단계가 끝났다고 판단하는 조건

(단계 반복)

## 리스크 및 주의사항
## 예상 소요 시간
## 최종 검증 체크리스트
```
