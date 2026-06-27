# 🟦 Pixel Agents — OpenRouter 드라이버

> **Claude Code 없이**, 작은 AI 모델(OpenRouter)이 픽셀 사무실에서 **캐릭터로 일하게** 만드는 프로그램이에요.
> 캐릭터 3명(김대리·박사원·이주임)이 책상에 앉아 📖읽기 / ✏️타이핑 / ⚙️실행 / ☕휴식을 반복합니다.

처음이라면 👉 **[아주 자세한 사용설명서 (초보자용)](docs/사용설명서.md)** 부터 보세요.

---

## 🧩 이게 뭐예요? (한 장 그림)

```
[이 드라이버 프로그램]                         [픽셀 오피스(기존 프로그램)]
  김대리 → OpenRouter(작은 AI) ─┐
  박사원 → OpenRouter(작은 AI) ─┤→ 훅 신호 전송 →  서버 → 브라우저 화면에
  이주임 → OpenRouter(작은 AI) ─┘                        캐릭터가 움직임 🎮
```

- 드라이버는 각 캐릭터에게 "지금 뭐 할래?"를 AI에게 물어보고(읽기/쓰기/실행/휴식 중 하나),
- 그 행동을 픽셀 오피스가 알아듣는 신호로 바꿔 보냅니다.
- 그러면 화면에서 캐릭터가 걷고, 타이핑하고, 쉬는 모습이 보여요.

> 1단계(데모)에서는 **실제 파일을 건드리지 않습니다.** "일하는 척"하는 모습만 보여줘요(안전).

---

## ✅ 준비물

1. **Node.js 20 이상** (이 컴퓨터엔 24가 깔려 있어요)
2. **픽셀 오피스 서버** (이 저장소로 한 번 빌드하면 됨 — 아래 참고)
3. (선택) **OpenRouter API 키** — 진짜 AI로 돌리고 싶을 때만. 없으면 "체험 모드"로 충분히 볼 수 있어요.
   - 키 발급: https://openrouter.ai/keys

---

## 🚀 가장 빠른 시작 (키 없이 체험 모드)

순서가 중요해요. **① 서버 → ② 브라우저 → ③ 드라이버**

```bash
# ── 터미널 A: 픽셀 오피스 서버 켜기 (저장소 루트에서, 최초 1회 빌드 필요) ──
cd <저장소 루트>
npm install                 # 처음 한 번만
npm run build               # 처음 한 번만 (dist/cli.js 생성)
node dist/cli.js --port 3100

# ── 브라우저: http://localhost:3100 열기 ──
#   설정(⚙️)에서 "Watch All Sessions" 를 켜요. (이러면 어디서 실행해도 캐릭터가 떠요)

# ── 터미널 B: 드라이버 체험 모드 (키 불필요) ──
cd driver
npm install                 # 처음 한 번만
npm run smoke
```

→ 브라우저에 **김대리·박사원·이주임**이 나타나 일을 시작합니다! 🎉

> ⚠️ **브라우저를 새로고침하지 마세요.** 새로고침하면 캐릭터가 사라져요(오피스 화면의 알려진 특성).
> 사라졌으면 터미널 B의 드라이버를 Ctrl+C 후 다시 실행하면 됩니다.

---

## 🤖 진짜 AI로 돌리기 (OpenRouter 키 필요)

```bash
cd driver
cp .env.example .env        # 그리고 .env 파일을 열어 OPENROUTER_API_KEY=... 입력
npm run start:env
```

`config.ts` 의 3개 모델(라마/퀀/미니스트랄)이 각자 "다음 행동"을 정해서 움직여요.

---

## ⚙️ 설정 (환경변수, 전부 선택)

`driver/.env` 에 넣어요. 안 넣으면 기본값으로 동작합니다.

