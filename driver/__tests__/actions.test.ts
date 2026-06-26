import { describe, it, expect } from 'vitest';
import {
  actionToTool,
  toolInputFor,
  describeAction,
  KNOWN_TOOL_NAMES,
} from '../src/actions.ts';
import { ACTIONS } from '../src/openrouter.ts';

// actions.ts: LLM 의 action 을 (1) 서버 훅 tool_name 과 (2) 한국어 로그 문구로 매핑.
// 한국어 문구는 모델이 아니라 드라이버 고정 템플릿이 만든다(ADR-006).
describe('actionToTool', () => {
  it('read/write/run 은 Read/Edit/Bash, rest 는 도구 없음(null)', () => {
    expect(actionToTool('read')).toBe('Read');
    expect(actionToTool('write')).toBe('Edit');
    expect(actionToTool('run')).toBe('Bash');
    expect(actionToTool('rest')).toBeNull();
  });

  it('도구가 있는 action 의 tool_name 은 서버가 아는 값 집합에 속한다', () => {
    for (const a of ACTIONS) {
      const tool = actionToTool(a);
      if (tool !== null) {
        expect(KNOWN_TOOL_NAMES).toContain(tool);
      }
    }
  });
});

describe('toolInputFor', () => {
  it('Read/Edit 는 file_path, Bash 는 command 를 채운다', () => {
    expect(toolInputFor('read', 'config.ts')).toEqual({ file_path: 'config.ts' });
    expect(toolInputFor('write', 'main.ts')).toEqual({ file_path: 'main.ts' });
    expect(toolInputFor('run', 'npm test')).toEqual({ command: 'npm test' });
  });

  it('target 이 비어도 안전한 기본 입력을 만든다', () => {
    expect(toolInputFor('read', '')).toEqual({ file_path: '파일' });
    expect(toolInputFor('run', '')).toEqual({ command: '명령' });
  });
});

describe('describeAction - 한국어 문구', () => {
  it('read 는 책 이모지와 대상 파일을 포함한다', () => {
    expect(describeAction('read', 'config.ts')).toContain('📖');
    expect(describeAction('read', 'config.ts')).toContain('config.ts');
  });

  it('write 는 연필 이모지, run 은 톱니 이모지', () => {
    expect(describeAction('write', 'main.ts')).toContain('✏️');
    expect(describeAction('write', 'main.ts')).toContain('main.ts');
    expect(describeAction('run', 'npm test')).toContain('⚙️');
  });

  it('rest 는 커피 이모지이며 대상이 없다', () => {
    const msg = describeAction('rest', '');
    expect(msg).toContain('☕');
  });

  it('대상이 비면 일반 문구로 폴백한다', () => {
    expect(describeAction('read', '')).toContain('📖');
    expect(describeAction('read', '')).not.toContain('undefined');
  });
});
