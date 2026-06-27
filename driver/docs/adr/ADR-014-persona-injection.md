# ADR-014: 페르소나 주입 전략(시스템 프롬프트 합성)

- 상태: 채택(Accepted)
- 날짜: 2026-06-27
- 관련: PLAN_2 F2

## 맥락

에이전트 3명이 같은 시스템 프롬프트를 쓰면 행동·reason이 비슷해 데모가 단조롭다.
에이전트별 성격/말투를 부여해 다양성을 주고 싶다.

## 결정

- `AgentDefinition.persona`(F1에서 추가) / `AgentConfig.persona`로 성격 문구를 전달한다.
- `systemPromptFor(name, persona?)`가 persona가 있으면 **성격 줄 한 줄**을 프롬프트에 추가한다:
  `"당신의 성격: <persona>. 이 성격이 드러나도록 행동하고 이유(reason)를 쓰세요."`
- persona가 없으면 기존 기본 프롬프트 그대로(회귀 0).
- 한국어 문구는 모델이 아니라 드라이버 템플릿이 만든다(ADR-006 유지). 모델은 reason만 생성하되
  persona의 영향을 받는다.
- `systemPromptFor`를 export해 단위 테스트로 직접 검증한다.

## 결과

- `agents.json`에 persona만 적으면 캐릭터별 성격이 reason/행동에 반영된다.
- 토큰 비용: 한 줄 추가뿐이라 미미(SKILL.md 주입(F3)과 합쳐질 때 길이 상한으로 관리).
