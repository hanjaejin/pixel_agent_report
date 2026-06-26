# ADR-007: 행동 루프 타이밍 모델

- 상태: 채택(Accepted)
- 날짜: 2026-06-26

## 맥락

캐릭터가 "살아 움직이는" 것처럼 보이려면 행동의 시작/지속/종료 타이밍이 적절해야 한다.
또한 `server` 는 `agentToolDone` 을 300ms 지연 처리하므로 행동 지속이 너무 짧으면
타이핑/읽기 애니메이션이 화면에 보이기 전에 사라질 수 있다.

## 결정

세 가지 시간 상수를 둔다(모두 주입 가능, 기본값 제공).

| 상수 | 기본값 | 의미 |
|------|--------|------|
| `actionDurationMs` | 1500ms | PreToolUse → PostToolUse 사이(애니메이션 지속). ≥500ms 권장 |
| `loopIntervalMs` | 4000ms | 한 사이클 종료 후 다음 결정까지 쉬는 시간(비용/레이트리밋 조절) |
| `backoffMs` | 2000ms | LLM 호출 실패 시 백오프(ADR-011 의 기본 단위) |

루프 1사이클: `LLM 결정 → (행동이면) PreToolUse → actionDuration 대기 → PostToolUse →
(rest면) Stop → loopInterval 대기`.

## 결과

- 화면에서 타이핑/읽기 동작이 충분히 보인다(300ms 배칭 지연 대비 여유).
- `loopIntervalMs` 를 키우면 호출량(비용)이 줄어든다 → 환경변수로 노출(단계 6/7).
