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

import { loadDriverConfig, validateAgents } from './config.ts';
import { createOffice } from './office.ts';
import { createOpenRouter } from './openrouter.ts';
import { createAgent } from './agent.ts';
import { createSemaphore } from './semaphore.ts';
import { createLogger } from './logger.ts';

/** 오케스트레이션이 다루는 에이전트의 최소 표면(실제 Agent + 이름). */
export interface ManagedAgent {
  name: string;
  runLoop(opts?: { maxIterations?: number }): Promise<void>;
  stop(): Promise<void>;
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

  const agents: ManagedAgent[] = cfg.agents.map((def) => {
    const openrouter = createOpenRouter({ apiKey: def.apiKey ?? cfg.apiKey });
    const logger = createLogger(def.name);
    const agent = createAgent(
      { name: def.name, model: def.model, workspace: cfg.workspace, sessionId: randomUUID() },
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
    return { name: def.name, runLoop: (o) => agent.runLoop(o), stop: () => agent.stop() };
  });

  // Ctrl+C / 종료 시 전원 graceful 퇴장.
  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    sys.info('🛑 종료 신호 수신 — 전원 퇴근 처리 중...');
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
