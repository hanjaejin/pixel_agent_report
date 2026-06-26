# 단계 3 완료 보고서 — openrouter.ts (LLM 클라이언트 + 견고한 파싱)

- 날짜: 2026-06-26
- 상태: ✅ 완료

## 목표
OpenRouter(OpenAI 호환) 호출로 `{action,target,reason}` 을 받고, 작은 모델의
들쭉날쭉한 출력을 안정화한다(실패 시 `rest` 폴백).

## 만든 것
| 파일 | 역할 |
|------|------|
| [src/openrouter.ts](../../src/openrouter.ts) | LLM 클라이언트(`createOpenRouter`), `parseDecision`, `buildRequestBody`, `ACTIONS` |
| [__tests__/openrouter.test.ts](../../__tests__/openrouter.test.ts) | 파싱/요청/IO 테스트 10건 |

### 핵심 설계
- **3중 방어(ADR-004)**: action 4종 enum + `response_format: json_object`(temp 0.4) + 코드펜스/잡텍스트 추출 폴백.
- **책임 분리**: HTTP 비정상(429/5xx)은 **예외**(상위 백오프용), 본문 파싱 실패는 **rest 폴백**(죽지 않음).
- **모델은 호출 인자**(ADR-005): 키 1개로 에이전트별 다른 모델 사용 가능.

## 주요 결정 (ADR)
- [ADR-004](../adr/ADR-004-slm-output-stabilization.md): SLM 출력 안정화
- [ADR-005](../adr/ADR-005-per-agent-model-key.md): 에이전트별 모델·키 주입

## 테스트 결과
- `npm test`: **10 passed / 10** (누적 23/23) ✅ (상세: [TEST_LOG.md](../TEST_LOG.md))
- `npm run build`: 성공 (`dist/openrouter.js`)

## 완료 기준 충족
- [x] 파싱 테스트(특히 깨진 응답) 전부 Green
- [x] 빌드 성공
- [ ] (수동) 실제 OpenRouter 호출 1회 스모크 — 키 준비 후 단계 6 통합에서 수행 예정

## 비고 / 다음 단계
- LLM 타임아웃 기본 30초(설정 가능). 한국어 업무 문구는 모델이 아닌 드라이버 템플릿이 생성(단계 4).
- 다음: 단계 4 (actions.ts — action→tool_name + 한국어 로그 매핑).
