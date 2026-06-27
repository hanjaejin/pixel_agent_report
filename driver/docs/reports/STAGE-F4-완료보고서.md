# 기능 단계 F4 완료 보고서 — 모델 폴백(자동 대체)

- 날짜: 2026-06-27
- 상태: ✅ 완료
- 관련: PLAN_2 F4

## 목표
404/402/401 같은 **영구 에러** 시 백오프만 돌지 말고 **대체 모델로 자동 전환**해 멈추지 않게 한다.
(라이브에서 실제로 겪은 404/402/429 고통을 해소.)

## 만든 것 / 바꾼 것
| 파일 | 내용 |
|------|------|
| [src/openrouter.ts](../../src/openrouter.ts) | `OpenRouterError{status}` 도입, decide가 상태코드를 담아 throw |
| [src/agent.ts](../../src/agent.ts) | 모델 목록 `[model, ...fallbackModels]` + 인덱스 전환, 에러 분류(영구/일시), `AgentConfig.fallbackModels` |
| [src/index.ts](../../src/index.ts), [scripts/smoke.ts](../../scripts/smoke.ts), [scripts/integration-check.ts](../../scripts/integration-check.ts) | `fallbackModels: def.fallbackModels` 전달 |
| [__tests__/openrouter.test.ts](../../__tests__/openrouter.test.ts), [__tests__/agent.test.ts](../../__tests__/agent.test.ts) | 테스트 +4 |

## 동작
- 영구 에러(400/401/402/403/404) → 다음 폴백 모델로 전환(이번 턴은 Stop, 다음 tick부터 새 모델).
  폴백 소진 시 짧게 대기 후 rest.
- 일시 에러(429/5xx/네트워크/타임아웃/파싱) → 같은 모델로 지수 백오프(ADR-011 유지).

## 주요 결정 (ADR)
- [ADR-016](../adr/ADR-016-error-classification-model-fallback.md): 에러 분류와 모델 폴백(영구 vs 일시)

## 테스트 결과
- `npm test`: **87 passed / 87** (+4) ✅
- `npm run build`(타입체크): 통과

## 완료 기준 충족
- [x] 404→모델 전환 / 429→백오프 분기 검증
- [x] 폴백 소진 시 안전 종료(rest)
- [x] 기존 백오프 동작 회귀 0
- [x] 타입체크 통과 + 보고서/TEST_LOG 갱신

## 다음 단계
- F5(풀스택): 오피스 화면에서 에이전트별 모델 선택 — 런타임 hot-swap + server↔driver 제어 채널.
