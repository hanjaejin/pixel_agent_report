import { describe, it, expect } from 'vitest';
import { t, parseLang } from '../src/i18n.ts';
import { describeAction } from '../src/actions.ts';

// i18n: 드라이버 로그/문구 한↔영 (F6).
describe('driver i18n', () => {
  it('t 는 ko/en 문구를 돌려주고 기본은 키', () => {
    expect(t('arrive', 'ko')).toContain('출근');
    expect(t('arrive', 'en')).toContain('Clocked in');
    expect(t('___x___', 'ko')).toBe('___x___');
  });

  it('parseLang 은 en 만 en, 나머지는 ko', () => {
    expect(parseLang('en')).toBe('en');
    expect(parseLang('EN')).toBe('en');
    expect(parseLang(undefined)).toBe('ko');
    expect(parseLang('ko')).toBe('ko');
  });

  it('describeAction 은 언어를 따른다(기본 ko)', () => {
    expect(describeAction('read', 'a.ts')).toContain('살펴보고');
    expect(describeAction('read', 'a.ts', 'en')).toBe('📖 Looking at a.ts');
    expect(describeAction('rest', '', 'en')).toContain('break');
  });
});