| 변수 | 기본 | 설명 |
|------|------|------|
| `OPENROUTER_API_KEY` | (없음) | 진짜 AI로 돌릴 때 필요. 체험 모드(smoke)는 불필요 |
| `PIXEL_WORKSPACE` | 실행 폴더 | 캐릭터를 띄울 기준 경로. 서버와 다르면 Watch All Sessions 를 켜세요 |
| `PIXEL_AGENTS_FILE` | `agents.json` | 에이전트 정의 파일 경로(F1). 없으면 cwd/agents.json, 그것도 없으면 코드 기본값 |
| `PIXEL_LANG` | `ko` | 드라이버 로그/업무 문구 언어(F6). 영어는 `en` |
| `PIXEL_PANEL` | (켜짐) | 화면에서 모델 선택 연동(F5). 끄려면 `0` |
| `PIXEL_LOOP_INTERVAL_MS` | 4000 | 행동 1번 사이 쉬는 시간(최소 1000). 키우면 비용↓ |
| `PIXEL_MAX_CONCURRENCY` | 2 | AI 동시 호출 최대 개수(비용/429 보호) |
| `PIXEL_BACKOFF_BASE_MS` | 2000 | 호출 실패 시 첫 대기. 실패할수록 2배씩 늘어남 |
| `PIXEL_BACKOFF_MAX_MS` | 30000 | 대기 상한 |

---

## ✨ 신규 기능 (F1~F6)

1차 PoC(F1 이전) 위에 추가된 기능들입니다. 자세한 설계는 `docs/PLAN_2.md`, `docs/adr/ADR-013~020`, `docs/reports/STAGE-F*` 참고.

### F1 — 에이전트 정의 외부화 (`agents.json`)
코드를 고치지 않고 에이전트를 추가/수정합니다. `copy agents.example.json agents.json` 후 편집.
잘못된 설정(이름 중복·model 누락·타입 오류)은 **위치를 포함한 친절한 한국어 에러**로 즉시 알려줍니다.
```jsonc
[
  { "name": "김대리", "model": "meta-llama/llama-3.2-3b-instruct",
    "persona": "꼼꼼한 성격",                         // F2
    "skillFile": "skills/example-김대리.md",          // F3
    "fallbackModels": ["qwen/qwen-2.5-7b-instruct"] } // F4
]
```

### F2 — 페르소나(성격/말투)
`persona` 를 적으면 시스템 프롬프트에 성격이 주입되어 행동·이유(reason)에 반영됩니다.

### F3 — SKILL.md 참조
`skillFile` 경로의 마크다운(역할·규칙)을 참고 자료로 주입합니다. 길이 상한(기본 4000자)으로 토큰 비용을 보호하고, 파일이 없어도 안전하게 동작합니다.

### F4 — 모델 폴백(자동 대체)
영구 에러(404/402/401)면 `fallbackModels` 로 **자동 전환**해 멈추지 않습니다. 일시 에러(429/5xx)는 기존 지수 백오프로 재시도합니다.

### F5 — 화면에서 모델 선택
브라우저 **설정(⚙️) → "Agent Models"** 드롭다운에서 에이전트별 모델을 바꾸면 **다음 행동부터 즉시 적용**됩니다.
드라이버가 1.5초 주기로 모델 상태를 서버에 보고하고(`POST /api/driver/state`), 변경 명령을 폴링(`GET /api/driver/commands`)합니다. 끄려면 `PIXEL_PANEL=0`.

### F6 — 한↔영 전환
- **화면 UI**: 설정 → **"한국어"** 토글로 Settings 텍스트를 ko/en 전환(localStorage 유지).
- **드라이버 로그**: `PIXEL_LANG=en` 으로 업무 로그를 영어로(`📖 Looking at config.ts`).
- (참고: 오피스 캔버스의 활동 라벨 "Reading…"은 서버 공유 부분이라 영어 유지.)

> 단계별 리얼테스트 방법은 👉 **[docs/리얼테스트_가이드.md](docs/리얼테스트_가이드.md)**

---

## 🛠️ 명령어 모음

| 명령 | 하는 일 |
|------|---------|
| `npm run smoke` | 키 없이 체험(가짜 AI가 정해진 행동 반복) |
| `npm start` / `npm run start:env` | 진짜 OpenRouter로 구동(.env 키 사용) |
| `npm run check:integration` | 서버 연결 자동 점검(훅 200/채택 확인 후 종료) |
| `npm test` | 단위 테스트 전체(98개) |
| `npm run build` | 타입 체크 |

---

## 🆘 안 될 때 (자주 묻는 질문)

