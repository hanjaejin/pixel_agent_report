/**
 * openrouter.ts — OpenRouter(OpenAI 호환) LLM 클라이언트.
 *
 * 목적: 에이전트의 "다음 행동"을 작은 모델(SLM)에게 물어 {action,target,reason} 으로 받는다.
 *       작은 모델은 자유 서술이 들쭉날쭉하므로, action 을 4종 enum 으로 제한하고(ADR-004)
 *       파싱이 조금이라도 어긋나면 안전하게 `rest` 로 폴백한다.
 * 의존성: 전역 fetch (테스트에서는 주입). node 내장 외 외부 패키지 없음.
 */

/** 허용되는 행동 4종. 작은 모델 안정화를 위해 의도적으로 좁게 제한. */
export const ACTIONS = ['read', 'write', 'run', 'rest'] as const;
export type Action = (typeof ACTIONS)[number];

/** LLM 이 결정한 한 번의 행동. */
export interface Decision {
  action: Action;
  /** 대상(파일명/명령 등). 없으면 빈 문자열. */
  target: string;
  /** 한국어 이유 한 줄(모델 생성). */
  reason: string;
}

/** 파싱 실패 시 돌려줄 안전한 기본 결정. */
function restFallback(reason = '응답을 이해하지 못해 잠깐 쉽니다'): Decision {
  return { action: 'rest', target: '', reason };
}

/**
 * 잡텍스트/코드펜스가 섞인 응답에서 첫 JSON 객체 문자열을 추출한다.
 * 입력: raw(모델 원문)
 * 출력: JSON 문자열 또는 null(추출 실패)
 */
function extractJsonText(raw: string): string | null {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return candidate.slice(start, end + 1);
}

/**
 * 모델 원문 → Decision.
 * 입력: raw(모델이 돌려준 문자열)
 * 출력: Decision (검증 통과 시 그대로, 어긋나면 rest 폴백)
 * 규칙: action 이 4종 enum 이 아니거나 JSON 파싱 실패면 rest.
 */
export function parseDecision(raw: string): Decision {
  const jsonText = extractJsonText(raw);
  if (!jsonText) return restFallback();

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    return restFallback();
  }

  const action = obj.action;
  if (typeof action !== 'string' || !(ACTIONS as readonly string[]).includes(action)) {
    return restFallback();
  }

  const target = typeof obj.target === 'string' ? obj.target : '';
  const reason = typeof obj.reason === 'string' && obj.reason.trim().length > 0 ? obj.reason : '';
  return { action: action as Action, target, reason };
}

/** OpenAI 호환 chat completions 요청 본문. */
export interface ChatRequestBody {
  model: string;
  messages: { role: 'system' | 'user'; content: string }[];
  response_format: { type: 'json_object' };
  temperature: number;
}

/**
 * 요청 본문을 만든다.
 * 입력: model, systemPrompt, userPrompt
 * 출력: ChatRequestBody (JSON 강제 + 낮은 temperature 로 형식 안정화)
 */
export function buildRequestBody(model: string, systemPrompt: string, userPrompt: string): ChatRequestBody {
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  };
}

/** createOpenRouter 의존성. apiKey 필수, 나머지는 테스트/설정용. */
export interface OpenRouterDeps {
  apiKey: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
  /** 호출 타임아웃(ms). 기본 30초(LLM 은 느릴 수 있음). */
  timeoutMs?: number;
}

export interface OpenRouterClient {
  /** 모델에게 다음 행동을 물어 Decision 을 받는다. 4xx(429)/5xx 는 예외, 파싱 실패는 rest. */
  decide(model: string, systemPrompt: string, userPrompt: string): Promise<Decision>;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * OpenRouter 클라이언트를 만든다.
 * 입력: deps(apiKey 등)
 * 출력: OpenRouterClient
 * 동작: decide 는 /chat/completions 로 POST. HTTP 비정상(429/5xx 등)은 예외를 던져
 *       상위(agent)에서 백오프하게 하고, 본문 파싱 실패는 rest 로 폴백한다.
 */
export function createOpenRouter(deps: OpenRouterDeps): OpenRouterClient {
  const fetchFn = deps.fetchFn ?? fetch;
  const baseUrl = deps.baseUrl ?? DEFAULT_BASE_URL;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${baseUrl}/chat/completions`;

  return {
    async decide(model: string, systemPrompt: string, userPrompt: string): Promise<Decision> {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deps.apiKey}`,
          // OpenRouter 권장 메타(선택): 출처 표기
          'X-Title': 'pixel-agents-openrouter-driver',
        },
        body: JSON.stringify(buildRequestBody(model, systemPrompt, userPrompt)),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        // 429/5xx 등은 상위에서 백오프하도록 예외로 알린다.
        throw new Error(`OpenRouter 호출 실패: HTTP ${res.status} (model=${model})`);
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      return parseDecision(content);
    },
  };
}
