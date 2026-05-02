# GSD 아키텍처

> 기여자와 고급 사용자를 위한 시스템 아키텍처입니다. 사용자 문서는 [Feature Reference](FEATURES.md) 또는 [User Guide](USER-GUIDE.md)를 참조하세요.

---

## 목차

- [시스템 개요](#system-overview)
- [설계 원칙](#design-principles)
- [컴포넌트 아키텍처](#component-architecture)
- [에이전트 모델](#agent-model)
- [데이터 흐름](#data-flow)
- [파일 시스템 구조](#file-system-layout)
- [인스톨러 아키텍처](#installer-architecture)
- [훅 시스템](#hook-system)
- [CLI 도구 레이어](#cli-tools-layer)
- [런타임 추상화](#runtime-abstraction)

---

## 시스템 개요

GSD는 사용자와 AI 코딩 에이전트(Claude Code, Gemini CLI, OpenCode, Kilo, Codex, Copilot, Antigravity, Trae, Cline, Augment Code) 사이에 위치하는 **메타 프롬프팅 프레임워크**입니다. 다음을 제공합니다.

1. **컨텍스트 엔지니어링** — 작업별로 AI에게 필요한 모든 것을 제공하는 구조화된 아티팩트
2. **멀티 에이전트 오케스트레이션** — 새로운 컨텍스트 윈도우로 전문화된 에이전트를 생성하는 가벼운 오케스트레이터
3. **명세 주도 개발** — 요구 사항 → 조사 → 계획 → 실행 → 검증 파이프라인
4. **상태 관리** — 세션과 컨텍스트 초기화를 넘나드는 영구적인 프로젝트 메모리

```
┌──────────────────────────────────────────────────────┐
│                      USER                            │
│            /gsd-command [args]                        │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│              COMMAND LAYER                            │
│   commands/gsd/*.md — Prompt-based command files      │
│   (Claude Code custom commands / Codex skills)        │
└─────────────────────┬────────────────────────────────┘
                      │
┌─────────────────────▼────────────────────────────────┐
│              WORKFLOW LAYER                           │
│   get-shit-done/workflows/*.md — Orchestration logic  │
│   (Reads references, spawns agents, manages state)    │
└──────┬──────────────┬─────────────────┬──────────────┘
       │              │                 │
┌──────▼──────┐ ┌─────▼─────┐ ┌────────▼───────┐
│  AGENT      │ │  AGENT    │ │  AGENT         │
│  (fresh     │ │  (fresh   │ │  (fresh        │
│   context)  │ │   context)│ │   context)     │
└──────┬──────┘ └─────┬─────┘ └────────┬───────┘
       │              │                 │
┌──────▼──────────────▼─────────────────▼──────────────┐
│              CLI TOOLS LAYER                          │
│   get-shit-done/bin/gsd-tools.cjs                     │
│   (State, config, phase, roadmap, verify, templates)  │
└──────────────────────┬───────────────────────────────┘
                       │
┌──────────────────────▼───────────────────────────────┐
│              FILE SYSTEM (.planning/)                 │
│   PROJECT.md | REQUIREMENTS.md | ROADMAP.md          │
│   STATE.md | config.json | phases/ | research/       │
└──────────────────────────────────────────────────────┘
```

---

## 설계 원칙

### 1. 에이전트별 새로운 컨텍스트

오케스트레이터가 생성하는 모든 에이전트는 새로운 컨텍스트 윈도우(최대 200K 토큰)를 받습니다. 이를 통해 컨텍스트 오염을 방지합니다 — AI가 컨텍스트 윈도우에 누적된 대화로 인해 품질이 저하되는 현상입니다.

### 2. 가벼운 오케스트레이터

워크플로우 파일(`get-shit-done/workflows/*.md`)은 무거운 작업을 직접 수행하지 않습니다. 다음 작업만 담당합니다.
- `gsd-tools.cjs init <workflow>`로 컨텍스트를 로드합니다
- 집중된 프롬프트로 전문화된 에이전트를 생성합니다
- 결과를 수집하여 다음 단계로 전달합니다
- 단계 사이에 상태를 업데이트합니다

### 3. 파일 기반 상태

모든 상태는 `.planning/`에 사람이 읽을 수 있는 Markdown과 JSON으로 저장됩니다. 데이터베이스, 서버, 외부 의존성이 없습니다. 이를 통해 다음이 가능합니다.
- 컨텍스트 초기화(`/clear`) 이후에도 상태가 유지됩니다
- 사람과 에이전트 모두 상태를 확인할 수 있습니다
- 팀 가시성을 위해 git에 커밋할 수 있습니다

### 4. 부재 = 활성화

워크플로우 기능 플래그는 **부재 = 활성화** 패턴을 따릅니다. `config.json`에 키가 없으면 기본값은 `true`입니다. 사용자는 기능을 명시적으로 비활성화하며 기본값을 활성화할 필요가 없습니다.

### 5. 심층 방어

여러 레이어가 일반적인 실패 모드를 방지합니다.
- 계획은 실행 전에 검증됩니다 (plan-checker 에이전트)
- 실행은 작업당 원자적 커밋을 생성합니다
- 실행 후 검증은 단계 목표에 대해 확인합니다
- UAT는 최종 게이트로서 사람의 검증을 제공합니다

---

## 컴포넌트 아키텍처

### Commands (`commands/gsd/*.md`)

사용자 대면 진입점입니다. 각 파일은 YAML 전문(name, description, allowed-tools)과 워크플로우를 부트스트랩하는 프롬프트 본문을 포함합니다. 명령어는 다음과 같이 설치됩니다.
- **Claude Code:** 커스텀 슬래시 명령어 (`/gsd-command-name`)
- **OpenCode / Kilo:** 슬래시 명령어 (`/gsd-command-name`)
- **Codex:** Skills (`$gsd-command-name`)
- **Copilot:** 슬래시 명령어 (`/gsd-command-name`)
- **Antigravity:** Skills

**전체 명령어 수:** 44개

### Workflows (`get-shit-done/workflows/*.md`)

명령어가 참조하는 오케스트레이션 로직입니다. 다음을 포함하는 단계별 프로세스를 담습니다.
- `gsd-tools.cjs init`을 통한 컨텍스트 로드
- 모델 해석을 포함한 에이전트 생성 지시
- 게이트/체크포인트 정의
- 상태 업데이트 패턴
- 오류 처리 및 복구

**전체 워크플로우 수:** 46개

### Agents (`agents/*.md`)

다음을 지정하는 전문화된 에이전트 정의 파일입니다.
- `name` — 에이전트 식별자
- `description` — 역할과 목적
- `tools` — 허용된 도구 접근 권한 (Read, Write, Edit, Bash, Grep, Glob, WebSearch 등)
- `color` — 시각적 구분을 위한 터미널 출력 색상

**전체 에이전트 수:** 16개

### References (`get-shit-done/references/*.md`)

워크플로우와 에이전트가 `@-reference`로 참조하는 공유 지식 문서입니다.
- `checkpoints.md` — 체크포인트 유형 정의 및 상호작용 패턴
- `model-profiles.md` — 에이전트별 모델 티어 할당
- `verification-patterns.md` — 다양한 아티팩트 유형 검증 방법
- `planning-config.md` — 전체 config 스키마 및 동작
- `git-integration.md` — git 커밋, 브랜칭, 히스토리 패턴
- `questioning.md` — 프로젝트 초기화를 위한 꿈 추출 철학
- `tdd.md` — 테스트 주도 개발 통합 패턴
- `ui-brand.md` — 시각적 출력 포매팅 패턴

### Templates (`get-shit-done/templates/`)

모든 계획 아티팩트를 위한 Markdown 템플릿입니다. `gsd-tools.cjs template fill`과 `scaffold` 명령어가 사전 구조화된 파일을 생성하는 데 사용합니다.
- `project.md`, `requirements.md`, `roadmap.md`, `state.md` — 핵심 프로젝트 파일
- `phase-prompt.md` — 단계 실행 프롬프트 템플릿
- `summary.md` (+ `summary-minimal.md`, `summary-standard.md`, `summary-complex.md`) — 세분화 인식 요약 템플릿
- `DEBUG.md` — 디버그 세션 추적 템플릿
- `UI-SPEC.md`, `UAT.md`, `VALIDATION.md` — 전문화된 검증 템플릿
- `discussion-log.md` — 논의 감사 추적 템플릿
- `codebase/` — 브라운필드 매핑 템플릿 (stack, architecture, conventions, concerns, structure, testing, integrations)
- `research-project/` — 조사 출력 템플릿 (SUMMARY, STACK, FEATURES, ARCHITECTURE, PITFALLS)

### Hooks (`hooks/`)

호스트 AI 에이전트와 통합되는 런타임 훅입니다.

| 훅 | 이벤트 | 목적 |
|------|-------|---------|
| `gsd-statusline.js` | `statusLine` | 모델, 작업, 디렉터리, 컨텍스트 사용 바 표시 |
| `gsd-context-monitor.js` | `PostToolUse` / `AfterTool` | 잔여 35%/25% 시점에 에이전트 대면 컨텍스트 경고 주입 |
| `gsd-check-update.js` | `SessionStart` | 새 GSD 버전을 백그라운드에서 확인 |
| `gsd-prompt-guard.js` | `PreToolUse` | `.planning/` 쓰기 작업에서 프롬프트 인젝션 패턴 스캔 (권고용) |
| `gsd-workflow-guard.js` | `PreToolUse` | GSD 워크플로우 컨텍스트 외부의 파일 편집 감지 (권고용, `hooks.workflow_guard`로 활성화) |

### CLI Tools (`get-shit-done/bin/`)

17개의 도메인 모듈을 포함하는 Node.js CLI 유틸리티(`gsd-tools.cjs`)입니다.

| 모듈 | 역할 |
|--------|---------------|
| `core.cjs` | 오류 처리, 출력 포매팅, 공유 유틸리티 |
| `state.cjs` | STATE.md 파싱, 업데이트, 진행, 메트릭 |
| `phase.cjs` | 단계 디렉터리 작업, 소수 번호 매기기, 계획 인덱싱 |
| `roadmap.cjs` | ROADMAP.md 파싱, 단계 추출, 계획 진행 상황 |
| `config.cjs` | config.json 읽기/쓰기, 섹션 초기화 |
| `verify.cjs` | 계획 구조, 단계 완성도, 참조, 커밋 검증 |
| `template.cjs` | 변수 치환을 포함한 템플릿 선택 및 채우기 |
| `frontmatter.cjs` | YAML 전문 CRUD 작업 |
| `init.cjs` | 각 워크플로우 유형을 위한 복합 컨텍스트 로드 |
| `milestone.cjs` | 마일스톤 보관, 요구 사항 표시 |
| `commands.cjs` | 기타 명령어 (slug, timestamp, todos, scaffolding, stats) |
| `model-profiles.cjs` | 모델 프로필 해석 테이블 |
| `security.cjs` | 경로 탐색 방지, 프롬프트 인젝션 감지, 안전한 JSON 파싱, 셸 인수 검증 |
| `uat.cjs` | UAT 파일 파싱, 검증 부채 추적, audit-uat 지원 |

---

## 에이전트 모델

### 오케스트레이터 → 에이전트 패턴

```
Orchestrator (workflow .md)
    │
    ├── Load context: gsd-tools.cjs init <workflow> <phase>
    │   Returns JSON with: project info, config, state, phase details
    │
    ├── Resolve model: gsd-tools.cjs resolve-model <agent-name>
    │   Returns: opus | sonnet | haiku | inherit
    │
    ├── Spawn Agent (Task/SubAgent call)
    │   ├── Agent prompt (agents/*.md)
    │   ├── Context payload (init JSON)
    │   ├── Model assignment
    │   └── Tool permissions
    │
    ├── Collect result
    │
    └── Update state: gsd-tools.cjs state update/patch/advance-plan
```

### 에이전트 생성 카테고리

| 카테고리 | 에이전트 | 병렬성 |
|----------|--------|-------------|
| **Researchers** | gsd-project-researcher, gsd-phase-researcher, gsd-ui-researcher, gsd-advisor-researcher | 4개 병렬 (stack, features, architecture, pitfalls); advisor는 discuss-phase 중 생성됨 |
| **Synthesizers** | gsd-research-synthesizer | 순차적 (조사자 완료 후) |
| **Planners** | gsd-planner, gsd-roadmapper | 순차적 |
| **Checkers** | gsd-plan-checker, gsd-integration-checker, gsd-ui-checker, gsd-nyquist-auditor | 순차적 (검증 루프, 최대 3회 반복) |
| **Executors** | gsd-executor | 웨이브 내 병렬, 웨이브 간 순차적 |
| **Verifiers** | gsd-verifier | 순차적 (모든 executor 완료 후) |
| **Mappers** | gsd-codebase-mapper | 4개 병렬 (tech, arch, quality, concerns) |
| **Debuggers** | gsd-debugger | 순차적 (대화형) |
| **Auditors** | gsd-ui-auditor | 순차적 |

### 웨이브 실행 모델

`execute-phase` 중 계획은 의존성 웨이브로 그룹화됩니다.

```
Wave Analysis:
  Plan 01 (no deps)      ─┐
  Plan 02 (no deps)      ─┤── Wave 1 (parallel)
  Plan 03 (depends: 01)  ─┤── Wave 2 (waits for Wave 1)
  Plan 04 (depends: 02)  ─┘
  Plan 05 (depends: 03,04) ── Wave 3 (waits for Wave 2)
```

각 executor는 다음을 받습니다.
- 새로운 200K 컨텍스트 윈도우
- 실행할 특정 PLAN.md
- 프로젝트 컨텍스트 (PROJECT.md, STATE.md)
- 단계 컨텍스트 (CONTEXT.md, 사용 가능한 경우 RESEARCH.md)

#### 병렬 커밋 안전성

같은 웨이브 내에서 여러 executor가 실행될 때 충돌을 방지하는 두 가지 메커니즘이 있습니다.

1. **`--no-verify` 커밋** — 병렬 에이전트는 사전 커밋 훅을 건너뜁니다 (빌드 잠금 경쟁을 유발할 수 있음, 예: Rust 프로젝트의 cargo lock 충돌). 오케스트레이터는 각 웨이브 완료 후 `git hook run pre-commit`을 한 번 실행합니다.

2. **STATE.md 파일 잠금** — 모든 `writeStateMd()` 호출은 lockfile 기반 상호 배제를 사용합니다 (`STATE.md.lock`, `O_EXCL` 원자적 생성). 이는 두 에이전트가 STATE.md를 읽고 서로 다른 필드를 수정하면 마지막 작성자가 다른 에이전트의 변경사항을 덮어쓰는 읽기-수정-쓰기 경쟁 조건을 방지합니다. 오래된 잠금 감지(10초 타임아웃)와 지터를 포함한 스핀 대기가 포함됩니다.

---

## 데이터 흐름

### 새 프로젝트 흐름

```
User input (idea description)
    │
    ▼
Questions (questioning.md philosophy)
    │
    ▼
4x Project Researchers (parallel)
    ├── Stack → STACK.md
    ├── Features → FEATURES.md
    ├── Architecture → ARCHITECTURE.md
    └── Pitfalls → PITFALLS.md
    │
    ▼
Research Synthesizer → SUMMARY.md
    │
    ▼
Requirements extraction → REQUIREMENTS.md
    │
    ▼
Roadmapper → ROADMAP.md
    │
    ▼
User approval → STATE.md initialized
```

### 단계 실행 흐름

```
discuss-phase → CONTEXT.md (user preferences)
    │
    ▼
ui-phase → UI-SPEC.md (design contract, optional)
    │
    ▼
plan-phase
    ├── Phase Researcher → RESEARCH.md
    ├── Planner → PLAN.md files
    └── Plan Checker → Verify loop (max 3x)
    │
    ▼
execute-phase
    ├── Wave analysis (dependency grouping)
    ├── Executor per plan → code + atomic commits
    ├── SUMMARY.md per plan
    └── Verifier → VERIFICATION.md
    │
    ▼
verify-work → UAT.md (user acceptance testing)
    │
    ▼
ui-review → UI-REVIEW.md (visual audit, optional)
```

### 컨텍스트 전파

각 워크플로우 단계는 이후 단계에 공급되는 아티팩트를 생성합니다.

```
PROJECT.md ────────────────────────────────────────────► All agents
REQUIREMENTS.md ───────────────────────────────────────► Planner, Verifier, Auditor
ROADMAP.md ────────────────────────────────────────────► Orchestrators
STATE.md ──────────────────────────────────────────────► All agents (decisions, blockers)
CONTEXT.md (per phase) ────────────────────────────────► Researcher, Planner, Executor
RESEARCH.md (per phase) ───────────────────────────────► Planner, Plan Checker
PLAN.md (per plan) ────────────────────────────────────► Executor, Plan Checker
SUMMARY.md (per plan) ─────────────────────────────────► Verifier, State tracking
UI-SPEC.md (per phase) ────────────────────────────────► Executor, UI Auditor
```

---

## 파일 시스템 구조

### 설치 파일

```
~/.claude/                          # Claude Code (전역 설치)
├── commands/gsd/*.md               # 37개 슬래시 명령어
├── get-shit-done/
│   ├── bin/gsd-tools.cjs           # CLI 유틸리티
│   ├── bin/lib/*.cjs               # 15개 도메인 모듈
│   ├── workflows/*.md              # 42개 워크플로우 정의
│   ├── references/*.md             # 13개 공유 참조 문서
│   └── templates/                  # 계획 아티팩트 템플릿
├── agents/*.md                     # 15개 에이전트 정의
├── hooks/
│   ├── gsd-statusline.js           # 상태표시줄 훅
│   ├── gsd-context-monitor.js      # 컨텍스트 경고 훅
│   └── gsd-check-update.js         # 업데이트 확인 훅
├── settings.json                   # 훅 등록
└── VERSION                         # 설치된 버전 번호
```

다른 런타임의 동등한 경로입니다.
- **OpenCode:** `~/.config/opencode/` 또는 `~/.opencode/`
- **Kilo:** `~/.config/kilo/` 또는 `~/.kilo/`
- **Gemini CLI:** `~/.gemini/`
- **Codex:** `~/.codex/` (명령어 대신 skills 사용)
- **Copilot:** `~/.github/`
- **Antigravity:** `~/.gemini/antigravity/` (전역) 또는 `./.agent/` (로컬)

### 프로젝트 파일 (`.planning/`)

```
.planning/
├── PROJECT.md              # 프로젝트 비전, 제약, 결정, 진화 규칙
├── REQUIREMENTS.md         # 범위 지정된 요구 사항 (v1/v2/범위 외)
├── ROADMAP.md              # 상태 추적을 포함한 단계 분류
├── STATE.md                # 살아있는 메모리: 위치, 결정, 차단, 메트릭
├── config.json             # 워크플로우 설정
├── MILESTONES.md           # 완료된 마일스톤 보관
├── research/               # /gsd-new-project의 도메인 조사
│   ├── SUMMARY.md
│   ├── STACK.md
│   ├── FEATURES.md
│   ├── ARCHITECTURE.md
│   └── PITFALLS.md
├── codebase/               # 브라운필드 매핑 (/gsd-map-codebase에서)
│   ├── STACK.md
│   ├── ARCHITECTURE.md
│   ├── CONVENTIONS.md
│   ├── CONCERNS.md
│   ├── STRUCTURE.md
│   ├── TESTING.md
│   └── INTEGRATIONS.md
├── phases/
│   └── XX-phase-name/
│       ├── XX-CONTEXT.md       # 사용자 선호도 (discuss-phase에서)
│       ├── XX-RESEARCH.md      # 생태계 조사 (plan-phase에서)
│       ├── XX-YY-PLAN.md       # 실행 계획
│       ├── XX-YY-SUMMARY.md    # 실행 결과
│       ├── XX-VERIFICATION.md  # 실행 후 검증
│       ├── XX-VALIDATION.md    # Nyquist 테스트 커버리지 매핑
│       ├── XX-UI-SPEC.md       # UI 디자인 계약서 (ui-phase에서)
│       ├── XX-UI-REVIEW.md     # 시각적 감사 점수 (ui-review에서)
│       └── XX-UAT.md           # 사용자 수용 테스트 결과
├── quick/                  # 빠른 작업 추적
│   └── YYMMDD-xxx-slug/
│       ├── PLAN.md
│       └── SUMMARY.md
├── todos/
│   ├── pending/            # 캡처된 아이디어
│   └── done/               # 완료된 할 일
├── threads/               # 영구 컨텍스트 스레드 (/gsd-thread에서)
├── seeds/                 # 미래 지향적 아이디어 (/gsd-plant-seed에서)
├── debug/                  # 활성 디버그 세션
│   ├── *.md                # 활성 세션
│   ├── resolved/           # 보관된 세션
│   └── knowledge-base.md   # 영구 디버그 학습 내용
├── ui-reviews/             # /gsd-ui-review의 스크린샷 (gitignored)
└── continue-here.md        # 컨텍스트 핸드오프 (pause-work에서)
```

---

## 인스톨러 아키텍처

인스톨러(`bin/install.js`, ~3,000줄)는 다음을 처리합니다.

1. **런타임 감지** — 대화형 프롬프트 또는 CLI 플래그 (`--claude`, `--opencode`, `--gemini`, `--kilo`, `--codex`, `--copilot`, `--antigravity`, `--all`)
2. **위치 선택** — 전역(`--global`) 또는 로컬(`--local`)
3. **파일 배포** — commands, workflows, references, templates, agents, hooks 복사
4. **런타임 적응** — 런타임별 파일 내용 변환.
   - Claude Code: 그대로 사용
   - OpenCode: 명령어/에이전트를 OpenCode 호환 플랫 명령어 + 서브에이전트 형식으로 변환
   - Kilo: Kilo 설정 경로로 OpenCode 변환 파이프라인을 재사용
   - Codex: commands에서 TOML config + skills 생성
   - Copilot: 도구 이름 매핑 (Read→read, Bash→execute 등)
   - Gemini: 훅 이벤트 이름 조정 (`PostToolUse` 대신 `AfterTool`)
   - Antigravity: Google 모델 등가물을 사용한 skills-first 방식
5. **경로 정규화** — `~/.claude/` 경로를 런타임별 경로로 교체
6. **설정 통합** — 런타임의 `settings.json`에 훅 등록
7. **패치 백업** — v1.17부터 로컬 수정 파일을 `gsd-local-patches/`에 백업하여 `/gsd-update --reapply`에 사용
8. **매니페스트 추적** — 깔끔한 제거를 위해 `gsd-file-manifest.json` 작성
9. **제거 모드** — `--uninstall`로 모든 GSD 파일, 훅, 설정 제거

### 플랫폼 처리

- **Windows:** 자식 프로세스에 `windowsHide` 적용, 보호 디렉터리의 EPERM/EACCES 방지, 경로 구분자 정규화
- **WSL:** WSL에서 실행 중인 Windows Node.js를 감지하고 경로 불일치에 대해 경고
- **Docker/CI:** 커스텀 config 디렉터리 위치를 위한 `CLAUDE_CONFIG_DIR` 환경 변수 지원

---

## 훅 시스템

### 아키텍처

```
Runtime Engine (Claude Code / Gemini CLI)
    │
    ├── statusLine event ──► gsd-statusline.js
    │   Reads: stdin (session JSON)
    │   Writes: stdout (formatted status), /tmp/claude-ctx-{session}.json (bridge)
    │
    ├── PostToolUse/AfterTool event ──► gsd-context-monitor.js
    │   Reads: stdin (tool event JSON), /tmp/claude-ctx-{session}.json (bridge)
    │   Writes: stdout (hookSpecificOutput with additionalContext warning)
    │
    └── SessionStart event ──► gsd-check-update.js
        Reads: VERSION file
        Writes: ~/.claude/cache/gsd-update-check.json (spawns background process)
```

### 컨텍스트 모니터 임계값

| 잔여 컨텍스트 | 수준 | 에이전트 동작 |
|-------------------|-------|----------------|
| > 35% | 정상 | 경고 주입 없음 |
| ≤ 35% | WARNING | "복잡한 새 작업 시작을 피하세요" |
| ≤ 25% | CRITICAL | "컨텍스트가 거의 소진됨, 사용자에게 알리세요" |

디바운스: 반복 경고 사이에 5회 도구 사용. 심각도 에스컬레이션(WARNING→CRITICAL)은 디바운스를 우회합니다.

### 안전 속성

- 모든 훅은 try/catch로 감싸여 있으며 오류 시 자동 종료합니다
- stdin 타임아웃 가드(3초)로 파이프 문제 시 중단 방지
- 오래된 메트릭(60초 이상)은 무시됩니다
- 누락된 브리지 파일은 정상적으로 처리됩니다 (서브에이전트, 새 세션)
- 컨텍스트 모니터는 권고용입니다 — 사용자 선호도를 재정의하는 명령을 내리지 않습니다

### 보안 훅 (v1.27)

**Prompt Guard** (`gsd-prompt-guard.js`).
- `.planning/` 파일에 Write/Edit 시 트리거됩니다
- 프롬프트 인젝션 패턴을 콘텐츠에서 스캔합니다 (역할 재정의, 지시 우회, system 태그 인젝션)
- 권고용 — 감지를 기록하며 차단하지 않습니다
- 패턴은 훅 독립성을 위해 인라인으로 포함됩니다 (`security.cjs`의 일부)

**Workflow Guard** (`gsd-workflow-guard.js`).
- `.planning/` 외부 파일에 Write/Edit 시 트리거됩니다
- GSD 워크플로우 컨텍스트 외부의 편집을 감지합니다 (활성 `/gsd-` 명령어 또는 Task 서브에이전트 없음)
- 상태 추적 변경을 위해 `/gsd-quick` 또는 `/gsd-fast` 사용을 권고합니다
- `hooks.workflow_guard: true`로 활성화 (기본값: false)

---

## 런타임 추상화

GSD는 통합된 명령어/워크플로우 아키텍처를 통해 여러 AI 코딩 런타임을 지원합니다.

| 런타임 | 명령어 형식 | 에이전트 시스템 | 설정 위치 |
|---------|---------------|--------------|-----------------|
| Claude Code | `/gsd-command` | Task 생성 | `~/.claude/` |
| OpenCode | `/gsd-command` | Subagent 모드 | `~/.config/opencode/` |
| Kilo | `/gsd-command` | Subagent 모드 | `~/.config/kilo/` |
| Gemini CLI | `/gsd-command` | Task 생성 | `~/.gemini/` |
| Codex | `$gsd-command` | Skills | `~/.codex/` |
| Copilot | `/gsd-command` | 에이전트 위임 | `~/.github/` |
| Antigravity | Skills | Skills | `~/.gemini/antigravity/` |

### 추상화 포인트

1. **도구 이름 매핑** — 각 런타임은 고유한 도구 이름을 가집니다 (예: Claude의 `Bash` → Copilot의 `execute`)
2. **훅 이벤트 이름** — Claude는 `PostToolUse`를 사용하고 Gemini는 `AfterTool`을 사용합니다
3. **에이전트 전문** — 각 런타임은 고유한 에이전트 정의 형식을 가집니다
4. **경로 규칙** — 각 런타임은 서로 다른 디렉터리에 설정을 저장합니다
5. **모델 참조** — `inherit` 프로필을 통해 GSD가 런타임의 모델 선택에 위임합니다

인스톨러는 설치 시 모든 변환을 처리합니다. 워크플로우와 에이전트는 Claude Code의 네이티브 형식으로 작성되어 배포 중에 변환됩니다.
