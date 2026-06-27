import { describe, it, expect } from 'vitest';

import type { AgentStateStore } from '../src/agentStateStore.js';
import { buildAgentModelsMessage, DriverControlState } from '../src/driverControl.js';

// driverControl: 드라이버 모델 보고 + webview 선택 명령 큐 (순수 상태).
function fakeStore(entries: [number, { sessionId: string }][]): AgentStateStore {
  return {
    *[Symbol.iterator]() {
      for (const e of entries) yield e;
    },
  } as unknown as AgentStateStore;
}

describe('DriverControlState', () => {
  it('setState 후 getModel / getAvailableModels 가 반영된다', () => {
    const c = new DriverControlState();
    c.setState(['m1', 'm2'], [{ sessionId: 's1', model: 'm1' }]);
    expect(c.getModel('s1')).toBe('m1');
    expect(c.getModel('없음')).toBeUndefined();
    expect(c.getAvailableModels()).toEqual(['m1', 'm2']);
  });

  it('queueCommand 는 현재 모델을 갱신하고 drainCommands 로 가져가며 비운다', () => {
    const c = new DriverControlState();
    c.setState([], [{ sessionId: 's1', model: 'old' }]);
    c.queueCommand('s1', 'new');
    expect(c.getModel('s1')).toBe('new'); // 낙관적 갱신
    expect(c.drainCommands()).toEqual([{ sessionId: 's1', model: 'new' }]);
    expect(c.drainCommands()).toEqual([]); // 비워짐
  });

  it('같은 session 의 명령은 최신 것으로 대체된다', () => {
    const c = new DriverControlState();
    c.queueCommand('s1', 'a');
    c.queueCommand('s1', 'b');
    expect(c.drainCommands()).toEqual([{ sessionId: 's1', model: 'b' }]);
  });
});

describe('buildAgentModelsMessage', () => {
  it('session_id↔agent_id 를 매핑하고 모델 보고가 없는 에이전트는 제외한다', () => {
    const c = new DriverControlState();
    c.setState(['mX'], [{ sessionId: 's1', model: 'mX' }]);
    const store = fakeStore([
      [1, { sessionId: 's1' }],
      [2, { sessionId: 's2' }], // 보고 없음 → 제외
    ]);
    const msg = buildAgentModelsMessage(store, c);
    expect(msg.type).toBe('agentModels');
    expect(msg.agents).toEqual([{ id: 1, model: 'mX' }]);
    expect(msg.availableModels).toEqual(['mX']);
  });
});
