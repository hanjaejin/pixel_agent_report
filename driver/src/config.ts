/**
 * config.ts — 에이전트 정의 + 환경변수 기반 드라이버 설정.
 *
 * 목적: 어떤 에이전트(이름/모델)를 띄울지, 어떤 키/워크스페이스/루프주기로 돌릴지를 한곳에 모은다.
 * 의존성: 없음(환경변수는 호출 측에서 process.env 를 넘긴다 → 테스트 용이).
 */

/** 에이전트 1명의 정의. apiKey 를 주면 그 에이전트만 별도 키를 쓴다(ADR-005). */
export interface AgentDefinition {
  name: string;
  model: string;
  apiKey?: string;
}

/**
 * 기본 에이전트 3명. 각자 다른 OpenRouter SLM 모델(최종 완료 기준 5).
 * 모델 ID 는 예시이며 실제 가용 모델로 교체 가능.
 */
export const DEFAULT_AGENTS: AgentDefinition[] = [
  { name: '김대리', model: 'meta-llama/llama-3.2-3b-instruct' },
  { name: '박사원', model: 'qwen/qwen-2.5-7b-instruct' },
  { name: '이주임', model: 'mistralai/ministral-3b-2512' },
];

/**
 * 에이전트 정의 목록을 검증한다.
 * 입력: defs
 * 예외: 이름이 비었거나, model 이 비었거나, 이름이 중복이면 한국어 에러.
 */
export function validateAgents(defs: AgentDefinition[]): void {
  const seen = new Set<string>();
  for (const d of defs) {
    if (!d.name?.trim()) throw new Error('에이전트 이름이 비어 있습니다.');
    if (!d.model?.trim()) throw new Error(`에이전트 "${d.name}" 의 model 이 비어 있습니다.`);
    if (seen.has(d.name)) throw new Error(`에이전트 이름이 중복됩니다: ${d.name}`);
    seen.add(d.name);
  }
}

/** 드라이버 실행 설정. */
export interface DriverConfig {
  apiKey: string;
  workspace: string;
  loopIntervalMs: number;
  /** LLM 오류 시 지수 백오프 기본 간격(ms). */
  backoffBaseMs: number;
  /** 백오프 상한(ms). */
  backoffMaxMs: number;
  /** OpenRouter 동시 호출 상한(전 에이전트 공유). */
  maxConcurrency: number;
  agents: AgentDefinition[];
}

/** 기본 루프 주기(ms). ADR-007 과 일치. */
const DEFAULT_LOOP_INTERVAL_MS = 4000;
/** 루프 주기 최소값(ms) — 비용/레이트리밋 보호용 하한(ADR-011). */
const MIN_LOOP_INTERVAL_MS = 1000;
const DEFAULT_BACKOFF_BASE_MS = 2000;
const DEFAULT_BACKOFF_MAX_MS = 30000;
const DEFAULT_MAX_CONCURRENCY = 2;

/** 문자열 → 양의 정수. 실패하면 기본값. */
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * 환경변수에서 드라이버 설정을 만든다.
 * 입력: env(process.env 등), defaults(에이전트 정의, 기본 DEFAULT_AGENTS)
 * 출력: DriverConfig
 * 예외: OPENROUTER_API_KEY 가 없으면 한국어 안내 에러.
 */
export function loadDriverConfig(
  env: Record<string, string | undefined>,
  defaults: AgentDefinition[] = DEFAULT_AGENTS,
): DriverConfig {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY 환경변수가 필요합니다. driver/.env 에 키를 넣거나 셸에서 export 하세요 (.env.example 참고).',
    );
  }
  const workspace = env.PIXEL_WORKSPACE?.trim() || process.cwd();
  // 루프 주기는 최소값으로 클램프해 너무 잦은 호출(비용 폭주)을 막는다.
  const loopIntervalMs = Math.max(
    MIN_LOOP_INTERVAL_MS,
    parsePositiveInt(env.PIXEL_LOOP_INTERVAL_MS, DEFAULT_LOOP_INTERVAL_MS),
  );
  const backoffBaseMs = parsePositiveInt(env.PIXEL_BACKOFF_BASE_MS, DEFAULT_BACKOFF_BASE_MS);
  const backoffMaxMs = parsePositiveInt(env.PIXEL_BACKOFF_MAX_MS, DEFAULT_BACKOFF_MAX_MS);
  const maxConcurrency = parsePositiveInt(env.PIXEL_MAX_CONCURRENCY, DEFAULT_MAX_CONCURRENCY);
  return { apiKey, workspace, loopIntervalMs, backoffBaseMs, backoffMaxMs, maxConcurrency, agents: defaults };
}
