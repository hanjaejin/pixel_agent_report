# 단계 2 완료 보고서 — office.ts (서버 연동 어댑터)

- 날짜: 2026-06-26
- 상태: ✅ 완료

## 목표
기존 서버를 수정하지 않고, 계약(ADR-001)만으로 연동하는 어댑터 구축:
server.json 읽기 + 훅 POST + JSONL 쓰기 + 프로젝트 해시 계산.

## 만든 것
| 파일 | 역할 |
|------|------|
| [src/office.ts](../../src/office.ts) | 서버 연동 어댑터(순수 함수 + IO 함수) |
| [__tests__/office.test.ts](../../__tests__/office.test.ts) | 순수/IO 테스트 9건 |

### 핵심 API
- 순수: `projectDirName`, `transcriptPathFor`, `readServerInfo`, 훅 빌더 5종(`buildSessionStart/PreToolUse/PostToolUse/Stop/SessionEnd`), `initRecord`
- IO: `createOffice(deps)` → `postHook(payload)`(Bearer + 2초 타임아웃), `writeInitTranscript(workspace, sessionId)`

## 주요 결정 (ADR)
- [ADR-003](../adr/ADR-003-io-boundary-injection.md): 네트워크/파일 IO 의존성 주입 → 실서버/디스크 없이 테스트

## 테스트 결과
- `npm test`: **9 passed / 9** (누적 13/13) ✅ (상세: [TEST_LOG.md](../TEST_LOG.md))
- `npm run build`: 성공 (`dist/office.js`)

## 완료 기준 충족
- [x] office 단위테스트 전부 Green
- [x] 빌드 성공
- [ ] (수동) 실서버 단발 POST → 캐릭터 1회 등장 — 통합 검증 단계(단계 6)에서 수행 예정

## 비고 / 다음 단계
- `readServerInfo` 는 파일 부재/형식 오류 시 "서버 실행 확인" 한국어 안내 에러로 친절히 실패.
- 다음: 단계 3 (openrouter.ts).
