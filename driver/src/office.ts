/**
 * office.ts — 픽셀 오피스 서버 연동 어댑터.
 *
 * 목적: 기존 서버(`server/`)를 수정하지 않고, 서버가 이해하는 외부 계약(ADR-001)만으로
 *       연동한다. 세 가지 일을 한다.
 *         1) `~/.pixel-agents/server.json` 에서 port/authToken 읽기
 *         2) `POST /api/hooks/claude` 로 훅 이벤트 전송 (Bearer 인증, 2초 타임아웃)
 *         3) `~/.claude/projects/<이름>/<uuid>.jsonl` 에 init 트랜스크립트 쓰기(스캐너 채택용)
 * 의존성: node:fs / node:path 는 기본값으로 쓰되, 테스트를 위해 모두 주입 가능하게 했다(ADR-003).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** server.json 의 형태. */
export interface ServerInfo {
  port: number;
  pid: number;
  authToken: string;
}

/** 서버가 이해하는 훅 페이로드(느슨한 형태 — hook_event_name + session_id 필수). */
export type HookPayload = {
  session_id: string;
  hook_event_name: string;
  [key: string]: unknown;
};

// ── 순수 함수 ────────────────────────────────────────────────────────────────

/**
 * 워크스페이스 경로 → Claude 프로젝트 디렉터리 이름.
 * 규칙: 영문/숫자/대시를 제외한 모든 문자를 `-`로 치환(mock-claude-runner.cjs 와 동일).
 */
export function projectDirName(workspacePath: string): string {
  return workspacePath.replace(/[^a-zA-Z0-9-]/g, '-');
}

/**
 * 트랜스크립트(JSONL) 파일 절대 경로를 만든다.
 * 입력: homeDir, workspacePath, sessionId
 * 출력: `<home>/.claude/projects/<이름>/<sessionId>.jsonl`
 */
export function transcriptPathFor(homeDir: string, workspacePath: string, sessionId: string): string {
  return path.join(homeDir, '.claude', 'projects', projectDirName(workspacePath), `${sessionId}.jsonl`);
}

/** server.json 의 절대 경로. */
export function serverInfoPath(homeDir: string): string {
  return path.join(homeDir, '.pixel-agents', 'server.json');
}

/**
 * server.json 을 읽어 ServerInfo 로 파싱한다.
 * 입력: homeDir, (선택) readFileFn — 기본 fs.readFileSync(utf8)
 * 출력: ServerInfo
 * 예외: 파일이 없거나 깨졌으면 "픽셀 오피스 서버가 실행 중인지" 안내하는 한국어 에러.
 */
export function readServerInfo(
  homeDir: string,
  readFileFn: (p: string) => string = (p) => fs.readFileSync(p, 'utf8'),
): ServerInfo {
  const p = serverInfoPath(homeDir);
  let raw: string;
  try {
    raw = readFileFn(p);
  } catch {
    throw new Error(
      `server.json 을 찾을 수 없습니다 (${p}). 픽셀 오피스 서버가 실행 중인지 확인하세요 (예: npx pixel-agents).`,
    );
  }
  try {
    // 실제 CLI 는 `token` 필드를 쓴다(구버전 문서는 authToken 으로 표기). 둘 다 허용.
    const parsed = JSON.parse(raw) as Partial<ServerInfo> & { token?: string };
    const authToken = parsed.authToken ?? parsed.token;
    if (typeof parsed.port !== 'number' || typeof authToken !== 'string') {
      throw new Error('형식 오류');
    }
    return { port: parsed.port, pid: parsed.pid ?? 0, authToken };
  } catch {
    throw new Error(`server.json 내용이 올바르지 않습니다 (${p}). 픽셀 오피스 서버를 재시작해 보세요.`);
  }
}

// ── 훅 페이로드 빌더 (ADR-001 계약) ──────────────────────────────────────────

/** 세션 시작 훅. cwd/transcript_path 로 서버가 외부 세션을 채택한다. */
export function buildSessionStart(sessionId: string, cwd: string, transcriptPath: string): HookPayload {
  return { session_id: sessionId, hook_event_name: 'SessionStart', cwd, transcript_path: transcriptPath };
}

