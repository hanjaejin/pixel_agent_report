import { describe, it, expect } from 'vitest';
import { colorForName, formatLine, stripAnsi } from '../src/logger.ts';

// 한국어 컬러 로거의 순수 포맷 함수들을 검증한다.
// 실제 stdout 출력은 부수효과라 테스트하지 않고, 문자열 생성만 검증.
describe('logger', () => {
  it('컬러 없이 [이름] 메시지 형태로 포맷한다', () => {
    const line = formatLine('김대리', '📖 config.ts 살펴보는 중', { color: false });
    expect(line).toBe('[김대리] 📖 config.ts 살펴보는 중');
  });

  it('컬러 모드에서는 ANSI 코드를 포함하지만, 벗겨내면 평문과 같다', () => {
    const colored = formatLine('박사원', '✏️ main.ts 수정 중', { color: true });
    // ANSI 이스케이프 시퀀스가 들어 있어야 한다
    expect(colored).toContain('\x1b[');
    expect(stripAnsi(colored)).toBe('[박사원] ✏️ main.ts 수정 중');
  });

  it('같은 이름은 항상 같은 색을, 다른 이름은 (대체로) 다른 색을 받는다', () => {
    expect(colorForName('김대리')).toBe(colorForName('김대리'));
    // 색 코드는 유효한 ANSI 전경색 범위(31~36 등) 안의 숫자 코드여야 한다
    expect(colorForName('이주임')).toMatch(/^\x1b\[\d{2}m$/);
  });

  it('stripAnsi 는 ANSI 코드가 없는 문자열을 그대로 돌려준다', () => {
    expect(stripAnsi('순수 텍스트')).toBe('순수 텍스트');
  });
});
