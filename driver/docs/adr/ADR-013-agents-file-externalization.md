# ADR-013: 에이전트 정의 외부화(agents.json) + 스키마 검증

- 상태: 채택(Accepted)
- 날짜: 2026-06-27
- 관련: PLAN_2 F1

## 맥락

에이전트 목록이 `config.ts` 코드에 하드코딩되어 있어, 사용자가 에이전트를 추가/수정하려면
소스를 고쳐야 했다. 공개 저장소 사용성을 위해 **코드 수정 없이** 설정으로 바꿀 수 있어야 한다.

## 결정

- `agents.json`(또는 `PIXEL_AGENTS_FILE` 지정 경로)에서 에이전트 정의를 읽는다.
- 허용 형태: 최상위 배열, 또는 `{ "agents": [...] }`.
- `loadAgentsFile(path, readFileFn?)` 가 **필드 단위로 검증**하고, 틀리면 "몇 번째 항목의 어떤
  필드가 왜 틀렸는지" 한국어로 알려준다(읽기 실패/JSON 깨짐/형태 오류/필수값/타입/이름 중복).
- 우선순위(`resolveAgents`): ① `PIXEL_AGENTS_FILE` 지정 → 로드 ② 기본 경로(`cwd/agents.json`)
  존재 → 로드 ③ 둘 다 아니면 `DEFAULT_AGENTS`(**기존 동작 보존, 회귀 0**).
- IO(파일 존재 확인·로드)는 주입 가능(`ConfigIO`)하게 해 디스크 없이 테스트(ADR-003 연장).
- `AgentDefinition` 을 확장: `persona?`, `skillFile?`, `fallbackModels?`(F2~F4가 사용할 자리만 확보).
- 순환참조 방지: `agentsFile.ts` 는 `config.ts` 의 `validateAgents` 를 import 하지 않고
  자체적으로 중복/필수 검증(AgentDefinition 은 타입만 import → 런타임 제거).

## 결과

- 사용자는 `agents.json` 하나로 에이전트를 추가/수정·페르소나/폴백모델을 지정할 수 있다.
- 파일이 없으면 기존 기본값으로 그대로 동작한다(무중단).
- 잘못된 설정은 친절한 한국어 에러로 즉시 원인을 알려준다.