/** 행동 시작 훅. tool_name 으로 읽기/타이핑 애니메이션이 갈린다. */
export function buildPreToolUse(
  sessionId: string,
  toolName: string,
  toolInput: Record<string, unknown>,
): HookPayload {
  return { session_id: sessionId, hook_event_name: 'PreToolUse', tool_name: toolName, tool_input: toolInput };
}

/** 행동 종료 훅. */
export function buildPostToolUse(sessionId: string): HookPayload {
  return { session_id: sessionId, hook_event_name: 'PostToolUse' };
}

/** 턴 종료(휴식) 훅. 캐릭터가 대기 상태가 된다. */
export function buildStop(sessionId: string): HookPayload {
  return { session_id: sessionId, hook_event_name: 'Stop' };
}

/** 세션 종료 훅. 캐릭터가 오피스에서 사라진다. */
export function buildSessionEnd(sessionId: string, reason: string): HookPayload {
  return { session_id: sessionId, hook_event_name: 'SessionEnd', reason };
}

/** 스캐너가 채택할 수 있도록 트랜스크립트 첫 줄에 넣을 system init 레코드. */
export function initRecord(): { type: string; subtype: string; content: string } {
  return { type: 'system', subtype: 'init', content: 'pixel-agents-openrouter-driver' };
}

// ── IO 함수 (의존성 주입) ────────────────────────────────────────────────────

/** createOffice 에 주입하는 의존성. 모두 선택값이며 기본은 node:fs / 전역 fetch. */
export interface OfficeDeps {
  homeDir: string;
  fetchFn?: typeof fetch;
  readFileFn?: (p: string) => string;
  mkdirFn?: (p: string) => void;
  appendFileFn?: (p: string, data: string) => void;
}

/** 훅 POST 타임아웃(ms) — ADR-001 계약. */
const HOOK_TIMEOUT_MS = 2000;

export interface Office {
  /** 훅 페이로드 1건을 서버로 POST 한다. 실패 시 한국어 에러를 던진다. */
  postHook(payload: HookPayload): Promise<void>;
  /** init 트랜스크립트 파일을 만들고 경로를 반환한다(스캐너 채택용). */
  writeInitTranscript(workspacePath: string, sessionId: string): string;
  /** 캐싱된 ServerInfo (port/token). */
  readonly serverInfo: ServerInfo;
}

/**
 * Office 인스턴스를 만든다.
 * 입력: deps (homeDir 필수, 나머지는 테스트용 주입)
 * 출력: Office (postHook / writeInitTranscript)
 * 동작: 생성 시 server.json 을 1회 읽어 캐싱한다(없으면 즉시 한국어 에러).
 */
export function createOffice(deps: OfficeDeps): Office {
  const fetchFn = deps.fetchFn ?? fetch;
  const readFileFn = deps.readFileFn ?? ((p: string) => fs.readFileSync(p, 'utf8'));
  const mkdirFn = deps.mkdirFn ?? ((p: string) => void fs.mkdirSync(p, { recursive: true }));
  const appendFileFn = deps.appendFileFn ?? ((p: string, data: string) => fs.appendFileSync(p, data));

  const info = readServerInfo(deps.homeDir, readFileFn);
  const url = `http://127.0.0.1:${info.port}/api/hooks/claude`;

  return {
    serverInfo: info,

    async postHook(payload: HookPayload): Promise<void> {
      const res = await fetchFn(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${info.authToken}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(HOOK_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`훅 전송 실패: HTTP ${res.status} (${payload.hook_event_name})`);
      }
    },

    writeInitTranscript(workspacePath: string, sessionId: string): string {
      const filePath = transcriptPathFor(deps.homeDir, workspacePath, sessionId);
      mkdirFn(path.dirname(filePath));
      appendFileFn(filePath, `${JSON.stringify(initRecord())}\n`);
      return filePath;
    },
  };
}
