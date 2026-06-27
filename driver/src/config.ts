/**
 * config.ts — 에이전트 정의 + 환경변수 기반 드라이버 설정.
 *
 * 목적: 어떤 에이전트(이름/모델)를 띄울지, 어떤 키/워크스페이스/루프주기로 돌릴지를 한곳에 모은다.
 * 의존성: node:fs/node:path(agents.json 탐지·로드, 주입 가능), agentsFile(파일 파서).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { loadAgentsFile } from './agentsFile.ts';
import { parseLang, type Lang } from './i18n.ts';

/** 에이전트 1명의 정의. apiKey 를 주면 그 에이전트만 별도 키를 쓴다(ADR-005). */
export interface AgentDefinition {
  name: string;
  model: string;
  apiKey?: string;
  /** 성격/말투(시스템 프롬프트 합성용, F2). */
  persona?: string;
  /** 참고할 SKILL.md 경로(컨텍스트 주입용, F3). */
  skillFile?: string;
  /** 모델 폴백 후보 목록(영구 에러 시 순서대로 전환, F4). */
  fallbackModels?: string[];
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
  /** 로그/문구 언어(기본 ko, F6). */
  lang: Lang;
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

/** agents.json 탐지·로드를 위한 주입형 IO(테스트에서 디스크 없이 검증). */
export interface ConfigIO {
  fileExists?: (p: string) => boolean;
  loadAgentsFile?: (p: string) => AgentDefinition[];
}

/**
 * 에이전트 목록을 결정한다(F1).
 * 우선순위: ① PIXEL_AGENTS_FILE 지정 → 그 파일 로드(없으면 친절한 에러)
 *           ② 미지정이지만 기본 경로(cwd/agents.json) 존재 → 그 파일 로드
 *           ③ 둘 다 아니면 DEFAULT_AGENTS(기존 동작 보존, 회귀 0)
 * 입력: env, defaults, io
 * 출력: AgentDefinition[]
 */
function resolveAgents(
  env: Record<string, string | undefined>,
  defaults: AgentDefinition[],
  io: ConfigIO,
): AgentDefinition[] {
  const exists = io.fileExists ?? ((p: string) => fs.existsSync(p));
  const load = io.loadAgentsFile ?? ((p: string) => loadAgentsFile(p));
  const explicit = env.PIXEL_AGENTS_FILE?.trim();
  if (explicit) return load(explicit);
  const defaultPath = path.join(process.cwd(), 'agents.json');
  if (exists(defaultPath)) return load(defaultPath);
  return defaults;
}

/**
 * 환경변수에서 드라이버 설정을 만든다.
 * 입력: env(process.env 등), defaults(에이전트 정의, 기본 DEFAULT_AGENTS), io(agents 파일 주입)
 * 출력: DriverConfig
 * 예외: OPENROUTER_API_KEY 가 없으면 한국어 안내 에러.
 */
export function loadDriverConfig(
  env: Record<string, string | undefined>,
  defaults: AgentDefinition[] = DEFAULT_AGENTS,
  io: ConfigIO = {},
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
  const lang = parseLang(env.PIXEL_LANG);
  const agents = resolveAgents(env, defaults, io);
  return { apiKey, workspace, loopIntervalMs, backoffBaseMs, backoffMaxMs, maxConcurrency, lang, agents };
}
