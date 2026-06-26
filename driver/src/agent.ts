/**
 * agent.ts — 단일 에이전트의 행동 루프.
 *
 * 목적: 한 에이전트(예: 김대리)가 OpenRouter 로 "다음 행동"을 결정하고, 그 행동을
 *       office 훅 신호로 바꿔 보내 오피스 캐릭터를 움직인다. 동시에 한국어 업무 로그를 남긴다.
 *       흐름: 등장(start) → [LLM 결정 → 행동 신호 → 지속 대기 → 종료] 반복 → 퇴장(stop).
 * 의존성: office(훅/JSONL), openrouter(LLM), logger(한국어 로그), sleep(타이머) — 모두 주입.
 *         실제 작업(파일 읽기/수정)은 PoC 에선 하지 않는다(ADR-008). action 핸들러를 분리해
 *         두어 추후 실작업으로 교체할 수 있게 한다.
 */
import {
  buildSessionStart,
  buildPreToolUse,
  buildPostToolUse,
  buildStop,
  buildSessionEnd,
  type HookPayload,
} from './office.ts';
import { actionToTool, toolInputFor, describeAction } from './actions.ts';
import { nextBackoffMs } from './backoff.ts';
import type { Decision, OpenRouterClient } from './openrouter.ts';
import type { Semaphore } from './semaphore.ts';

/** 에이전트 1명의 정체성. */
export interface AgentConfig {
  name: string;
  model: string;
  /** 캐릭터를 띄울 워크스페이스 경로(JSONL 채택 기준). */
  workspace: string;
  /** 이 에이전트의 세션 UUID. */
  sessionId: string;
}

/** agent 가 의존하는 office 의 최소 표면(실제 Office 가 만족). */
export interface AgentOffice {
  postHook(payload: HookPayload): Promise<void>;
  writeInitTranscript(workspace: string, sessionId: string): string;
}

/** createAgent 주입 의존성. */
export interface AgentDeps {
  office: AgentOffice;
  openrouter: OpenRouterClient;
  logger: { info: (message: string) => void };
  /** 타이머. 기본은 setTimeout 기반(테스트에선 즉시 resolve 로 주입). */
  sleep?: (ms: number) => Promise<void>;
  /** 루프 1회 사이 쉬는 시간(ms). 기본 4000. */
  loopIntervalMs?: number;
  /** 행동 애니메이션을 보여주기 위한 지속 시간(ms). 기본 1500. */
  actionDurationMs?: number;
  /** LLM 오류 시 백오프 기본 간격(ms). 기본 2000. 지수 백오프의 base. */
  backoffMs?: number;
  /** 백오프 상한(ms). 기본 30000. */
  backoffMaxMs?: number;
  /** OpenRouter 동시 호출 제한용 세마포어(여러 에이전트가 공유). 없으면 무제한. */
  semaphore?: Semaphore;
}

export interface Agent {
  readonly sessionId: string;
  /** 캐릭터를 등장시킨다(init 트랜스크립트 + SessionStart). */
  start(): Promise<void>;
  /** 한 번의 결정→행동 사이클을 수행하고 그 Decision 을 돌려준다. */
  tickOnce(): Promise<Decision>;
  /** start 후 abort 또는 maxIterations 까지 루프를 돈다. */
  runLoop(opts?: { maxIterations?: number }): Promise<void>;
  /** 루프를 멈추고 SessionEnd 를 보낸다(캐릭터 퇴장). */
  stop(): Promise<void>;
}

const DEFAULT_LOOP_INTERVAL_MS = 4000;
const DEFAULT_ACTION_DURATION_MS = 1500;
const DEFAULT_BACKOFF_MS = 2000;
const DEFAULT_BACKOFF_MAX_MS = 30000;

/** 기본 sleep: 실제 setTimeout 기반. */
const realSleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 에이전트에게 주는 시스템 프롬프트(한국어, 행동 4종 제한 안내). */
function systemPromptFor(name: string): string {
  return [
    `당신은 소프트웨어 회사의 직원 "${name}"입니다.`,
    '지금 무슨 작업을 할지 하나만 골라 JSON 으로만 답하세요.',
    '가능한 행동(action)은 다음 4종뿐입니다: read(파일 읽기), write(코드 작성), run(명령 실행), rest(휴식).',
    '형식: {"action":"read|write|run|rest","target":"대상 파일이나 명령(없으면 \\"\\")","reason":"한국어로 이유 한 줄"}',
    'JSON 외의 다른 말은 절대 쓰지 마세요.',
  ].join('\n');
}

