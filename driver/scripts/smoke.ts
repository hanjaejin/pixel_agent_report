/**
 * smoke.ts — OpenRouter 키 없이 office 연동을 검증하는 스모크 하니스.
 *
 * 목적: 실제 LLM 대신 정해진 행동을 순환시키는 가짜 클라이언트로 N명 에이전트를 구동한다.
 *       → API 키 없이도 "캐릭터 등장 + 타이핑/읽기/대기 애니메이션 + 한국어 로그"를 눈으로 확인.
 * 사용: (1) 터미널 A `npx pixel-agents` (2) 터미널 B `npm run smoke`
 *       워크스페이스가 서버와 다르면 오피스 설정에서 "Watch All Sessions" 를 켜세요.
 * 의존성: src 의 office/agent/logger/config 와 index 의 오케스트레이션 헬퍼를 재사용.
 */
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

import { createOffice } from '../src/office.ts';
import { createAgent } from '../src/agent.ts';
import { createLogger } from '../src/logger.ts';
import { DEFAULT_AGENTS } from '../src/config.ts';
import { runAll, stopAll, type ManagedAgent } from '../src/index.ts';
import type { OpenRouterClient, Decision } from '../src/openrouter.ts';

/** 정해진 행동을 순환시키는 가짜 OpenRouter(키 불필요). */
function fakeOpenRouter(): OpenRouterClient {
  const cycle: Decision[] = [
    { action: 'read', target: 'config.ts', reason: '설정 값을 확인하려고' },
    { action: 'write', target: 'main.ts', reason: '기능을 추가하려고' },
    { action: 'run', target: 'npm test', reason: '테스트를 돌려보려고' },
    { action: 'rest', target: '', reason: '잠깐 숨 돌리기' },
  ];
  let i = 0;
  return {
    async decide(): Promise<Decision> {
      await new Promise((r) => setTimeout(r, 300)); // 생각하는 척
      return cycle[i++ % cycle.length];
    },
  };
}

async function main(): Promise<void> {
  const sys = createLogger('스모크');
  const office = createOffice({ homeDir: os.homedir() });
  const workspace = process.env.PIXEL_WORKSPACE?.trim() || process.cwd();
  sys.info(`🟢 서버 연결됨 (port ${office.serverInfo.port}). 워크스페이스: ${workspace}`);
  sys.info('ℹ️ 캐릭터가 안 보이면 오피스 설정에서 "Watch All Sessions" 를 켜세요.');

  const agents: ManagedAgent[] = DEFAULT_AGENTS.map((def) => {
    const agent = createAgent(
      { name: def.name, model: def.model, workspace, sessionId: randomUUID() },
      {
        office,
        openrouter: fakeOpenRouter(),
        logger: createLogger(def.name),
        loopIntervalMs: 3000,
        actionDurationMs: 1500,
      },
    );
    return { name: def.name, runLoop: (o) => agent.runLoop(o), stop: () => agent.stop() };
  });

  let stopping = false;
  const shutdown = async (): Promise<void> => {
    if (stopping) return;
    stopping = true;
    sys.info('🛑 종료 신호 — 전원 퇴근 처리 중...');
    await stopAll(agents, { logger: sys });
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  await runAll(agents, { logger: sys });
}

main().catch((err) => {
  createLogger('스모크').info(`❌ 스모크 실패: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
