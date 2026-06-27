/**
 * skills.ts — 에이전트별 SKILL.md(역할·규칙·도메인 지식)를 읽어 프롬프트 주입용 텍스트로 만든다.
 *
 * 목적: Claude 의 SKILL.md 처럼, 각 에이전트가 참고할 자료를 마크다운 파일로 두고
 *       시스템 프롬프트에 주입한다. 토큰 비용 폭증을 막기 위해 길이 상한을 둔다(ADR-015).
 * 의존성: node:fs(기본 reader). 테스트는 readFileFn 주입.
 */
import * as fs from 'node:fs';

/** SKILL 주입 기본 길이 상한(문자 수). 토큰 비용 보호. */
export const DEFAULT_MAX_SKILL_CHARS = 4000;

/**
 * SKILL 파일을 읽어 주입용 텍스트로 반환한다.
 * 입력: filePath, (선택) readFileFn(기본 fs.readFileSync utf8), (선택) maxLen(기본 4000)
 * 출력: trim 된 텍스트. 없는 파일/읽기 실패는 **빈 문자열**(graceful, 예외 없음).
 *       maxLen 초과 시 잘라내고 "…(생략됨)"을 붙인다.
 * 의존성: 파일시스템(주입 가능).
 */
export function loadSkill(
  filePath: string,
  readFileFn: (p: string) => string = (p) => fs.readFileSync(p, 'utf8'),
  maxLen: number = DEFAULT_MAX_SKILL_CHARS,
): string {
  let raw: string;
  try {
    raw = readFileFn(filePath);
  } catch {
    return ''; // 파일이 없거나 못 읽으면 조용히 건너뜀(에이전트는 SKILL 없이 동작)
  }
  const text = raw.trim();
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}\n…(생략됨)`;
}
