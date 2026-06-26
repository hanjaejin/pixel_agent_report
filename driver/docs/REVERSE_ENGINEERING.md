# Pixel Agents 역공학 분석 보고서

> 작성일: 2026-06-25  
> 목적: 프로젝트를 이해하고 OpenRouter 드라이버로 교체하기 위한 분석

---

## 1. 이 프로젝트가 하는 일 (한 줄 요약)

**Claude Code CLI가 일하는 모습을 픽셀 아트 캐릭터로 실시간 시각화하는 VS Code 확장 + CLI 도구.**

- Claude가 파일을 읽으면 → 캐릭터가 책상으로 걸어가 "읽기" 애니메이션
- Claude가 코드를 편집하면 → "타이핑" 애니메이션
- Claude가 입력을 기다리면 → 말풍선(✓) 표시 + 알림 사운드
- Claude가 권한 승인을 요청하면 → 말풍선(...) 표시

---

## 2. 전체 아키텍처 (계층 구조)

```
┌─────────────────────────────────────────────────────────┐
│  core/          프로토콜 + 인터페이스 (사이드이펙트 없음)  │
└─────────────────┬───────────────────┬───────────────────┘
                  │                   │
    ┌─────────────▼──────┐   ┌────────▼────────────────┐
    │  server/            │   │  webview-ui/             │
    │  (Fastify HTTP/WS)  │   │  (React 19 + Canvas)     │
    └─────────────┬──────┘   └────────┬────────────────-┘
                  │                   │
    ┌─────────────▼──────┐            │
    │  adapters/vscode/   │           │
    │  (VS Code 확장)      │───────────┘
    └────────────────────┘

  standalone CLI: server/ + webview-ui/ (adapters 없이)
```

**엄격한 의존 방향:** core ← server ← adapters/vscode; core ← webview-ui  
adapters/vscode와 standalone은 서로를 절대 import하지 않는다.

---

## 3. 폴더별 역할 상세

### `core/` — 계약 레이어 (변경 금지 영역)

| 파일 | 역할 |
|------|------|
| `asyncapi.yaml` | 전체 프로토콜 정의 (단일 진실 소스). 변경 시 CI 실패 |
| `src/messages.ts` | **자동 생성** — 직접 수정 금지. ServerMessage/ClientMessage 타입 |
| `src/provider.ts` | `HookProvider` 인터페이스 + `AgentEvent` 타입 |
| `src/schemas.ts` | `PersistedAgent`, `AgentMeta`, `OfficeLayout` |
| `src/transport.ts` | `MessageTransport` 인터페이스 |

**AgentEvent.kind 값 (에이전트 상태를 표현하는 핵심 열거형):**
```typescript
'toolStart'        // 도구 실행 시작
'toolEnd'          // 도구 실행 종료
'turnEnd'          // 한 턴 완료 (awaitingInput: boolean)
'subagentStart'    // 서브에이전트 시작
'subagentEnd'      // 서브에이전트 종료
'subagentTurnEnd'  // 서브에이전트 턴 완료
'progress'         // 진행 상황 업데이트
'permissionRequest'// 권한 요청 (승인 대기)
'sessionStart'     // 세션 시작
'sessionEnd'       // 세션 종료
```

---

### `server/` — 런타임 핵심 (에이전트 활동 처리)

```
server/src/
  agentRuntime.ts       ← 모든 것의 중심. 타이머·스캐너·이벤트 처리 총괄
  agentStateStore.ts    ← 에이전트 상태 저장소 (EventEmitter 기반)
  hookEventHandler.ts   ← 정규화된 AgentEvent를 런타임에 전달
  sessionRouter.ts      ← session_id ↔ agent_id 매핑
  dismissalTracker.ts   ← 닫힌/clear된 세션 추적
  httpServer.ts         ← Fastify: POST /api/hooks/:providerId, WebSocket
  fileWatcher.ts        ← JSONL 파일 감시 (500ms 폴링)
  transcriptParser.ts   ← JSONL 파싱 → AgentEvent 변환
  timerManager.ts       ← 권한 타이머(7s), 텍스트 유휴 타이머(5s)
  
  providers/hook/claude/
    claude.ts              ← Claude 전용 이벤트 정규화
    claudeHookInstaller.ts ← ~/.claude/settings.json에 훅 설치/제거
    hooks/claude-hook.ts   ← Claude가 실행하는 훅 스크립트
```

