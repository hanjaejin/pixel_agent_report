# 단계 5 완료 보고서 — agent.ts (단일 에이전트 행동 루프)

- 날짜: 2026-06-26
- 상태: ✅ 완료

## 목표
한 에이전트의 등장→LLM 결정→행동 신호→지속→종료→반복 루프를 구현한다.
office/openrouter/actions 를 조합하고, 모든 의존성을 주입해 결정적으로 테스트.

## 만든 것
| 파일 | 역할 |
|------|------|
| [src/agent.ts](../../src/agent.ts) | `createAgent(config, deps)` → `start/tickOnce/runLoop/stop` |
| [__tests__/agent.test.ts](../../__tests__/agent.test.ts) | fake 주입 행동 루프 테스트 7건 |

### 핵심 흐름
- `start()`: init 트랜스크립트 작성 + `SessionStart`(transcript_path) → 캐릭터 등장(ADR-002)
- `tickOnce()`: `safeDecide()`(LLM, 실패 시 rest+백오프) → 행동이면 `PreToolUse → 대기 → PostToolUse`, rest면 `Stop`
- `runLoop({maxIterations})`: start 후 abort/최대횟수까지 반복
- `stop()`: `SessionEnd(exit)` → 캐릭터 퇴장

## 주요 결정 (ADR)
- [ADR-007](../adr/ADR-007-loop-timing-model.md): 루프 타이밍(actionDuration 1.5s / loopInterval 4s / backoff 2s)
- [ADR-008](../adr/ADR-008-poc-no-real-work.md): PoC 는 실제 파일 미조작(신호만), 추후 실작업 교체 가능

## 빌드 방식 변경 (중요)
- agent.ts 가 첫 **로컬 value import(`.ts`)** 라 `tsc` 방출이 TS5097 로 거부됨.
- ESM+`tsx` 표준에 맞춰 `tsconfig` 를 `noEmit` + `allowImportingTsExtensions` 로 전환.
- `npm run build`/`npm run typecheck` = **타입체크**(tsc --noEmit), 실행 = `tsx`(`npm start`/`npm run dev`).
- 과거 보고서의 "dist/*.js 생성"은 이 시점부터 "타입체크 통과"로 대체됨.

## 테스트 결과
- `npm test`: **7 passed / 7** (누적 38/38) ✅ (상세: [TEST_LOG.md](../TEST_LOG.md))
- `npm run build`(타입체크): 통과

## 완료 기준 충족
- [x] 루프 테스트 Green (등장/행동순서/휴식/루프/예외폴백/퇴장)
- [x] 타입체크 통과
- [ ] (수동) 실서버에서 에이전트 1명 걷기/타이핑/읽기/대기 반복 — 단계 6 통합에서 수행

## 비고 / 다음 단계
- 다음: 단계 6 (index.ts + config.ts — N명 병렬 구동 + 실서버 통합 검증).
