/**
 * index.ts — 드라이버 진입점.
 *
 * 목적: 설정을 읽어 N명의 에이전트를 만들고, 각자 독립 루프로 병렬 구동한다.
 *       Ctrl+C(SIGINT) 시 전원 graceful 종료(SessionEnd)로 캐릭터를 퇴장시킨다.
 * 의존성: config(설정), office(서버 연동), openrouter(LLM), agent(루프), logger.
 *
 * 실행: `npm start` 또는 `npm run dev` (둘 다 tsx 로 이 파일을 직접 실행).
 */
import * as os from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { loadDriverConfig, validateAgents, type AgentDefinition } from './config.ts';
import { createOffice, type DriverCommand, type DriverStateReport } from './office.ts';
import { createOpenRouter } from './openrouter.ts';
import { createAgent } from './agent.ts';
import { createSemaphore } from './semaphore.ts';
import { loadSkill } from './skills.ts';
import { createLogger } from './logger.ts';

/** 오케스트레이션이 다루는 에이전트의 최소 표면(실제 Agent + 이름). */
export interface ManagedAgent {
  name: string;
  runLoop(opts?: { maxIterations?: number }): Promise<void>;
  stop(): Promise<void>;
}

/** 제어판(F5) 모델 선택을 적용하기 위한 에이전트 핸들(session_id 기준). */
export interface ModelHandle {
  sessionId: string;
  getModel(): string;
  setModel(model: string): void;
}

/** 제어 루프가 쓰는 office 의 최소 표면. */
interface ControlOffice {
  reportDriverState(state: DriverStateReport): Promise<void>;
  pollCommands(): Promise<DriverCommand[]>;
}

/** 제어 루프 폴링 주기(ms). */
const CONTROL_POLL_MS = 1500;

/**
 * 제어 루프 1회: ① 에이전트별 현재 모델 + 가용 목록을 서버에 보고
 * ② 서버에 쌓인 모델 변경 명령을 가져와 해당 에이전트에 setModel.
 * 입력: office(보고/폴링), handles(에이전트 핸들), availableModels(선택 가능 목록)
 */
export async function runControlTick(
  office: ControlOffice,
  handles: ModelHandle[],
  availableModels: string[],
): Promise<void> {
  await office.reportDriverState({
    availableModels,
    agents: handles.map((h) => ({ sessionId: h.sessionId, model: h.getModel() })),
  });
  const commands = await office.pollCommands();
  if (commands.length === 0) return;
  const bySession = new Map(handles.map((h) => [h.sessionId, h]));
  for (const c of commands) {
    bySession.get(c.sessionId)?.setModel(c.model);
  }
}

/** 설정된 에이전트들의 모델·폴백모델을 모아 선택 가능한 모델 목록을 만든다. */
export function computeAvailableModels(agents: AgentDefinition[]): string[] {
  const set = new Set<string>();
  for (const a of agents) {
    set.add(a.model);
    for (const m of a.fallbackModels ?? []) set.add(m);
  }
  return [...set];
}

interface OrchestratorDeps {
  logger?: { info: (message: string) => void };
}

/**
 * 모든 에이전트의 runLoop 를 병렬로 돌린다.
 * 입력: agents, deps.logger
 * 동작: 한 에이전트가 실패해도 다른 에이전트는 계속 돈다(allSettled 로 격리).
 */
export async function runAll(agents: ManagedAgent[], deps: OrchestratorDeps = {}): Promise<void> {
  const logger = deps.logger ?? createLogger('시스템');
  const results = await Promise.allSettled(agents.map((a) => a.runLoop()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.info(`⚠️ 에이전트 "${agents[i]?.name}" 루프가 종료됨: ${String(r.reason)}`);
    }
  });
}

/**
 * 모든 에이전트를 멈춘다(전원 SessionEnd).
 * 입력: agents, deps.logger
 * 동작: 하나가 실패해도 나머지 stop 은 모두 시도한다(allSettled).
 */
