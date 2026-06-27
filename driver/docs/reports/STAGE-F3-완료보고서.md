# 기능 단계 F3 완료 보고서 — 에이전트별 SKILL.md 참조

- 날짜: 2026-06-27
- 상태: ✅ 완료
- 관련: PLAN_2 F3

## 목표
에이전트가 자신의 `SKILL.md`(역할·규칙·도메인 지식)를 참고해 행동하게 한다(토큰 비용은 길이 상한으로 보호).

## 만든 것 / 바꾼 것
| 파일 | 내용 |
|------|------|
| [src/skills.ts](../../src/skills.ts) (신규) | `loadSkill(path, readFileFn?, maxLen=4000)` — graceful + 길이 상한 |
| [src/agent.ts](../../src/agent.ts) | `systemPromptFor(name, persona?, skill?)`에 SKILL 블록, `AgentConfig.skill` |
| [src/index.ts](../../src/index.ts) | `def.skillFile` → `loadSkill` → `createAgent`에 전달 |
| [skills/example-김대리.md](../../skills/example-김대리.md) (신규), [agents.example.json](../../agents.example.json) | 예시 SKILL + skillFile 연결 |
| [__tests__/skills.test.ts](../../__tests__/skills.test.ts) (신규), agent.test.ts(확장) | 테스트 +8 |

## 동작
- `agents.json`의 `skillFile` 경로(드라이버 cwd 기준)에서 마크다운 로드 → "참고 자료(SKILL)" 블록으로 주입.
- 없는 파일/읽기 실패 → 빈 문자열(무중단). `maxLen` 초과 → 잘라내고 "…(생략됨)".
- agent.ts는 파일시스템 미접근(순수). index가 로드해 전달(ADR-003 연장).

## 주요 결정 (ADR)
- [ADR-015](../adr/ADR-015-skill-context-injection.md): SKILL.md 컨텍스트 주입(길이 상한)

## 테스트 결과
- `npm test`: **83 passed / 83** (+8) ✅
- `npm run build`(타입체크): 통과

## 완료 기준 충족
- [x] 신규 테스트 그린 + 기존 회귀 0
- [x] 타입체크 통과
- [x] 토큰 폭증 없음(길이 상한 검증)
- [x] 없는 파일 graceful
- [x] 보고서/TEST_LOG 갱신

## 다음 단계
- F4: 모델 폴백(404/402/401 영구 에러 시 대체 모델 자동 전환).
