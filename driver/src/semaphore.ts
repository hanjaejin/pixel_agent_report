/**
 * semaphore.ts — 동시 실행 상한(세마포어).
 *
 * 목적: N명 에이전트가 동시에 OpenRouter 를 때리지 않도록 동시 호출 수를 제한한다.
 *       비용 폭주와 레이트리밋(429)을 구조적으로 줄인다(ADR-011).
 * 의존성: 없음.
 */

export interface Semaphore {
  /** 슬롯을 얻어 fn 을 실행하고, 끝나면(성공/실패 무관) 슬롯을 반환한다. */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** 현재 사용 중인 슬롯 수(테스트/모니터링용). */
  readonly inUse: number;
  /** 최대 동시 실행 수. */
  readonly max: number;
}

/**
 * 세마포어를 만든다.
 * 입력: max(최대 동시 실행 수, 1 이상)
 * 출력: Semaphore
 */
export function createSemaphore(max: number): Semaphore {
  const limit = Math.max(1, Math.floor(max));
  let inUse = 0;
  const waiters: Array<() => void> = [];

  const acquire = (): Promise<void> =>
    new Promise((resolve) => {
      if (inUse < limit) {
        inUse++;
        resolve();
      } else {
        waiters.push(() => {
          inUse++;
          resolve();
        });
      }
    });

  const release = (): void => {
    inUse--;
    const next = waiters.shift();
    if (next) next();
  };

  return {
    get inUse() {
      return inUse;
    },
    max: limit,
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await fn();
      } finally {
        release();
      }
    },
  };
}
