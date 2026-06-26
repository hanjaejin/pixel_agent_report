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
| `PIXEL_LOOP_INTERVAL_MS` | 4000 | 행동 1번 사이 쉬는 시간(최소 1000). 키우면 비용↓ |
| `PIXEL_MAX_CONCURRENCY` | 2 | AI 동시 호출 최대 개수(비용/429 보호) |
| `PIXEL_BACKOFF_BASE_MS` | 2000 | 호출 실패 시 첫 대기. 실패할수록 2배씩 늘어남 |
| `PIXEL_BACKOFF_MAX_MS` | 30000 | 대기 상한 |

---

## 🛠️ 명령어 모음

| 명령 | 하는 일 |
|------|---------|
| `npm run smoke` | 키 없이 체험(가짜 AI가 정해진 행동 반복) |
| `npm start` / `npm run start:env` | 진짜 OpenRouter로 구동(.env 키 사용) |
| `npm run check:integration` | 서버 연결 자동 점검(훅 200/채택 확인 후 종료) |
| `npm test` | 단위 테스트 전체 |
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
  __tests__/        단위 테스트(58개)
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

---

## 🔐 비밀 관리

- API 키는 **`driver/.env`** 에만 넣고, 이 파일은 `.gitignore` 로 **git에 올라가지 않습니다.**
- 저장소에는 절대 키를 커밋하지 마세요. 예시는 `.env.example` 참고.

## 📜 라이선스

MIT (상위 pixel-agents 프로젝트와 동일).