---

### `adapters/vscode/` — VS Code 브릿지

- VS Code WebviewViewProvider를 AgentRuntime에 연결하는 얇은 레이어
- 터미널 생성/삭제 관리 (`agentManager.ts`)
- PostMessageTransport 생성

---

### `webview-ui/` — 픽셀 오피스 UI

```
webview-ui/src/
  hooks/useExtensionMessages.ts  ← ServerMessage를 OfficeState 변경으로 변환
  office/engine/
    officeState.ts   ← 게임 월드 상태 (캐릭터, 가구, 좌석)
    gameLoop.ts      ← requestAnimationFrame 루프
    renderer.ts      ← Canvas 렌더링
    characters.ts    ← 캐릭터 FSM (idle/walk/type/read)
    matrixEffect.ts  ← 등장/퇴장 매트릭스 애니메이션
  transport/
    postMessageTransport.ts  ← VS Code 모드
    webSocketTransport.ts    ← 독립 실행 모드 (자동 재연결)
```

---

## 4. 데이터 흐름 (에이전트가 일하는 걸 어떻게 감지하나)

### 감지 방식 1: 훅 (Hooks) — 권장, 즉각적

```
Claude 실행
  → PreToolUse 이벤트 발생
  → ~/.pixel-agents/server.json에서 port + token 읽기
  → POST http://127.0.0.1:{port}/api/hooks/claude
  → Bearer 인증, 2초 타임아웃
  → 서버: HookEventHandler.handleEvent()
```

**훅 이벤트 종류 (11가지):**
| 이벤트 | 타이밍 | AgentEvent.kind 변환 |
|--------|--------|---------------------|
| SessionStart | 세션 시작 시 | sessionStart |
| SessionEnd | 세션 종료 시 | sessionEnd |
| PreToolUse | 도구 실행 직전 | toolStart |
| PostToolUse | 도구 실행 완료 | toolEnd |
| PostToolUseFailure | 도구 실행 실패 | toolEnd |
| Stop | 턴 완료 | turnEnd |
| PermissionRequest | 승인 요청 | permissionRequest |
| Notification(idle_prompt) | 입력 대기 | turnEnd(awaitingInput: true) |
| SubagentStart | 서브에이전트 시작 | subagentStart |
| SubagentStop | 서브에이전트 종료 | subagentEnd |

### 감지 방식 2: JSONL 폴링 — 폴백, 500ms 지연

```
~/.claude/projects/<프로젝트-해시>/<session-id>.jsonl
  → FileWatcher 500ms 폴링
  → transcriptParser.processTranscriptLine()
  → AgentEvent 생성
```

**JSONL 레코드 타입:**
- `assistant` — tool_use 블록 (도구 실행 감지)
- `user` — tool_result (도구 완료 감지)  
- `system` + `subtype: "turn_duration"` — 턴 완료 신호 (신뢰할 수 있음)
- `progress` + `data.type: "agent_progress"` — 서브에이전트 활동

**프로젝트 해시 계산법:**
```
경로의 `:`, `\`, `/` 를 `-`로 치환
예: C:\Users\user\project → C--Users-user-project
```

### 전체 파이프라인

