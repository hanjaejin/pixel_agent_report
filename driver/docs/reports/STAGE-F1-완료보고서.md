# 기능 단계 F1 완료 보고서 — 에이전트 정의 외부화(agents.json)

- 날짜: 2026-06-27
- 상태: ✅ 완료
- 관련: PLAN_2 F1

## 목표
코드 수정 없이 `agents.json`으로 에이전트를 추가/수정하고, 잘못된 설정은 친절한 한국어 에러로 안내.

## 만든 것 / 바꾼 것
| 파일 | 내용 |
|------|------|
| [src/agentsFile.ts](../../src/agentsFile.ts) (신규) | `loadAgentsFile(path, readFileFn?)` — 파싱·필드 검증·한국어 에러 |
| [src/config.ts](../../src/config.ts) (확장) | `AgentDefinition`에 `persona?`/`skillFile?`/`fallbackModels?` 추가, `resolveAgents`/`ConfigIO` 도입 |
| [agents.example.json](../../agents.example.json) (신규) | 3인 예시(페르소나·폴백모델 포함) |
| [.env.example](../../.env.example) | `PIXEL_AGENTS_FILE` 안내 추가 |
| [__tests__/agentsFile.test.ts](../../__tests__/agentsFile.test.ts) (신규), config.test.ts(확장) | 테스트 +14 |

## 동작 (우선순위)
1. `PIXEL_AGENTS_FILE` 지정 → 그 파일 로드(없으면 친절한 에러)
2. 미지정이라도 `cwd/agents.json` 존재 → 로드
3. 둘 다 아니면 `DEFAULT_AGENTS` (**기존 동작 보존, 회귀 0**)

허용 형태: 배열 또는 `{ "agents": [...] }`. 검증: 읽기실패/JSON깨짐/형태/필수값(name·model)/타입(persona·skillFile·fallbackModels·apiKey)/이름중복 → 위치 포함 한국어 에러.

## 주요 결정 (ADR)
- [ADR-013](../adr/ADR-013-agents-file-externalization.md): 에이전트 정의 외부화 + 스키마 검증
  (순환참조 방지를 위해 agentsFile은 자체 검증, AgentDefinition은 타입만 import)

## 테스트 결과
- `npm test`: **72 passed / 72** (신규 +14) ✅ (상세: [TEST_LOG.md](../TEST_LOG.md))
- `npm run build`(타입체크): 통과

## 완료 기준 충족
- [x] 신규 테스트 그린 + 기존 58개 회귀 0
- [x] 타입체크 통과
- [x] `agents.json` 없이도 기존 동작 유지(폴백)
- [x] 친절한 한국어 에러(위치·필드·이유)
- [x] 보고서/TEST_LOG 갱신

## 다음 단계
- F2: 에이전트별 페르소나(성격/말투) — `persona` 필드를 시스템 프롬프트에 주입.
