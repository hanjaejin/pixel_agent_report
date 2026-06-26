import { describe, it, expect } from 'vitest';
import { createSemaphore } from '../src/semaphore.ts';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// semaphore.ts: OpenRouter 동시 호출 상한(비용/레이트리밋 보호).
describe('createSemaphore', () => {
  it('max=1 이면 동시에 하나만 실행한다', async () => {
    const sem = createSemaphore(1);
    let concurrent = 0;
    let peak = 0;
    const task = async (): Promise<void> => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await delay(10);
      concurrent--;
    };
    await Promise.all([sem.run(task), sem.run(task), sem.run(task)]);
    expect(peak).toBe(1);
  });

  it('max=2 이면 최대 2개까지 동시 실행한다', async () => {
    const sem = createSemaphore(2);
    let concurrent = 0;
    let peak = 0;
    const task = async (): Promise<void> => {
      concurrent++;
      peak = Math.max(peak, concurrent);
      await delay(10);
      concurrent--;
    };
    await Promise.all([sem.run(task), sem.run(task), sem.run(task), sem.run(task)]);
    expect(peak).toBe(2);
  });

  it('실행 중 에러가 나도 슬롯을 반환한다', async () => {
    const sem = createSemaphore(1);
    await expect(sem.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(sem.inUse).toBe(0);
    // 다음 작업이 정상 진행되어야 함
    const v = await sem.run(async () => 42);
    expect(v).toBe(42);
  });
});
