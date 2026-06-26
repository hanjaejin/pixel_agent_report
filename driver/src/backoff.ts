/**
 * backoff.ts — 지수 백오프 계산(순수 함수).
 *
 * 목적: OpenRouter 호출 실패(특히 429/5xx)가 반복될 때 재시도 간격을 지수적으로 늘려
 *       서버 부담과 비용을 줄인다(ADR-011).
 * 의존성: 없음.
 */

/**
 * 다음 백오프 대기 시간(ms)을 계산한다.
 * 입력: attempt(연속 실패 횟수, 0부터), baseMs(기본 간격), maxMs(상한)
 * 출력: min(maxMs, baseMs * 2^attempt). attempt 음수는 0으로 취급.
 */
export function nextBackoffMs(attempt: number, baseMs: number, maxMs: number): number {
  const a = attempt < 0 ? 0 : attempt;
  const raw = baseMs * Math.pow(2, a);
  return Math.min(maxMs, raw);
}