```
[훅 HTTP POST] ────────────────────────────────┐
                                               ▼
[JSONL 폴링] → transcriptParser → AgentEvent → HookEventHandler
                                               ▼
                                         AgentRuntime
                                         (kind로 분기)
                                               ▼
                                        AgentStateStore
                                        (상태 변경 + emit)
                                               ▼
                                     StoreEvent → ServerMessage
                                               ▼
                           PostMessage ──┤├── WebSocket
                           (VS Code)         (독립 실행)
                                               ▼
                                    useExtensionMessages.ts
                                               ▼
                                    OfficeState 변경 → Canvas 렌더링
```

---

## 5. 에이전트 감지 메커니즘 (상세)

### AgentRuntime의 스캐너 3종

| 스캐너 | 주기 | 역할 |
|--------|------|------|
| 프로젝트 스캔 | 1초 | 현재 워크스페이스의 새 JSONL 파일 탐지 |
| 외부 스캔 | 3초 | 다른 디렉토리의 에이전트 탐지 (Watch All Sessions ON 시) |
| 오래된 것 정리 | 30초 | 데이터 없는 에이전트 제거 |

### 타이머 2종 (훅 없을 때만 작동)

| 타이머 | 대기 시간 | 트리거 조건 |
|--------|-----------|------------|
| 권한 타이머 | 7초 | 비면제 도구 실행 후 7초 동안 데이터 없음 |
| 텍스트 유휴 타이머 | 5초 | 도구 없는 턴에서 5초 동안 데이터 없음 |

`hookDelivered = true` 이면 두 타이머 모두 비활성화됨.

### 캐릭터 생성 조건 (중요!)

```
⚠️ 훅 POST만으로는 캐릭터가 생기지 않는다!

캐릭터 생성 경로:
1. 외부 세션 채택: 스캐너가 JSONL 파일을 발견했을 때
2. SessionStart 훅: hookEventHandler.ts가 처리

→ JSONL 파일이 먼저 존재해야 스캐너가 채택해서 캐릭터 등장
→ 파일 경로: ~/.claude/projects/<해시>/<session-id>.jsonl
```

이것이 `PLAN_강사님.md`에서 1단계 PoC에서 JSONL 파일을 먼저 만들라는 이유.

---

## 6. 핵심 상태 구조

### AgentState (서버 측, 에이전트당 런타임 데이터)

```typescript
{
  id: number;                                    // 정수 ID (서브에이전트는 음수)
  sessionId: string;                             // UUID
  projectDir: string;                            // 워크스페이스 경로
  jsonlFile: string;                             // JSONL 파일 경로
  activeToolIds: Set<string>;                    // 현재 실행 중인 도구 ID
  activeToolStatuses: Map<string, string>;       // 도구 ID → 표시 텍스트
  isWaiting: boolean;                            // 입력 대기 중?
  permissionSent: boolean;                       // 권한 요청 말풍선 표시 중?
  hookDelivered: boolean;                        // 훅이 전달되면 true
  teamName?: string;                             // 팀 에이전트 이름
  inputTokens: number;                           // 사용 토큰 수
  outputTokens: number;
}
```

### 퍼시스턴스 위치 (`~/.pixel-agents/`)

| 파일 | 내용 |
|------|------|
| `server.json` | `{ port, pid, authToken }` — 훅 스크립트가 여기서 포트 읽음 |
| `config.json` | 사운드/레이아웃 등 설정 |
| `layout.json` | 공유 오피스 레이아웃 |
| `vscode-state.json` | VS Code 모드 에이전트 + 좌석 정보 |
| `standalone-state.json` | 독립 실행 모드 에이전트 + 좌석 정보 |

---

## 7. 훅 페이로드 형식 (드라이버 작성 시 필요)

### POST /api/hooks/claude

```
헤더: Authorization: Bearer <authToken>
      Content-Type: application/json
```

#### 세션 시작
```jsonc
{
  "session_id": "<uuid>",
  "hook_event_name": "SessionStart",
  "cwd": "/path/to/workspace",
  "transcript_path": "/path/to/session.jsonl"
}
```

