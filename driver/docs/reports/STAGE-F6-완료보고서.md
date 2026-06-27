# 기능 단계 F6 완료 보고서 — 한↔영 전환(webview UI + 드라이버 로그)

- 날짜: 2026-06-27
- 상태: ✅ 완료 (범위 A)
- 관련: PLAN_2 F6

## 목표
화면(오피스) UI 텍스트와 드라이버 로그를 ko/en 으로 전환. (활동 라벨은 공유 provider 소관이라 영어 유지.)

## 만든 것 / 바꾼 것
| 영역 | 파일 | 내용 |
|------|------|------|
| webview | [i18n.ts](../../../webview-ui/src/i18n.ts)(신규) | ko/en 사전 + `t()` + localStorage 언어 |
| webview | App.tsx / SettingsModal.tsx | `lang` 상태 + Settings 라벨 번역 + "한국어" 토글 |
| driver | [src/i18n.ts](../../src/i18n.ts)(신규) | ko/en `t()` + `parseLang(PIXEL_LANG)` |
| driver | actions.ts / agent.ts / config.ts / index.ts | `describeAction(…, lang)`, 출근/퇴근 로그, `PIXEL_LANG` |

## 동작
- 브라우저 **Settings → 한국어** 토글 → Settings UI 가 ko/en 전환(localStorage 저장).
- `PIXEL_LANG=en` → 드라이버 터미널 업무 로그가 영어(예: `📖 Looking at config.ts`).
- 기본값: webview en(현행 유지), driver ko(한국어 원칙 유지).

## 범위 결정(사용자 승인 A)
- 오피스 캔버스 **활동 라벨**("Reading…")은 서버 공유 Claude provider 포맷 → **영어 유지**(번역 시 실제 Claude 사용자 영향).
- webview UI 언어(localStorage)와 드라이버 로그 언어(PIXEL_LANG)는 **독립 제어**(동기화는 향후 과제).

## 주요 결정 (ADR)
- [ADR-018](../adr/ADR-018-i18n-language-toggle.md): i18n 범위(webview UI + 드라이버 로그, 활동 라벨 제외)

## 검증 결과
- driver: **98/98** ✅ (i18n 3 + config 1 신규)
- webview: 단위 **43**(i18n +2), build/eslint 통과 ✅
- driver/webview 타입체크 통과, 기존 회귀 0

## 완료 기준 충족
- [x] ko/en 전환·폴백 테스트 그린(webview·driver)
- [x] Settings UI 토글 동작 + localStorage 유지
- [x] PIXEL_LANG 으로 드라이버 로그 언어 전환
- [x] 기존 테스트 회귀 0, 픽셀 ESLint 0 위반

## 비고
- PLAN_2 의 6개 기능(F1~F6) 전부 완료.
