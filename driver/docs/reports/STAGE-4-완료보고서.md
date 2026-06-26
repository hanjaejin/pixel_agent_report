# 단계 4 완료 보고서 — actions.ts (action→신호/문구 매핑)

- 날짜: 2026-06-26
- 상태: ✅ 완료

## 목표
LLM 의 추상 action(read/write/run/rest)을 (1) 서버 훅 tool_name 과
(2) 한국어 로그 문구로 매핑한다.

## 만든 것
| 파일 | 역할 |
|------|------|
| [src/actions.ts](../../src/actions.ts) | `actionToTool`, `toolInputFor`, `describeAction`, `KNOWN_TOOL_NAMES` |
| [__tests__/actions.test.ts](../../__tests__/actions.test.ts) | 매핑/문구 테스트 8건 |

### 매핑 표
| action | tool_name | tool_input | 한국어 문구 |
|--------|-----------|-----------|------------|
| read | Read | `{file_path}` | 📖 … 살펴보고 있어요 |
| write | Edit | `{file_path}` | ✏️ … 수정하는 중이에요 |
| run | Bash | `{command}` | ⚙️ … 명령을 실행하고 있어요 |
| rest | (null→Stop) | — | ☕ 잠깐 쉬는 중이에요 |

## 주요 결정 (ADR)
- [ADR-006](../adr/ADR-006-korean-phrase-templates.md): 한국어 문구는 고정 템플릿, 모델은 reason 한 줄만

## 테스트 결과
- `npm test`: **8 passed / 8** (누적 31/31) ✅ (상세: [TEST_LOG.md](../TEST_LOG.md))
- `npm run build`: 성공 (`dist/actions.js`)

## 완료 기준 충족
- [x] 매핑 테스트 Green
- [x] tool_name 이 KNOWN_TOOL_NAMES 에 속함을 단언
- [x] 빌드 성공

## 비고 / 다음 단계
- 순수 함수만으로 구성(부수효과 없음) → agent 가 조합해 사용.
- 다음: 단계 5 (agent.ts — 단일 에이전트 행동 루프, office/openrouter/actions 조합).
