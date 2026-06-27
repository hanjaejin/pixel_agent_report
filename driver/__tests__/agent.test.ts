import { describe, it, expect, vi } from 'vitest';
import { createAgent, systemPromptFor } from '../src/agent.ts';
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

// ── F2: 페르소나 ──
describe('systemPromptFor - 페르소나', () => {
  it('persona 가 있으면 성격 줄과 이름을 포함한다', () => {
    const p = systemPromptFor('김대리', '꼼꼼하고 신중한 성격');
    expect(p).toContain('김대리');
    expect(p).toContain('꼼꼼하고 신중한 성격');
  });

  it('persona 가 없으면 성격 줄 없이 기본 프롬프트(행동 4종 안내)를 만든다', () => {
    const p = systemPromptFor('김대리');
    expect(p).toContain('김대리');
    expect(p).toContain('read');
    expect(p).not.toContain('당신의 성격');
  });

  it('createAgent 는 persona 를 시스템 프롬프트에 실어 decide 를 호출한다', async () => {
    const f = makeFakes([{ action: 'rest', target: '', reason: '' }]);
    const agent = createAgent(
      { ...cfg, persona: '느긋한 성격' },
      { office: f.office, openrouter: f.openrouter, logger: { info: () => {} }, sleep: f.sleep } as never,
    );
    await agent.tickOnce();
    const sysArg = (f.openrouter.decide as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(sysArg).toContain('느긋한 성격');
  });
});

// ── F3: SKILL.md 주입 ──
describe('systemPromptFor - SKILL 주입', () => {
  it('skill 이 있으면 참고 자료 섹션과 내용을 포함한다', () => {
    const p = systemPromptFor('김대리', undefined, '# 역할\n로그를 먼저 확인한다');
    expect(p).toContain('참고 자료(SKILL)');
    expect(p).toContain('로그를 먼저 확인한다');
  });

  it('skill 이 없으면 참고 자료 섹션이 없다', () => {
    const p = systemPromptFor('김대리', '꼼꼼한 성격');
    expect(p).not.toContain('참고 자료(SKILL)');
  });

  it('persona 와 skill 을 함께 주입한다', () => {
    const p = systemPromptFor('김대리', '꼼꼼한 성격', '규칙: 테스트 먼저');
    expect(p).toContain('꼼꼼한 성격');
    expect(p).toContain('규칙: 테스트 먼저');
  });
});

// ── F4: 모델 폴백 ──
import { OpenRouterError } from '../src/openrouter.ts';

function fallbackFakes() {
  const office = { postHook: vi.fn(async () => {}), writeInitTranscript: vi.fn(() => '/t.jsonl') };
  return { office };
}

describe('agent - 모델 폴백(F4)', () => {
  it('영구 에러(404)면 다음 폴백 모델로 전환한다', async () => {
    const models: string[] = [];
    let n = 0;
    const openrouter = {
      decide: vi.fn(async (model: string): Promise<Decision> => {
        models.push(model);
        if (n++ === 0) throw new OpenRouterError(404, 'not found');
        return { action: 'rest', target: '', reason: '' };
      }),
    };
    const { office } = fallbackFakes();
    const agent = createAgent(
      { name: '김', model: 'primary', fallbackModels: ['backup'], workspace: '/ws', sessionId: 's' },
      { office, openrouter, logger: { info: () => {} }, sleep: vi.fn(async () => {}) } as never,
    );
    await agent.tickOnce(); // 404 on primary → 전환
    await agent.tickOnce(); // backup 사용
    expect(models[0]).toBe('primary');
    expect(models[1]).toBe('backup');
  });

  it('일시 에러(429)면 모델 전환 없이 백오프한다', async () => {
    const models: string[] = [];
    const sleeps: number[] = [];
    let n = 0;
    const openrouter = {
      decide: vi.fn(async (model: string): Promise<Decision> => {
        models.push(model);
        if (n++ === 0) throw new OpenRouterError(429, 'rate');
        return { action: 'rest', target: '', reason: '' };
      }),
    };
    const { office } = fallbackFakes();
    const agent = createAgent(
      { name: '김', model: 'primary', fallbackModels: ['backup'], workspace: '/ws', sessionId: 's' },
      {
        office,
        openrouter,
        logger: { info: () => {} },
        sleep: vi.fn(async (ms: number) => {
          sleeps.push(ms);
        }),
        backoffMs: 2000,
      } as never,
    );
    await agent.tickOnce(); // 429 → 백오프, 모델 유지
    await agent.tickOnce();
    expect(models[0]).toBe('primary');
    expect(models[1]).toBe('primary'); // 전환 안 함
    expect(sleeps).toContain(2000); // 백오프
  });

  it('폴백이 없을 때 영구 에러면 대기(rest)한다', async () => {
    let n = 0;
    const openrouter = {
      decide: vi.fn(async (): Promise<Decision> => {
        if (n++ === 0) throw new OpenRouterError(402, 'pay');
        return { action: 'read', target: 'a', reason: '' };
      }),
    };
    const posted: { hook_event_name: string }[] = [];
    const office = {
      postHook: vi.fn(async (p: { hook_event_name: string }) => {
        posted.push(p);
      }),
      writeInitTranscript: vi.fn(() => '/t'),
    };
    const agent = createAgent(
      { name: '김', model: 'only', workspace: '/ws', sessionId: 's' },
      { office, openrouter, logger: { info: () => {} }, sleep: vi.fn(async () => {}) } as never,
    );
    const d = await agent.tickOnce();
    expect(d.action).toBe('rest');
    expect(posted.some((p) => p.hook_event_name === 'Stop')).toBe(true);
  });
});

// ── F5-1: 런타임 모델 hot-swap ──
describe('agent - 런타임 모델 변경(F5-1)', () => {
  it('getModel 은 초기 모델을 돌려주고, setModel 후 다음 호출에 반영된다', async () => {
    const used: string[] = [];
    const openrouter = {
      decide: vi.fn(async (model: string): Promise<Decision> => {
        used.push(model);
        return { action: 'rest', target: '', reason: '' };
      }),
    };
    const office = { postHook: vi.fn(async () => {}), writeInitTranscript: vi.fn(() => '/t') };
    const agent = createAgent(
      { name: '김', model: 'primary', workspace: '/ws', sessionId: 's' },
      { office, openrouter, logger: { info: () => {} }, sleep: vi.fn(async () => {}) } as never,
    );
    expect(agent.getModel()).toBe('primary');
    await agent.tickOnce();
    agent.setModel('chosen');
    expect(agent.getModel()).toBe('chosen');
    await agent.tickOnce();
    expect(used).toEqual(['primary', 'chosen']);
  });

  it('setModel 대상이 폴백 목록에 있으면 그 모델로 전환한다', async () => {
    const office = { postHook: vi.fn(async () => {}), writeInitTranscript: vi.fn(() => '/t') };
    const openrouter = { decide: vi.fn(async (): Promise<Decision> => ({ action: 'rest', target: '', reason: '' })) };
    const agent = createAgent(
      { name: '김', model: 'm1', fallbackModels: ['m2', 'm3'], workspace: '/ws', sessionId: 's' },
      { office, openrouter, logger: { info: () => {} }, sleep: vi.fn(async () => {}) } as never,
    );
    agent.setModel('m3');
    expect(agent.getModel()).toBe('m3');
  });
});
