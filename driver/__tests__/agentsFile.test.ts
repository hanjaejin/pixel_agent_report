import { describe, it, expect } from 'vitest';
import { loadAgentsFile } from '../src/agentsFile.ts';

// agentsFile.ts: agents.json 외부 파일을 읽어 AgentDefinition[] 로 검증·파싱.
// 잘못된 설정은 "어디가 왜 틀렸는지" 한국어로 알려준다.
function reader(content: string): (p: string) => string {
  return () => content;
}

describe('loadAgentsFile - 정상', () => {
  it('배열 형태 JSON 을 파싱한다', () => {
    const json = JSON.stringify([
      { name: '김대리', model: 'm1' },
      { name: '박사원', model: 'm2' },
    ]);
    const defs = loadAgentsFile('agents.json', reader(json));
    expect(defs).toHaveLength(2);
    expect(defs[0]).toEqual({ name: '김대리', model: 'm1' });
  });

  it('{ "agents": [...] } 형태도 파싱한다', () => {
    const json = JSON.stringify({ agents: [{ name: '김', model: 'm' }] });
    expect(loadAgentsFile('a.json', reader(json))).toHaveLength(1);
  });

  it('선택 필드(persona/skillFile/fallbackModels/apiKey)를 반영한다', () => {
    const json = JSON.stringify([
      {
        name: '김',
        model: 'm',
        persona: '꼼꼼한 성격',
        skillFile: 'skills/김.md',
        fallbackModels: ['m2', 'm3'],
        apiKey: 'k',
      },
    ]);
    const d = loadAgentsFile('a.json', reader(json))[0];
    expect(d.persona).toBe('꼼꼼한 성격');
    expect(d.skillFile).toBe('skills/김.md');
    expect(d.fallbackModels).toEqual(['m2', 'm3']);
    expect(d.apiKey).toBe('k');
  });
});

describe('loadAgentsFile - 친절한 한국어 에러', () => {
  it('파일을 못 읽으면 한국어 에러', () => {
    const fail = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };
    expect(() => loadAgentsFile('없는.json', fail)).toThrow(/읽을 수 없습니다/);
  });

  it('JSON 이 깨지면 한국어 에러', () => {
    expect(() => loadAgentsFile('a.json', reader('이건 JSON 아님'))).toThrow(/JSON/);
  });

  it('배열도 {agents:[]}도 아니면 한국어 에러', () => {
    expect(() => loadAgentsFile('a.json', reader('{"foo":1}'))).toThrow(/배열|agents/);
  });

  it('model 누락은 위치와 함께 거부', () => {
    const json = JSON.stringify([{ name: '김' }]);
    expect(() => loadAgentsFile('a.json', reader(json))).toThrow(/model/);
  });

  it('name 누락 거부', () => {
    const json = JSON.stringify([{ model: 'm' }]);
    expect(() => loadAgentsFile('a.json', reader(json))).toThrow(/name|이름/);
  });

  it('이름 중복 거부', () => {
    const json = JSON.stringify([
      { name: '김', model: 'm1' },
      { name: '김', model: 'm2' },
    ]);
    expect(() => loadAgentsFile('a.json', reader(json))).toThrow(/중복/);
  });

  it('fallbackModels 가 문자열 배열이 아니면 거부', () => {
    const json = JSON.stringify([{ name: '김', model: 'm', fallbackModels: [1, 2] }]);
    expect(() => loadAgentsFile('a.json', reader(json))).toThrow(/fallbackModels/);
  });

  it('persona 가 문자열이 아니면 거부', () => {
    const json = JSON.stringify([{ name: '김', model: 'm', persona: 123 }]);
    expect(() => loadAgentsFile('a.json', reader(json))).toThrow(/persona/);
  });
});
