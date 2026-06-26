# ADR-002: 캐릭터 등장 방식 — JSONL 파일 기반 채택 + 훅 활동

- 상태: 채택(Accepted)
- 날짜: 2026-06-26

## 맥락

메타 프롬프트의 "핵심 제약"은 "훅 POST만으로는 캐릭터가 안 생긴다"였다.
그러나 실제 서버 코드를 읽어보니 더 정확한 사실이 있다.

`server/src/fileWatcher.ts:801` `adoptExternalSessionFromHook` 는 두 갈래다.

- `transcript_path` **있음** → JSONL 파일을 감시하며 채택 (파일 기반)
- `transcript_path` **없음(cwd만)** → `jsonlFile: ''` 로 에이전트 생성 (훅 전용, JSONL 불필요)

따라서 훅만으로도 캐릭터 생성이 **가능**하다. 단, 두 경로 모두
`server/src/agentRuntime.ts:99` 의 게이트를 통과해야 한다:

```
isTrackedProjectDir(cwd) === true  ||  watchAllSessions === true
```

`isTrackedProjectDir`(fileWatcher.ts:242)는 서버가 스캔하도록 등록된
프로젝트 디렉터리 집합(`trackedProjectDirs`)에 속하는지를 본다. 신선한 standalone
서버에서 이 집합은 사실상 서버의 워크스페이스(실행 cwd)뿐이다. 즉 **드라이버의
워크스페이스가 서버 워크스페이스와 다르면, 어떤 경로를 쓰든 Watch All Sessions
가 켜져 있어야 채택된다.**

## 결정

드라이버는 **JSONL 파일 기반 채택 + 훅 활동**을 1차 방식으로 채택한다.

1. 에이전트 시작 시 `~/.claude/projects/<이름>/<uuid>.jsonl` 에 init 한 줄을 쓴다
   (`{"type":"system","subtype":"init","content":"..."}`). 이는 e2e의 mock-claude가
   증명한 가장 견고한 경로다(스캐너가 발견해 채택).
2. 동시에 `SessionStart(transcript_path 포함)` 훅을 보내 즉시 채택을 유도하고,
   이후 `PreToolUse/PostToolUse/Stop` 훅으로 행동을 즉각/깔끔하게 표현한다.
3. 워크스페이스 경로는 `PIXEL_WORKSPACE`(기본 = 드라이버 cwd)로 설정 가능.
   서버 워크스페이스와 다르면 README에서 **Watch All Sessions ON** 을 안내한다.

## 대안 (기각/보류)

- **훅 전용(transcript_path 없음)**: JSONL을 안 써서 더 깔끔하지만, 게이트는 동일하게
  적용되고 파일 기반보다 검증 사례가 적다. → 2단계(provider 승격)에서 정식 채택 검토.

## 결과

- 신선한 standalone에서 가장 확실하게 캐릭터가 뜬다.
- 비용: 에이전트당 작은 JSONL 파일 1개 생성(.claude/projects 아래). PoC에선 무해.
- 게이트 한계(워크스페이스 불일치)는 코드 수정 없이 못 넘으므로 문서로 안내한다.
