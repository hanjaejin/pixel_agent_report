# 단계 7 완료 보고서 — 비용·레이트리밋·백오프

- 날짜: 2026-06-26
- 상태: ✅ 완료

## 목표
호출량 통제(비용)와 429 복원력을 위해 루프 주기 하한 + 동시성 제한 + 지수 백오프를 도입.

## 만든 것
| 파일 | 역할 |
|------|------|
| [src/backoff.ts](../../src/backoff.ts) | `nextBackoffMs(attempt, base, max)` 지수 백오프(상한) |
| [src/semaphore.ts](../../src/semaphore.ts) | `createSemaphore(max)` 동시 호출 제한 |
| [src/agent.ts](../../src/agent.ts) | tickOnce 에 백오프(실패 시 `Stop`+대기) + 세마포어 적용 |
| [src/config.ts](../../src/config.ts) | 루프 주기 최소 1000ms 클램프 + 백오프/동시성 env |
| [src/index.ts](../../src/index.ts) | 전 에이전트 공유 세마포어 생성·주입 |

## 정책 (모두 환경변수 조절)
| 환경변수 | 기본 | 의미 |
|----------|------|------|
| `PIXEL_LOOP_INTERVAL_MS` | 4000 (최소 1000) | 루프 1회 주기 |
| `PIXEL_MAX_CONCURRENCY` | 2 | OpenRouter 동시 호출 상한(공유) |
| `PIXEL_BACKOFF_BASE_MS` | 2000 | 백오프 base (2배씩 증가) |
| `PIXEL_BACKOFF_MAX_MS` | 30000 | 백오프 상한 |

## 주요 결정 (ADR)
- [ADR-011](../adr/ADR-011-cost-ratelimit-policy.md): 비용·레이트리밋 정책(주기·동시성·백오프)

## 테스트 결과
- `npm test`: **누적 58/58** ✅ (backoff 3 + semaphore 3 + agent 9 + config 8 + 기타)
- `npm run build`(타입체크): 통과

## 완료 기준 충족
- [x] 루프 최소 주기 보장(클램프)
- [x] 429/5xx 지수 백오프(상한)
- [x] 백오프 중 `Stop`(대기) 신호
- [x] 동시 호출 상한(세마포어)

## 다음 단계
- 단계 8 (문서화 & 공개 준비): README(운영수칙·env·실행 절차), .gitignore/비밀관리, ADR 정리.