/** 매 턴 보내는 유저 프롬프트. */
function userPrompt(): string {
  return '다음 행동을 JSON 으로 정하세요.';
}

/**
 * 에이전트를 만든다.
 * 입력: config(정체성), deps(주입 의존성)
 * 출력: Agent (start/tickOnce/runLoop/stop)
 */
export function createAgent(config: AgentConfig, deps: AgentDeps): Agent {
  const sleep = deps.sleep ?? realSleep;
  const loopIntervalMs = deps.loopIntervalMs ?? DEFAULT_LOOP_INTERVAL_MS;
  const actionDurationMs = deps.actionDurationMs ?? DEFAULT_ACTION_DURATION_MS;
  const backoffBaseMs = deps.backoffMs ?? DEFAULT_BACKOFF_MS;
  const backoffMaxMs = deps.backoffMaxMs ?? DEFAULT_BACKOFF_MAX_MS;
  const { office, openrouter, logger, semaphore } = deps;
  const { name, model, workspace, sessionId } = config;
  const controller = new AbortController();
  const sysPrompt = systemPromptFor(name);
  // 연속 호출 실패 횟수(지수 백오프용). 성공하면 0으로 초기화.
  let failStreak = 0;

  /** OpenRouter 호출을 (세마포어가 있으면) 동시성 제한 안에서 수행한다. */
  function callLLM(): Promise<Decision> {
    const fn = () => openrouter.decide(model, sysPrompt, userPrompt());
    return semaphore ? semaphore.run(fn) : fn();
  }

  return {
    sessionId,

    async start(): Promise<void> {
      // ADR-002: init 트랜스크립트 + SessionStart 로 채택을 유도한다.
      const transcriptPath = office.writeInitTranscript(workspace, sessionId);
      await office.postHook(buildSessionStart(sessionId, workspace, transcriptPath));
      logger.info('🚪 출근했어요');
    },

    async tickOnce(): Promise<Decision> {
      let decision: Decision;
      try {
        decision = await callLLM();
        failStreak = 0; // 성공 시 백오프 초기화
      } catch (err) {
        // 429/5xx 등 호출 실패 → 지수 백오프. 대기하는 동안 캐릭터를 '대기'로 표시.
        const delay = nextBackoffMs(failStreak, backoffBaseMs, backoffMaxMs);
        failStreak++;
        const msg = err instanceof Error ? err.message : String(err);
        logger.info(`⏳ 잠시 대기합니다 (호출 실패: ${msg}, ${delay}ms 후 재시도)`);
        await office.postHook(buildStop(sessionId)); // 백오프 동안 대기 신호
        await sleep(delay);
        return { action: 'rest', target: '', reason: '호출 실패로 잠시 대기' };
      }

      const tool = actionToTool(decision.action);

      if (tool === null) {
        // rest: 턴 종료(대기) 신호.
        logger.info(describeAction('rest', decision.target));
        await office.postHook(buildStop(sessionId));
        return decision;
      }

      // 행동 시작 → 지속(애니메이션) → 행동 종료.
      const reasonSuffix = decision.reason ? ` (${decision.reason})` : '';
      logger.info(`${describeAction(decision.action, decision.target)}${reasonSuffix}`);
      await office.postHook(buildPreToolUse(sessionId, tool, toolInputFor(decision.action, decision.target)));
      await sleep(actionDurationMs);
      await office.postHook(buildPostToolUse(sessionId));
      return decision;
    },

    async runLoop(opts: { maxIterations?: number } = {}): Promise<void> {
      const { maxIterations } = opts;
      await this.start();
      let i = 0;
      while (!controller.signal.aborted) {
        if (maxIterations !== undefined && i >= maxIterations) break;
        await this.tickOnce();
        i++;
        if (controller.signal.aborted) break;
        if (maxIterations !== undefined && i >= maxIterations) break;
        await sleep(loopIntervalMs);
      }
    },

    async stop(): Promise<void> {
      controller.abort();
      await office.postHook(buildSessionEnd(sessionId, 'exit'));
      logger.info('🏠 퇴근했어요');
    },
  };
}
