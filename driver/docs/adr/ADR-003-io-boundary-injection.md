# ADR-003: 네트워크/파일 IO 경계 추상화 (의존성 주입)

- 상태: 채택(Accepted)
- 날짜: 2026-06-26

## 맥락

`office.ts` 는 실제 HTTP(`fetch`)와 파일시스템(`fs`)에 의존한다. 이를 직접 호출하면
단위 테스트가 실제 서버나 디스크 상태에 묶여 느리고 불안정해진다(TDD 저해).

## 결정

IO를 수행하는 함수는 모두 **주입 가능한 의존성**으로 받는다.

- `createOffice(deps)` 의 `deps` 에 `fetchFn`, `readFileFn`, `mkdirFn`, `appendFileFn` 을 둔다.
- 기본값은 전역 `fetch` 와 `node:fs` 이지만, 테스트는 가짜(fake)를 주입해 호출 인자를 검증한다.
- 순수 함수(해시 계산, 페이로드 빌더, server.json 파싱)는 IO와 분리해 별도로 테스트한다.

## 결과

- 실제 서버/디스크 없이 office 전체를 단위 테스트(9건)로 검증 가능.
- 같은 패턴을 `openrouter.ts`(fetch 주입), `agent.ts`(office/openrouter 주입)에 재사용한다.