#### 도구 실행 시작
```jsonc
{
  "session_id": "<uuid>",
  "hook_event_name": "PreToolUse",
  "tool_name": "Read",          // Read, Edit, Bash, Grep, Glob, Write 등
  "tool_input": { "file_path": "config.ts" }
}
```

#### 도구 실행 완료
```jsonc
{
  "session_id": "<uuid>",
  "hook_event_name": "PostToolUse"
}
```

#### 턴 완료 (입력 대기)
```jsonc
{
  "session_id": "<uuid>",
  "hook_event_name": "Stop"
}
```

#### 입력 대기 (명시적)
```jsonc
{
  "session_id": "<uuid>",
  "hook_event_name": "Notification",
  "notification_type": "idle_prompt"
}
```

### 도구 이름 → 애니메이션 매핑

| tool_name | 애니메이션 | 설명 |
|-----------|-----------|------|
| `Read`, `Grep`, `Glob`, `WebFetch`, `WebSearch` | 읽기 | 책을 보는 동작 |
| `Edit`, `Write`, `Bash`, `Task`, `Agent` | 타이핑 | 키보드 치는 동작 |
| 그 외 | 타이핑 | 기본값 |

---

## 8. 서버 HTTP 엔드포인트

```
POST /api/hooks/:providerId    훅 이벤트 수신 (Bearer 인증)
GET  /api/health               상태 확인: { ok, version, port, pid }
GET  /ws                       WebSocket 채널 (양방향 프로토콜)
GET  /*                        (standalone만) 웹뷰 SPA 서빙
```

### server.json 읽기 방법
```javascript
const info = JSON.parse(fs.readFileSync(
  path.join(os.homedir(), '.pixel-agents', 'server.json'),
  'utf8'
));
// info.port, info.authToken
```

---

## 9. 캐릭터 생명주기

```
JSONL 파일 발견 (스캐너)
  → agentAdded → character 생성 (매트릭스 등장 효과 0.3초)
  → idle 상태 (배회 AI: 자리로 돌아가거나 랜덤 이동)

도구 시작 (agentToolStart)
  → 좌석으로 이동 (BFS 경로찾기)
  → 앉아서 타이핑/읽기 애니메이션

대기 (agentStatus: 'waiting')
  → 말풍선(✓) + 사운드 알림

도구 완료 → idle로 복귀

세션 종료 → 매트릭스 퇴장 효과 → 캐릭터 제거
```

### 캐릭터 팔레트 배정

- 6개 팔레트(0-5), 각각 다른 색상
- 새 에이전트: 사용이 가장 적은 팔레트 자동 배정
- 6명 초과 시: 기존 팔레트 재사용 + 랜덤 색조 이동(45-315도)

---

## 10. 수정하기 위해 알아야 할 핵심 포인트

### A. 드라이버 구현 시 필요한 것

1. **`~/.pixel-agents/server.json`** 읽기 (port + authToken)
2. **최소 JSONL 파일 생성** (`~/.claude/projects/<해시>/<uuid>.jsonl`)
   - 최소 1줄이면 됨 (스캐너가 발견해야 캐릭터 등장)
   - 형식: `{"type":"system","subtype":"init","cwd":"/path"}` 
3. **훅 POST** → `POST /api/hooks/claude`로 에이전트 상태 전달

### B. 주의해야 할 상태 기계

```
hookDelivered 플래그:
- 훅이 한 번이라도 전달되면 true
- true이면 JSONL 폴링 타이머 비활성화
- → 드라이버에서 훅을 보내면 자동으로 훅 모드로 동작
```

### C. 캐릭터 등장 순서

```
1. JSONL 파일 생성 (스캐너가 3초 이내 발견)
2. (선택) SessionStart 훅 POST → 즉시 채택
3. PreToolUse 훅 POST → 캐릭터 책상으로 이동
4. PostToolUse 훅 POST → 캐릭터 idle
5. Stop 훅 POST → 대기 말풍선
```

