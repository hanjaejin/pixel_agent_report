import { describe, it, expect, vi } from 'vitest';
import {
  projectDirName,
  transcriptPathFor,
  readServerInfo,
  buildSessionStart,
  buildPreToolUse,
  buildPostToolUse,
  buildStop,
  buildSessionEnd,
  initRecord,
  createOffice,
} from '../src/office.ts';

// office.ts: 픽셀 오피스 서버 연동 어댑터.
// 순수 함수(해시/페이로드 빌더/server.json 파싱)와 IO 함수(훅 POST, JSONL 쓰기)를 검증.
describe('office - 순수 함수', () => {
  it('projectDirName 은 비영숫자/대시 문자를 모두 -로 치환한다', () => {
    expect(projectDirName('C:\\aistudy\\pixel')).toBe('C--aistudy-pixel');
    expect(projectDirName('/home/user/my project')).toBe('-home-user-my-project');
  });

  it('transcriptPathFor 는 ~/.claude/projects/<이름>/<uuid>.jsonl 경로를 만든다', () => {
    const p = transcriptPathFor('/home/u', '/ws/app', 'abc-123');
    // 경로 구분자는 플랫폼별로 다를 수 있으니 정규화해서 비교
    const norm = p.replace(/\\/g, '/');
    expect(norm).toContain('/home/u/.claude/projects/-ws-app/');
    expect(norm.endsWith('abc-123.jsonl')).toBe(true);
  });

  it('readServerInfo 는 정상 server.json 을 파싱한다', () => {
    const fakeRead = (p: string): string => {
      if (p.replace(/\\/g, '/').endsWith('.pixel-agents/server.json')) {
        return JSON.stringify({ port: 3100, pid: 1234, authToken: 'tok' });
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };
    const info = readServerInfo('/home/u', fakeRead);
    expect(info).toEqual({ port: 3100, pid: 1234, authToken: 'tok' });
  });

  it('readServerInfo 는 실제 CLI 의 `token` 필드도 인식한다', () => {
    const fakeRead = (p: string): string => {
      if (p.replace(/\\/g, '/').endsWith('.pixel-agents/server.json')) {
        return JSON.stringify({ port: 3100, pid: 1, token: 'real-token', startedAt: 1 });
      }
      throw new Error('ENOENT');
    };
    expect(readServerInfo('/home/u', fakeRead).authToken).toBe('real-token');
  });

  it('readServerInfo 는 파일이 없으면 한국어 안내 에러를 던진다', () => {
    const fakeRead = (): string => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };
    expect(() => readServerInfo('/home/u', fakeRead)).toThrow(/server\.json/);
    expect(() => readServerInfo('/home/u', fakeRead)).toThrow(/픽셀 오피스 서버/);
  });

  it('훅 페이로드 빌더들은 계약대로의 형태를 만든다', () => {
    expect(buildSessionStart('sid', '/ws', '/ws/t.jsonl')).toEqual({
      session_id: 'sid',
      hook_event_name: 'SessionStart',
      cwd: '/ws',
      transcript_path: '/ws/t.jsonl',
    });
    expect(buildPreToolUse('sid', 'Read', { file_path: 'config.ts' })).toEqual({
      session_id: 'sid',
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_input: { file_path: 'config.ts' },
    });
    expect(buildPostToolUse('sid')).toEqual({ session_id: 'sid', hook_event_name: 'PostToolUse' });
    expect(buildStop('sid')).toEqual({ session_id: 'sid', hook_event_name: 'Stop' });
    expect(buildSessionEnd('sid', 'exit')).toEqual({
      session_id: 'sid',
      hook_event_name: 'SessionEnd',
      reason: 'exit',
    });
  });

  it('initRecord 는 서버가 /clear 로 오인하지 않는 system init 레코드다', () => {
    const rec = initRecord();
    expect(rec.type).toBe('system');
    expect(rec.subtype).toBe('init');
    expect(JSON.stringify(rec)).not.toContain('/clear');
  });
});

describe('office - IO 함수 (의존성 주입)', () => {
  function makeDeps() {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = vi.fn(async (url: string | URL, init?: RequestInit) => {
      calls.push({ url: String(url), init: init ?? {} });
      return { ok: true, status: 200 } as Response;
    });
    const appended: { path: string; data: string }[] = [];
    const mkdirs: string[] = [];
    const deps = {
      homeDir: '/home/u',
      fetchFn: fetchFn as unknown as typeof fetch,
      readFileFn: (p: string): string => {
        if (p.replace(/\\/g, '/').endsWith('.pixel-agents/server.json')) {
          return JSON.stringify({ port: 3100, pid: 1, authToken: 'TOK' });
        }
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      },
      mkdirFn: (p: string): void => {
        mkdirs.push(p);
      },
      appendFileFn: (p: string, data: string): void => {
        appended.push({ path: p, data });
      },
    };
    return { deps, calls, appended, mkdirs };
  }

  it('postHook 은 올바른 URL/Bearer/본문/타임아웃 시그널로 POST 한다', async () => {
    const { deps, calls } = makeDeps();
    const office = createOffice(deps);
    await office.postHook(buildStop('sid'));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('http://127.0.0.1:3100/api/hooks/claude');
    const init = calls[0].init;
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer TOK');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({ session_id: 'sid', hook_event_name: 'Stop' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('postHook 은 200이 아니면 한국어 에러를 던진다', async () => {
    const { deps } = makeDeps();
    (deps.fetchFn as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 401,
    });
    const office = createOffice(deps);
    await expect(office.postHook(buildStop('sid'))).rejects.toThrow(/401/);
  });

  it('writeInitTranscript 는 프로젝트 디렉터리를 만들고 init 라인을 줄바꿈과 함께 추가한다', () => {
    const { deps, appended, mkdirs } = makeDeps();
    const office = createOffice(deps);
    const p = office.writeInitTranscript('/ws/app', 'sid-9');

    expect(mkdirs.some((d) => d.replace(/\\/g, '/').endsWith('.claude/projects/-ws-app'))).toBe(true);
    expect(appended).toHaveLength(1);
    expect(appended[0].path).toBe(p);
    expect(appended[0].data.endsWith('\n')).toBe(true);
    const rec = JSON.parse(appended[0].data.trim());
    expect(rec.subtype).toBe('init');
  });

  // ── F5-4: 드라이버 상태 보고 / 명령 폴링 ──
  it('reportDriverState 는 /api/driver/state 로 Bearer POST 한다', async () => {
    const { deps, calls } = makeDeps();
    const office = createOffice(deps);
    await office.reportDriverState({ availableModels: ['m1'], agents: [{ sessionId: 's1', model: 'm1' }] });

    const call = calls.find((c) => c.url.endsWith('/api/driver/state'))!;
    expect(call).toBeTruthy();
    expect(call.init.method).toBe('POST');
    expect((call.init.headers as Record<string, string>)['Authorization']).toBe('Bearer TOK');
    expect(JSON.parse(String(call.init.body))).toEqual({
      availableModels: ['m1'],
      agents: [{ sessionId: 's1', model: 'm1' }],
    });
  });

  it('pollCommands 는 commands 배열을 반환한다', async () => {
    const { deps } = makeDeps();
    (deps.fetchFn as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ commands: [{ sessionId: 's1', model: 'mNew' }] }),
    });
    const office = createOffice(deps);
    const cmds = await office.pollCommands();
    expect(cmds).toEqual([{ sessionId: 's1', model: 'mNew' }]);
  });
});
