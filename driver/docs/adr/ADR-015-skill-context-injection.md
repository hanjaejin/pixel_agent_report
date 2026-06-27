# ADR-015: SKILL.md 컨텍스트 주입(길이 상한)

- 상태: 채택(Accepted)
- 날짜: 2026-06-27
- 관련: PLAN_2 F3

## 맥락

에이전트가 자신의 역할·규칙·도메인 지식을 참고해 행동하게 하려면, Claude 의 `SKILL.md`
처럼 마크다운 파일을 두고 시스템 프롬프트에 주입하는 방식이 자연스럽다. 단, 파일이 길면
매 호출 토큰 비용이 급증한다.

## 결정

- `agents.json`의 `skillFile`(에이전트별 경로)에서 마크다운을 읽어 시스템 프롬프트의
  "참고 자료(SKILL)" 블록으로 주입한다.
- `loadSkill(path, readFileFn?, maxLen=4000)`:
  - 읽기 실패/없는 파일 → **빈 문자열**(graceful, 예외 없음. 에이전트는 SKILL 없이 동작).
  - `maxLen` 초과 시 잘라내고 `"…(생략됨)"`을 붙여 **토큰 비용을 상한**(ADR-011 정신).
- `index.ts`가 시작 시 `loadSkill`로 텍스트를 만들어 `createAgent`에 `skill`로 전달
  (agent.ts는 파일시스템을 모름 — 순수 유지, ADR-003 연장).
- `systemPromptFor(name, persona?, skill?)`가 persona·skill을 각각 블록으로 합성한다.

## 결과

- `skillFile`만 지정하면 에이전트가 역할 가이드를 참고해 행동한다.
- 긴 SKILL도 길이 상한으로 비용이 통제된다.
- 파일이 없거나 깨져도 데모가 멈추지 않는다(graceful).
