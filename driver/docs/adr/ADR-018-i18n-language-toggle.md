# ADR-018: 한↔영 전환(i18n) — webview UI + 드라이버 로그

- 상태: 채택(Accepted)
- 날짜: 2026-06-27
- 관련: PLAN_2 F6

## 맥락

"화면 한/영 전환"을 원하지만, 오피스 캔버스의 **활동 라벨**("Reading config.ts")은 드라이버가
아니라 **서버의 공유 Claude provider**(`formatToolStatus`)가 영어로 포맷한다. 이를 번역하려면
실제 Claude 사용자에게도 영향을 주는 공유 표면을 바꿔야 한다(위험).

## 결정 (사용자 승인 범위 A)

두 영역만 i18n 한다. 공유 provider 는 건드리지 않는다.

1. **webview UI 텍스트(F6-1)**: `webview-ui/src/i18n.ts`(ko/en 사전 + 순수 `t(key,lang)`),
   Settings 에 "한국어" 토글. 언어는 **localStorage** 에 저장(프로토콜/서버 변경 없음).
   Settings 의 라벨·제목을 `t()` 로 전환.
2. **드라이버 로그/업무 문구(F6-2)**: `driver/src/i18n.ts`(ko/en) + `actions.describeAction(action,target,lang)`
   ko/en + 출근/퇴근 로그. 언어는 `PIXEL_LANG`(기본 ko). 한국어 원칙 유지(기본 ko, en 옵션).

### 범위 밖(의도적)
- 오피스 캔버스 **활동 라벨**(Reading→읽는 중)은 공유 provider 소관 → 본 범위 밖(영어 유지).
- webview UI 와 드라이버 로그의 언어는 **독립 제어**(브라우저 Settings vs `PIXEL_LANG`).
  동기화는 향후 과제(F5 제어 채널로 전달 가능).

## 결과

- 브라우저 Settings 에서 한국어 토글 → Settings UI 가 ko/en 전환(localStorage 유지).
- `PIXEL_LANG=en` → 드라이버 터미널 업무 로그가 영어.
- 공유 코드/실제 Claude 사용자 영향 0. webview/driver 테스트 회귀 0.
