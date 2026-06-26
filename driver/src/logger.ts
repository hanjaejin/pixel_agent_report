/**
 * 한국어 컬러 로거.
 *
 * 목적: 각 에이전트의 업무 로그를 `[이름] 이모지 메시지` 형태로, 이름마다
 *       고정된 색으로 터미널에 출력한다. 화면(픽셀 오피스)의 캐릭터 동작과
 *       1:1로 대응하는 사람이 읽기 쉬운 로그를 만드는 것이 핵심.
 * 의존성: 없음 (Node 내장 process.stdout 만 사용).
 */

/** 이름별로 순환 배정할 ANSI 전경색 코드 목록 (빨강~청록). */
const PALETTE: readonly string[] = ['31', '32', '33', '34', '35', '36', '91', '92', '93', '94', '95', '96'];

/**
 * 문자열을 ANSI 색 코드(`\x1b[NNm`)로 결정적으로 매핑한다.
 * 입력: name(에이전트 이름)
 * 출력: `\x1b[NNm` 형태의 색 시작 코드
 * 같은 이름은 항상 같은 색을 받는다(해시 기반).
 */
export function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    // 간단한 누적 해시. 음수 방지를 위해 부호 없는 32비트로 강제.
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const code = PALETTE[hash % PALETTE.length];
  return `\x1b[${code}m`;
}

/** 문자열에서 모든 ANSI 이스케이프 시퀀스를 제거한다(테스트/평문 비교용). */
export function stripAnsi(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/** ANSI 리셋 코드. */
const RESET = '\x1b[0m';

export interface FormatOptions {
  /** true면 ANSI 색을 입힌다. 기본값 true. */
  color?: boolean;
}

/**
 * 한 줄 로그를 문자열로 만든다.
 * 입력: name(이름), message(이모지 포함 메시지 본문), opts.color
 * 출력: color=false면 `[name] message`, color=true면 이름 부분에 색을 입힌 문자열
 */
export function formatLine(name: string, message: string, opts: FormatOptions = {}): string {
  const useColor = opts.color !== false;
  if (!useColor) {
    return `[${name}] ${message}`;
  }
  const color = colorForName(name);
  return `${color}[${name}]${RESET} ${message}`;
}

/**
 * 이름이 고정된 로거 인스턴스를 만든다.
 * 입력: name
 * 출력: { info(message) } — process.stdout 으로 한 줄 출력하는 부수효과 함수
 * 의존성: process.stdout (TTY가 아니면 색 자동 비활성화)
 */
export function createLogger(name: string): { info: (message: string) => void } {
  const color = process.stdout.isTTY === true;
  return {
    info(message: string): void {
      process.stdout.write(`${formatLine(name, message, { color })}\n`);
    },
  };
}
