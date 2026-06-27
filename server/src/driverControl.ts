import type { AgentStateStore } from './agentStateStore.js';

/**
 * driverControl.ts — 외부 드라이버(OpenRouter 드라이버 등)의 모델 선택 제어 상태.
 *
 * 역할: 드라이버는 자신을 session_id 로 식별한다. 서버는 session_id ↔ agent_id 매핑을
 *       store 로 해결한다. 이 클래스는 두 가지를 보관한다.
 *         1) 드라이버가 보고한 "에이전트별 현재 모델 + 선택 가능한 모델 목록"(session_id 기준)
 *         2) webview 가 보낸 "이 에이전트 모델을 바꿔라" 명령 큐(드라이버가 폴링으로 가져감)
 *
 * 이 모듈은 transport/Fastify 를 모르며 순수 상태만 다룬다(테스트 용이).
 */

/** 드라이버가 보고하는 한 에이전트의 (session_id, 현재 모델). */
export interface DriverModelReport {
  sessionId: string;
  model: string;
}

/** webview 선택 → 드라이버가 가져갈 모델 변경 명령. */
export interface DriverModelCommand {
  sessionId: string;
  model: string;
}

export class DriverControlState {
  private availableModels: string[] = [];
  private modelBySession = new Map<string, string>();
  private commands: DriverModelCommand[] = [];

  /** 드라이버 보고 반영(현재 모델 맵 + 가용 모델 목록 갱신). */
  setState(availableModels: string[], agents: DriverModelReport[]): void {
    this.availableModels = [...availableModels];
    this.modelBySession.clear();
    for (const a of agents) this.modelBySession.set(a.sessionId, a.model);
  }

  /** 선택 가능한 모델 목록(복사본). */
  getAvailableModels(): string[] {
    return [...this.availableModels];
  }

  /** 특정 session 의 현재 모델(없으면 undefined). */
  getModel(sessionId: string): string | undefined {
    return this.modelBySession.get(sessionId);
  }

  /**
   * webview 선택을 명령 큐에 적재한다(+ 낙관적으로 현재 모델도 즉시 갱신).
   * 같은 session 의 이전 명령은 최신 것으로 대체한다.
   */
  queueCommand(sessionId: string, model: string): void {
    this.modelBySession.set(sessionId, model);
    this.commands = this.commands.filter((c) => c.sessionId !== sessionId);
    this.commands.push({ sessionId, model });
  }

  /** 드라이버가 대기 명령을 가져가며 큐를 비운다. */
  drainCommands(): DriverModelCommand[] {
    const out = this.commands;
    this.commands = [];
    return out;
  }
}

/**
 * store(agent_id↔session_id) 와 control(session_id↔model) 을 합쳐
 * webview 로 보낼 `agentModels` 메시지를 만든다.
 * 입력: store, control
 * 출력: { type:'agentModels', agents:[{id, model}], availableModels:[] }
 */
export function buildAgentModelsMessage(
  store: AgentStateStore,
  control: DriverControlState,
): { type: 'agentModels'; agents: { id: number; model: string }[]; availableModels: string[] } {
  const agents: { id: number; model: string }[] = [];
  for (const [id, agent] of store) {
    const model = control.getModel(agent.sessionId);
    if (model) agents.push({ id, model });
  }
  return { type: 'agentModels', agents, availableModels: control.getAvailableModels() };
}
