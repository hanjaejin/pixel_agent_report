import { describe, expect,it } from 'vitest';

import { t } from '../src/i18n.js';

// i18n.t: 순수 번역 함수(F6). localStorage 미사용이라 node 환경에서 안전.
describe('i18n t', () => {
  it('en/ko 문구를 돌려준다', () => {
    expect(t('settings', 'en')).toBe('Settings');
    expect(t('settings', 'ko')).toBe('설정');
  });

  it('없는 키는 키 자체를 돌려준다', () => {
    expect(t('___nope___', 'ko')).toBe('___nope___');
  });
});
