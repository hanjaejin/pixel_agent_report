# ADR-004: SLM 출력 안정화 — enum 4종 + JSON 강제 + 파싱 폴백

- 상태: 채택(Accepted)
- 날짜: 2026-06-26

## 맥락

드라이버는 작은 모델(SLM: llama-3.2-3b, qwen-2.5-7b, ministral-3b 등)을 쓴다.
작은 모델은 자유 서술이 들쭉날쭉하고, JSON 형식을 깨거나 코드펜스/잡설을 덧붙이기 쉽다.
이 출력으로 캐릭터를 안정적으로 움직이려면 형식을 강하게 제약해야 한다.

## 결정

3중 방어를 둔다.

1. **action 4종 enum 제한**: `read | write | run | rest`. 그 외 값은 모두 `rest`.
2. **JSON 강제 프롬프트 + response_format**: `response_format: { type: 'json_object' }` 와
   낮은 `temperature(0.4)` 로 형식 안정화.
3. **파싱 폴백**: `parseDecision` 이 코드펜스/잡텍스트에서 JSON 을 추출하고, 실패하면
   `{ action:'rest', target:'', reason:'...' }` 로 안전 복귀(예외 던지지 않음).

또한 한국어 업무 문구는 모델이 아니라 **드라이버 고정 템플릿**이 만든다(단계 4, ADR-006).
모델은 `reason`(한 줄)만 생성한다 → 형식 리스크 최소화.

## 결과

- 어떤 깨진 응답이 와도 드라이버는 죽지 않고 캐릭터는 "쉬는" 상태로 graceful 하게 처리된다.
- HTTP 비정상(429/5xx)은 파싱과 별개로 **예외**로 올려 상위에서 백오프(ADR-011)하게 한다.
