/**
 * actions.ts — LLM action → (1) 서버 훅 tool_name + (2) 한국어 로그 문구 매핑.
 *
 * 목적: 모델이 고른 추상 행동(read/write/run/rest)을 두 가지로 변환한다.
 *         1) 서버가 이해하는 tool_name (Read/Edit/Bash) — 오피스 애니메이션을 가른다.
 *         2) 사람이 읽는 한국어 업무 문구 — 화면 동작과 1:1로 대응(ADR-006).
 *       한국어 문구는 모델이 아니라 이 모듈의 고정 템플릿이 만든다(작은 모델 안정성).
 * 의존성: openrouter.ts 의 Action 타입만 참조(런타임 의존 없음).
 */
import type { Action } from './openrouter.ts';

/** 서버가 아는(= 애니메이션이 매핑된) tool_name 집합. */
export const KNOWN_TOOL_NAMES = ['Read', 'Edit', 'Bash'] as const;
export type KnownToolName = (typeof KNOWN_TOOL_NAMES)[number];

/** action 별 메타데이터: 도구 이름, 이모지, 문구 빌더. */
interface ActionMeta {
  /** 서버 훅 tool_name. rest 는 도구 없음(null → Stop 으로 처리). */
  tool: KnownToolName | null;
  /** 로그 이모지. */
  emoji: string;
  /** target(대상)을 받아 한국어 문구를 만든다. */
  phrase: (target: string) => string;
}

const ACTION_META: Record<Action, ActionMeta> = {
  read: {
    tool: 'Read',
    emoji: '📖',
    phrase: (t) => (t ? `📖 ${t} 파일을 살펴보고 있어요` : '📖 코드를 살펴보고 있어요'),
  },
  write: {
    tool: 'Edit',
    emoji: '✏️',
    phrase: (t) => (t ? `✏️ ${t} 를 수정하는 중이에요` : '✏️ 코드를 수정하는 중이에요'),
  },
  run: {
    tool: 'Bash',
    emoji: '⚙️',
    phrase: (t) => (t ? `⚙️ ${t} 명령을 실행하고 있어요` : '⚙️ 명령을 실행하고 있어요'),
  },
  rest: {
    tool: null,
    emoji: '☕',
    phrase: () => '☕ 잠깐 쉬는 중이에요',
  },
};

/**
 * action → 서버 훅 tool_name.
 * 입력: action
 * 출력: 'Read' | 'Edit' | 'Bash' | null(rest 는 도구 없음)
 */
export function actionToTool(action: Action): KnownToolName | null {
  return ACTION_META[action].tool;
}

/**
 * action + target → 훅 PreToolUse 의 tool_input.
 * 입력: action, target(대상 파일/명령)
 * 출력: Read/Edit → { file_path }, Bash → { command }. target 이 비면 안전한 기본값.
 * 주의: rest 는 도구가 없으므로 호출 측에서 actionToTool(action)===null 로 거른다.
 */
export function toolInputFor(action: Action, target: string): Record<string, unknown> {
  const tool = ACTION_META[action].tool;
  if (tool === 'Bash') {
    return { command: target || '명령' };
  }
  // Read / Edit (rest 는 호출되지 않는 전제)
  return { file_path: target || '파일' };
}

/**
 * action + target → 한국어 로그 문구(이모지 포함, 이름 접두사 제외).
 * 입력: action, target
 * 출력: 예) '📖 config.ts 파일을 살펴보고 있어요'. target 이 비면 일반 문구로 폴백.
 * 의존성: 로거가 `[이름]` 접두사를 붙이므로 여기서는 본문만 만든다.
 */
export function describeAction(action: Action, target: string): string {
  return ACTION_META[action].phrase(target);
}