### D. 변경하면 안 되는 파일들 (1단계 PoC)

- `core/` 전체
- `server/` 전체
- `webview-ui/` 전체
- `adapters/vscode/` 전체

### E. 새로 만들어야 하는 파일들

```
driver/                    (완전 새 폴더)
  package.json
  src/
    index.ts               N개 에이전트 진입점
    config.ts              에이전트 정의 (이름, 모델)
    agent.ts               에이전트 1명의 루프
    openrouter.ts          OpenRouter API 클라이언트
    office.ts              server.json 읽기 + 훅 POST + JSONL 쓰기
    actions.ts             action → tool_name + 한국어 문구 매핑
    logger.ts              한국어 컬러 로그
```

---

## 11. 빌드 및 실행 방법

```bash
# 전체 설치 (루트에서 한 번만)
npm install

# 타입 체크 + 빌드
npm run compile

# 독립 실행 서버 시작
npx pixel-agents              # 기본값: localhost:3100
npx pixel-agents --port 3100

# 개발 모드 (watch)
npm run watch                  # esbuild watch
cd webview-ui && npm run dev   # Vite 개발 서버 (별도 터미널)

# 테스트
npm test                       # Vitest (서버 + 웹뷰)
npm run e2e                    # Playwright E2E
```

---

## 12. 테스트 구조 (빠른 참고)

```
server/__tests__/          13개 Vitest 파일, ~200개 테스트
  agentStateStore.test.ts  상태 변경 검증
  hookEventHandler.test.ts 이벤트 라우팅 검증
  claude.test.ts           훅 정규화 검증

e2e/                       47개 Playwright 테스트
  fixtures/mock-claude     실제 claude 없이 테스트하는 목 스크립트
  → 이것이 드라이버 구현의 참고 모델
```

### mock-claude 패턴 (드라이버 구현 참고)

```javascript
// e2e/fixtures/mock-claude-runner.cjs 참고
claudeScenario()
  .at(100).appendJsonl({ type: "system", subtype: "init" })
  .at(500).emitHook("PreToolUse", { tool_name: "Read", ... })
  .at(1500).emitHook("PostToolUse")
  .at(2000).emitHook("Stop")
  .build()
```

---

## 13. 중요한 발견 사항 (주의)

1. **`fs.watch` Windows 불안정** → 프로젝트가 이미 500ms 폴링으로 보완
2. **부분 줄 버퍼링** → JSONL 쓰기 중 읽기 안전 처리됨
3. **`agentToolDone` 300ms 지연** → React 배칭이 brief 상태를 숨기는 걸 방지
4. **외부 세션 채택 레이스** → 스캐너가 3초마다 실행 → JSONL 생성 후 최대 3초 대기 필요
5. **`/clear` 감지** → JSONL 파일 앞 8KB에서 `/clear</command-name>` 탐색
6. **`/clear` 후** → 새 JSONL 파일 생성됨 (기존 파일은 종료)

---

## 14. 관련 파일 빠른 참조

| 목적 | 파일 |
|------|------|
| 훅 페이로드 형식 이해 | [claude.ts](../server/src/providers/hook/claude/claude.ts) |
| 훅 스크립트 예시 | [claude-hook.ts](../server/src/providers/hook/claude/hooks/claude-hook.ts) |
| 캐릭터 생성 로직 | [hookEventHandler.ts](../server/src/hookEventHandler.ts) |
| 에이전트 상태 구조 | [agentStateStore.ts](../server/src/agentStateStore.ts) |
| 도구→애니메이션 매핑 | [characters.ts](../webview-ui/src/office/engine/characters.ts) |
| mock-claude 패턴 | [mock-claude-runner.cjs](../e2e/fixtures/mock-claude-runner.cjs) |
| 수동 테스트용 HTTP | [manual-hook-events.http](../server/manual-hook-events.http) |
| 전체 계획 | [PLAN_강사님.md](./PLAN_강사님.md) |
