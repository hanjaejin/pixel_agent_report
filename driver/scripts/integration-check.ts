/**
 * integration-check.ts — 실서버 대상 bounded 통합 검증(키 불필요).
 *
 * 목적: 실행 중인 픽셀 오피스 서버에 대해 가짜 LLM 으로 N명 에이전트를 각자 몇 번만
 *       돌리고 종료한다. 훅 POST 성공/실패 횟수를 집계해 "서버 연동이 살아 있는지"를
 *       자동으로 판정한다. (캐릭터의 시각적 동작은 브라우저에서 별도 확인)
 * 사용: 서버 기동 후 `PIXEL_WORKSPACE=<서버워크스페이스> npm run check:integration`
 */
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';

import { createOffice, type HookPayload } from '../src/office.ts';
import { createAgent } from '../src/agent.ts';
import { createLogger } from '../src/logger.ts';
import { DEFAULT_AGENTS } from '../src/config.ts';
import { stopAll, type ManagedAgent } from '../src/index.ts';
import type { OpenRouterClient, Decision } from '../src/openrouter.ts';

const ITERATIONS = 3;

/** 정해진 행동을 순환시키는 가짜 OpenRouter(키 불필요). */
function fakeOpenRouter(): OpenRouterClient {
  const cycle: Decision[] = [
    { action: 'read', target: 'config.ts', reason: '설정 확인' },
    { action: 'write', target: 'main.ts', reason: '기능 추가' },
    { action: 'run', target: 'npm test', reason: '테스트 실행' },
  ];
  let i = 0;
  return {
    async decide(): Promise<Decision> {
      await new Promise((r) => setTimeout(r, 50));
      return cycle[i++ % cycle.length];
    },
  };
}

async function main(): Promise<void> {
  const sys = createLogger('통합검증');
  const real = createOffice({ homeDir: os.homedir() });
  const workspace = process.env.PIXEL_WORKSPACE?.trim() || process.cwd();
  sys.info(`🟢 서버 연결됨 (port ${real.serverInfo.port}). 워크스페이스: ${workspace}`);

  // 훅 POST 성공/실패를 집계하는 계측 래퍼.
  let ok = 0;
  let fail = 0;
  const office = {
    writeInitTranscript: (ws: string, sid: string) => real.writeInitTranscript(ws, sid),
    postHook: async (p: HookPayload) => {
      try {
        await real.postHook(p);
        ok++;
      } catch (e) {
        fail++;
        sys.info(`  ❌ 훅 실패(${p.hook_event_name}): ${e instanceof Error ? e.message : String(e)}`);
      }
    },
  };

  const agents: ManagedAgent[] = DEFAULT_AGENTS.map((def) => {
    const agent = createAgent(
      { name: def.name, model: def.model, workspace, sessionId: randomUUID() },
      { office, openrouter: fakeOpenRouter(), logger: createLogger(def.name), loopIntervalMs: 300, actionDurationMs: 600 },
    );
    return { name: def.name, runLoop: (o) => agent.runLoop(o), stop: () => agent.stop() };
  });

  // 각자 ITERATIONS 회만 돌린다(격리: 한 명 실패해도 진행).
  await Promise.allSettled(agents.map((a) => a.runLoop({ maxIterations: ITERATIONS })));
  // 잠깐 여유를 주어 스캐너(1초)가 채택하도록 한 뒤 퇴장.
  await new Promise((r) => setTimeout(r, 2500));
  await stopAll(agents, { logger: sys });

  sys.info(`📊 결과: 훅 성공 ${ok}건 / 실패 ${fail}건 (에이전트 ${agents.length}명 × ${ITERATIONS}회 + 종료)`);
  if (fail > 0) {
    sys.info('⚠️ 일부 훅 실패 — server.json 토큰/포트, 서버 실행 여부를 확인하세요.');
    process.exitCode = 1;
  } else {
    sys.info('✅ 모든 훅이 200 으로 수락됨. 브라우저(http://127.0.0.1:포트)에서 캐릭터 동작을 확인하세요.');
  }
}

main().catch((err) => {
  createLogger('통합검증').info(`❌ 통합 검증 실패: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
