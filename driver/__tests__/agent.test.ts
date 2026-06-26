import { describe, it, expect, vi } from 'vitest';
import { createAgent } from '../src/agent.ts';
import type { HookPayload } from '../src/office.ts';
import type { Decision } from '../src/openrouter.ts';

// agent.ts: 단일 에이전트의 행동 루프. office/openrouter/actions 를 조합한다.
// 모든 의존성을 fake 로 주입해 네트워크/타이머 없이 결정적으로 검증.
function makeFakes(decisions: (Decision | 'throw')[]) {
  const posted: HookPayload[] = [];
  const inits: { ws: string; sid: string }[] = [];
  const office = {
    postHook: vi.fn(async (p: HookPayload) => {
      posted.push(p);
    }),
    writeInitTranscript: vi.fn((ws: string, sid: string) => {
      inits.push({ ws, sid });
      return `/home/u/.claude/projects/-ws/${sid}.jsonl`;
    }),
  };
  let idx = 0;
  const openrouter = {
    decide: vi.fn(async (): Promise<Decision> => {
      const d = decisions[Math.min(idx, decisions.length - 1)];
      idx++;
      if (d === 'throw') throw new Error('429 모의 오류');
      return d;
    }),
  };
  const lines: string[] = [];
  const logger = { info: (m: string) => lines.push(m) };
  const sleeps: number[] = [];
  const sleep = vi.fn(async (ms: number) => {
    sleeps.push(ms);
  });
  return { posted, inits, office, openrouter, lines, sleeps, sleep };
}

const cfg = { name: '김대리', model: 'model-x', workspace: '/ws', sessionId: 'sid-1' };

describe('agent', () => {
  it('start(): init 트랜스크립트 작성 + SessionStart(transcript_path 포함) POST', async () => {
    const f = makeFakes([{ action: 'rest', target: '', reason: '' }]);
    const agent = makeAgent(f);
    await agent.start();

    expect(f.inits).toHaveLength(1);
    expect(f.posted[0].hook_event_name).toBe('SessionStart');
    expect(f.posted[0].transcript_path).toBeTruthy();
    expect(f.posted[0].cwd).toBe('/ws');
  });

  it('start 후 첫 행동이 확인 이벤트(비-SessionStart)로 채택을 유도한다', async () => {
    const f = makeFakes([{ action: 'read', target: 'a.ts', reason: '확인' }]);
    const agent = makeAgent(f);
    await agent.start();
    await agent.tickOnce();
    expect(f.posted[0].hook_event_name).toBe('SessionStart');
    expect(f.posted[1].hook_event_name).not.toBe('SessionStart'); // PreToolUse 등 확인 이벤트
  });

  it('read 결정: PreToolUse(Read)+input → 대기 → PostToolUse 순서', async () => {
    const f = makeFakes([{ action: 'read', target: 'config.ts', reason: '설정 확인' }]);
    const agent = makeAgent(f, { actionDurationMs: 1500 });
    await agent.tickOnce();

    const pre = f.posted.find((p) => p.hook_event_name === 'PreToolUse')!;
    expect(pre.tool_name).toBe('Read');
    expect(pre.tool_input).toEqual({ file_path: 'config.ts' });
    // 순서: PreToolUse 다음에 PostToolUse
    const names = f.posted.map((p) => p.hook_event_name);
    expect(names.indexOf('PostToolUse')).toBeGreaterThan(names.indexOf('PreToolUse'));
    expect(f.sleeps).toContain(1500); // 행동 지속 대기
  });

  it('rest 결정: Stop 만 보내고 PreToolUse 는 없다', async () => {
    const f = makeFakes([{ action: 'rest', target: '', reason: '' }]);
    const agent = makeAgent(f);
    await agent.tickOnce();
    const names = f.posted.map((p) => p.hook_event_name);
    expect(names).toContain('Stop');
    expect(names).not.toContain('PreToolUse');
  });

  it('runLoop(maxIterations:2): start 1회 + 결정 2회 처리', async () => {
    const f = makeFakes([
      { action: 'read', target: 'a.ts', reason: '' },
      { action: 'write', target: 'b.ts', reason: '' },
    ]);
    const agent = makeAgent(f, { loopIntervalMs: 10 });
    await agent.runLoop({ maxIterations: 2 });

    expect(f.office.writeInitTranscript).toHaveBeenCalledTimes(1);
    expect(f.openrouter.decide).toHaveBeenCalledTimes(2);
    expect(f.posted.filter((p) => p.hook_event_name === 'SessionStart')).toHaveLength(1);
  });

  it('LLM 예외: rest 폴백(Stop) + 백오프 대기, 예외를 밖으로 던지지 않음', async () => {
    const f = makeFakes(['throw']);
    const agent = makeAgent(f, { backoffMs: 2000 });
    await expect(agent.tickOnce()).resolves.toBeDefined();
    const names = f.posted.map((p) => p.hook_event_name);
    expect(names).toContain('Stop'); // rest 폴백
    expect(f.sleeps).toContain(2000); // 백오프
  });

  it('연속 실패 시 백오프가 지수적으로 늘고, 성공하면 초기화된다', async () => {
    const f = makeFakes(['throw', 'throw', { action: 'rest', target: '', reason: '' }, 'throw']);
    const agent = makeAgent(f, { backoffMs: 1000 }); // base=1000, max=기본 30000
    await agent.tickOnce(); // 실패 → 1000
    await agent.tickOnce(); // 실패 → 2000
    await agent.tickOnce(); // 성공(rest) → 백오프 초기화 (백오프 sleep 없음)
    await agent.tickOnce(); // 실패 → 다시 1000
    expect(f.sleeps.filter((s) => s >= 1000)).toEqual([1000, 2000, 1000]);
  });

  it('semaphore 가 있으면 decide 를 그 안에서 호출한다', async () => {
    const f = makeFakes([{ action: 'rest', target: '', reason: '' }]);
    const sem = { inUse: 0, max: 1, run: vi.fn(async (fn: () => Promise<unknown>) => fn()) };
    const agent = createAgent(cfg, {
      office: f.office,
      openrouter: f.openrouter,
      logger: { info: () => {} },
      sleep: f.sleep,
      semaphore: sem,
    } as never);
    await agent.tickOnce();
    expect(sem.run).toHaveBeenCalledTimes(1);
    expect(f.openrouter.decide).toHaveBeenCalledTimes(1);
  });

  it('stop(): SessionEnd(exit) 를 보낸다', async () => {
    const f = makeFakes([{ action: 'rest', target: '', reason: '' }]);
    const agent = makeAgent(f);
    await agent.stop();
    const end = f.posted.find((p) => p.hook_event_name === 'SessionEnd')!;
    expect(end).toBeDefined();
    expect(end.reason).toBe('exit');
  });
});

// 공통 에이전트 생성 헬퍼 (로거는 무음).
function makeAgent(
  f: ReturnType<typeof makeFakes>,
  opts: { loopIntervalMs?: number; actionDurationMs?: number; backoffMs?: number } = {},
) {
  return createAgent(cfg, {
    office: f.office,
    openrouter: f.openrouter,
    logger: { info: () => {} },
    sleep: f.sleep,
    ...opts,
  } as never);
}
