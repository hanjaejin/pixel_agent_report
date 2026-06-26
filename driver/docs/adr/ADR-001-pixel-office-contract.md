# ADR-001: 픽셀 오피스 연동 계약 고정

- 상태: 채택(Accepted)
- 날짜: 2026-06-26

## 맥락

드라이버는 기존 픽셀 오피스 서버(`server/`)를 **수정하지 않고** 연동해야 한다.
따라서 서버가 이미 이해하는 외부 인터페이스를 "계약"으로 동결하고, 드라이버는
그 계약만 바라본다. 계약 내용은 역공학(`docs/REVERSE_ENGINEERING.md`)과
실제 코드(`server/src/httpServer.ts`, `hookEventHandler.ts`, `fileWatcher.ts`,
`e2e/fixtures/mock-claude-runner.cjs`) 확인으로 검증했다.

## 결정

다음을 변경 불가 계약으로 고정한다.

1. **연결 정보**: `~/.pixel-agents/server.json` → 실제 CLI 는 `{ port, pid, token, startedAt }`
   를 쓴다(역공학 문서의 `authToken` 표기는 틀렸음 — 라이브 검증에서 확인). 드라이버는
   `token` 을 우선 읽고 `authToken` 도 폴백으로 허용한다. 인증 헤더는 `Bearer <token>`.
2. **훅 입구**: `POST http://127.0.0.1:<port>/api/hooks/claude`,
   헤더 `Authorization: Bearer <authToken>`, `Content-Type: application/json`, 타임아웃 2초.
3. **훅 페이로드**(Claude 형식 그대로 재사용):
   - `SessionStart`: `{ session_id, hook_event_name, cwd, transcript_path }`
   - `PreToolUse`: `{ session_id, hook_event_name, tool_name, tool_input }`
   - `PostToolUse`: `{ session_id, hook_event_name }`
   - `Stop`: `{ session_id, hook_event_name }`
   - `SessionEnd`: `{ session_id, hook_event_name, reason }`
4. **프로젝트 디렉터리 이름 규칙**: `workspacePath.replace(/[^a-zA-Z0-9-]/g, '-')`
   (mock-claude-runner.cjs:27 의 실제 규칙. 문서의 "`:` `\` `/` 치환"보다 넓다 — 모든
   비영숫자/대시 문자를 치환). JSONL 경로: `~/.claude/projects/<이름>/<uuid>.jsonl`.
5. **도구→애니메이션**: `Read/Grep/Glob/WebFetch`=읽기, `Edit/Write/Bash/Task`=타이핑.

## 결과

- 드라이버는 위 5개 항목만 의존하면 서버 내부가 바뀌어도 (계약이 유지되는 한) 동작한다.
- 계약 위반(예: 잘못된 프로젝트 디렉터리 이름)은 "캐릭터가 안 뜸"으로 즉시 드러난다.
