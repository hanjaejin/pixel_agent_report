import { describe, it, expect, vi } from 'vitest';
import { runAll, stopAll, runControlTick, computeAvailableModels } from '../src/index.ts';

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

// ── F5-4: 제어 루프 ──
describe('runControlTick (F5-4)', () => {
  it('상태를 보고하고, 받은 명령을 해당 에이전트에 setModel 한다', async () => {
    const reported: unknown[] = [];
    const office = {
      reportDriverState: vi.fn(async (s: unknown) => {
        reported.push(s);
      }),
      pollCommands: vi.fn(async () => [{ sessionId: 's2', model: 'mNew' }]),
    };
    const set1 = vi.fn();
    const set2 = vi.fn();
    const handles = [
      { sessionId: 's1', getModel: () => 'a', setModel: set1 },
      { sessionId: 's2', getModel: () => 'b', setModel: set2 },
    ];
    await runControlTick(office, handles, ['a', 'b', 'mNew']);

    expect(reported[0]).toEqual({
      availableModels: ['a', 'b', 'mNew'],
      agents: [
        { sessionId: 's1', model: 'a' },
        { sessionId: 's2', model: 'b' },
      ],
    });
    expect(set2).toHaveBeenCalledWith('mNew');
    expect(set1).not.toHaveBeenCalled();
  });

  it('명령이 없으면 setModel 을 호출하지 않는다', async () => {
    const office = { reportDriverState: vi.fn(async () => {}), pollCommands: vi.fn(async () => []) };
    const set1 = vi.fn();
    await runControlTick(office, [{ sessionId: 's1', getModel: () => 'a', setModel: set1 }], ['a']);
    expect(set1).not.toHaveBeenCalled();
  });
});

describe('computeAvailableModels (F5-4)', () => {
  it('모델 + 폴백모델을 중복 없이 모은다', () => {
    const models = computeAvailableModels([
      { name: '김', model: 'm1', fallbackModels: ['m2'] },
      { name: '박', model: 'm2', fallbackModels: ['m3'] },
    ]);
    expect(models.sort()).toEqual(['m1', 'm2', 'm3']);
  });
});
