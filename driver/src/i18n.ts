/**
 * i18n.ts — 드라이버 로그/업무 문구의 한/영 전환(F6).
 *
 * 목적: 드라이버 터미널 로그(출근/퇴근 등)와 행동 문구(actions.describeAction)를 ko/en 으로 낸다.
 *       기본은 ko(한국어 원칙 유지), `PIXEL_LANG=en` 으로 영어 전환.
 * 의존성: 없음(순수). 환경변수 해석은 parseLang 으로 분리해 테스트 용이.
 */

export type Lang = 'en' | 'ko';

/** 키 → 언어별 문구 사전(로그용). */
const DICT: Record<string, { en: string; ko: string }> = {
  arrive: { en: '🚪 Clocked in', ko: '🚪 출근했어요' },
  leave: { en: '🏠 Clocked out', ko: '🏠 퇴근했어요' },
};

/**
 * 키 + 언어 → 문구(순수). 키 없으면 key 그대로, 언어 누락이면 en 폴백.
 */
export function t(key: string, lang: Lang): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}

/** 환경변수 값 → Lang. 'en' 이면 en, 그 외(미설정 포함)는 기본 ko. */
export function parseLang(value: string | undefined): Lang {
  return value?.trim().toLowerCase() === 'en' ? 'en' : 'ko';
}