| 증상 | 원인 | 해결 |
|------|------|------|
| `server.json 을 찾을 수 없습니다` | 서버가 안 켜짐 | 터미널 A에서 `node dist/cli.js` 실행했는지 확인 |
| 캐릭터가 안 보임 | 브라우저가 캐릭터 생성 전에 연결됨/새로고침함 | 순서대로(서버→브라우저→드라이버), **새로고침 금지**, 안 되면 드라이버 재시작 |
| 캐릭터가 잠깐 보였다 사라짐 | 워크스페이스 불일치로 채택 안 됨 | 오피스 설정에서 **Watch All Sessions** 켜기 |
| `OPENROUTER_API_KEY 환경변수가 필요합니다` | 키 없이 `start` 실행 | 체험은 `npm run smoke`, 진짜는 `.env`에 키 넣고 `start:env` |
| `npx pixel-agents` 가 안 됨 | npm 배포본엔 CLI가 없음(구버전) | 이 저장소를 빌드해 `node dist/cli.js` 사용 |
| 바닥/가구 없이 **분홍(마젠타)** 화면 | 저장된 `layout.json` 손상 | `~/.pixel-agents/layout.json` 삭제 후 새로고침(기본 레이아웃 복구) |
| 설정에 **Agent Models** 가 안 보임 | 드라이버 미실행/새로고침함 | 드라이버 실행 중인지, 새로고침 안 했는지 확인(F5는 연결 후 보고) |
| 화면 라벨이 전부 `driver` | 에이전트 이름은 **터미널 로그**에만 표시(현 사양) | 이름은 창 B 로그에서 확인(오피스 표시는 향후 기능) |

더 자세한 안내는 👉 **[docs/사용설명서.md](docs/사용설명서.md)**

---

## 📁 폴더 구조

```
driver/
  src/
    index.ts        진입점: N명 병렬 구동 + 종료 처리
    config.ts       에이전트 정의(이름/모델) + 환경변수 설정
    agent.ts        에이전트 1명의 행동 루프
    openrouter.ts   OpenRouter 호출 + 안전 파싱
    actions.ts      행동 → 도구이름 + 한국어 문구
    office.ts       서버 연동(server.json/훅 POST/JSONL)
    logger.ts       한국어 컬러 로그
    backoff.ts      지수 백오프
    semaphore.ts    동시 호출 제한
  scripts/
    smoke.ts             체험 모드(무한)
    integration-check.ts 자동 점검(종료형)
  __tests__/        단위 테스트(98개)
  docs/
    사용설명서.md      ← 초보자용 상세 매뉴얼
    PLAN 관련/ADR/리포트
```

---

## 🧱 설계 결정 (ADR)

`docs/adr/` 에 결정 기록이 있어요.

| ADR | 제목 |
|-----|------|
| 001 | 픽셀 오피스 연동 계약 고정 |
| 002 | 캐릭터 등장 방식(JSONL + 훅) |
| 003 | 네트워크/파일 IO 의존성 주입 |
| 004 | SLM 출력 안정화(enum+JSON+폴백) |
| 005 | 에이전트별 모델·키 주입 |
| 006 | 한국어 문구는 고정 템플릿 |
| 007 | 행동 루프 타이밍 |
| 008 | PoC는 실제 파일 미조작 |
| 009 | 종료 시 SessionEnd |
| 010 | 에이전트 격리 |
| 011 | 비용·레이트리밋 정책 |
| 012 | 공개 범위·비밀 관리 |
| 013 | 에이전트 정의 외부화(agents.json) — F1 |
| 014 | 페르소나 주입 — F2 |
| 015 | SKILL.md 컨텍스트 주입(길이 상한) — F3 |
| 016 | 에러 분류와 모델 폴백 — F4 |
| 017 | 모델 런타임 hot-swap — F5 |
| 018 | i18n 한↔영(웹뷰 UI + 드라이버 로그) — F6 |
| 019 | server↔driver 제어 채널(보고+명령 폴링) — F5 |
| 020 | AsyncAPI 프로토콜 확장 절차 — F5 |

---

## 🔐 비밀 관리

- API 키는 **`driver/.env`** 에만 넣고, 이 파일은 `.gitignore` 로 **git에 올라가지 않습니다.**
- 저장소에는 절대 키를 커밋하지 마세요. 예시는 `.env.example` 참고.

## 📜 라이선스

MIT (상위 pixel-agents 프로젝트와 동일).
