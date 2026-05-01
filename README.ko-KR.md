<div align="center">

# GET SHIT DONE

[English](README.md) · [Português](README.pt-BR.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md) · **한국어**

**Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment, Trae, Cline을 위한 가볍고 강력한 메타 프롬프팅, 컨텍스트 엔지니어링, 스펙 기반 개발 시스템.**

**컨텍스트 rot를 해결합니다 — Claude의 컨텍스트 창이 채워질수록 품질이 저하되는 문제.**

[![npm version](https://img.shields.io/npm/v/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![npm downloads](https://img.shields.io/npm/dm/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![Tests](https://img.shields.io/github/actions/workflow/status/gsd-build/get-shit-done/test.yml?branch=main&style=for-the-badge&logo=github&label=Tests)](https://github.com/gsd-build/get-shit-done/actions/workflows/test.yml)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/mYgfVNfA2r)
[![X (Twitter)](https://img.shields.io/badge/X-@gsd__foundation-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/gsd_foundation)
[![$GSD Token](https://img.shields.io/badge/$GSD-Dexscreener-1C1C1C?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzAwRkYwMCIvPjwvc3ZnPg==&logoColor=00FF00)](https://dexscreener.com/solana/dwudwjvan7bzkw9zwlbyv6kspdlvhwzrqy6ebk8xzxkv)
[![GitHub stars](https://img.shields.io/github/stars/gsd-build/get-shit-done?style=for-the-badge&logo=github&color=181717)](https://github.com/gsd-build/get-shit-done)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx get-shit-done-cc@latest
```

**Mac, Windows, Linux 모두 지원.**

<br>

![GSD Install](assets/terminal.svg)

<br>

*"원하는 게 뭔지 명확하게 알고 있다면, 이게 진짜로 만들어줍니다. 과장 없이."*

*"SpecKit, OpenSpec, Taskmaster 다 써봤는데 — 지금까지 이게 제일 결과가 좋았어요."*

*"Claude Code에 추가한 것 중 단연 가장 강력합니다. 과하게 엔지니어링하지 않고, 말 그대로 그냥 해냅니다."*

<br>

**Amazon, Google, Shopify, Webflow 엔지니어들이 신뢰합니다.**

[왜 만들었나](#왜-만들었나) · [작동 방식](#작동-방식) · [명령어](#명령어) · [왜 효과적인가](#왜-효과적인가) · [사용자 가이드](docs/ko-KR/USER-GUIDE.md)

</div>

---

## 왜 만들었나

저는 솔로 개발자입니다. 코드는 제가 아니라 Claude Code가 씁니다.

스펙 기반 개발 도구가 없는 건 아닙니다. BMAD, Speckit 같은 것들이 있죠. 근데 다들 필요 이상으로 복잡합니다 — 스프린트 세리머니, 스토리 포인트, 이해관계자 싱크, 회고, 지라 워크플로우. 저는 50인 규모 소프트웨어 회사가 아니에요. 기업 연극을 하고 싶지 않습니다. 그냥 좋은 걸 만들고 싶은 사람입니다.

그래서 GSD를 만들었습니다. 복잡함은 시스템 안에 있습니다. 워크플로우에 있는 게 아니라. 뒤에서 컨텍스트 엔지니어링, XML 프롬프트 포맷팅, 서브에이전트 오케스트레이션, 상태 관리가 돌아갑니다. 겉에서 보이는 건 그냥 몇 가지 명령어뿐입니다.

시스템이 Claude한테 작업하는 데 필요한 것과 검증하는 데 필요한 것을 모두 줍니다. 저는 이 워크플로우를 믿습니다. 그냥 잘 됩니다.

이게 전부입니다. 기업 역할극 같은 건 없습니다. Claude Code를 일관성 있게 쓰기 위한, 진짜로 잘 되는 시스템입니다.

— **TÂCHES**

---

바이브코딩은 평판이 안 좋습니다. 원하는 걸 설명하면 AI가 코드를 생성하는데, 규모가 커지면 엉망이 되는 일관성 없는 쓰레기가 나옵니다.

GSD가 그걸 고칩니다. Claude Code를 신뢰할 수 있게 만드는 컨텍스트 엔지니어링 레이어입니다. 아이디어를 설명하면 시스템이 필요한 걸 다 뽑아내고, Claude Code가 일을 시작합니다.

---

## 이게 누구를 위한 건가

원하는 걸 설명하면 제대로 만들어지길 바라는 사람들 — 50인 규모 엔지니어링 조직인 척하지 않아도 되는.

내장 품질 게이트가 실제 문제를 잡아냅니다: 스키마 드리프트 감지는 마이그레이션 누락된 ORM 변경을 플래그하고, 보안 강제는 검증을 위협 모델에 고정시키고, 스코프 축소 감지는 플래너가 요구사항을 몰래 빠뜨리는 걸 방지합니다.

### v1.39.0 하이라이트

전체 목록은 [v1.39.0 릴리스 노트](https://github.com/gsd-build/get-shit-done/releases/tag/v1.39.0)를 참고하세요.

- **`--minimal` 설치 프로파일** — 별칭 `--core-only`. 메인 루프 6개 스킬(`new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `help`, `update`)만 설치하고 `gsd-*` 서브에이전트는 설치하지 않음. 콜드 스타트 시스템 프롬프트 오버헤드를 ~12k 토큰에서 ~700 토큰으로 축소(≥94% 감소). 32K–128K 컨텍스트의 로컬 LLM이나 토큰 과금 API에 유용.
- **`/gsd-edit-phase`** — `ROADMAP.md`에 있는 기존 단계의 임의 필드를 그 자리에서 수정(번호와 위치는 변경되지 않음). `--force`는 확인 diff를 건너뛰고, `depends_on` 참조를 검증하며 쓰기 시 `STATE.md`도 갱신.
- **머지 후 빌드 & 테스트 게이트** — `execute-phase` 5.6 단계가 `workflow.build_command` 설정을 우선 자동 감지하고, 없으면 Xcode(`.xcodeproj`), Makefile, Justfile, Cargo, Go, Python, npm 순으로 폴백. Xcode/iOS 프로젝트는 `xcodebuild build` 및 `xcodebuild test`를 자동 실행. 병렬·직렬 모드 모두에서 동작.
- **런타임별 리뷰 모델 선택** — `review.models.<cli>`로 각 외부 리뷰 CLI(codex, gemini 등)가 플래너/실행 프로파일과 독립적으로 자체 모델을 선택할 수 있음.
- **워크스트림 설정 상속** — `GSD_WORKSTREAM`이 설정되면 루트 `.planning/config.json`을 먼저 로드한 뒤 워크스트림 설정을 딥 머지(충돌 시 워크스트림 우선). 워크스트림 설정에서 명시적 `null`은 루트 값을 덮어씀.
- **수동 카나리 릴리스 워크플로** — `.github/workflows/canary.yml`이 `workflow_dispatch`로 `dev` 브랜치에서 `{base}-canary.{N}` 빌드를 `@canary` dist-tag로 수동 게시(`get-shit-done-cc`와 `@gsd-build/sdk`).
- **스킬 통합: 86 → 59** — 4개의 새로운 그룹 스킬(`capture`, `phase`, `config`, `workspace`)이 31개의 마이크로 스킬을 흡수. 기존 6개의 부모 스킬은 래퍼업/하위 동작을 플래그로 흡수: `update --sync/--reapply`, `sketch --wrap-up`, `spike --wrap-up`, `map-codebase --fast/--query`, `code-review --fix`, `progress --do/--next`. 기능 손실 없음.

---

## 시작하기

```bash
npx get-shit-done-cc@latest
```

설치 중에 다음을 선택합니다:
1. **런타임** — Claude Code, OpenCode, Gemini, Kilo, Codex, Copilot, Cursor, Windsurf, Antigravity, Augment, Trae, Cline, 또는 전체 (대화형 다중 선택 — 한 번에 여러 런타임 선택 가능)
2. **위치** — 전역 (모든 프로젝트) 또는 로컬 (현재 프로젝트만)

설치가 됐는지 확인하려면:
- Claude Code / Gemini / Copilot / Antigravity: `/gsd-help`
- OpenCode / Kilo / Augment / Trae: `/gsd-help`
- Codex: `$gsd-help`
- Cline: GSD는 `.clinerules`를 통해 설치 — `.clinerules` 존재 여부 확인

> [!NOTE]
> Claude Code 2.1.88+와 Codex는 스킬(`skills/gsd-*/SKILL.md`)로 설치됩니다. Cline은 `.clinerules`를 사용합니다. 설치 프로그램이 모든 형식을 자동으로 처리합니다.

> [!TIP]
> 소스 기반 설치 또는 npm을 사용할 수 없는 환경은 **[docs/manual-update.md](docs/manual-update.md)**를 참조하세요.

### 업데이트 유지

GSD는 빠르게 발전합니다. 주기적으로 업데이트하세요:

```bash
npx get-shit-done-cc@latest
```

<details>
<summary><strong>비대화형 설치 (Docker, CI, 스크립트)</strong></summary>

```bash
# Claude Code
npx get-shit-done-cc --claude --global   # ~/.claude/에 설치
npx get-shit-done-cc --claude --local    # ./.claude/에 설치

# OpenCode
npx get-shit-done-cc --opencode --global # ~/.config/opencode/에 설치

# Gemini CLI
npx get-shit-done-cc --gemini --global   # ~/.gemini/에 설치

# Kilo
npx get-shit-done-cc --kilo --global     # ~/.config/kilo/에 설치
npx get-shit-done-cc --kilo --local      # ./.kilo/에 설치

# Codex
npx get-shit-done-cc --codex --global    # ~/.codex/에 설치
npx get-shit-done-cc --codex --local     # ./.codex/에 설치

# Copilot
npx get-shit-done-cc --copilot --global  # ~/.github/에 설치
npx get-shit-done-cc --copilot --local   # ./.github/에 설치

# Cursor CLI
npx get-shit-done-cc --cursor --global      # ~/.cursor/에 설치
npx get-shit-done-cc --cursor --local       # ./.cursor/에 설치

# Antigravity
npx get-shit-done-cc --antigravity --global # ~/.gemini/antigravity/에 설치
npx get-shit-done-cc --antigravity --local  # ./.agent/에 설치

# Augment
npx get-shit-done-cc --augment --global     # ~/.augment/에 설치
npx get-shit-done-cc --augment --local      # ./.augment/에 설치

# Trae
npx get-shit-done-cc --trae --global        # ~/.trae/에 설치
npx get-shit-done-cc --trae --local         # ./.trae/에 설치

# Cline
npx get-shit-done-cc --cline --global       # ~/.cline/에 설치
npx get-shit-done-cc --cline --local        # ./.clinerules에 설치

# 전체 런타임
npx get-shit-done-cc --all --global      # 모든 디렉터리에 설치
```

위치 프롬프트 건너뛰기: `--global` (`-g`) 또는 `--local` (`-l`).
런타임 프롬프트 건너뛰기: `--claude`, `--opencode`, `--gemini`, `--kilo`, `--codex`, `--copilot`, `--cursor`, `--windsurf`, `--antigravity`, `--augment`, `--trae`, `--cline`, 또는 `--all`.

</details>

<details>
<summary><strong>개발 설치</strong></summary>

저장소를 클론하고 설치 프로그램을 로컬에서 실행합니다:

```bash
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done
node bin/install.js --claude --local
```

기여 전 수정사항 테스트를 위해 `./.claude/`에 설치됩니다.

</details>

### 권장: 권한 확인 건너뛰기 모드

GSD는 마찰 없는 자동화를 위해 설계되었습니다. Claude Code를 다음과 같이 실행하세요:

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> 이게 GSD를 사용하는 방법입니다 — `date`와 `git commit` 50번을 승인하러 멈추면 의미가 없습니다.

<details>
<summary><strong>대안: 세분화된 권한</strong></summary>

해당 플래그를 쓰지 않으려면 프로젝트의 `.claude/settings.json`에 다음을 추가하세요:

```json
{
  "permissions": {
    "allow": [
      "Bash(date:*)",
      "Bash(echo:*)",
      "Bash(cat:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(wc:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(sort:*)",
      "Bash(grep:*)",
      "Bash(tr:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git tag:*)"
    ]
  }
}
```

</details>

---

## 작동 방식

> **이미 코드가 있나요?** 먼저 `/gsd-map-codebase`를 실행하세요. 병렬 에이전트를 생성해 스택, 아키텍처, 컨벤션, 고려사항을 분석합니다. 그러면 `/gsd-new-project`가 코드베이스를 파악한 상태에서 시작되고 — 질문은 추가하는 것에 집중되고, 기획 시 자동으로 기존 패턴을 불러옵니다.

### 1. 프로젝트 초기화

```
/gsd-new-project
```

명령어 하나, 플로우 하나. 시스템이:

1. **질문** — 아이디어를 완전히 이해할 때까지 물어봅니다 (목표, 제약사항, 기술 선호도, 엣지 케이스)
2. **리서치** — 도메인 조사를 위해 병렬 에이전트를 생성합니다 (선택사항이지만 권장)
3. **요구사항** — v1, v2, 스코프 밖을 추출합니다
4. **로드맵** — 요구사항에 매핑된 단계를 생성합니다

로드맵을 승인하면 이제 만들 준비가 됩니다.

**생성 파일:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `.planning/research/`

---

### 2. 단계 논의

```
/gsd-discuss-phase 1
```

**여기서 구현을 직접 설계합니다.**

로드맵에는 단계당 한두 문장이 있습니다. 그건 *당신이 상상하는 방식*으로 뭔가를 만들기에 충분한 컨텍스트가 아닙니다. 리서치나 기획이 시작되기 전에 원하는 방향을 미리 잡아두는 단계입니다.

시스템이 단계를 분석하고 만들어지는 것에 기반한 회색 지대를 식별합니다:

- **시각적 기능** → 레이아웃, 밀도, 인터랙션, 빈 상태
- **API/CLI** → 응답 형식, 플래그, 오류 처리, 상세도
- **콘텐츠 시스템** → 구조, 톤, 깊이, 흐름
- **조직 작업** → 그룹화 기준, 이름 지정, 중복, 예외

선택한 각 영역에 대해 만족할 때까지 물어봅니다. 결과물인 `CONTEXT.md`는 다음 두 단계에 바로 쓰입니다.

1. **리서처가 읽습니다** — 어떤 패턴을 조사할지 파악합니다 ("카드 레이아웃 원함" → 카드 컴포넌트 라이브러리 리서치)
2. **플래너가 읽습니다** — 어떤 결정이 확정됐는지 파악합니다 ("무한 스크롤 결정됨" → 플랜에 스크롤 처리 포함)

여기서 깊이 들어갈수록 시스템이 실제로 원하는 것에 더 가깝게 만듭니다. 건너뛰면 합리적인 기본값을 얻습니다. 사용하면 *당신의* 비전을 얻습니다.

**생성 파일:** `{phase_num}-CONTEXT.md`

> **가정 모드:** 질문보다 코드베이스 분석을 선호하나요? `/gsd-settings`에서 `workflow.discuss_mode`를 `assumptions`로 설정하세요. 시스템이 코드를 읽고 하려는 것과 이유를 제시한 다음 틀린 부분만 수정을 요청합니다. [논의 모드](docs/ko-KR/workflow-discuss-mode.md) 참조.

---

### 3. 단계 기획

```
/gsd-plan-phase 1
```

시스템이:

1. **리서치** — CONTEXT.md 결정사항을 기반으로 구현 방법을 조사합니다
2. **기획** — XML 구조로 2~3개의 원자적 작업 계획을 생성합니다
3. **검증** — 요구사항 대비 계획을 확인하고, 통과할 때까지 반복합니다

각 계획은 새로운 컨텍스트 창에서 실행할 수 있을 만큼 작습니다. 저하 없이, "이제 더 간결하게 하겠습니다" 같은 말도 없습니다.

**생성 파일:** `{phase_num}-RESEARCH.md`, `{phase_num}-{N}-PLAN.md`

---

### 4. 단계 실행

```
/gsd-execute-phase 1
```

시스템이:

1. **웨이브로 계획 실행** — 가능한 경우 병렬, 의존성 있으면 순차
2. **계획당 새로운 컨텍스트** — 20만 토큰이 순수하게 구현을 위해, 쌓인 쓰레기 없음
3. **작업당 커밋** — 모든 작업이 고유한 원자적 커밋을 가짐
4. **목표 대비 검증** — 코드베이스가 단계에서 약속한 것을 전달했는지 확인

자리를 비우고 돌아오면 깔끔한 git 이력과 함께 완성된 작업이 기다립니다.

**웨이브 실행 방식:**

계획은 의존성에 따라 "웨이브"로 그룹화됩니다. 각 웨이브 안에서 계획이 병렬로 실행됩니다. 웨이브는 순차적으로 실행됩니다.

```
┌────────────────────────────────────────────────────────────────────┐
│  단계 실행                                                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  웨이브 1 (병렬)           웨이브 2 (병렬)           웨이브 3       │
│  ┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐ │
│  │ 플랜 01 │ │ 플랜 02 │ →  │ 플랜 03 │ │ 플랜 04 │ →  │ 플랜 05 │ │
│  │         │ │         │    │         │ │         │    │         │ │
│  │  유저   │ │  제품   │    │  주문   │ │  장바구니│   │  결제   │ │
│  │  모델   │ │  모델   │    │  API   │ │  API   │    │  UI    │ │
│  └─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘ │
│       │           │              ↑           ↑              ↑      │
│       └───────────┴──────────────┴───────────┘              │      │
│              의존성: 플랜 03은 플랜 01 필요                  │      │
│                     플랜 04는 플랜 02 필요                          │
│                     플랜 05는 플랜 03 + 04 필요                     │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**웨이브가 중요한 이유:**
- 독립 계획 → 같은 웨이브 → 병렬 실행
- 의존 계획 → 이후 웨이브 → 의존성 대기
- 파일 충돌 → 순차 계획 또는 같은 계획

그래서 "수직 슬라이스" (플랜 01: 유저 기능 엔드투엔드)가 "수평 레이어" (플랜 01: 모든 모델, 플랜 02: 모든 API)보다 더 잘 병렬화됩니다.

**생성 파일:** `{phase_num}-{N}-SUMMARY.md`, `{phase_num}-VERIFICATION.md`

---

### 5. 작업 검증

```
/gsd-verify-work 1
```

**여기서 실제로 작동하는지 확인합니다.**

자동화된 검증은 코드가 존재하고 테스트가 통과하는지 확인합니다. 하지만 기능이 *당신이 기대하는 방식*으로 작동하나요? 직접 사용해볼 기회입니다.

시스템이:

1. **테스트 가능한 결과물 추출** — 지금 뭘 할 수 있어야 하는지
2. **하나씩 안내** — "이메일로 로그인할 수 있나요?" 예/아니오, 또는 뭐가 잘못됐는지 설명
3. **실패 자동 진단** — 근본 원인을 찾기 위해 디버그 에이전트 생성
4. **검증된 수정 계획 생성** — 즉시 재실행 준비 완료

모든 게 통과하면 다음으로 넘어갑니다. 뭔가 깨졌으면 직접 디버그하지 않아도 됩니다 — 생성된 수정 계획으로 `/gsd-execute-phase`만 다시 실행하면 됩니다.

**생성 파일:** `{phase_num}-UAT.md`, 문제 발견 시 수정 계획

---

### 6. 반복 → 출시 → 완료 → 다음 마일스톤

```
/gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
/gsd-ship 2                  # 검증된 작업으로 PR 생성
...
/gsd-complete-milestone
/gsd-new-milestone
```

또는 GSD가 다음 단계를 자동으로 파악하게 합니다:

```
/gsd-next                    # 다음 단계 자동 감지 및 실행
```

마일스톤이 완료될 때까지 **논의 → 기획 → 실행 → 검증 → 출시** 반복.

논의 중에 더 빠르게 진행하고 싶다면 `/gsd-discuss-phase <n> --batch`를 사용해 하나씩이 아닌 소그룹으로 한 번에 답할 수 있습니다. `--chain`을 사용하면 논의에서 기획+실행까지 중간에 멈추지 않고 자동 체이닝됩니다.

각 단계는 사용자 입력(논의), 적절한 리서치(기획), 깔끔한 실행(실행), 사람의 검증(검증)을 거칩니다. 컨텍스트는 새롭게 유지됩니다. 품질도 높게 유지됩니다.

모든 단계가 끝나면 `/gsd-complete-milestone`이 마일스톤을 아카이브하고 릴리스에 태그를 답니다.

그다음 `/gsd-new-milestone`으로 다음 버전을 시작합니다 — `new-project`와 같은 흐름이지만 기존 코드베이스를 위한 것입니다. 다음에 만들 것을 설명하면 시스템이 도메인을 리서치하고, 요구사항을 스코핑하고, 새 로드맵을 만듭니다. 각 마일스톤은 깔끔한 사이클입니다: 정의 → 구축 → 출시.

---

### 빠른 모드

```
/gsd-quick
```

**전체 기획이 필요 없는 임시 작업용.**

빠른 모드는 GSD 보장 (원자적 커밋, 상태 추적)을 더 빠른 경로로 제공합니다:

- **같은 에이전트** — 플래너 + 실행기, 같은 품질
- **선택적 단계 건너뛰기** — 기본적으로 리서치, 계획 확인기, 검증기 없음
- **별도 추적** — `.planning/quick/`에 위치, 단계와 별개

**`--discuss` 플래그:** 기획 전 회색 지대를 파악하기 위한 가벼운 논의.

**`--research` 플래그:** 기획 전 집중 리서처를 생성합니다. 구현 접근법, 라이브러리 옵션, 주의사항을 조사합니다. 접근 방식이 불확실할 때 사용하세요.

**`--full` 플래그:** 모든 단계를 활성화 — 논의 + 리서치 + 계획 확인 + 검증. 빠른 작업 형태의 전체 GSD 파이프라인.

**`--validate` 플래그:** 계획 확인 + 실행 후 검증만 활성화 (이전 `--full`의 동작).

플래그는 조합 가능합니다: `--discuss --research --validate`은 논의 + 리서치 + 계획 확인 + 검증을 제공합니다.

```
/gsd-quick
> 뭘 하고 싶으신가요? "설정에 다크 모드 토글 추가"
```

**생성 파일:** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`, `SUMMARY.md`

---

## 왜 효과적인가

### 컨텍스트 엔지니어링

Claude Code는 컨텍스트만 제대로 주면 정말 강력합니다. 근데 대부분은 그걸 안 하죠.

GSD가 대신 해줍니다.

| 파일 | 역할 |
|------|--------------|
| `PROJECT.md` | 프로젝트 비전, 항상 로드 |
| `research/` | 생태계 지식 (스택, 기능, 아키텍처, 주의사항) |
| `REQUIREMENTS.md` | 단계 추적성이 있는 스코핑된 v1/v2 요구사항 |
| `ROADMAP.md` | 방향과 완료된 것 |
| `STATE.md` | 결정사항, 블로커, 위치 — 세션 간 메모리 |
| `PLAN.md` | XML 구조와 검증 단계가 있는 원자적 작업 |
| `SUMMARY.md` | 무슨 일이 있었는지, 무엇이 바뀌었는지, 이력에 커밋됨 |
| `todos/` | 나중 작업을 위해 캡처된 아이디어와 작업 |
| `threads/` | 여러 세션에 걸친 작업을 위한 지속적 컨텍스트 스레드 |
| `seeds/` | 때가 되면 자연스럽게 떠오르는 미래 아이디어 저장소 |

파일 크기는 Claude 품질이 떨어지기 시작하는 지점에 맞춰 설정했습니다. 그 안에 머물면 일관된 결과가 나옵니다.

### XML 프롬프트 포맷팅

모든 계획은 Claude에 최적화된 구조화된 XML입니다:

```xml
<task type="auto">
  <name>로그인 엔드포인트 생성</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    JWT에는 jose 사용 (jsonwebtoken 아님 - CommonJS 이슈).
    users 테이블 대비 자격증명 검증.
    성공 시 httpOnly 쿠키 반환.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login이 200 + Set-Cookie 반환</verify>
  <done>유효한 자격증명은 쿠키 반환, 무효는 401 반환</done>
</task>
```

정확한 지시사항. 추측 없음. 검증 내장.

### 멀티 에이전트 오케스트레이션

모든 단계는 같은 패턴입니다. 얇은 오케스트레이터가 전문화된 에이전트를 띄우고 결과를 모아 다음 단계로 넘깁니다.

| 단계 | 오케스트레이터가 하는 일 | 에이전트가 하는 일 |
|-------|------------------|-----------|
| 리서치 | 조율, 결과 제시 | 병렬로 4개의 리서처가 스택, 기능, 아키텍처, 주의사항 조사 |
| 기획 | 검증, 반복 관리 | 플래너가 계획 생성, 확인기가 검증, 통과할 때까지 반복 |
| 실행 | 웨이브 그룹화, 진행 추적 | 실행기가 병렬로 구현, 각각 새로운 20만 컨텍스트 |
| 검증 | 결과 제시, 다음 라우팅 | 검증기가 코드베이스를 목표 대비 확인, 디버거가 실패 진단 |

오케스트레이터는 무거운 작업을 직접 하지 않습니다. 에이전트를 띄우고 기다렸다가 결과를 합칩니다.

**결과:** 전체 단계를 다 돌릴 수 있습니다 — 깊은 리서치, 계획 생성과 검증, 병렬 실행기가 수천 줄 코드 작성, 자동화된 검증 — 근데 메인 컨텍스트 창은 30~40%에 머뭅니다. 실제 작업은 새 서브에이전트 컨텍스트에서 이루어지거든요. 세션이 끝까지 빠르고 반응적으로 유지되는 이유입니다.

### 원자적 Git 커밋

각 작업은 완료 직후 자체 커밋을 받습니다:

```bash
abc123f docs(08-02): complete user registration plan
def456g feat(08-02): add email confirmation flow
hij789k feat(08-02): implement password hashing
lmn012o feat(08-02): create registration endpoint
```

> [!NOTE]
> **장점:** Git bisect로 어느 작업에서 깨졌는지 정확히 찍어낼 수 있습니다. 작업 단위로 독립 revert가 됩니다. 다음 세션 Claude가 읽을 명확한 이력이 남습니다. AI 자동화 워크플로우를 한눈에 파악하기 좋습니다.

커밋 하나하나가 외과적이고 추적 가능하며 의미를 담고 있습니다.

### 모듈식 설계

- 현재 마일스톤에 단계 추가
- 단계 사이에 긴급 작업 삽입
- 마일스톤 완료 후 새로 시작
- 전부 다시 만들지 않고 계획 조정

절대 갇히지 않습니다. 시스템이 적응합니다.

---

## 명령어

### 핵심 워크플로우

| 명령어 | 역할 |
|---------|------------|
| `/gsd-new-project [--auto]` | 전체 초기화: 질문 → 리서치 → 요구사항 → 로드맵 |
| `/gsd-discuss-phase [N] [--auto] [--analyze] [--chain]` | 기획 전 구현 결정 캡처 (`--analyze`는 트레이드오프 분석 추가, `--chain`은 기획+실행으로 자동 체이닝) |
| `/gsd-plan-phase [N] [--auto] [--reviews]` | 단계에 대한 리서치 + 기획 + 검증 (`--reviews`는 코드베이스 리뷰 결과 로드) |
| `/gsd-execute-phase <N>` | 병렬 웨이브로 모든 계획 실행, 완료 시 검증 |
| `/gsd-verify-work [N]` | 수동 사용자 인수 테스트 ¹ |
| `/gsd-ship [N] [--draft]` | 자동 생성된 본문으로 검증된 단계 작업에서 PR 생성 |
| `/gsd-next` | 다음 논리적 워크플로우 단계로 자동 진행 |
| `/gsd-fast <text>` | 인라인 사소한 작업 — 기획 완전 건너뛰고 즉시 실행 |
| `/gsd-audit-milestone` | 마일스톤이 완료 정의를 달성했는지 검증 |
| `/gsd-complete-milestone` | 마일스톤 아카이브, 릴리스 태그 |
| `/gsd-new-milestone [name]` | 다음 버전 시작: 질문 → 리서치 → 요구사항 → 로드맵 |
| `/gsd-forensics [desc]` | 실패한 워크플로우 실행의 사후 조사 (막힌 루프, 누락된 아티팩트, git 이상 진단) |
| `/gsd-milestone-summary [version]` | 팀 온보딩 및 리뷰를 위한 종합 프로젝트 요약 생성 |

### 워크스트림

| 명령어 | 역할 |
|---------|------------|
| `/gsd-workstreams list` | 모든 워크스트림과 상태 표시 |
| `/gsd-workstreams create <name>` | 병렬 마일스톤 작업을 위한 네임스페이스 워크스트림 생성 |
| `/gsd-workstreams switch <name>` | 활성 워크스트림 전환 |
| `/gsd-workstreams complete <name>` | 워크스트림 완료 및 병합 |

### 멀티 프로젝트 워크스페이스

| 명령어 | 역할 |
|---------|------------|
| `/gsd-new-workspace` | 저장소 복사본으로 격리된 워크스페이스 생성 (worktrees 또는 clones) |
| `/gsd-list-workspaces` | 모든 GSD 워크스페이스와 상태 표시 |
| `/gsd-remove-workspace` | 워크스페이스 제거 및 worktree 정리 |

### UI 디자인

| 명령어 | 역할 |
|---------|------------|
| `/gsd-ui-phase [N]` | 프론트엔드 단계를 위한 UI 디자인 계약 (UI-SPEC.md) 생성 |
| `/gsd-ui-review [N]` | 구현된 프론트엔드 코드의 소급적 6가지 기준 시각 감사 |

### 탐색

| 명령어 | 역할 |
|---------|------------|
| `/gsd-progress` | 지금 어디에 있나? 다음은? |
| `/gsd-next` | 상태 자동 감지 및 다음 단계 실행 |
| `/gsd-help` | 모든 명령어와 사용 가이드 표시 |
| `/gsd-update` | 변경 로그 미리보기와 함께 GSD 업데이트 |
| `/gsd-join-discord` | GSD Discord 커뮤니티 참여 |
| `/gsd-manager` | 여러 단계 관리를 위한 대화형 커맨드 센터 |

### 브라운필드

| 명령어 | 역할 |
|---------|------------|
| `/gsd-map-codebase [area]` | new-project 전 기존 코드베이스 분석 |

### 단계 관리

| 명령어 | 역할 |
|---------|------------|
| `/gsd-add-phase` | 로드맵에 단계 추가 |
| `/gsd-insert-phase [N]` | 단계 사이에 긴급 작업 삽입 |
| `/gsd-edit-phase [N] [--force]` | 기존 단계의 임의 필드를 그 자리에서 수정 — 번호와 위치는 그대로 |
| `/gsd-remove-phase [N]` | 미래 단계 제거, 번호 재정렬 |
| `/gsd-list-phase-assumptions [N]` | 기획 전 Claude의 의도된 접근 방식 확인 |
| `/gsd-plan-milestone-gaps` | 감사에서 발견된 갭을 해소하기 위한 단계 생성 |

### 세션

| 명령어 | 역할 |
|---------|------------|
| `/gsd-pause-work` | 단계 중간에 멈출 때 핸드오프 생성 (HANDOFF.json 작성) |
| `/gsd-resume-work` | 마지막 세션에서 복원 |
| `/gsd-session-report` | 수행한 작업과 결과가 담긴 세션 요약 생성 |

### 코드 품질

| 명령어 | 역할 |
|---------|------------|
| `/gsd-review` | 현재 단계 또는 브랜치의 Cross-AI 피어 리뷰 |
| `/gsd-pr-branch` | `.planning/` 커밋을 필터링한 깔끔한 PR 브랜치 생성 |
| `/gsd-audit-uat` | 검증 부채 감사 — UAT가 누락된 단계 찾기 |

### 백로그 및 스레드

| 명령어 | 역할 |
|---------|------------|
| `/gsd-plant-seed <idea>` | 트리거 조건이 있는 아이디어 저장 — 때가 되면 알아서 올라옴 |
| `/gsd-add-backlog <desc>` | 백로그 파킹 롯에 아이디어 추가 (999.x 번호 지정, 활성 시퀀스 외부) |
| `/gsd-review-backlog` | 백로그 항목 리뷰 및 활성 마일스톤으로 승격하거나 오래된 항목 제거 |
| `/gsd-thread [name]` | 지속적 컨텍스트 스레드 — 여러 세션에 걸친 작업을 위한 가벼운 크로스 세션 지식 |

### 유틸리티

| 명령어 | 역할 |
|---------|------------|
| `/gsd-settings` | 모델 프로필 및 워크플로우 에이전트 설정 |
| `/gsd-set-profile <profile>` | 모델 프로필 전환 (quality/balanced/budget/inherit) |
| `/gsd-add-todo [desc]` | 나중을 위한 아이디어 캡처 |
| `/gsd-check-todos` | 대기 중인 할 일 목록 |
| `/gsd-debug [desc]` | 지속적 상태를 이용한 체계적 디버깅 |
| `/gsd-do <text>` | 자유 형식 텍스트를 적절한 GSD 명령어로 자동 라우팅 |
| `/gsd-note <text>` | 마찰 없는 아이디어 캡처 — 추가, 목록, 또는 할 일로 승격 |
| `/gsd-quick [--full] [--discuss] [--research]` | GSD 보장과 함께 임시 작업 실행 (`--full`은 전체 단계 활성화, `--discuss`는 먼저 컨텍스트 수집, `--research`는 기획 전 접근법 조사) |
| `/gsd-health [--repair]` | `.planning/` 디렉터리 무결성 검증, `--repair`로 자동 복구 |
| `/gsd-stats` | 프로젝트 통계 표시 — 단계, 계획, 요구사항, git 지표 |
| `/gsd-profile-user [--questionnaire] [--refresh]` | 개인화된 응답을 위해 세션 분석에서 개발자 행동 프로필 생성 |

<sup>¹ reddit 유저 OracleGreyBeard 기여</sup>

---

## 설정

GSD는 프로젝트 설정을 `.planning/config.json`에 저장합니다. `/gsd-new-project` 중에 설정하거나 나중에 `/gsd-settings`로 업데이트할 수 있습니다. 전체 config 스키마, 워크플로우 토글, git 브랜칭 옵션, 에이전트별 모델 분석은 [사용자 가이드](docs/ko-KR/USER-GUIDE.md#configuration-reference)를 참조하세요.

### 핵심 설정

| 설정 | 옵션 | 기본값 | 역할 |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | 각 단계 자동 승인 vs 확인 |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | 단계 세분성 — 스코프를 얼마나 세밀하게 나눌지 (단계 × 계획) |

### 모델 프로필

각 에이전트가 사용하는 Claude 모델을 제어합니다. 품질 대비 토큰 사용을 균형 잡습니다.

| 프로필 | 기획 | 실행 | 검증 |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced` (기본값) | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |
| `inherit` | 상속 | 상속 | 상속 |

프로필 전환:
```
/gsd-set-profile budget
```

비-Anthropic 제공업체 (OpenRouter, 로컬 모델) 사용 시 또는 현재 런타임 모델 선택을 따를 때 (예: OpenCode `/model`) `inherit`를 사용하세요.

또는 `/gsd-settings`를 통해 설정하세요.

### 워크플로우 에이전트

기획/실행 중에 추가 에이전트를 생성합니다. 품질을 향상시키지만 토큰과 시간이 더 필요합니다.

| 설정 | 기본값 | 역할 |
|---------|---------|--------------|
| `workflow.research` | `true` | 각 단계 기획 전 도메인 리서치 |
| `workflow.plan_check` | `true` | 실행 전 계획이 단계 목표를 달성하는지 확인 |
| `workflow.verifier` | `true` | 실행 후 필수 사항이 전달됐는지 확인 |
| `workflow.auto_advance` | `false` | 멈추지 않고 논의 → 기획 → 실행 자동 연결 |
| `workflow.research_before_questions` | `false` | 논의 질문 대신 리서치 먼저 실행 |
| `workflow.discuss_mode` | `'discuss'` | 논의 모드: `discuss` (인터뷰), `assumptions` (코드베이스 우선) |
| `workflow.skip_discuss` | `false` | 자율 모드에서 discuss-phase 건너뛰기 |
| `workflow.text_mode` | `false` | 원격 세션을 위한 텍스트 전용 모드 (TUI 메뉴 없음) |

`/gsd-settings`로 토글하거나 호출별로 재정의하세요:
- `/gsd-plan-phase --skip-research`
- `/gsd-plan-phase --skip-verify`

### 실행

| 설정 | 기본값 | 역할 |
|---------|---------|------------------|
| `parallelization.enabled` | `true` | 독립 계획 동시 실행 |
| `planning.commit_docs` | `true` | git에서 `.planning/` 추적 |
| `hooks.context_warnings` | `true` | 컨텍스트 창 사용 경고 표시 |

### Git 브랜칭

실행 중 GSD의 브랜치 처리 방식을 제어합니다.

| 설정 | 옵션 | 기본값 | 역할 |
|---------|---------|---------|--------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | 브랜치 생성 전략 |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | 단계 브랜치 템플릿 |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | 마일스톤 브랜치 템플릿 |

**전략:**
- **`none`** — 현재 브랜치에 커밋 (기본 GSD 동작)
- **`phase`** — 단계당 브랜치 생성, 단계 완료 시 병합
- **`milestone`** — 전체 마일스톤을 위한 하나의 브랜치 생성, 완료 시 병합

마일스톤 완료 시 GSD가 스쿼시 병합 (권장) 또는 이력과 함께 병합을 제안합니다.

---

## 보안

### 내장 보안 강화

GSD는 v1.27부터 심층 방어 보안을 포함합니다:

- **경로 순회 방지** — 모든 사용자 제공 파일 경로(`--text-file`, `--prd`)가 프로젝트 디렉터리 내에서 해석되도록 검증
- **프롬프트 인젝션 감지** — 중앙화된 `security.cjs` 모듈이 사용자 제공 텍스트가 기획 아티팩트에 들어가기 전 인젝션 패턴 스캔
- **PreToolUse 프롬프트 가드 훅** — `gsd-prompt-guard`가 `.planning/`에 대한 쓰기에서 내장된 인젝션 벡터 스캔 (권고적, 차단하지 않음)
- **안전한 JSON 파싱** — 잘못된 형식의 `--fields` 인수가 상태를 손상시키기 전에 캐치
- **셸 인수 검증** — 사용자 텍스트가 셸 보간 전에 살균됨
- **CI 준비 인젝션 스캐너** — `prompt-injection-scan.test.cjs`가 모든 에이전트/워크플로우/명령어 파일에서 내장된 인젝션 벡터 스캔

> [!NOTE]
> GSD는 LLM 시스템 프롬프트가 되는 마크다운 파일을 생성하기 때문에, 기획 아티팩트에 들어가는 사용자 제어 텍스트는 잠재적인 간접 프롬프트 인젝션 벡터가 됩니다. 이 보호 장치들은 여러 레이어에서 그런 벡터를 잡도록 설계되었습니다.

### 민감한 파일 보호

GSD의 코드베이스 매핑 및 분석 명령어는 프로젝트를 이해하기 위해 파일을 읽습니다. **비밀이 담긴 파일**을 Claude Code의 거부 목록에 추가해 보호하세요:

1. Claude Code 설정 열기 (`.claude/settings.json` 또는 전역)
2. 민감한 파일 패턴을 거부 목록에 추가:

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/*)",
      "Read(**/*credential*)",
      "Read(**/*.pem)",
      "Read(**/*.key)"
    ]
  }
}
```

이렇게 하면 실행하는 명령어와 관계없이 Claude가 이 파일들을 완전히 읽지 못합니다.

> [!IMPORTANT]
> GSD에는 비밀 커밋에 대한 내장 보호 장치가 있지만, 심층 방어가 모범 사례입니다. 민감한 파일에 대한 읽기 접근을 거부하는 것을 첫 번째 방어선으로 삼으세요.

---

## 문제 해결

**설치 후 명령어를 찾을 수 없나요?**
- 런타임을 재시작해 명령어/스킬을 다시 로드하세요
- `~/.claude/commands/gsd/` (전역) 또는 `./.claude/commands/gsd/` (로컬)에 파일이 있는지 확인하세요
- Codex의 경우 `~/.codex/skills/gsd-*/SKILL.md` (전역) 또는 `./.codex/skills/gsd-*/SKILL.md` (로컬)에 스킬이 있는지 확인하세요

**명령어가 예상대로 작동하지 않나요?**
- `/gsd-help`를 실행해 설치 확인
- `npx get-shit-done-cc`를 다시 실행해 재설치

**최신 버전으로 업데이트하나요?**
```bash
npx get-shit-done-cc@latest
```

**Docker 또는 컨테이너 환경을 사용하나요?**

파일 읽기가 틸드 경로(`~/.claude/...`)로 실패하면 설치 전에 `CLAUDE_CONFIG_DIR`를 설정하세요:
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-shit-done-cc --global
```
컨테이너에서 올바르게 확장되지 않을 수 있는 `~` 대신 절대 경로가 사용됩니다.

### 제거

GSD를 완전히 제거하려면:

```bash
# 전역 설치
npx get-shit-done-cc --claude --global --uninstall
npx get-shit-done-cc --opencode --global --uninstall
npx get-shit-done-cc --gemini --global --uninstall
npx get-shit-done-cc --kilo --global --uninstall
npx get-shit-done-cc --codex --global --uninstall
npx get-shit-done-cc --copilot --global --uninstall
npx get-shit-done-cc --cursor --global --uninstall
npx get-shit-done-cc --antigravity --global --uninstall
npx get-shit-done-cc --trae --global --uninstall

# 로컬 설치 (현재 프로젝트)
npx get-shit-done-cc --claude --local --uninstall
npx get-shit-done-cc --opencode --local --uninstall
npx get-shit-done-cc --gemini --local --uninstall
npx get-shit-done-cc --kilo --local --uninstall
npx get-shit-done-cc --codex --local --uninstall
npx get-shit-done-cc --copilot --local --uninstall
npx get-shit-done-cc --cursor --local --uninstall
npx get-shit-done-cc --antigravity --local --uninstall
npx get-shit-done-cc --trae --local --uninstall
```

다른 설정은 그대로 유지하면서 GSD의 모든 명령어, 에이전트, 훅, 설정을 제거합니다.

---

## 커뮤니티 포트

OpenCode, Gemini CLI, Kilo, Codex는 이제 `npx get-shit-done-cc`를 통해 기본 지원됩니다.

이 커뮤니티 포트들이 멀티 런타임 지원의 선구자였습니다:

| 프로젝트 | 플랫폼 | 설명 |
|---------|----------|-------------|
| [gsd-opencode](https://github.com/rokicool/gsd-opencode) | OpenCode | 최초 OpenCode 적응 |
| gsd-gemini (아카이브됨) | Gemini CLI | uberfuzzy의 최초 Gemini 적응 |

---

## 스타 히스토리

<a href="https://star-history.com/#gsd-build/get-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
 </picture>
</a>

---

## 라이선스

MIT 라이선스. 자세한 내용은 [LICENSE](LICENSE)를 참조하세요.

---

<div align="center">

**Claude Code는 강력합니다. GSD가 그걸 신뢰할 수 있게 만듭니다.**

</div>
