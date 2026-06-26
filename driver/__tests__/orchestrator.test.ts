import { describe, it, expect, vi } from 'vitest';
import { runAll, stopAll } from '../src/index.ts';

// index.ts 의 오케스트레이션 헬퍼: N명 병렬 구동 + 격리.
const silent = { logger: { info: () => {} } };

describe('orchestrator', () => {
  it('runAll 은 모든 에이전트의 runLoop 를 호출한다', async () => {
    const a = { name: 'a', runLoop: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
    const b = { name: 'b', runLoop: vi.fn(async () => {}), stop: vi.fn(async () => {}) };
    await runAll([a, b], silent);
    expect(a.runLoop).toHaveBeenCalledTimes(1);
    expect(b.runLoop).toHaveBeenCalledTimes(1);
  });

  it('한 에이전트의 runLoop 실패가 다른 에이전트를 막지 않는다(격리)', async () => {
    const a = { name: 'a', runLoop: vi.fn(async () => { throw new Error('boom'); }), stop: vi.fn() };
    const b = { name: 'b', runLoop: vi.fn(async () => {}), stop: vi.fn() };
    await expect(runAll([a, b], silent)).resolves.toBeUndefined();
    expect(a.runLoop).toHaveBeenCalled();
    expect(b.runLoop).toHaveBeenCalled();
  });

  it('stopAll 은 하나가 실패해도 전원 stop 을 호출한다', async () => {
    const a = { name: 'a', runLoop: vi.fn(), stop: vi.fn(async () => { throw new Error('x'); }) };
    const b = { name: 'b', runLoop: vi.fn(), stop: vi.fn(async () => {}) };
    await stopAll([a, b], silent);
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).toHaveBeenCalled();
  });
});
