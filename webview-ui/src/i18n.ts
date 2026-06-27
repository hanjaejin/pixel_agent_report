/**
 * i18n.ts — 오피스 webview UI 텍스트의 한/영 전환(F6).
 *
 * 목적: Settings 등 webview 자체 UI 텍스트를 ko/en 으로 전환한다. 언어는 localStorage 에 저장.
 *       (오피스 캔버스의 활동 라벨은 서버 provider 가 포맷하므로 본 범위 밖 — 영어 유지.)
 * 의존성: localStorage(브라우저). t() 자체는 순수 함수(테스트 용이).
 */

export type Lang = 'en' | 'ko';

/** 키 → 언어별 문구 사전. 새 문구는 여기에 추가. */
const DICT: Record<string, { en: string; ko: string }> = {
  settings: { en: 'Settings', ko: '설정' },
  language: { en: 'Korean (한국어)', ko: '한국어 (Korean)' },
  openSessionsFolder: { en: 'Open Sessions Folder', ko: '세션 폴더 열기' },
  exportLayout: { en: 'Export Layout', ko: '레이아웃 내보내기' },
  importLayout: { en: 'Import Layout', ko: '레이아웃 가져오기' },
  addAssetDirectory: { en: 'Add Asset Directory', ko: '에셋 폴더 추가' },
  soundNotifications: { en: 'Sound Notifications', ko: '소리 알림' },
  watchAllSessions: { en: 'Watch All Sessions', ko: '모든 세션 감시' },
  instantDetection: { en: 'Instant Detection (Hooks)', ko: '즉시 감지 (훅)' },
  alwaysShowLabels: { en: 'Always Show Labels', ko: '항상 라벨 표시' },
  debugView: { en: 'Debug View', ko: '디버그 보기' },
  agentModels: { en: 'Agent Models', ko: '에이전트 모델' },
};

const STORAGE_KEY = 'pixel-agents.language';

/** 저장된 언어를 읽는다(기본 'en'). localStorage 없거나 오류면 'en'. */
export function getStoredLanguage(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ko' ? 'ko' : 'en';
  } catch {
    return 'en';
  }
}

/** 언어를 저장한다(실패해도 조용히 무시). */
export function storeLanguage(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* localStorage 불가 환경은 무시 */
  }
}

/**
 * 키 + 언어 → 문구(순수).
 * 입력: key(사전 키), lang('en'|'ko')
 * 출력: 해당 언어 문구. 키가 없으면 key 그대로, 언어 누락이면 en 폴백.
 */
export function t(key: string, lang: Lang): string {
  const entry = DICT[key];
  if (!entry) return key;
  return entry[lang] ?? entry.en;
}
