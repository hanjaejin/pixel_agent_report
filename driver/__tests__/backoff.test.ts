import { describe, it, expect } from 'vitest';
import { nextBackoffMs } from '../src/backoff.ts';

// backoff.ts: 지수 백오프(상한 포함) 순수 계산.
describe('nextBackoffMs', () => {
  it('시도 횟수에 따라 base 의 2배씩 증가한다', () => {
    expect(nextBackoffMs(0, 2000, 30000)).toBe(2000);
    expect(nextBackoffMs(1, 2000, 30000)).toBe(4000);
    expect(nextBackoffMs(2, 2000, 30000)).toBe(8000);
    expect(nextBackoffMs(3, 2000, 30000)).toBe(16000);
  });

  it('상한(maxMs)을 넘지 않는다', () => {
    expect(nextBackoffMs(4, 2000, 30000)).toBe(30000); // 32000 → 30000 으로 캡
    expect(nextBackoffMs(10, 2000, 30000)).toBe(30000);
  });

  it('음수 시도는 0 으로 취급한다', () => {
    expect(nextBackoffMs(-3, 1000, 9999)).toBe(1000);
  });
});
