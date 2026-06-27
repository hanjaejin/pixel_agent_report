import { describe, it, expect, vi } from 'vitest';
import {
  parseDecision,
  buildRequestBody,
  createOpenRouter,
  ACTIONS,
  OpenRouterError,
} from '../src/openrouter.ts';

// openrouter.ts: OpenRouter(OpenAI 호환) 호출 + {action,target,reason} 파싱.
// 작은 모델의 들쭉날쭉한 출력을 안정화하는 파싱 폴백이 핵심.
describe('parseDecision - 견고한 파싱', () => {
  it('정상 JSON 을 그대로 파싱한다', () => {
    const d = parseDecision('{"action":"read","target":"config.ts","reason":"설정 확인"}');
    expect(d).toEqual({ action: 'read', target: 'config.ts', reason: '설정 확인' });
  });

  it('코드펜스/잡텍스트에 둘러싸인 JSON 도 추출한다', () => {
    const raw = '네, 알겠습니다.\n```json\n{"action":"write","target":"main.ts","reason":"기능 추가"}\n```\n끝.';
    const d = parseDecision(raw);
    expect(d.action).toBe('write');
    expect(d.target).toBe('main.ts');
  });

  it('enum 밖의 action 은 rest 로 폴백한다', () => {
    const d = parseDecision('{"action":"deploy","target":"x","reason":"y"}');
    expect(d.action).toBe('rest');
  });

  it('완전히 깨진 응답은 rest 로 폴백하고 target 은 빈 문자열', () => {
    const d = parseDecision('이건 JSON 이 아니에요 ㅋㅋ');
    expect(d.action).toBe('rest');
    expect(d.target).toBe('');
    expect(typeof d.reason).toBe('string');
    expect(d.reason.length).toBeGreaterThan(0);
  });

  it('target/reason 누락 시 안전한 기본값을 채운다', () => {
    const d = parseDecision('{"action":"run"}');
    expect(d.action).toBe('run');
    expect(d.target).toBe('');
    expect(typeof d.reason).toBe('string');
  });

  it('ACTIONS 는 4종 enum 이다', () => {
    expect([...ACTIONS].sort()).toEqual(['read', 'rest', 'run', 'write']);
  });
});

describe('buildRequestBody', () => {
  it('model/messages/response_format 를 OpenAI 호환 형태로 만든다', () => {
    const body = buildRequestBody('meta-llama/llama-3.2-3b-instruct', '시스템', '유저');
    expect(body.model).toBe('meta-llama/llama-3.2-3b-instruct');
    expect(body.messages[0]).toEqual({ role: 'system', content: '시스템' });
    expect(body.messages[1]).toEqual({ role: 'user', content: '유저' });
    expect(body.response_format).toEqual({ type: 'json_object' });
  });
});

describe('createOpenRouter().decide - IO', () => {
  function fakeFetch(content: string, status = 200) {
    return vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      json: async () => ({ choices: [{ message: { content } }] }),
    }));
  }

  it('올바른 URL/Bearer/본문으로 POST 하고 Decision 을 반환한다', async () => {
    const fetchFn = fakeFetch('{"action":"read","target":"a.ts","reason":"확인"}');
    const or = createOpenRouter({ apiKey: 'KEY', fetchFn: fetchFn as unknown as typeof fetch });
    const d = await or.decide('model-x', '시스템', '유저');

    expect(d.action).toBe('read');
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer KEY');
    expect(JSON.parse(String(init.body)).model).toBe('model-x');
  });

  it('429/5xx 는 예외를 던진다(상위에서 백오프)', async () => {
    const or429 = createOpenRouter({ apiKey: 'K', fetchFn: fakeFetch('', 429) as unknown as typeof fetch });
    await expect(or429.decide('m', 's', 'u')).rejects.toThrow(/429/);

    const or500 = createOpenRouter({ apiKey: 'K', fetchFn: fakeFetch('', 503) as unknown as typeof fetch });
    await expect(or500.decide('m', 's', 'u')).rejects.toThrow(/503/);
  });

  it('비정상 응답은 OpenRouterError(상태코드 포함)를 던진다', async () => {
    const or = createOpenRouter({ apiKey: 'K', fetchFn: fakeFetch('', 404) as unknown as typeof fetch });
    await expect(or.decide('m', 's', 'u')).rejects.toBeInstanceOf(OpenRouterError);
    const err = await or.decide('m', 's', 'u').catch((e) => e);
    expect(err.status).toBe(404);
  });

  it('모델이 깨진 내용을 줘도 rest 로 폴백한다(예외 아님)', async () => {
    const or = createOpenRouter({ apiKey: 'K', fetchFn: fakeFetch('도와줄게요!') as unknown as typeof fetch });
    const d = await or.decide('m', 's', 'u');
    expect(d.action).toBe('rest');
  });
});
