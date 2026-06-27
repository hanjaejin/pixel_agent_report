# 기능 단계 F2 완료 보고서 — 에이전트별 페르소나(성격/말투)

- 날짜: 2026-06-27
- 상태: ✅ 완료
- 관련: PLAN_2 F2

## 목표
에이전트마다 성격/말투(persona)를 부여해 행동·reason을 다양화한다.

## 만든 것 / 바꾼 것
| 파일 | 내용 |
|------|------|
| [src/agent.ts](../../src/agent.ts) | `systemPromptFor(name, persona?)` 확장·export, `AgentConfig.persona` 추가, createAgent에서 주입 |
| [src/index.ts](../../src/index.ts), [scripts/smoke.ts](../../scripts/smoke.ts), [scripts/integration-check.ts](../../scripts/integration-check.ts) | `persona: def.persona` 전달 |
| [agents.example.json](../../agents.example.json) | (F1에서 이미) 3인 페르소나 예시 포함 |
| [__tests__/agent.test.ts](../../__tests__/agent.test.ts) | 페르소나 테스트 +3 |

## 동작
- `persona`가 있으면 시스템 프롬프트에 `"당신의 성격: <persona>. 이 성격이 드러나도록 …"` 한 줄 추가.
- 없으면 기존 기본 프롬프트 그대로(회귀 0). 한국어 문구는 드라이버 템플릿 유지(ADR-006).

## 주요 결정 (ADR)
- [ADR-014](../adr/ADR-014-persona-injection.md): 페르소나 주입 전략(시스템 프롬프트 합성)

## 테스트 결과
- `npm test`: **75 passed / 75** (+3) ✅
- `npm run build`(타입체크): 통과

## 완료 기준 충족
- [x] 신규 테스트 그린 + 기존 회귀 0
- [x] 타입체크 통과
- [x] persona 없을 때 기존 동작 유지
- [x] 보고서/TEST_LOG 갱신

## 다음 단계
- F3: 에이전트별 SKILL.md 참조(컨텍스트 주입, 길이 상한).
