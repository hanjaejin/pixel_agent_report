import { describe, it, expect } from 'vitest';
import { loadSkill } from '../src/skills.ts';

// skills.ts: 에이전트별 SKILL.md 를 읽어 시스템 프롬프트에 주입할 텍스트로 반환.
// 토큰 비용 보호를 위해 길이 상한이 있고, 없는 파일은 graceful(빈 문자열)하게 처리.
describe('loadSkill', () => {
  it('정상 파일 내용을 trim 해서 반환한다', () => {
    const text = loadSkill('skill.md', () => '  # 역할\n파일을 꼼꼼히 본다.  ');
    expect(text).toBe('# 역할\n파일을 꼼꼼히 본다.');
  });

  it('없는 파일은 예외 없이 빈 문자열을 반환한다(graceful)', () => {
    const fail = () => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    };
    expect(loadSkill('없는.md', fail)).toBe('');
  });

  it('빈 파일은 빈 문자열', () => {
    expect(loadSkill('a.md', () => '   \n  ')).toBe('');
  });

  it('길이 상한을 넘으면 잘라내고 생략 표시를 붙인다', () => {
    const big = 'ㄱ'.repeat(5000);
    const text = loadSkill('a.md', () => big, 100);
    expect(text.length).toBeLessThanOrEqual(100 + 20); // 본문 100 + 생략 표시
    expect(text).toContain('생략');
    expect(text.startsWith('ㄱ')).toBe(true);
  });

  it('상한 이내면 그대로 반환한다', () => {
    const text = loadSkill('a.md', () => '짧은 스킬', 100);
    expect(text).toBe('짧은 스킬');
    expect(text).not.toContain('생략');
  });
});