export async function stopAll(agents: ManagedAgent[], deps: OrchestratorDeps = {}): Promise<void> {
  const logger = deps.logger ?? createLogger('시스템');
  const results = await Promise.allSettled(agents.map((a) => a.stop()));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      logger.info(`⚠️ 에이전트 "${agents[i]?.name}" 종료 중 오류: ${String(r.reason)}`);
    }
  });
}

/**
 * 드라이버 메인. 설정 로드 → office/agent 생성 → 병렬 구동 → 시그널 처리.
 */
async function main(): Promise<void> {
  const sys = createLogger('시스템');
  const cfg = loadDriverConfig(process.env);
  validateAgents(cfg.agents);

  const homeDir = os.homedir();
  // server.json 이 없으면 여기서 친절한 한국어 에러로 즉시 중단된다.
  const office = createOffice({ homeDir });
  sys.info(`🟢 픽셀 오피스 서버 연결됨 (port ${office.serverInfo.port}). 워크스페이스: ${cfg.workspace}`);
  sys.info(
    `👥 에이전트 ${cfg.agents.length}명 출근 준비 중 (동시 호출 ${cfg.maxConcurrency}, 루프 ${cfg.loopIntervalMs}ms)...`,
  );

  // 전 에이전트가 공유하는 동시 호출 제한(비용/레이트리밋 보호).
  const semaphore = createSemaphore(cfg.maxConcurrency);

  const handles: ModelHandle[] = [];
  const agents: ManagedAgent[] = cfg.agents.map((def) => {
    const openrouter = createOpenRouter({ apiKey: def.apiKey ?? cfg.apiKey });
    const logger = createLogger(def.name);
    const skill = def.skillFile ? loadSkill(def.skillFile) : undefined;
    const agent = createAgent(
      {
        name: def.name,
        model: def.model,
        workspace: cfg.workspace,
        sessionId: randomUUID(),
        persona: def.persona,
        skill,
        fallbackModels: def.fallbackModels,
        lang: cfg.lang,
      },
      {
        office,
        openrouter,
        logger,
        loopIntervalMs: cfg.loopIntervalMs,
        backoffMs: cfg.backoffBaseMs,
        backoffMaxMs: cfg.backoffMaxMs,
        semaphore,
      },
    );
    handles.push({
      sessionId: agent.sessionId,
      getModel: () => agent.getModel(),
      setModel: (m) => agent.setModel(m),
    });
    return { name: def.name, runLoop: (o) => agent.runLoop(o), stop: () => agent.stop() };
  });

  // 제어판(F5) 연동: 주기적으로 모델 상태 보고 + 변경 명령 폴링. PIXEL_PANEL=0 으로 끔.
  const availableModels = computeAvailableModels(cfg.agents);
  let controlTimer: ReturnType<typeof setInterval> | undefined;
  if (process.env.PIXEL_PANEL !== '0') {
    sys.info(`🎛️ 화면 모델 선택 연동 켜짐 (브라우저에서 에이전트 모델 변경 가능, 끄려면 PIXEL_PANEL=0)`);
    controlTimer = setInterval(() => {
      void runControlTick(office, handles, availableModels).catch(() => {
        // 보고/폴링 실패는 다음 주기에 재시도(무시).
      });
    }, CONTROL_POLL_MS);
    controlTimer.unref?.();
  }

  // Ctrl+C / 종료 시 전원 graceful 퇴장.
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    sys.info('🛑 종료 신호 수신 — 전원 퇴근 처리 중...');
    if (controlTimer) clearInterval(controlTimer);
    await stopAll(agents, { logger: sys });
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await runAll(agents, { logger: sys });
}

// 직접 실행될 때만 main 을 돌린다(테스트에서 import 시에는 실행 안 됨).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (fileURLToPath(import.meta.url) === invokedPath) {
  main().catch((err) => {
    const sys = createLogger('시스템');
    sys.info(`❌ 드라이버 시작 실패: ${err instanceof Error ? err.message : String(err)}`);
    process.exitCode = 1;
  });
}
