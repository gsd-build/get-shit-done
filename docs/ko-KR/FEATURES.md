# GSD 기능 참조

> 기능 및 함수에 대한 완전한 문서와 요구사항입니다. 아키텍처 세부 사항은 [Architecture](ARCHITECTURE.md)를, 명령어 문법은 [Command Reference](COMMANDS.md)를 참조하세요.

---

## 목차

- [핵심 기능](#core-features)
  - [프로젝트 초기화](#1-project-initialization)
  - [페이즈 논의](#2-phase-discussion)
  - [UI 설계 계약](#3-ui-design-contract)
  - [페이즈 계획](#4-phase-planning)
  - [페이즈 실행](#5-phase-execution)
  - [작업 검증](#6-work-verification)
  - [UI 검토](#7-ui-review)
  - [마일스톤 관리](#8-milestone-management)
- [계획 기능](#planning-features)
  - [페이즈 관리](#9-phase-management)
  - [빠른 모드](#10-quick-mode)
  - [자율 모드](#11-autonomous-mode)
  - [자유형 라우팅](#12-freeform-routing)
  - [노트 캡처](#13-note-capture)
  - [자동 진행(Next)](#14-auto-advance-next)
- [품질 보증 기능](#quality-assurance-features)
  - [Nyquist 유효성 검사](#15-nyquist-validation)
  - [계획 검사](#16-plan-checking)
  - [실행 후 검증](#17-post-execution-verification)
  - [노드 복구](#18-node-repair)
  - [상태 유효성 검사](#19-health-validation)
  - [교차 페이즈 회귀 게이트](#20-cross-phase-regression-gate)
  - [요구사항 커버리지 게이트](#21-requirements-coverage-gate)
- [컨텍스트 엔지니어링 기능](#context-engineering-features)
  - [컨텍스트 창 모니터링](#22-context-window-monitoring)
  - [세션 관리](#23-session-management)
  - [세션 보고](#24-session-reporting)
  - [멀티 에이전트 오케스트레이션](#25-multi-agent-orchestration)
  - [모델 프로파일](#26-model-profiles)
- [브라운필드 기능](#brownfield-features)
  - [코드베이스 매핑](#27-codebase-mapping)
- [유틸리티 기능](#utility-features)
  - [디버그 시스템](#28-debug-system)
  - [할 일 관리](#29-todo-management)
  - [통계 대시보드](#30-statistics-dashboard)
  - [업데이트 시스템](#31-update-system)
  - [설정 관리](#32-settings-management)
  - [테스트 생성](#33-test-generation)
- [인프라 기능](#infrastructure-features)
  - [Git 통합](#34-git-integration)
  - [CLI 도구](#35-cli-tools)
  - [멀티 런타임 지원](#36-multi-runtime-support)
  - [훅 시스템](#37-hook-system)
  - [개발자 프로파일링](#38-developer-profiling)
  - [실행 강화](#39-execution-hardening)
  - [검증 부채 추적](#40-verification-debt-tracking)
- [v1.27 기능](#v127-features)
  - [빠른 모드(Fast Mode)](#41-fast-mode)
  - [교차 AI 동료 검토](#42-cross-ai-peer-review)
  - [백로그 주차장](#43-backlog-parking-lot)
  - [지속적 컨텍스트 스레드](#44-persistent-context-threads)
  - [PR 브랜치 필터링](#45-pr-branch-filtering)
  - [보안 강화](#46-security-hardening)
  - [멀티 저장소 워크스페이스 지원](#47-multi-repo-workspace-support)
  - [논의 감사 추적](#48-discussion-audit-trail)
- [v1.28 기능](#v128-features)
  - [포렌식](#49-forensics)
  - [마일스톤 요약](#50-milestone-summary)
  - [워크스트림 네임스페이싱](#51-workstream-namespacing)
  - [매니저 대시보드](#52-manager-dashboard)
  - [가정 논의 모드](#53-assumptions-discussion-mode)
  - [UI 페이즈 자동 감지](#54-ui-phase-auto-detection)
  - [멀티 런타임 설치 선택](#55-multi-runtime-installer-selection)
- [v1.29 기능](#v129-기능)
  - [Windsurf 런타임 지원](#56-windsurf-런타임-지원)
  - [국제화 문서](#57-국제화-문서)
- [v1.30 기능](#v130-기능)
  - [GSD SDK](#58-gsd-sdk)
- [v1.31 기능](#v131-기능)
  - [스키마 드리프트 감지](#59-스키마-드리프트-감지)
  - [보안 시행](#60-보안-시행)
  - [문서 생성](#61-문서-생성)
  - [디스커스 체인 모드](#62-디스커스-체인-모드)
  - [단일 페이즈 자율 모드](#63-단일-페이즈-자율-모드)
  - [범위 축소 감지](#64-범위-축소-감지)
  - [주장 출처 태깅](#65-주장-출처-태깅)
  - [Worktree 토글](#66-worktree-토글)
  - [프로젝트 코드 접두사](#67-프로젝트-코드-접두사)
  - [Claude Code 스킬 마이그레이션](#68-claude-code-스킬-마이그레이션)
- [v1.32 기능](#v132-기능)
  - [STATE.md 일관성 게이트](#69-statemd-일관성-게이트)
  - [자율 모드 `--to N` 플래그](#70-자율-모드---to-n-플래그)
  - [리서치 게이트](#71-리서치-게이트)
  - [검증자 마일스톤 범위 필터링](#72-검증자-마일스톤-범위-필터링)
  - [Read-Before-Edit 가드 훅](#73-read-before-edit-가드-훅)
  - [컨텍스트 축소](#74-컨텍스트-축소)
  - [디스커스 페이즈 `--power` 플래그](#75-디스커스-페이즈---power-플래그)
  - [디버그 `--diagnose` 플래그](#76-디버그---diagnose-플래그)
  - [페이즈 의존성 분석](#77-페이즈-의존성-분석)
  - [안티패턴 심각도 레벨](#78-안티패턴-심각도-레벨)
  - [방법론 아티팩트 유형](#79-방법론-아티팩트-유형)
  - [플래너 도달 가능성 검사](#80-플래너-도달-가능성-검사)
  - [Playwright-MCP UI 검증](#81-playwright-mcp-ui-검증)
  - [Pause-Work 확장](#82-pause-work-확장)
  - [응답 언어 설정](#83-응답-언어-설정)
  - [수동 업데이트 절차](#84-수동-업데이트-절차)
  - [신규 런타임 지원 (Trae, Cline, Augment Code)](#85-신규-런타임-지원-trae-cline-augment-code)

---

## 핵심 기능

### 1. Project Initialization

**명령어:** `/gsd-new-project [--auto @file.md]`

**목적:** 사용자의 아이디어를 연구, 범위가 지정된 요구사항, 단계별 로드맵을 갖춘 완전히 구조화된 프로젝트로 전환합니다.

**요구사항.**
- REQ-INIT-01: 프로젝트 범위가 완전히 파악될 때까지 적응형 질문을 진행해야 합니다.
- REQ-INIT-02: 도메인 생태계를 조사하는 병렬 연구 에이전트를 생성해야 합니다.
- REQ-INIT-03: 요구사항을 v1(필수), v2(향후), 범위 외 카테고리로 분류해야 합니다.
- REQ-INIT-04: 요구사항 추적성을 갖춘 단계별 로드맵을 생성해야 합니다.
- REQ-INIT-05: 진행 전에 사용자의 로드맵 승인을 요구해야 합니다.
- REQ-INIT-06: `.planning/PROJECT.md`가 이미 존재하는 경우 재초기화를 방지해야 합니다.
- REQ-INIT-07: 대화형 질문을 건너뛰고 문서에서 정보를 추출하는 `--auto @file.md` 플래그를 지원해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `PROJECT.md` | 프로젝트 비전, 제약조건, 기술적 결정, 발전 규칙 |
| `REQUIREMENTS.md` | 고유 ID(REQ-XX)가 있는 범위 지정 요구사항 |
| `ROADMAP.md` | 상태 추적 및 요구사항 매핑이 포함된 페이즈 분류 |
| `STATE.md` | 위치, 결정, 지표가 포함된 초기 프로젝트 상태 |
| `config.json` | 워크플로우 구성 |
| `research/SUMMARY.md` | 통합된 도메인 연구 결과 |
| `research/STACK.md` | 기술 스택 조사 |
| `research/FEATURES.md` | 기능 구현 패턴 |
| `research/ARCHITECTURE.md` | 아키텍처 패턴 및 트레이드오프 |
| `research/PITFALLS.md` | 일반적인 실패 모드와 완화 방법 |

**프로세스.**
1. **질문** — "꿈 추출" 철학(요구사항 수집이 아닌)으로 안내되는 적응형 질문
2. **연구** — 스택, 기능, 아키텍처, 위험 요소를 조사하는 4개의 병렬 연구자 에이전트
3. **종합** — 연구 종합자가 결과를 SUMMARY.md로 통합
4. **요구사항** — 사용자 응답과 연구에서 추출하여 범위별로 분류
5. **로드맵** — 요구사항에 매핑된 페이즈 분류, 세분화 설정으로 페이즈 수 제어

**기능적 요구사항.**
- 감지된 프로젝트 유형(웹 앱, CLI, 모바일, API 등)에 따라 질문이 적응합니다.
- 연구 에이전트는 현재 생태계 정보를 위한 웹 검색 기능을 갖추고 있습니다.
- 세분화 설정으로 페이즈 수를 제어합니다. `coarse`(3-5), `standard`(5-8), `fine`(8-12)
- `--auto` 모드는 대화형 질문 없이 제공된 문서에서 모든 정보를 추출합니다.
- 기존 코드베이스 컨텍스트(`/gsd-map-codebase`에서)가 있으면 로드됩니다.

---

### 2. Phase Discussion

**명령어:** `/gsd-discuss-phase [N] [--auto] [--batch]`

**목적:** 연구와 계획이 시작되기 전에 사용자의 구현 선호도와 결정을 캡처합니다. AI가 추측하게 만드는 회색 지대를 제거합니다.

**요구사항.**
- REQ-DISC-01: 페이즈 범위를 분석하고 결정 영역(회색 지대)을 식별해야 합니다.
- REQ-DISC-02: 회색 지대를 유형별로 분류해야 합니다(시각적, API, 콘텐츠, 조직 등).
- REQ-DISC-03: 이전 CONTEXT.md 파일에서 이미 답변된 질문은 하지 않아야 합니다.
- REQ-DISC-04: 결정사항을 표준 참조와 함께 `{phase}-CONTEXT.md`에 저장해야 합니다.
- REQ-DISC-05: 권장 기본값을 자동 선택하는 `--auto` 플래그를 지원해야 합니다.
- REQ-DISC-06: 질문을 그룹으로 받는 `--batch` 플래그를 지원해야 합니다.
- REQ-DISC-07: 회색 지대를 식별하기 전에 관련 소스 파일을 스카우트해야 합니다(코드 인식 논의).

**생성 산출물.** `{padded_phase}-CONTEXT.md` — 연구 및 계획에 반영되는 사용자 선호도

**회색 지대 카테고리.**
| 카테고리 | 결정 예시 |
|----------|-------------------|
| 시각적 기능 | 레이아웃, 밀도, 상호작용, 빈 상태 |
| API/CLI | 응답 형식, 플래그, 오류 처리, 상세 수준 |
| 콘텐츠 시스템 | 구조, 어조, 깊이, 흐름 |
| 조직 | 그룹화 기준, 명명, 중복, 예외 |

---

### 3. UI Design Contract

**명령어:** `/gsd-ui-phase [N]`

**목적:** 계획 전에 설계 결정을 확정하여 페이즈 내 모든 컴포넌트가 일관된 시각적 기준을 공유하도록 합니다.

**요구사항.**
- REQ-UI-01: 기존 디자인 시스템 상태를 감지해야 합니다(shadcn components.json, Tailwind config, 토큰).
- REQ-UI-02: 아직 답변되지 않은 설계 계약 질문만 물어봐야 합니다.
- REQ-UI-03: 6개 차원에 대해 유효성을 검사해야 합니다(Copywriting, Visuals, Color, Typography, Spacing, Registry Safety).
- REQ-UI-04: 유효성 검사가 BLOCKED를 반환하면 수정 루프에 진입해야 합니다(최대 2회 반복).
- REQ-UI-05: `components.json`이 없는 React/Next.js/Vite 프로젝트에 shadcn 초기화를 제공해야 합니다.
- REQ-UI-06: 서드파티 shadcn 레지스트리에 대한 레지스트리 안전 게이트를 적용해야 합니다.

**생성 산출물.** `{padded_phase}-UI-SPEC.md` — 실행자가 사용하는 설계 계약

**6가지 유효성 검사 차원.**
1. **Copywriting** — CTA 레이블, 빈 상태, 오류 메시지
2. **Visuals** — 초점, 시각적 계층구조, 아이콘 접근성
3. **Color** — 강조색 사용 규율, 60/30/10 준수
4. **Typography** — 글꼴 크기/굵기 제약 준수
5. **Spacing** — 그리드 정렬, 토큰 일관성
6. **Registry Safety** — 서드파티 컴포넌트 검사 요구사항

**shadcn 통합.**
- React/Next.js/Vite 프로젝트에서 누락된 `components.json`을 감지합니다.
- `ui.shadcn.com/create` 프리셋 구성을 통해 사용자를 안내합니다.
- 프리셋 문자열은 페이즈 간 재현 가능한 계획 산출물이 됩니다.
- 서드파티 컴포넌트 전에 `npx shadcn view`와 `npx shadcn diff`를 요구하는 안전 게이트가 있습니다.

---

### 4. Phase Planning

**명령어:** `/gsd-plan-phase [N] [--auto] [--skip-research] [--skip-verify]`

**목적:** 구현 도메인을 연구하고 검증된 원자적 실행 계획을 생성합니다.

**요구사항.**
- REQ-PLAN-01: 구현 접근 방식을 조사하는 페이즈 연구자를 생성해야 합니다.
- REQ-PLAN-02: 단일 컨텍스트 창에 맞는 2-3개 작업으로 구성된 계획을 생성해야 합니다.
- REQ-PLAN-03: `name`, `files`, `action`, `verify`, `done` 필드를 포함하는 `<task>` 요소가 있는 XML 형식으로 계획을 구성해야 합니다.
- REQ-PLAN-04: 모든 계획에 `read_first`와 `acceptance_criteria` 섹션을 포함해야 합니다.
- REQ-PLAN-05: `--skip-verify`가 설정되지 않은 경우 계획 검사기 검증 루프를 실행해야 합니다(최대 3회 반복).
- REQ-PLAN-06: 연구 단계를 건너뛰는 `--skip-research` 플래그를 지원해야 합니다.
- REQ-PLAN-07: 프론트엔드 페이즈가 감지되고 UI-SPEC.md가 없는 경우 `/gsd-ui-phase` 실행을 촉구해야 합니다(UI 안전 게이트).
- REQ-PLAN-08: `workflow.nyquist_validation`이 활성화된 경우 Nyquist 유효성 검사 매핑을 포함해야 합니다.
- REQ-PLAN-09: 계획이 완료되기 전에 모든 페이즈 요구사항이 최소 하나의 계획에 포함되어 있는지 확인해야 합니다(요구사항 커버리지 게이트).

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `{phase}-RESEARCH.md` | 생태계 연구 결과 |
| `{phase}-{N}-PLAN.md` | 원자적 실행 계획(각 2-3개 작업) |
| `{phase}-VALIDATION.md` | 테스트 커버리지 매핑(Nyquist 레이어) |

**계획 구조(XML).**
```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT. Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

**계획 검사기 검증(8가지 차원).**
1. 요구사항 커버리지 — 계획이 모든 페이즈 요구사항을 다루는지 확인
2. 작업 원자성 — 각 작업이 독립적으로 커밋 가능한지 확인
3. 의존성 순서 — 작업이 올바른 순서로 배열되어 있는지 확인
4. 파일 범위 — 계획 간 과도한 파일 중복이 없는지 확인
5. 검증 명령어 — 각 작업에 테스트 가능한 완료 기준이 있는지 확인
6. 컨텍스트 적합성 — 작업이 단일 컨텍스트 창에 맞는지 확인
7. 갭 감지 — 누락된 구현 단계가 없는지 확인
8. Nyquist 준수 — 작업에 자동화된 검증 명령어가 있는지 확인(활성화된 경우)

---

### 5. Phase Execution

**명령어:** `/gsd-execute-phase <N>`

**목적:** 실행자별 새로운 컨텍스트 창을 사용한 웨이브 기반 병렬화로 페이즈의 모든 계획을 실행합니다.

**요구사항.**
- REQ-EXEC-01: 계획 의존성을 분석하고 실행 웨이브로 그룹화해야 합니다.
- REQ-EXEC-02: 각 웨이브 내에서 독립적인 계획을 병렬로 생성해야 합니다.
- REQ-EXEC-03: 각 실행자에게 새로운 컨텍스트 창(200K 토큰)을 제공해야 합니다.
- REQ-EXEC-04: 작업별로 원자적 git 커밋을 생성해야 합니다.
- REQ-EXEC-05: 완료된 각 계획에 대한 SUMMARY.md를 생성해야 합니다.
- REQ-EXEC-06: 실행 후 검증자를 실행하여 페이즈 목표가 달성되었는지 확인해야 합니다.
- REQ-EXEC-07: git 브랜칭 전략을 지원해야 합니다(`none`, `phase`, `milestone`).
- REQ-EXEC-08: 작업 검증 실패 시 노드 복구 연산자를 호출해야 합니다(활성화된 경우).
- REQ-EXEC-09: 교차 페이즈 회귀를 감지하기 위해 검증 전에 이전 페이즈의 테스트 스위트를 실행해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `{phase}-{N}-SUMMARY.md` | 계획별 실행 결과 |
| `{phase}-VERIFICATION.md` | 실행 후 검증 보고서 |
| Git 커밋 | 작업별 원자적 커밋 |

**웨이브 실행.**
- 의존성 없는 계획 → 웨이브 1(병렬)
- 웨이브 1에 의존하는 계획 → 웨이브 2(병렬, 웨이브 1 완료 후)
- 모든 계획이 완료될 때까지 계속
- 파일 충돌로 인해 동일 웨이브 내 순차 실행 강제

**실행자 기능.**
- 전체 작업 지시사항이 담긴 PLAN.md 읽기
- PROJECT.md, STATE.md, CONTEXT.md, RESEARCH.md에 접근 가능
- 구조화된 커밋 메시지로 각 작업을 원자적으로 커밋
- 병렬 실행 중 빌드 잠금 경쟁을 피하기 위해 커밋 시 `--no-verify` 사용
- 체크포인트 유형 처리: `auto`, `checkpoint:human-verify`, `checkpoint:decision`, `checkpoint:human-action`
- SUMMARY.md에 계획과의 편차 보고

**병렬 안전성.**
- **Pre-commit 훅**: 병렬 에이전트가 건너뜀(`--no-verify`), 각 웨이브 후 오케스트레이터가 한 번 실행
- **STATE.md 잠금**: 파일 수준 잠금 파일로 에이전트 간 동시 쓰기 손상 방지

---

### 6. Work Verification

**명령어:** `/gsd-verify-work [N]`

**목적:** 사용자 인수 테스트 — 각 결과물을 테스트하는 과정을 사용자와 함께 진행하고 실패를 자동으로 진단합니다.

**요구사항.**
- REQ-VERIFY-01: 페이즈에서 테스트 가능한 결과물을 추출해야 합니다.
- REQ-VERIFY-02: 결과물을 하나씩 사용자 확인을 위해 제시해야 합니다.
- REQ-VERIFY-03: 실패를 자동으로 진단하는 디버그 에이전트를 생성해야 합니다.
- REQ-VERIFY-04: 식별된 문제에 대한 수정 계획을 작성해야 합니다.
- REQ-VERIFY-05: 서버/데이터베이스/시드/시작 파일을 수정하는 페이즈에 콜드 스타트 스모크 테스트를 삽입해야 합니다.
- REQ-VERIFY-06: 합격/불합격 결과가 담긴 UAT.md를 생성해야 합니다.

**생성 산출물.** `{phase}-UAT.md` — 사용자 인수 테스트 결과, 문제 발견 시 수정 계획 포함

---

### 6.5. Ship

**명령어:** `/gsd-ship [N] [--draft]`

**목적:** 로컬 완료에서 병합된 PR로의 전환. 검증 통과 후 브랜치를 푸시하고, 계획 산출물에서 자동 생성된 본문으로 PR을 작성하며, 선택적으로 검토를 요청하고 STATE.md에 추적합니다.

**요구사항.**
- REQ-SHIP-01: 배포 전 페이즈가 검증을 통과했는지 확인해야 합니다.
- REQ-SHIP-02: `gh` CLI를 통해 브랜치를 푸시하고 PR을 작성해야 합니다.
- REQ-SHIP-03: SUMMARY.md, VERIFICATION.md, REQUIREMENTS.md에서 PR 본문을 자동 생성해야 합니다.
- REQ-SHIP-04: 배포 상태와 PR 번호로 STATE.md를 업데이트해야 합니다.
- REQ-SHIP-05: 초안 PR을 위한 `--draft` 플래그를 지원해야 합니다.

**전제 조건.** 페이즈 검증 완료, `gh` CLI 설치 및 인증, 피처 브랜치에서 작업

**생성 산출물.** 풍부한 본문이 있는 GitHub PR, STATE.md 업데이트

---

### 7. UI Review

**명령어:** `/gsd-ui-review [N]`

**목적:** 구현된 프론트엔드 코드의 소급 6기둥 시각적 감사. 모든 프로젝트에서 독립적으로 작동합니다.

**요구사항.**
- REQ-UIREVIEW-01: 6개 기둥 각각을 1-4 척도로 점수 매겨야 합니다.
- REQ-UIREVIEW-02: Playwright CLI를 통해 `.planning/ui-reviews/`에 스크린샷을 캡처해야 합니다.
- REQ-UIREVIEW-03: 스크린샷 디렉토리에 `.gitignore`를 작성해야 합니다.
- REQ-UIREVIEW-04: 우선순위 수정사항 상위 3개를 식별해야 합니다.
- REQ-UIREVIEW-05: UI-SPEC.md 없이도 추상적인 품질 기준을 사용하여 독립적으로 작동해야 합니다.

**6가지 감사 기둥(1-4 점수).**
1. **Copywriting** — CTA 레이블, 빈 상태, 오류 상태
2. **Visuals** — 초점, 시각적 계층구조, 아이콘 접근성
3. **Color** — 강조색 사용 규율, 60/30/10 준수
4. **Typography** — 글꼴 크기/굵기 제약 준수
5. **Spacing** — 그리드 정렬, 토큰 일관성
6. **Experience Design** — 로딩/오류/빈 상태 커버리지

**생성 산출물.** `{padded_phase}-UI-REVIEW.md` — 점수와 우선순위 수정사항

---

### 8. Milestone Management

**명령어:** `/gsd-audit-milestone`, `/gsd-complete-milestone`, `/gsd-new-milestone [name]`

**목적:** 마일스톤 완료를 검증하고, 보관하고, 릴리스 태그를 지정하며, 다음 개발 주기를 시작합니다.

**요구사항.**
- REQ-MILE-01: 감사는 모든 마일스톤 요구사항이 충족되었는지 확인해야 합니다.
- REQ-MILE-02: 감사는 스텁, 플레이스홀더 구현, 테스트되지 않은 코드를 감지해야 합니다.
- REQ-MILE-03: 감사는 페이즈 전반에 걸친 Nyquist 유효성 검사 준수 여부를 확인해야 합니다.
- REQ-MILE-04: 완료는 마일스톤 데이터를 MILESTONES.md에 보관해야 합니다.
- REQ-MILE-05: 완료는 릴리스용 git 태그 생성을 제안해야 합니다.
- REQ-MILE-06: 완료는 브랜칭 전략에 따라 스쿼시 병합 또는 히스토리 포함 병합을 제안해야 합니다.
- REQ-MILE-07: 완료는 UI 리뷰 스크린샷을 정리해야 합니다.
- REQ-MILE-08: 새 마일스톤은 new-project와 동일한 흐름을 따라야 합니다(질문 → 연구 → 요구사항 → 로드맵).
- REQ-MILE-09: 새 마일스톤은 기존 워크플로우 구성을 초기화해서는 안 됩니다.


---

## 계획 기능

### 9. Phase Management

**명령어:** `/gsd-phase`, `/gsd-phase --insert [N]`, `/gsd-phase --remove [N]`

**목적:** 개발 중 동적 로드맵 수정.

**요구사항.**
- REQ-PHASE-01: 추가는 현재 로드맵의 끝에 새 페이즈를 추가해야 합니다.
- REQ-PHASE-02: 삽입은 기존 페이즈 사이에 소수 번호를 사용해야 합니다(예: 3.1).
- REQ-PHASE-03: 제거는 이후의 모든 페이즈 번호를 다시 매겨야 합니다.
- REQ-PHASE-04: 이미 실행된 페이즈 제거를 방지해야 합니다.
- REQ-PHASE-05: 모든 작업은 ROADMAP.md를 업데이트하고 페이즈 디렉토리를 생성/제거해야 합니다.

---

### 10. Quick Mode

**명령어:** `/gsd-quick [--full] [--discuss] [--research]`

**목적:** GSD 보증을 제공하지만 더 빠른 경로로 임시 작업을 실행합니다.

**요구사항.**
- REQ-QUICK-01: 자유형 작업 설명을 받아야 합니다.
- REQ-QUICK-02: 전체 워크플로우와 동일한 플래너 및 실행자 에이전트를 사용해야 합니다.
- REQ-QUICK-03: 기본적으로 연구, 계획 검사기, 검증자를 건너뛰어야 합니다.
- REQ-QUICK-04: `--full` 플래그는 계획 검사(최대 2회 반복)와 실행 후 검증을 활성화해야 합니다.
- REQ-QUICK-05: `--discuss` 플래그는 간단한 사전 계획 논의를 실행해야 합니다.
- REQ-QUICK-06: `--research` 플래그는 계획 전에 집중된 연구 에이전트를 생성해야 합니다.
- REQ-QUICK-07: 플래그는 조합 가능해야 합니다(`--discuss --research --full`).
- REQ-QUICK-08: 빠른 작업을 `.planning/quick/YYMMDD-xxx-slug/`에 추적해야 합니다.
- REQ-QUICK-09: 빠른 작업 실행에 대한 원자적 커밋을 생성해야 합니다.

---

### 11. Autonomous Mode

**명령어:** `/gsd-autonomous [--from N]`

**목적:** 나머지 모든 페이즈를 자율적으로 실행합니다 — 페이즈별로 논의 → 계획 → 실행.

**요구사항.**
- REQ-AUTO-01: 로드맵 순서대로 완료되지 않은 모든 페이즈를 반복해야 합니다.
- REQ-AUTO-02: 각 페이즈에 대해 논의 → 계획 → 실행을 실행해야 합니다.
- REQ-AUTO-03: 명시적 사용자 결정이 필요한 경우 일시 중지해야 합니다(회색 지대 수락, 블로커, 유효성 검사).
- REQ-AUTO-04: 동적으로 삽입된 페이즈를 감지하기 위해 각 페이즈 후 ROADMAP.md를 다시 읽어야 합니다.
- REQ-AUTO-05: `--from N` 플래그는 특정 페이즈 번호부터 시작해야 합니다.

---

### 12. Freeform Routing

**명령어:** `/gsd-do`

**목적:** 자유형 텍스트를 분석하고 적절한 GSD 명령어로 라우팅합니다.

**요구사항.**
- REQ-DO-01: 자연어 입력에서 사용자 의도를 파악해야 합니다.
- REQ-DO-02: 의도를 가장 적합한 GSD 명령어에 매핑해야 합니다.
- REQ-DO-03: 실행 전에 라우팅을 사용자에게 확인해야 합니다.
- REQ-DO-04: 프로젝트가 존재하는 경우와 없는 경우를 다르게 처리해야 합니다.

---

### 13. Note Capture

**명령어:** `/gsd-note`

**목적:** 워크플로우를 방해하지 않고 아이디어를 즉시 캡처합니다. 타임스탬프가 있는 노트를 추가하거나, 모든 노트를 나열하거나, 노트를 구조화된 할 일로 승격합니다.

**요구사항.**
- REQ-NOTE-01: 단일 Write 호출로 타임스탬프가 있는 노트 파일을 저장해야 합니다.
- REQ-NOTE-02: 프로젝트 및 전역 범위의 모든 노트를 표시하는 `list` 하위 명령어를 지원해야 합니다.
- REQ-NOTE-03: 노트를 구조화된 할 일로 변환하는 `promote N` 하위 명령어를 지원해야 합니다.
- REQ-NOTE-04: 전역 범위 작업을 위한 `--global` 플래그를 지원해야 합니다.
- REQ-NOTE-05: Task, AskUserQuestion, Bash를 사용해서는 안 됩니다 — 인라인으로만 실행됩니다.

---

### 14. Auto-Advance (Next)

**명령어:** `/gsd-next`

**목적:** 현재 프로젝트 상태를 자동으로 감지하고 다음 논리적 워크플로우 단계로 진행합니다. 현재 어느 페이즈/단계에 있는지 기억할 필요가 없습니다.

**요구사항.**
- REQ-NEXT-01: STATE.md, ROADMAP.md, 페이즈 디렉토리를 읽어 현재 위치를 확인해야 합니다.
- REQ-NEXT-02: 논의, 계획, 실행, 검증 중 어느 것이 필요한지 감지해야 합니다.
- REQ-NEXT-03: 올바른 명령어를 자동으로 호출해야 합니다.
- REQ-NEXT-04: 프로젝트가 없으면 `/gsd-new-project`를 제안해야 합니다.
- REQ-NEXT-05: 모든 페이즈가 완료되면 `/gsd-complete-milestone`을 제안해야 합니다.

**상태 감지 로직.**
| 상태 | 액션 |
|-------|--------|
| `.planning/` 디렉토리 없음 | `/gsd-new-project` 제안 |
| 페이즈에 CONTEXT.md 없음 | `/gsd-discuss-phase` 실행 |
| 페이즈에 PLAN.md 파일 없음 | `/gsd-plan-phase` 실행 |
| 계획 있지만 SUMMARY.md 없음 | `/gsd-execute-phase` 실행 |
| 실행되었지만 VERIFICATION.md 없음 | `/gsd-verify-work` 실행 |
| 모든 페이즈 완료 | `/gsd-complete-milestone` 제안 |

---

## 품질 보증 기능

### 15. Nyquist Validation

**목적:** 코드 작성 전에 자동화된 테스트 커버리지를 페이즈 요구사항에 매핑합니다. Nyquist 샘플링 정리의 이름을 따서 명명되었으며 — 모든 요구사항에 피드백 신호가 존재하도록 보장합니다.

**요구사항.**
- REQ-NYQ-01: plan-phase 연구 중에 기존 테스트 인프라를 감지해야 합니다.
- REQ-NYQ-02: 각 요구사항을 특정 테스트 명령어에 매핑해야 합니다.
- REQ-NYQ-03: 웨이브 0 작업(구현 전에 필요한 테스트 스캐폴딩)을 식별해야 합니다.
- REQ-NYQ-04: 계획 검사기는 Nyquist 준수를 8번째 검증 차원으로 적용해야 합니다.
- REQ-NYQ-05: `/gsd-validate-phase`를 통한 소급 유효성 검사를 지원해야 합니다.
- REQ-NYQ-06: `workflow.nyquist_validation: false`로 비활성화 가능해야 합니다.

**생성 산출물.** `{phase}-VALIDATION.md` — 테스트 커버리지 계약

**소급 유효성 검사(`/gsd-validate-phase [N]`).**
- 구현을 스캔하고 요구사항을 테스트에 매핑합니다.
- 요구사항에 자동화된 검증이 없는 갭을 식별합니다.
- 테스트 생성을 위한 감사자를 생성합니다(최대 3회 시도).
- 구현 코드는 절대 수정하지 않습니다 — 테스트 파일과 VALIDATION.md만 수정합니다.
- 구현 버그는 사용자가 처리해야 할 에스컬레이션으로 표시합니다.

---

### 16. Plan Checking

**목적:** 실행 전에 계획이 페이즈 목표를 달성할 것인지를 목표 역방향으로 검증합니다.

**요구사항.**
- REQ-PLANCK-01: 8가지 품질 차원에 대해 계획을 검증해야 합니다.
- REQ-PLANCK-02: 계획이 통과할 때까지 최대 3회 반복해야 합니다.
- REQ-PLANCK-03: 실패에 대한 구체적이고 실행 가능한 피드백을 생성해야 합니다.
- REQ-PLANCK-04: `workflow.plan_check: false`로 비활성화 가능해야 합니다.

---

### 17. Post-Execution Verification

**목적:** 코드베이스가 페이즈가 약속한 것을 제공하는지 자동으로 확인합니다.

**요구사항.**
- REQ-POSTVER-01: 작업 완료가 아닌 페이즈 목표에 대해 확인해야 합니다.
- REQ-POSTVER-02: 합격/불합격 분석이 담긴 VERIFICATION.md를 생성해야 합니다.
- REQ-POSTVER-03: `/gsd-verify-work`가 처리할 문제를 기록해야 합니다.
- REQ-POSTVER-04: `workflow.verifier: false`로 비활성화 가능해야 합니다.

---

### 18. Node Repair

**목적:** 실행 중 작업 검증 실패 시 자율적 복구.

**요구사항.**
- REQ-REPAIR-01: 실패를 분석하고 RETRY, DECOMPOSE, PRUNE 중 하나의 전략을 선택해야 합니다.
- REQ-REPAIR-02: RETRY는 구체적인 조정으로 재시도해야 합니다.
- REQ-REPAIR-03: DECOMPOSE는 작업을 더 작고 검증 가능한 하위 단계로 분해해야 합니다.
- REQ-REPAIR-04: PRUNE은 달성 불가능한 작업을 제거하고 사용자에게 에스컬레이션해야 합니다.
- REQ-REPAIR-05: 복구 예산을 준수해야 합니다(기본값: 작업당 2회 시도).
- REQ-REPAIR-06: `workflow.node_repair_budget`과 `workflow.node_repair`로 구성 가능해야 합니다.

---

### 19. Health Validation

**명령어:** `/gsd-health [--repair]`

**목적:** `.planning/` 디렉토리 무결성을 검증하고 문제를 자동으로 복구합니다.

**요구사항.**
- REQ-HEALTH-01: 누락된 필수 파일을 확인해야 합니다.
- REQ-HEALTH-02: 구성 일관성을 검증해야 합니다.
- REQ-HEALTH-03: 요약 없이 고아가 된 계획을 감지해야 합니다.
- REQ-HEALTH-04: 페이즈 번호 매기기와 로드맵 동기화를 확인해야 합니다.
- REQ-HEALTH-05: `--repair` 플래그는 복구 가능한 문제를 자동으로 수정해야 합니다.

---

### 20. Cross-Phase Regression Gate

**목적:** 페이즈 실행 후 이전 페이즈의 테스트 스위트를 실행하여 회귀가 여러 페이즈에 걸쳐 누적되는 것을 방지합니다.

**요구사항.**
- REQ-REGR-01: 페이즈 실행 후 완료된 모든 이전 페이즈의 테스트 스위트를 실행해야 합니다.
- REQ-REGR-02: 모든 테스트 실패를 교차 페이즈 회귀로 보고해야 합니다.
- REQ-REGR-03: 회귀는 실행 후 검증 전에 표시되어야 합니다.
- REQ-REGR-04: 어느 이전 페이즈의 테스트가 실패했는지 식별해야 합니다.

**실행 시점.** `/gsd-execute-phase` 중 검증자 단계 전에 자동으로 실행됩니다.

---

### 21. Requirements Coverage Gate

**목적:** 계획 완료 전에 모든 페이즈 요구사항이 최소 하나의 계획에 포함되어 있는지 확인합니다.

**요구사항.**
- REQ-COVGATE-01: ROADMAP.md에서 페이즈에 할당된 모든 요구사항 ID를 추출해야 합니다.
- REQ-COVGATE-02: 각 요구사항이 최소 하나의 PLAN.md에 나타나는지 확인해야 합니다.
- REQ-COVGATE-03: 포함되지 않은 요구사항은 계획 완료를 차단해야 합니다.
- REQ-COVGATE-04: 계획 커버리지가 없는 특정 요구사항을 보고해야 합니다.

**실행 시점.** `/gsd-plan-phase`의 계획 검사기 루프 후 자동으로 실행됩니다.

---

## 컨텍스트 엔지니어링 기능

### 22. Context Window Monitoring

**목적:** 컨텍스트가 부족할 때 사용자와 에이전트 모두에게 경고하여 컨텍스트 로트를 방지합니다.

**요구사항.**
- REQ-CTX-01: 상태표시줄은 사용자에게 컨텍스트 사용률을 표시해야 합니다.
- REQ-CTX-02: 컨텍스트 모니터는 남은 용량 ≤35%(WARNING)에서 에이전트 대상 경고를 주입해야 합니다.
- REQ-CTX-03: 컨텍스트 모니터는 남은 용량 ≤25%(CRITICAL)에서 에이전트 대상 경고를 주입해야 합니다.
- REQ-CTX-04: 경고는 디바운스되어야 합니다(반복 경고 사이에 5회 도구 사용).
- REQ-CTX-05: 심각도 에스컬레이션(WARNING→CRITICAL)은 디바운스를 우회해야 합니다.
- REQ-CTX-06: 컨텍스트 모니터는 GSD 활성 프로젝트와 비활성 프로젝트를 구분해야 합니다.
- REQ-CTX-07: 경고는 권고 사항이어야 하며 사용자 선호도를 재정의하는 명령적 지시가 되어서는 안 됩니다.
- REQ-CTX-08: 모든 훅은 자동으로 실패해야 하며 도구 실행을 차단해서는 안 됩니다.

**아키텍처.** 두 부분으로 구성된 브리지 시스템.
1. 상태표시줄이 `/tmp/claude-ctx-{session}.json`에 지표를 기록합니다.
2. 컨텍스트 모니터가 지표를 읽고 `additionalContext` 경고를 주입합니다.

---

### 23. Session Management

**명령어:** `/gsd-pause-work`, `/gsd-resume-work`, `/gsd-progress`

**목적:** 컨텍스트 초기화와 세션 간에 프로젝트 연속성을 유지합니다.

**요구사항.**
- REQ-SESSION-01: 일시 중지는 현재 위치와 다음 단계를 `continue-here.md`와 구조화된 `HANDOFF.json`에 저장해야 합니다.
- REQ-SESSION-02: 재개는 HANDOFF.json(우선)이나 상태 파일(대체)에서 전체 프로젝트 컨텍스트를 복원해야 합니다.
- REQ-SESSION-03: 진행 상황은 현재 위치, 다음 액션, 전체 완료도를 표시해야 합니다.
- REQ-SESSION-04: 진행 상황은 모든 상태 파일(STATE.md, ROADMAP.md, 페이즈 디렉토리)을 읽어야 합니다.
- REQ-SESSION-05: 모든 세션 작업은 `/clear`(컨텍스트 초기화) 후에도 작동해야 합니다.
- REQ-SESSION-06: HANDOFF.json은 블로커, 보류 중인 사람 액션, 진행 중인 작업 상태를 포함해야 합니다.
- REQ-SESSION-07: 재개는 세션 시작 시 즉시 사람 액션과 블로커를 표시해야 합니다.

---

### 24. Session Reporting

**명령어:** `/gsd-session-report`

**목적:** 수행된 작업, 달성된 결과, 예상 리소스 사용량을 캡처하는 구조화된 세션 후 요약 문서를 생성합니다.

**요구사항.**
- REQ-REPORT-01: STATE.md, git log, 계획/요약 파일에서 데이터를 수집해야 합니다.
- REQ-REPORT-02: 커밋 수, 실행된 계획, 진행된 페이즈를 포함해야 합니다.
- REQ-REPORT-03: 세션 활동을 기반으로 토큰 사용량과 비용을 추정해야 합니다.
- REQ-REPORT-04: 활성 블로커와 결정사항을 포함해야 합니다.
- REQ-REPORT-05: 다음 단계를 권장해야 합니다.

**생성 산출물.** `.planning/reports/SESSION_REPORT.md`

**보고서 섹션.**
- 세션 개요(기간, 마일스톤, 페이즈)
- 수행된 작업(커밋, 계획, 페이즈)
- 결과 및 결과물
- 블로커 및 결정사항
- 리소스 추정(토큰, 비용)
- 다음 단계 권장사항

---

### 25. Multi-Agent Orchestration

**목적:** 각 작업에 대해 새로운 컨텍스트 창을 가진 전문 에이전트를 조율합니다.

**요구사항.**
- REQ-ORCH-01: 각 에이전트는 새로운 컨텍스트 창을 받아야 합니다.
- REQ-ORCH-02: 오케스트레이터는 간결해야 합니다 — 에이전트를 생성하고 결과를 수집하여 다음으로 라우팅합니다.
- REQ-ORCH-03: 컨텍스트 페이로드는 모든 관련 프로젝트 산출물을 포함해야 합니다.
- REQ-ORCH-04: 병렬 에이전트는 진정으로 독립적이어야 합니다(공유 가변 상태 없음).
- REQ-ORCH-05: 에이전트 결과는 오케스트레이터가 처리하기 전에 디스크에 기록되어야 합니다.
- REQ-ORCH-06: 실패한 에이전트는 감지되어야 합니다(실제 출력과 보고된 실패를 대조 확인).

---

### 26. Model Profiles

**명령어:** `/gsd-config --profile <quality|balanced|budget|inherit>`

**목적:** 각 에이전트가 사용하는 AI 모델을 제어하여 품질과 비용의 균형을 맞춥니다.

**요구사항.**
- REQ-MODEL-01: 4가지 프로파일을 지원해야 합니다. `quality`, `balanced`, `budget`, `inherit`
- REQ-MODEL-02: 각 프로파일은 에이전트별 모델 티어를 정의해야 합니다(프로파일 표 참조).
- REQ-MODEL-03: 에이전트별 재정의는 프로파일보다 우선해야 합니다.
- REQ-MODEL-04: `inherit` 프로파일은 런타임의 현재 모델 선택을 따라야 합니다.
- REQ-MODEL-04a: `inherit` 프로파일은 비Anthropic 공급자(OpenRouter, 로컬 모델) 사용 시 예상치 못한 API 비용을 피하기 위해 사용해야 합니다.
- REQ-MODEL-05: 프로파일 전환은 프로그래밍 방식이어야 합니다(LLM 기반이 아닌 스크립트).
- REQ-MODEL-06: 모델 해석은 생성당 한 번이 아닌 오케스트레이션당 한 번 수행해야 합니다.

**프로파일 할당.**

| 에이전트 | `quality` | `balanced` | `budget` | `inherit` |
|-------|-----------|------------|----------|-----------|
| gsd-planner | Opus | Opus | Sonnet | Inherit |
| gsd-roadmapper | Opus | Sonnet | Sonnet | Inherit |
| gsd-executor | Opus | Sonnet | Sonnet | Inherit |
| gsd-phase-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-project-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku | Inherit |
| gsd-debugger | Opus | Sonnet | Sonnet | Inherit |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku | Inherit |
| gsd-verifier | Sonnet | Sonnet | Haiku | Inherit |
| gsd-plan-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-integration-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-nyquist-auditor | Sonnet | Sonnet | Haiku | Inherit |

---

## 브라운필드 기능

### 27. Codebase Mapping

**명령어:** `/gsd-map-codebase [area]`

**목적:** 새 프로젝트를 시작하기 전에 기존 코드베이스를 분석하여 GSD가 무엇이 존재하는지 이해하도록 합니다.

**요구사항.**
- REQ-MAP-01: 각 분석 영역에 대한 병렬 매퍼 에이전트를 생성해야 합니다.
- REQ-MAP-02: `.planning/codebase/`에 구조화된 문서를 생성해야 합니다.
- REQ-MAP-03: 기술 스택, 아키텍처 패턴, 코딩 규범, 문제점을 감지해야 합니다.
- REQ-MAP-04: 이후 `/gsd-new-project`는 코드베이스 매핑을 로드하고 추가하는 내용에 대한 질문에 집중해야 합니다.
- REQ-MAP-05: 선택적 `[area]` 인수는 매핑 범위를 특정 영역으로 제한해야 합니다.

**생성 산출물.**
| 문서 | 내용 |
|----------|---------|
| `STACK.md` | 언어, 프레임워크, 데이터베이스, 인프라 |
| `ARCHITECTURE.md` | 패턴, 레이어, 데이터 흐름, 경계 |
| `CONVENTIONS.md` | 명명, 파일 구성, 코드 스타일, 테스트 패턴 |
| `CONCERNS.md` | 기술 부채, 보안 문제, 성능 병목 |
| `STRUCTURE.md` | 디렉토리 레이아웃과 파일 구성 |
| `TESTING.md` | 테스트 인프라, 커버리지, 패턴 |
| `INTEGRATIONS.md` | 외부 서비스, API, 서드파티 의존성 |

---

## 유틸리티 기능

### 28. Debug System

**명령어:** `/gsd-debug [description]`

**목적:** 컨텍스트 초기화 전반에 걸쳐 영구적인 상태로 체계적인 디버깅을 수행합니다.

**요구사항.**
- REQ-DEBUG-01: `.planning/debug/`에 디버그 세션 파일을 작성해야 합니다.
- REQ-DEBUG-02: 가설, 증거, 제거된 이론을 추적해야 합니다.
- REQ-DEBUG-03: 디버깅이 컨텍스트 초기화 후에도 유지되도록 상태를 저장해야 합니다.
- REQ-DEBUG-04: 해결됨으로 표시하기 전에 사람의 확인을 요구해야 합니다.
- REQ-DEBUG-05: 해결된 세션은 `.planning/debug/knowledge-base.md`에 추가되어야 합니다.
- REQ-DEBUG-06: 재조사를 방지하기 위해 새 디버그 세션에서 지식 베이스를 참조해야 합니다.

**디버그 세션 상태.** `gathering` → `investigating` → `fixing` → `verifying` → `awaiting_human_verify` → `resolved`

---

### 29. Todo Management

**명령어:** `/gsd-capture [desc]`, `/gsd-capture --list`

**목적:** 세션 중 나중에 처리할 아이디어와 작업을 캡처합니다.

**요구사항.**
- REQ-TODO-01: 현재 대화 컨텍스트에서 할 일을 캡처해야 합니다.
- REQ-TODO-02: 할 일은 `.planning/todos/pending/`에 저장되어야 합니다.
- REQ-TODO-03: 완료된 할 일은 `.planning/todos/completed/`으로 이동해야 합니다.
- REQ-TODO-04: check-todos는 모든 보류 항목을 나열하고 하나를 선택하여 작업할 수 있어야 합니다.

---

### 30. Statistics Dashboard

**명령어:** `/gsd-stats`

**목적:** 프로젝트 지표를 표시합니다 — 페이즈, 계획, 요구사항, git 히스토리, 타임라인.

**요구사항.**
- REQ-STATS-01: 페이즈/계획 완료 수를 표시해야 합니다.
- REQ-STATS-02: 요구사항 커버리지를 표시해야 합니다.
- REQ-STATS-03: git 커밋 지표를 표시해야 합니다.
- REQ-STATS-04: 여러 출력 형식을 지원해야 합니다(json, table, bar).

---

### 31. Update System

**명령어:** `/gsd-update`

**목적:** 변경 로그 미리보기와 함께 GSD를 최신 버전으로 업데이트합니다.

**요구사항.**
- REQ-UPDATE-01: npm을 통해 새 버전을 확인해야 합니다.
- REQ-UPDATE-02: 업데이트 전에 새 버전의 변경 로그를 표시해야 합니다.
- REQ-UPDATE-03: 런타임을 인식하고 올바른 디렉토리를 대상으로 해야 합니다.
- REQ-UPDATE-04: 로컬에서 수정된 파일을 `gsd-local-patches/`에 백업해야 합니다.
- REQ-UPDATE-05: `/gsd-update --reapply`는 업데이트 후 로컬 수정사항을 복원해야 합니다.

---

### 32. Settings Management

**명령어:** `/gsd-settings`

**목적:** 워크플로우 토글과 모델 프로파일의 대화형 구성.

**요구사항.**
- REQ-SETTINGS-01: 토글 옵션과 함께 현재 설정을 표시해야 합니다.
- REQ-SETTINGS-02: `.planning/config.json`을 업데이트해야 합니다.
- REQ-SETTINGS-03: 전역 기본값으로 저장하는 것을 지원해야 합니다(`~/.gsd/defaults.json`).

**구성 가능한 설정.**
| 설정 | 유형 | 기본값 | 설명 |
|---------|------|---------|-------------|
| `mode` | enum | `interactive` | `interactive` 또는 `yolo`(자동 승인) |
| `granularity` | enum | `standard` | `coarse`, `standard`, 또는 `fine` |
| `model_profile` | enum | `balanced` | `quality`, `balanced`, `budget`, 또는 `inherit` |
| `workflow.research` | boolean | `true` | 계획 전 도메인 연구 |
| `workflow.plan_check` | boolean | `true` | 계획 검증 루프 |
| `workflow.verifier` | boolean | `true` | 실행 후 검증 |
| `workflow.auto_advance` | boolean | `false` | 논의→계획→실행 자동 연결 |
| `workflow.nyquist_validation` | boolean | `true` | Nyquist 테스트 커버리지 매핑 |
| `workflow.ui_phase` | boolean | `true` | UI 설계 계약 생성 |
| `workflow.ui_safety_gate` | boolean | `true` | 프론트엔드 페이즈에서 ui-phase 촉구 |
| `workflow.node_repair` | boolean | `true` | 자율적 작업 복구 |
| `workflow.node_repair_budget` | number | `2` | 작업당 최대 복구 시도 횟수 |
| `planning.commit_docs` | boolean | `true` | `.planning/` 파일을 git에 커밋 |
| `planning.search_gitignored` | boolean | `false` | 검색에 gitignore된 파일 포함 |
| `parallelization.enabled` | boolean | `true` | 독립적인 계획을 동시에 실행 |
| `git.branching_strategy` | enum | `none` | `none`, `phase`, 또는 `milestone` |

---

### 33. Test Generation

**명령어:** `/gsd-add-tests [N]`

**목적:** UAT 기준과 구현을 기반으로 완료된 페이즈에 대한 테스트를 생성합니다.

**요구사항.**
- REQ-TEST-01: 완료된 페이즈 구현을 분석해야 합니다.
- REQ-TEST-02: UAT 기준과 인수 기준을 기반으로 테스트를 생성해야 합니다.
- REQ-TEST-03: 기존 테스트 인프라 패턴을 사용해야 합니다.

---

## 인프라 기능

### 34. Git Integration

**목적:** 원자적 커밋, 브랜칭 전략, 깔끔한 히스토리 관리.

**요구사항.**
- REQ-GIT-01: 각 작업은 고유한 원자적 커밋을 가져야 합니다.
- REQ-GIT-02: 커밋 메시지는 구조화된 형식을 따라야 합니다: `type(scope): description`
- REQ-GIT-03: 3가지 브랜칭 전략을 지원해야 합니다: `none`, `phase`, `milestone`
- REQ-GIT-04: phase 전략은 페이즈당 하나의 브랜치를 생성해야 합니다.
- REQ-GIT-05: milestone 전략은 마일스톤당 하나의 브랜치를 생성해야 합니다.
- REQ-GIT-06: complete-milestone은 스쿼시 병합(권장) 또는 히스토리 포함 병합을 제공해야 합니다.
- REQ-GIT-07: `.planning/` 파일에 대한 `commit_docs` 설정을 준수해야 합니다.
- REQ-GIT-08: `.gitignore`에서 `.planning/`을 자동 감지하고 커밋을 건너뛰어야 합니다.

**커밋 형식.**
```
type(phase-plan): description

# 예시:
docs(08-02): complete user registration plan
feat(08-02): add email confirmation flow
fix(03-01): correct auth token expiry
```

---

### 35. CLI Tools

**목적:** 반복적인 인라인 bash 패턴을 대체하는 워크플로우와 에이전트를 위한 프로그래밍 방식의 유틸리티.

**요구사항.**
- REQ-CLI-01: 상태, 구성, 페이즈, 로드맵 작업을 위한 원자적 명령어를 제공해야 합니다.
- REQ-CLI-02: 각 워크플로우에 대한 모든 컨텍스트를 로드하는 복합 `init` 명령어를 제공해야 합니다.
- REQ-CLI-03: 기계 판독 가능한 출력을 위한 `--raw` 플래그를 지원해야 합니다.
- REQ-CLI-04: 샌드박스 하위 에이전트 작업을 위한 `--cwd` 플래그를 지원해야 합니다.
- REQ-CLI-05: 모든 작업은 Windows에서 슬래시 경로를 사용해야 합니다.

**명령어 카테고리.** State(11개), Phase(5개), Roadmap(3개), Verify(8개), Template(2개), Frontmatter(4개), Scaffold(4개), Init(12개), Validate(2개), Progress, Stats, Todo

---

### 36. Multi-Runtime Support

**목적:** 여러 AI 코딩 에이전트 런타임에서 GSD를 실행합니다.

**요구사항.**
- REQ-RUNTIME-01: Claude Code, OpenCode, Gemini CLI, Kilo, Codex, Copilot, Antigravity를 지원해야 합니다.
- REQ-RUNTIME-02: 설치 프로그램은 런타임별로 콘텐츠를 변환해야 합니다(도구 이름, 경로, 프론트매터).
- REQ-RUNTIME-03: 설치 프로그램은 대화형 및 비대화형(`--claude --global`) 모드를 모두 지원해야 합니다.
- REQ-RUNTIME-04: 설치 프로그램은 전역 및 로컬 설치를 모두 지원해야 합니다.
- REQ-RUNTIME-05: 제거는 다른 구성에 영향을 주지 않고 모든 GSD 파일을 깔끔하게 제거해야 합니다.
- REQ-RUNTIME-06: 설치 프로그램은 플랫폼 차이를 처리해야 합니다(Windows, macOS, Linux, WSL, Docker).

**런타임 변환.**

| 측면 | Claude Code | OpenCode | Gemini | Kilo | Codex | Copilot | Antigravity |
|--------|------------|----------|--------|-------|-------|---------|-------------|
| 명령어 | 슬래시 명령어 | 슬래시 명령어 | 슬래시 명령어 | 슬래시 명령어 | Skills(TOML) | 슬래시 명령어 | Skills |
| 에이전트 형식 | Claude native | `mode: subagent` | Claude native | `mode: subagent` | Skills | Tool mapping | Skills |
| 훅 이벤트 | `PostToolUse` | N/A | `AfterTool` | N/A | N/A | N/A | N/A |
| 구성 | `settings.json` | `opencode.json(c)` | `settings.json` | `kilo.json(c)` | TOML | Instructions | Config |

---

### 37. Hook System

**목적:** 컨텍스트 모니터링, 상태 표시, 업데이트 확인을 위한 런타임 이벤트 훅.

**요구사항.**
- REQ-HOOK-01: 상태표시줄은 모델, 현재 작업, 디렉토리, 컨텍스트 사용량을 표시해야 합니다.
- REQ-HOOK-02: 컨텍스트 모니터는 임계값에서 에이전트 대상 경고를 주입해야 합니다.
- REQ-HOOK-03: 업데이트 확인기는 세션 시작 시 백그라운드에서 실행되어야 합니다.
- REQ-HOOK-04: 모든 훅은 `CLAUDE_CONFIG_DIR` 환경 변수를 준수해야 합니다.
- REQ-HOOK-05: 모든 훅은 3초 stdin 타임아웃 가드를 포함해야 합니다.
- REQ-HOOK-06: 모든 훅은 오류 시 자동으로 실패해야 합니다.
- REQ-HOOK-07: 컨텍스트 사용량은 autocompact 버퍼(16.5% 예약)에 맞게 정규화해야 합니다.

**상태표시줄 표시.**
```
[⬆ /gsd-update │] model │ [current task │] directory [█████░░░░░ 50%]
```

색상 코드: <50% 초록, <65% 노랑, <80% 주황, ≥80% 해골 이모지와 함께 빨강

### 38. Developer Profiling

**명령어:** `/gsd-profile-user [--questionnaire] [--refresh]`

**목적:** Claude Code 세션 히스토리를 분석하여 8가지 차원에서 행동 프로파일을 구축하고, 개발자의 스타일에 맞게 Claude 응답을 개인화하는 산출물을 생성합니다.

**차원.**
1. 커뮤니케이션 스타일(간결 vs 장황, 공식 vs 비공식)
2. 결정 패턴(신속 vs 신중, 위험 허용도)
3. 디버깅 접근 방식(체계적 vs 직관적, 로그 선호도)
4. UX 선호도(디자인 감각, 접근성 인식)
5. 벤더/기술 선택(프레임워크 선호도, 생태계 숙련도)
6. 불만 요인(워크플로우에서 마찰을 일으키는 요소)
7. 학습 스타일(문서 vs 예시, 깊이 선호도)
8. 설명 깊이(고수준 vs 구현 세부 사항)

**생성 산출물.**
- `USER-PROFILE.md` — 증거 인용이 포함된 전체 행동 프로파일
- `/gsd-dev-preferences` 명령어 — 모든 세션에서 선호도 로드
- `CLAUDE.md` 프로파일 섹션 — Claude Code가 자동으로 검색

**플래그.**
- `--questionnaire` — 세션 히스토리를 사용할 수 없을 때 대화형 설문지 대체
- `--refresh` — 세션을 재분석하고 프로파일 재생성

**파이프라인 모듈.**
- `profile-pipeline.cjs` — 세션 스캐닝, 메시지 추출, 샘플링
- `profile-output.cjs` — 프로파일 렌더링, 설문지, 산출물 생성
- `gsd-user-profiler` 에이전트 — 세션 데이터에서 행동 분석

**요구사항.**
- REQ-PROF-01: 세션 분석은 최소 8가지 행동 차원을 다루어야 합니다.
- REQ-PROF-02: 프로파일은 실제 세션 메시지에서 증거를 인용해야 합니다.
- REQ-PROF-03: 세션 히스토리가 없을 때 설문지가 대체 수단으로 제공되어야 합니다.
- REQ-PROF-04: 생성된 산출물은 Claude Code가 검색할 수 있어야 합니다(CLAUDE.md 통합).

### 39. Execution Hardening

**목적:** 교차 계획 실패가 연쇄적으로 발생하기 전에 잡아내는 실행 파이프라인에 대한 세 가지 추가 품질 개선.

**구성 요소.**

**1. 사전 웨이브 의존성 확인** (execute-phase)
웨이브 N+1을 생성하기 전에 이전 웨이브 산출물의 핵심 링크가 존재하고 올바르게 연결되어 있는지 확인합니다. 교차 계획 의존성 갭이 다운스트림 실패로 연쇄되기 전에 잡아냅니다.

**2. 교차 계획 데이터 계약 — 차원 9** (plan-checker)
데이터 파이프라인을 공유하는 계획에 호환 가능한 변환이 있는지 확인하는 새 분석 차원입니다. 한 계획이 다른 계획이 원본 형태로 필요로 하는 데이터를 제거할 때 표시합니다.

**3. 내보내기 수준 스팟 체크** (verify-phase)
레벨 3 배선 검증이 통과된 후 개별 내보내기의 실제 사용을 스팟 체크합니다. 배선된 파일에 존재하지만 호출되지 않는 데드 스토어를 잡아냅니다.

**요구사항.**
- REQ-HARD-01: 사전 웨이브 확인은 다음 웨이브를 생성하기 전에 모든 이전 웨이브 산출물의 핵심 링크를 확인해야 합니다.
- REQ-HARD-02: 교차 계획 계약 확인은 계획 간 호환되지 않는 데이터 변환을 감지해야 합니다.
- REQ-HARD-03: 내보내기 스팟 체크는 배선된 파일의 데드 스토어를 식별해야 합니다.

---

### 40. Verification Debt Tracking

**명령어:** `/gsd-audit-uat`

**목적:** 프로젝트가 미결 테스트가 있는 페이즈를 넘어 진행할 때 UAT/검증 항목이 자동으로 누락되는 것을 방지합니다. 모든 이전 페이즈에 걸쳐 검증 부채를 표시하여 항목이 잊히지 않도록 합니다.

**구성 요소.**

**1. 교차 페이즈 상태 확인** (progress.md 1.6단계)
모든 `/gsd-progress` 호출은 현재 마일스톤의 모든 페이즈에서 미결 항목(pending, skipped, blocked, human_needed)을 스캔합니다. 실행 가능한 링크가 포함된 비차단 경고 섹션을 표시합니다.

**2. `status: partial`** (verify-work.md, UAT.md)
"세션 종료"와 "모든 테스트 해결" 사이를 구분하는 새 UAT 상태입니다. 테스트가 여전히 pending, blocked, 또는 이유 없이 skipped된 경우 `status: complete`를 방지합니다.

**3. `blocked_by` 태그가 있는 `result: blocked`** (verify-work.md, UAT.md)
외부 의존성(서버, 물리적 장치, 릴리스 빌드, 서드파티 서비스)으로 인해 차단된 테스트의 새 테스트 결과 유형입니다. 건너뛴 테스트와는 별도로 분류됩니다.

**4. HUMAN-UAT.md 영속성** (execute-phase.md)
검증이 `human_needed`를 반환할 때 항목은 `status: partial`이 있는 추적 가능한 HUMAN-UAT.md 파일로 저장됩니다. 교차 페이즈 상태 확인과 감사 시스템에 반영됩니다.

**5. 페이즈 완료 경고** (phase.cjs, transition.md)
`phase complete` CLI는 JSON 출력에 검증 부채 경고를 반환합니다. 전환 워크플로우는 확인 전에 미결 항목을 표시합니다.

**요구사항.**
- REQ-DEBT-01: `/gsd-progress`에서 모든 이전 페이즈의 미결 UAT/검증 항목을 표시해야 합니다.
- REQ-DEBT-02: 불완전한 테스트(partial)와 완료된 테스트(complete)를 구분해야 합니다.
- REQ-DEBT-03: 차단된 테스트를 `blocked_by` 태그로 분류해야 합니다.
- REQ-DEBT-04: human_needed 검증 항목을 추적 가능한 UAT 파일로 저장해야 합니다.
- REQ-DEBT-05: 검증 부채가 있을 때 페이즈 완료와 전환 중에 경고해야 합니다(비차단).
- REQ-DEBT-06: `/gsd-audit-uat`는 모든 페이즈를 스캔하고 테스트 가능성별로 항목을 분류하며 사람 테스트 계획을 생성해야 합니다.

---

## v1.27 기능

### 41. Fast Mode

**명령어:** `/gsd-fast [task description]`

**목적:** 하위 에이전트를 생성하거나 PLAN.md 파일을 생성하지 않고 인라인으로 간단한 작업을 실행합니다. 계획 오버헤드를 정당화하기에는 너무 작은 작업에 사용합니다: 오타 수정, 구성 변경, 작은 리팩터링, 잊혀진 커밋, 간단한 추가.

**요구사항.**
- REQ-FAST-01: 하위 에이전트 없이 현재 컨텍스트에서 직접 작업을 실행해야 합니다.
- REQ-FAST-02: 변경사항에 대한 원자적 git 커밋을 생성해야 합니다.
- REQ-FAST-03: 상태 일관성을 위해 `.planning/quick/`에 작업을 추적해야 합니다.
- REQ-FAST-04: 연구, 다단계 계획, 또는 검증이 필요한 작업에는 사용해서는 안 됩니다.

**`/gsd-quick`과 비교하여 사용 시점.**
- `/gsd-fast` — 2분 이내에 실행 가능한 한 문장 작업(오타, 구성 변경, 작은 추가)
- `/gsd-quick` — 연구, 다단계 계획, 또는 검증이 필요한 모든 것

---

### 42. Cross-AI Peer Review

**명령어:** `/gsd-review --phase N [--gemini] [--claude] [--codex] [--coderabbit] [--opencode] [--qwen] [--cursor] [--all]`

**목적:** 외부 AI CLI(Gemini, Claude, Codex, CodeRabbit, OpenCode, Qwen Code, Cursor)를 호출하여 페이즈 계획을 독립적으로 검토합니다. 검토자별 피드백이 담긴 구조화된 REVIEWS.md를 생성합니다.

**요구사항.**
- REQ-REVIEW-01: 시스템에서 사용 가능한 AI CLI를 감지해야 합니다.
- REQ-REVIEW-02: 페이즈 계획에서 구조화된 검토 프롬프트를 작성해야 합니다.
- REQ-REVIEW-03: 선택된 각 CLI를 독립적으로 호출해야 합니다.
- REQ-REVIEW-04: 응답을 수집하고 `REVIEWS.md`를 생성해야 합니다.
- REQ-REVIEW-05: 검토는 `/gsd-plan-phase --reviews`가 사용할 수 있어야 합니다.

**생성 산출물.** `{phase}-REVIEWS.md` — 검토자별 구조화된 피드백

---

### 43. Backlog Parking Lot

**명령어:** `/gsd-capture --backlog <description>`, `/gsd-review-backlog`, `/gsd-capture --seed <idea>`

**목적:** 아직 적극적인 계획에 준비되지 않은 아이디어를 캡처합니다. 백로그 항목은 활성 페이즈 순서 밖에 있기 위해 999.x 번호를 사용합니다. 시드는 올바른 마일스톤에서 자동으로 표시되는 트리거 조건이 있는 미래 지향적 아이디어입니다.

**요구사항.**
- REQ-BACKLOG-01: 백로그 항목은 활성 페이즈 순서 밖에 있기 위해 999.x 번호를 사용해야 합니다.
- REQ-BACKLOG-02: `/gsd-discuss-phase`와 `/gsd-plan-phase`가 작동할 수 있도록 페이즈 디렉토리를 즉시 생성해야 합니다.
- REQ-BACKLOG-03: `/gsd-review-backlog`는 항목별로 승격, 유지, 제거 액션을 지원해야 합니다.
- REQ-BACKLOG-04: 승격된 항목은 활성 마일스톤 순서로 번호가 다시 매겨져야 합니다.
- REQ-SEED-01: 시드는 표시 조건에 대한 전체 이유와 시기를 캡처해야 합니다.
- REQ-SEED-02: `/gsd-new-milestone`은 시드를 스캔하고 일치하는 항목을 표시해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `.planning/phases/999.x-slug/` | 백로그 항목 디렉토리 |
| `.planning/seeds/SEED-NNN-slug.md` | 트리거 조건이 있는 시드 |

---

### 44. Persistent Context Threads

**명령어:** `/gsd-thread [name | description]`

**목적:** 여러 세션에 걸쳐 있지만 특정 페이즈에 속하지 않는 작업을 위한 가벼운 교차 세션 지식 저장소입니다. `/gsd-pause-work`보다 더 가볍습니다 — 페이즈 상태나 계획 컨텍스트가 없습니다.

**요구사항.**
- REQ-THREAD-01: 생성, 나열, 재개 모드를 지원해야 합니다.
- REQ-THREAD-02: 스레드는 `.planning/threads/`에 마크다운 파일로 저장되어야 합니다.
- REQ-THREAD-03: 스레드 파일은 Goal, Context, References, Next Steps 섹션을 포함해야 합니다.
- REQ-THREAD-04: 스레드 재개는 전체 컨텍스트를 현재 세션에 로드해야 합니다.
- REQ-THREAD-05: 스레드는 페이즈나 백로그 항목으로 승격될 수 있어야 합니다.

**생성 산출물.** `.planning/threads/{slug}.md` — 지속적 컨텍스트 스레드

---

### 45. PR Branch Filtering

**명령어:** `/gsd-pr-branch [target branch]`

**목적:** `.planning/` 커밋을 필터링하여 풀 리퀘스트에 적합한 깔끔한 브랜치를 생성합니다. 검토자는 GSD 계획 산출물이 아닌 코드 변경사항만 봅니다.

**요구사항.**
- REQ-PRBRANCH-01: `.planning/` 파일만 수정하는 커밋을 식별해야 합니다.
- REQ-PRBRANCH-02: 계획 커밋이 필터링된 새 브랜치를 생성해야 합니다.
- REQ-PRBRANCH-03: 코드 변경사항은 커밋된 그대로 정확히 보존되어야 합니다.

---

### 46. Security Hardening

**목적:** GSD 계획 산출물에 대한 심층 방어 보안. GSD가 LLM 시스템 프롬프트가 되는 마크다운 파일을 생성하기 때문에, 이 파일로 흘러드는 사용자 제어 텍스트는 잠재적인 간접 프롬프트 주입 벡터입니다.

**구성 요소.**

**1. 중앙화된 보안 모듈** (`security.cjs`)
- 경로 순회 방지 — 파일 경로가 프로젝트 디렉토리 내에서 확인되는지 검증합니다.
- 프롬프트 주입 감지 — 사용자 제공 텍스트에서 알려진 주입 패턴을 스캔합니다.
- 안전한 JSON 파싱 — 상태 손상 전에 잘못된 입력을 포착합니다.
- 필드 이름 검증 — 구성 필드 이름을 통한 주입을 방지합니다.
- 셸 인수 검증 — 셸 보간 전에 사용자 텍스트를 살균합니다.

**2. 프롬프트 주입 가드 훅** (`gsd-prompt-guard.js`)
`.planning/`을 대상으로 하는 Write/Edit 호출에서 주입 패턴을 스캔하는 PreToolUse 훅입니다. 정당한 작업을 차단하지 않고 인식을 위해 감지를 기록하는 권고 전용입니다.

**3. 워크플로우 가드 훅** (`gsd-workflow-guard.js`)
Claude가 GSD 워크플로우 컨텍스트 밖에서 파일 편집을 시도하는 것을 감지하는 PreToolUse 훅입니다. 직접 편집 대신 `/gsd-quick` 또는 `/gsd-fast` 사용을 권고합니다. `hooks.workflow_guard`로 구성 가능합니다(기본값: false).

**4. CI 준비 주입 스캐너** (`prompt-injection-scan.test.cjs`)
모든 에이전트, 워크플로우, 명령어 파일에서 포함된 주입 벡터를 스캔하는 테스트 스위트입니다.

**요구사항.**
- REQ-SEC-01: 모든 사용자 제공 파일 경로는 프로젝트 디렉토리에 대해 검증되어야 합니다.
- REQ-SEC-02: 프롬프트 주입 패턴은 텍스트가 계획 산출물에 들어가기 전에 감지되어야 합니다.
- REQ-SEC-03: 보안 훅은 권고 전용이어야 합니다(정당한 작업을 절대 차단하지 않음).
- REQ-SEC-04: 사용자 입력의 JSON 파싱은 잘못된 데이터를 정상적으로 처리해야 합니다.
- REQ-SEC-05: macOS `/var` → `/private/var` 심링크 해석은 경로 검증에서 처리되어야 합니다.

---

### 47. Multi-Repo Workspace Support

**목적:** 모노저장소 및 멀티 저장소 설정에 대한 자동 감지 및 프로젝트 루트 해석. `.planning/`이 저장소 경계를 넘어 해석되어야 하는 워크스페이스를 지원합니다.

**요구사항.**
- REQ-MULTIREPO-01: 멀티 저장소 워크스페이스 구성을 자동으로 감지해야 합니다.
- REQ-MULTIREPO-02: 저장소 경계를 넘어 프로젝트 루트를 해석해야 합니다.
- REQ-MULTIREPO-03: 실행자는 멀티 저장소 모드에서 저장소별 커밋 해시를 기록해야 합니다.

---

### 48. Discussion Audit Trail

**목적:** `/gsd-discuss-phase` 중에 `DISCUSSION-LOG.md`를 자동 생성하여 논의 중에 내려진 결정의 전체 감사 추적을 제공합니다.

**요구사항.**
- REQ-DISCLOG-01: discuss-phase 중에 DISCUSSION-LOG.md를 자동 생성해야 합니다.
- REQ-DISCLOG-02: 로그는 질문, 제시된 옵션, 내려진 결정을 캡처해야 합니다.
- REQ-DISCLOG-03: 결정 ID는 discuss-phase에서 plan-phase까지 추적 가능해야 합니다.

---

## v1.28 기능

### 49. Forensics

**명령어:** `/gsd-forensics [description]`

**목적:** 실패하거나 막힌 GSD 워크플로우의 사후 조사.

**요구사항.**
- REQ-FORENSICS-01: git 히스토리에서 이상(막힌 루프, 긴 간격, 반복된 커밋)을 분석해야 합니다.
- REQ-FORENSICS-02: 산출물 무결성을 확인해야 합니다(완료된 페이즈에 예상 파일이 있는지).
- REQ-FORENSICS-03: `.planning/forensics/`에 저장된 마크다운 보고서를 생성해야 합니다.
- REQ-FORENSICS-04: 조사 결과로 GitHub 이슈 생성을 제안해야 합니다.
- REQ-FORENSICS-05: 프로젝트 파일을 수정해서는 안 됩니다(읽기 전용 조사).

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `.planning/forensics/report-{timestamp}.md` | 사후 조사 보고서 |

**프로세스.**
1. **스캔** — git 히스토리에서 이상 분석: 막힌 루프, 커밋 사이의 긴 간격, 반복된 동일 커밋
2. **무결성 확인** — 완료된 페이즈에 예상 산출물 파일이 있는지 확인
3. **보고** — `.planning/forensics/`에 저장된 조사 결과가 담긴 마크다운 보고서 생성
4. **이슈** — 팀 가시성을 위해 조사 결과로 GitHub 이슈 생성 제안

---

### 50. Milestone Summary

**명령어:** `/gsd-milestone-summary [version]`

**목적:** 팀 온보딩을 위해 마일스톤 산출물에서 포괄적인 프로젝트 요약을 생성합니다.

**요구사항.**
- REQ-SUMMARY-01: 페이즈 계획, 요약, 검증 결과를 집계해야 합니다.
- REQ-SUMMARY-02: 현재 및 보관된 마일스톤 모두에 대해 작동해야 합니다.
- REQ-SUMMARY-03: 탐색 가능한 단일 문서를 생성해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `MILESTONE-SUMMARY.md` | 마일스톤 산출물의 포괄적인 탐색 가능한 요약 |

**프로세스.**
1. **수집** — 대상 마일스톤의 페이즈 계획, 요약, 검증 결과 집계
2. **종합** — 교차 참조가 있는 단일 탐색 가능한 문서로 산출물 결합
3. **출력** — 팀 온보딩과 이해관계자 검토에 적합한 `MILESTONE-SUMMARY.md` 작성

---

### 51. Workstream Namespacing

**명령어:** `/gsd-workstreams`

**목적:** 마일스톤의 다른 영역에서 동시 작업을 위한 병렬 워크스트림.

**요구사항.**
- REQ-WS-01: 별도의 `.planning/workstreams/{name}/` 디렉토리에 워크스트림 상태를 격리해야 합니다.
- REQ-WS-02: 워크스트림 이름을 검증해야 합니다(영숫자 + 하이픈만, 경로 순회 없음).
- REQ-WS-03: list, create, switch, status, progress, complete, resume 하위 명령어를 지원해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `.planning/workstreams/{name}/` | 격리된 워크스트림 디렉토리 구조 |

**프로세스.**
1. **생성** — 격리된 `.planning/workstreams/{name}/` 디렉토리로 명명된 워크스트림 초기화
2. **전환** — 이후 GSD 명령어를 위한 활성 워크스트림 컨텍스트 변경
3. **관리** — 워크스트림 나열, 상태 확인, 진행 상황 추적, 완료, 재개

---

### 52. Manager Dashboard

**명령어:** `/gsd-manager`

**목적:** 하나의 터미널에서 여러 페이즈를 관리하는 대화형 명령 센터.

**요구사항.**
- REQ-MGR-01: 상태와 함께 모든 페이즈의 개요를 표시해야 합니다.
- REQ-MGR-02: 현재 마일스톤 범위로 필터링해야 합니다.
- REQ-MGR-03: 페이즈 의존성과 충돌을 표시해야 합니다.

**생성 산출물.** 대화형 터미널 출력

**프로세스.**
1. **스캔** — 상태와 함께 현재 마일스톤의 모든 페이즈 로드
2. **표시** — 페이즈 의존성, 충돌, 진행 상황을 보여주는 개요 렌더링
3. **상호작용** — 개별 페이즈를 탐색, 검사, 또는 작업하는 명령어 수락

---

### 53. Assumptions Discussion Mode

**명령어:** `/gsd-discuss-phase` with `workflow.discuss_mode: 'assumptions'`

**목적:** 인터뷰 스타일 질문을 코드베이스 우선 가정 분석으로 대체합니다.

**요구사항.**
- REQ-ASSUME-01: 질문하기 전에 코드베이스를 분석하여 구조화된 가정을 생성해야 합니다.
- REQ-ASSUME-02: 가정을 신뢰도 수준별로 분류해야 합니다(Confident/Likely/Unclear).
- REQ-ASSUME-03: 기본 논의 모드와 동일한 CONTEXT.md 형식을 생성해야 합니다.
- REQ-ASSUME-04: 신뢰도 기반 건너뛰기 게이트를 지원해야 합니다(모두 HIGH이면 질문 없음).

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| `{phase}-CONTEXT.md` | 기본 논의 모드와 동일한 형식 |

**프로세스.**
1. **분석** — 구현 접근 방식에 대한 구조화된 가정을 생성하기 위해 코드베이스 스캔
2. **분류** — 가정을 신뢰도 수준별로 분류: Confident, Likely, Unclear
3. **게이트** — 모든 가정이 HIGH 신뢰도라면 질문 완전히 건너뛰기
4. **확인** — 불명확한 가정을 사용자에게 타겟팅된 질문으로 제시
5. **출력** — 기본 논의 모드와 동일한 형식으로 `{phase}-CONTEXT.md` 생성

---

### 54. UI Phase Auto-Detection

**일부:** `/gsd-new-project` 및 `/gsd-progress`

**목적:** UI 중심 프로젝트를 자동으로 감지하고 `/gsd-ui-phase` 권장사항을 표시합니다.

**요구사항.**
- REQ-UI-DETECT-01: 프로젝트 설명에서 UI 신호를 감지해야 합니다(키워드, 프레임워크 참조).
- REQ-UI-DETECT-02: 해당하는 경우 ROADMAP.md 페이즈에 `ui_hint`를 주석으로 추가해야 합니다.
- REQ-UI-DETECT-03: UI 중심 페이즈의 다음 단계에서 `/gsd-ui-phase`를 제안해야 합니다.
- REQ-UI-DETECT-04: `/gsd-ui-phase`를 필수로 만들어서는 안 됩니다.

**프로세스.**
1. **감지** — UI 신호(키워드, 프레임워크 참조)에 대한 프로젝트 설명 및 기술 스택 스캔
2. **주석** — ROADMAP.md의 해당 페이즈에 `ui_hint` 표시 추가
3. **표시** — UI 중심 페이즈의 다음 단계에 `/gsd-ui-phase` 권장사항 포함

---

### 55. Multi-Runtime Installer Selection

**일부:** `npx get-shit-done-cc`

**목적:** 단일 대화형 설치 세션에서 여러 런타임을 선택합니다.

**요구사항.**
- REQ-MULTI-RT-01: 대화형 프롬프트는 다중 선택을 지원해야 합니다(예: Claude Code + Gemini).
- REQ-MULTI-RT-02: CLI 플래그는 비대화형 설치에서 계속 작동해야 합니다.

**프로세스.**
1. **감지** — 시스템에서 사용 가능한 AI CLI 런타임 식별
2. **프롬프트** — 런타임 선택을 위한 다중 선택 인터페이스 표시
3. **설치** — 단일 세션에서 선택된 모든 런타임에 GSD 구성

---

## v1.29 기능

### 56. Windsurf 런타임 지원

**대상:** `npx get-shit-done-cc`

**목적:** Windsurf AI IDE 지원을 추가합니다.

**요구사항.**
- REQ-WINDSURF-01: 설치 프로그램은 `--windsurf` 플래그를 통한 Windsurf 설치를 지원해야 합니다.
- REQ-WINDSURF-02: Windsurf 규칙 형식에 맞는 프롬프트 파일을 생성해야 합니다.

**프로세스.**
1. **감지** — Windsurf 설치 상태 확인
2. **변환** — GSD 프롬프트를 Windsurf 규칙 형식으로 변환
3. **설치** — Windsurf 구성 디렉토리에 GSD 설정

---

### 57. 국제화 문서

**대상:** `docs/` 디렉토리

**목적:** GSD 문서를 포르투갈어, 한국어, 일본어로 제공합니다.

**요구사항.**
- REQ-I18N-01: 문서는 포르투갈어(pt), 한국어(ko), 일본어(ja)로 제공되어야 합니다.
- REQ-I18N-02: 번역은 영어 원본 문서와 동기화를 유지해야 합니다.

**프로세스.**
1. **번역** — 핵심 문서를 대상 언어로 변환
2. **게시** — 번역된 문서를 영어 원본과 함께 접근 가능하게 제공

---

## v1.30 기능

### 58. GSD SDK

**명령어:** 프로그래매틱 API (헤드리스)

**목적:** CLI 세션 없이 프로그래밍 방식으로 GSD 워크플로우를 실행하기 위한 헤드리스 TypeScript SDK.

**요구사항.**
- REQ-SDK-01: SDK는 GSD 워크플로우 작업을 TypeScript 함수로 노출해야 합니다.
- REQ-SDK-02: SDK는 대화형 프롬프트 없이 헤드리스 실행을 지원해야 합니다.
- REQ-SDK-03: SDK는 CLI 기반 워크플로우와 동일한 아티팩트를 생성해야 합니다.

**프로세스.**
1. **임포트** — TypeScript/JavaScript 프로젝트에 GSD SDK 임포트
2. **구성** — 프로젝트 경로와 워크플로우 옵션을 프로그래밍 방식으로 설정
3. **실행** — API 호출로 GSD 페이즈(discuss, plan, execute) 실행

---

## v1.31 기능

### 59. 스키마 드리프트 감지

**명령어:** `/gsd-execute-phase` 실행 시 자동

**목적:** ORM 스키마 파일이 대응하는 마이그레이션 또는 push 명령 없이 수정된 경우를 감지하여 오탐 검증을 방지합니다.

**요구사항.**
- REQ-SCHEMA-01: 시스템은 ORM 스키마 파일(Prisma, Drizzle, Payload, Sanity, Mongoose) 수정을 감지해야 합니다.
- REQ-SCHEMA-02: 스키마 변경이 감지되면 대응하는 마이그레이션/push 명령의 존재를 확인해야 합니다.
- REQ-SCHEMA-03: 이중 방어를 구현해야 합니다: 계획 시점 주입 및 실행 시점 게이트.
- REQ-SCHEMA-04: 감지를 재정의하는 `GSD_SKIP_SCHEMA_CHECK` 환경 변수를 지원해야 합니다.
- REQ-SCHEMA-05: 마이그레이션 없는 스키마 변경 시 오탐 검증을 방지해야 합니다.

**프로세스.**
1. **감지** — 계획 실행 중 ORM 스키마 파일 수정 모니터링
2. **확인** — 계획에 대응하는 마이그레이션/push 명령이 포함되어 있는지 확인
3. **게이트** — 마이그레이션 없는 스키마 드리프트가 감지되면 실행 차단(실행 시점 게이트)
4. **주입** — 계획 생성 중 마이그레이션 리마인더 추가(계획 시점 주입)

**구성:** `GSD_SKIP_SCHEMA_CHECK` 환경 변수로 감지 바이패스.

---

### 60. 보안 시행

**명령어:** `/gsd-secure-phase <N>`

**목적:** 페이즈 구현에 대한 위협 모델 기반 보안 검증.

**요구사항.**
- REQ-SEC-01: 시스템은 위협 모델 기반 검증(블라인드 스캔이 아닌)을 수행해야 합니다.
- REQ-SEC-02: 구성 가능한 OWASP ASVS 검증 레벨(1-3)을 지원해야 합니다.
- REQ-SEC-03: 구성 가능한 심각도 임계값에 따라 페이즈 진행을 차단해야 합니다.
- REQ-SEC-04: 분석을 위해 `gsd-security-auditor` 에이전트를 스폰해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| 보안 감사 보고서 | 심각도 분류가 포함된 위협 모델 기반 발견 사항 |

**프로세스.**
1. **모델** — 페이즈 구현 컨텍스트에서 위협 모델 구축
2. **감사** — `gsd-security-auditor`를 스폰하여 위협 모델에 대해 검증
3. **게이트** — 발견 사항이 `security_block_on` 심각도 이상이면 페이즈 진행 차단

**구성:**
| 설정 | 유형 | 기본값 | 설명 |
|------|------|--------|------|
| `security_enforcement` | boolean | `true` | 위협 모델 보안 검증 활성화 |
| `security_asvs_level` | number (1-3) | `1` | OWASP ASVS 검증 레벨 |
| `security_block_on` | string | `"high"` | 페이즈 진행을 차단하는 최소 심각도 |

---

### 61. 문서 생성

**명령어:** `/gsd-docs-update`

**목적:** 정확성 검사가 포함된 프로젝트 문서를 생성하고 검증합니다.

**요구사항.**
- REQ-DOCS-01: 시스템은 문서 생성을 위해 `gsd-doc-writer` 에이전트를 스폰해야 합니다.
- REQ-DOCS-02: 시스템은 정확성 검사를 위해 `gsd-doc-verifier` 에이전트를 스폰해야 합니다.
- REQ-DOCS-03: 시스템은 생성된 문서를 실제 구현에 대해 검증해야 합니다.

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| 업데이트된 프로젝트 문서 | 생성 및 검증된 문서 파일 |

**프로세스.**
1. **생성** — `gsd-doc-writer`를 스폰하여 구현에서 문서 생성 또는 업데이트
2. **검증** — `gsd-doc-verifier`를 스폰하여 코드베이스에 대한 문서 정확성 검사
3. **출력** — 정확성 주석이 포함된 검증된 문서 생성

---

### 62. 디스커스 체인 모드

**플래그:** `/gsd-discuss-phase <N> --chain`

**목적:** 수동 명령어 연속 실행을 줄이기 위해 discuss, plan, execute 페이즈를 하나의 플로우로 자동 체인합니다.

**요구사항.**
- REQ-CHAIN-01: `--chain` 플래그가 제공되면 시스템은 discuss → plan → execute를 자동 체인해야 합니다.
- REQ-CHAIN-02: 체인된 페이즈 간의 모든 게이트 설정을 준수해야 합니다.
- REQ-CHAIN-03: 어떤 페이즈든 실패하면 체인을 중단해야 합니다.

**프로세스.**
1. **디스커스** — 컨텍스트 수집을 위해 디스커스 페이즈 실행
2. **플랜** — 수집된 컨텍스트로 플랜 페이즈 자동 호출
3. **실행** — 생성된 계획으로 실행 페이즈 자동 호출

---

### 63. 단일 페이즈 자율 모드

**플래그:** `/gsd-autonomous --only N`

**목적:** 모든 남은 페이즈가 아닌 하나의 페이즈만 자율적으로 실행합니다.

**요구사항.**
- REQ-ONLY-01: `--only N`이 제공되면 시스템은 지정된 페이즈 번호만 실행해야 합니다.
- REQ-ONLY-02: 전체 자율 모드와 동일한 discuss → plan → execute 플로우를 따라야 합니다.
- REQ-ONLY-03: 지정된 페이즈가 완료되면 중단해야 합니다.

**프로세스.**
1. **선택** — `--only N` 인수에서 대상 페이즈 식별
2. **실행** — 해당 페이즈에 대해 전체 자율 플로우(discuss → plan → execute) 실행
3. **중단** — 다음 페이즈로 진행하지 않고 페이즈 완료 후 중단

---

### 64. 범위 축소 감지

**대상:** `/gsd-plan-phase`

**목적:** 삼중 방어로 계획 생성 중 요구사항의 무단 삭제를 방지합니다.

**요구사항.**
- REQ-SCOPE-01: 플래너는 명시적 정당화 없이 범위를 축소하는 것이 금지되어야 합니다.
- REQ-SCOPE-02: 플랜 체커는 요구사항 차원 커버리지를 검증해야 합니다.
- REQ-SCOPE-03: 오케스트레이터는 삭제된 요구사항을 복구하고 재주입해야 합니다.
- REQ-SCOPE-04: 삼중 방어를 구현해야 합니다: 플래너 금지, 체커 차원, 오케스트레이터 복구.

**프로세스.**
1. **금지** — 플래너 지시에서 범위 축소를 명시적으로 금지
2. **검사** — 플랜 체커가 모든 페이즈 요구사항이 계획에 포함되어 있는지 확인
3. **복구** — 오케스트레이터가 삭제된 요구사항을 감지하고 계획 루프에 재주입

---

### 65. 주장 출처 태깅

**대상:** `/gsd-plan-phase --research-phase`

**목적:** 연구 주장에 출처 증거를 태깅하고 가정을 별도로 기록합니다.

**요구사항.**
- REQ-PROVENANCE-01: 연구자는 주장에 출처 증거 참조를 표시해야 합니다.
- REQ-PROVENANCE-02: 가정은 출처가 있는 주장과 별도로 기록되어야 합니다.
- REQ-PROVENANCE-03: 시스템은 증거가 있는 사실과 추론된 가정을 구분해야 합니다.

**프로세스.**
1. **연구** — 연구자가 코드베이스 및 도메인 소스에서 정보 수집
2. **태그** — 각 주장에 출처(파일 경로, 문서, API 응답)를 주석으로 추가
3. **분리** — 직접적 증거가 없는 가정을 별도 섹션에 기록

---

### 66. Worktree 토글

**구성:** `workflow.use_worktrees: false`

**목적:** 순차적 실행을 선호하는 사용자를 위해 git worktree 격리를 비활성화합니다.

**요구사항.**
- REQ-WORKTREE-01: 시스템은 격리 전략 결정 시 `workflow.use_worktrees` 설정을 준수해야 합니다.
- REQ-WORKTREE-02: 하위 호환성을 위해 기본값은 `true`(worktree 활성화)여야 합니다.
- REQ-WORKTREE-03: worktree가 비활성화되면 순차적 실행으로 폴백해야 합니다.

**구성:**
| 설정 | 유형 | 기본값 | 설명 |
|------|------|--------|------|
| `workflow.use_worktrees` | boolean | `true` | `false`이면 git worktree 격리 비활성화 |

---

### 67. 프로젝트 코드 접두사

**구성:** `project_code: "ABC"`

**목적:** 다중 프로젝트 구분을 위해 페이즈 디렉토리 이름에 프로젝트 코드를 접두사로 추가합니다.

**요구사항.**
- REQ-PREFIX-01: 구성된 경우 시스템은 페이즈 디렉토리에 프로젝트 코드를 접두사로 추가해야 합니다(예: `ABC-01-setup/`).
- REQ-PREFIX-02: `project_code`가 설정되지 않은 경우 표준 명명을 사용해야 합니다.
- REQ-PREFIX-03: 모든 페이즈 작업에서 일관되게 접두사를 적용해야 합니다.

**구성:**
| 설정 | 유형 | 기본값 | 설명 |
|------|------|--------|------|
| `project_code` | string | (없음) | 페이즈 디렉토리 이름의 접두사 |

---

### 68. Claude Code 스킬 마이그레이션

**대상:** `npx get-shit-done-cc`

**목적:** GSD 명령어를 하위 호환성을 유지하면서 Claude Code 2.1.88+ 스킬 형식으로 마이그레이션합니다.

**요구사항.**
- REQ-SKILLS-01: 설치 프로그램은 Claude Code 2.1.88+ 용 `skills/gsd-*/SKILL.md`를 작성해야 합니다.
- REQ-SKILLS-02: 설치 프로그램은 레거시 `commands/gsd/` 디렉토리를 자동 정리해야 합니다.
- REQ-SKILLS-03: Gemini 경로를 통해 이전 Claude Code 버전과의 하위 호환성을 유지해야 합니다.

**프로세스.**
1. **감지** — Claude Code 버전을 확인하여 스킬 지원 여부 판단
2. **마이그레이션** — 각 GSD 명령어에 대해 `skills/gsd-*/SKILL.md` 파일 작성
3. **정리** — 스킬이 설치되면 레거시 `commands/gsd/` 디렉토리 제거
4. **폴백** — 이전 Claude Code 버전을 위한 Gemini 경로 호환성 유지

---

## v1.32 기능

### 69. STATE.md 일관성 게이트

**명령어:** `state validate`, `state sync [--verify]`, `state planned-phase --phase N --plans N`

**목적:** STATE.md와 실제 파일 시스템 간의 드리프트를 감지하고 복구하여 오래된 상태에서 발생하는 연쇄 오류를 방지합니다.

**요구사항.**
- REQ-STATE-01: `state validate`는 STATE.md 필드와 파일 시스템 실제 상태 간의 드리프트를 감지해야 합니다.
- REQ-STATE-02: `state sync`는 디스크의 실제 프로젝트 상태에서 STATE.md를 재구성해야 합니다.
- REQ-STATE-03: `state sync --verify`는 쓰기 없이 제안된 변경 사항을 표시하는 드라이 런을 수행해야 합니다.
- REQ-STATE-04: `state planned-phase`는 플랜 페이즈 완료 후 상태 전환을 기록해야 합니다(Planned/Ready to execute).

**생성 산출물.**
| 산출물 | 설명 |
|----------|-------------|
| 업데이트된 `STATE.md` | 파일 시스템 실제 상태를 반영하는 수정된 상태 |

**프로세스.**
1. **검증** — STATE.md 필드를 파일 시스템(페이즈 디렉토리, 계획 파일, 요약)과 비교
2. **동기화** — 드리프트가 감지되면 디스크에서 STATE.md 재구성
3. **전환** — 실행 페이즈 준비 상태로 계획 수와 함께 포스트 플래닝 상태 기록

---

### 70. 자율 모드 `--to N` 플래그

**플래그:** `/gsd-autonomous --to N`

**목적:** 특정 페이즈 완료 후 자율 실행을 중단하여 부분적 자율 실행을 가능하게 합니다.

**요구사항.**
- REQ-TO-01: 시스템은 지정된 페이즈 번호 완료 후 실행을 중단해야 합니다.
- REQ-TO-02: N까지의 각 페이즈에 대해 동일한 discuss → plan → execute 플로우를 따라야 합니다.
- REQ-TO-03: `--to N`은 경계가 있는 자율 범위를 위해 `--from N`과 결합할 수 있어야 합니다.

**프로세스.**
1. **경계 설정** — `--to N` 인수에서 상한 페이즈 설정
2. **실행** — 페이즈 N까지(포함) 각 페이즈에 대해 자율 플로우 실행
3. **중단** — 페이즈 N 완료 후 중단

---

### 71. 리서치 게이트

**대상:** `/gsd-plan-phase`

**목적:** RESEARCH.md에 미해결 오픈 질문이 있을 때 계획을 차단하여 불완전한 정보에 기반한 계획을 방지합니다.

**요구사항.**
- REQ-RESGATE-01: 계획 시작 전 RESEARCH.md에서 미해결 오픈 질문을 스캔해야 합니다.
- REQ-RESGATE-02: 오픈 질문이 존재하면 플랜 페이즈 진입을 차단해야 합니다.
- REQ-RESGATE-03: 구체적인 미해결 질문을 사용자에게 표시해야 합니다.

**프로세스.**
1. **스캔** — RESEARCH.md의 오픈 질문 섹션에서 미해결 항목 확인
2. **게이트** — 미해결 질문이 발견되면 계획 차단
3. **표시** — 해결이 필요한 구체적인 오픈 질문 표시

---

### 72. 검증자 마일스톤 범위 필터링

**대상:** `/gsd-execute-phase` (검증자 단계)

**목적:** 진정한 갭과 후속 페이즈로 연기된 항목을 구분하여 검증의 오탐을 줄입니다.

**요구사항.**
- REQ-VSCOPE-01: 검증자는 갭이 후속 마일스톤 페이즈에서 다뤄지는지 확인해야 합니다.
- REQ-VSCOPE-02: 후속 페이즈에서 다뤄지는 갭은 "갭"이 아닌 "연기"로 표시되어야 합니다.
- REQ-VSCOPE-03: 진정한 갭(어떤 미래 페이즈에서도 다뤄지지 않는)만 실패로 보고되어야 합니다.

**프로세스.**
1. **검증** — 표준 목표 역추적 검증 실행
2. **필터** — 감지된 갭을 후속 마일스톤 페이즈와 교차 참조
3. **분류** — 연기된 항목을 진정한 갭과 별도로 표시

---

### 73. Read-Before-Edit 가드 훅

**대상:** 훅 (`PreToolUse`)

**목적:** 파일이 편집 전에 읽혀지도록 하여 비-Claude 런타임에서의 무한 재시도 루프를 방지합니다.

**요구사항.**
- REQ-RBE-01: 훅은 세션에서 이전에 읽히지 않은 파일을 대상으로 하는 Edit/Write 도구 호출을 감지해야 합니다.
- REQ-RBE-02: 훅은 먼저 파일을 읽도록 권고해야 합니다(권고적, 비차단).
- REQ-RBE-03: 훅은 내장 read-before-edit 강제가 없는 런타임에서 일반적인 무한 재시도 루프를 방지해야 합니다.

---

### 74. 컨텍스트 축소

**대상:** GSD SDK 프롬프트 어셈블리

**목적:** Markdown 절삭 및 캐시 친화적 프롬프트 순서를 통해 컨텍스트 프롬프트 크기를 줄입니다.

**요구사항.**
- REQ-CTXRED-01: 시스템은 컨텍스트 예산 내에 맞도록 과대 Markdown 아티팩트를 절삭해야 합니다.
- REQ-CTXRED-02: 캐시 친화적 어셈블리를 위해 프롬프트를 순서화해야 합니다(안정적 접두사 우선).
- REQ-CTXRED-03: 축소는 필수 정보(제목, 요구사항, 작업 구조)를 보존해야 합니다.

**프로세스.**
1. **측정** — 워크플로우의 총 프롬프트 크기 계산
2. **절삭** — 과대 아티팩트에 Markdown 인식 절삭 적용
3. **순서화** — KV 캐시 재사용 최적화를 위해 프롬프트 섹션 배치

---

### 75. 디스커스 페이즈 `--power` 플래그

**플래그:** `/gsd-discuss-phase --power`

**목적:** 디스커스 페이즈의 파일 기반 대량 질문 답변으로, 준비된 답변 파일에서 일괄 입력을 가능하게 합니다.

**요구사항.**
- REQ-POWER-01: 시스템은 토론 질문에 대한 사전 작성된 답변이 포함된 파일을 수락해야 합니다.
- REQ-POWER-02: 시스템은 답변을 해당 그레이 영역 질문에 매핑해야 합니다.
- REQ-POWER-03: 시스템은 대화형 디스커스 페이즈와 동일한 CONTEXT.md를 생성해야 합니다.

---

### 76. 디버그 `--diagnose` 플래그

**플래그:** `/gsd-debug --diagnose`

**목적:** 수정을 시도하지 않고 조사만 수행하는 진단 전용 모드.

**요구사항.**
- REQ-DIAG-01: 시스템은 완전한 디버그 조사(가설, 증거, 근본 원인)를 수행해야 합니다.
- REQ-DIAG-02: 시스템은 어떤 코드 변경도 시도해서는 안 됩니다.
- REQ-DIAG-03: 시스템은 발견 사항 및 권장 수정 사항이 포함된 진단 보고서를 생성해야 합니다.

---

### 77. 페이즈 의존성 분석

**명령어:** `/gsd-analyze-dependencies`

**목적:** 페이즈 의존성을 감지하고 `/gsd-manager` 실행 전 ROADMAP.md에 `Depends on` 항목을 제안합니다.

**요구사항.**
- REQ-DEP-01: 시스템은 페이즈 간 파일 겹침을 감지해야 합니다.
- REQ-DEP-02: 시스템은 의미적 의존성(API/스키마 생산자와 소비자)을 감지해야 합니다.
- REQ-DEP-03: 시스템은 데이터 흐름 의존성(출력 생산자와 리더)을 감지해야 합니다.
- REQ-DEP-04: 시스템은 의존성 항목을 제안하고 쓰기 전 사용자 확인을 요구해야 합니다.

**생성 산출물:** 의존성 제안 테이블; 선택적으로 ROADMAP.md의 `Depends on` 필드 업데이트

---

### 78. 안티패턴 심각도 레벨

**대상:** `/gsd-resume-work`

**목적:** 심각도 기반 안티패턴 강제를 통한 재개 시 필수 이해 검사.

**요구사항.**
- REQ-ANTI-01: 시스템은 안티패턴을 심각도 레벨로 분류해야 합니다.
- REQ-ANTI-02: 시스템은 세션 재개 시 필수 이해 검사를 강제해야 합니다.
- REQ-ANTI-03: 높은 심각도의 안티패턴은 인정될 때까지 워크플로우 진행을 차단해야 합니다.

---

### 79. 방법론 아티팩트 유형

**대상:** 계획 아티팩트

**목적:** 방법론 문서의 소비 메커니즘을 정의하여 에이전트에 의해 올바르게 소비되도록 보장합니다.

**요구사항.**
- REQ-METHOD-01: 시스템은 방법론을 고유한 아티팩트 유형으로 지원해야 합니다.
- REQ-METHOD-02: 방법론 아티팩트는 에이전트를 위한 정의된 소비 메커니즘을 가져야 합니다.

---

### 80. 플래너 도달 가능성 검사

**대상:** `/gsd-plan-phase`

**목적:** 실행에 커밋하기 전에 계획 단계가 달성 가능한지 검증합니다.

**요구사항.**
- REQ-REACH-01: 플래너는 각 계획 단계가 도달 가능한 파일과 API를 참조하는지 검증해야 합니다.
- REQ-REACH-02: 도달 불가능한 단계는 실행 중이 아닌 계획 중에 플래그되어야 합니다.

---

### 81. Playwright-MCP UI 검증

**대상:** `/gsd-verify-work` (선택 사항)

**목적:** 검증 페이즈 중 Playwright-MCP를 사용한 자동 시각적 검증.

**요구사항.**
- REQ-PLAY-01: 시스템은 검증 페이즈 중 선택적 Playwright-MCP 시각적 검증을 지원해야 합니다.
- REQ-PLAY-02: 시각적 검증은 옵트인이어야 하며 필수가 아니어야 합니다.
- REQ-PLAY-03: 시스템은 UI-SPEC.md 기대치에 대해 시각적 상태를 캡처하고 비교해야 합니다.

---

### 82. Pause-Work 확장

**대상:** `/gsd-pause-work`

**목적:** 더 풍부한 핸드오프 데이터로 비페이즈 컨텍스트를 지원하여 pause-work의 적용 범위를 확대합니다.

**요구사항.**
- REQ-PAUSE-01: 시스템은 비페이즈 컨텍스트(빠른 작업, 디버그 세션, 스레드)에서의 일시 정지를 지원해야 합니다.
- REQ-PAUSE-02: 핸드오프 데이터는 현재 작업 유형에 적절한 더 풍부한 컨텍스트를 포함해야 합니다.

---

### 83. 응답 언어 설정

**구성:** `response_language`

**목적:** 비영어권 사용자를 위한 크로스 페이즈 언어 일관성.

**요구사항.**
- REQ-LANG-01: 시스템은 모든 페이즈와 에이전트에서 `response_language` 설정을 준수해야 합니다.
- REQ-LANG-02: 설정은 모든 스폰된 에이전트에 전파되어 일관된 언어 출력을 보장해야 합니다.

**구성:**
| 설정 | 유형 | 기본값 | 설명 |
|------|------|--------|------|
| `response_language` | string | (없음) | 에이전트 응답의 언어 코드 (예: `"pt"`, `"ko"`, `"ja"`) |

---

### 84. 수동 업데이트 절차

**대상:** `docs/manual-update.md`

**목적:** `npx`가 사용 불가하거나 npm 퍼블리시에 장애가 발생한 환경을 위한 수동 업데이트 경로를 문서화합니다.

**요구사항.**
- REQ-MANUAL-01: 문서는 단계별 수동 업데이트 절차를 설명해야 합니다.
- REQ-MANUAL-02: 절차는 npm 접근 없이 작동해야 합니다.

---

### 85. 신규 런타임 지원 (Trae, Cline, Augment Code)

**대상:** `npx get-shit-done-cc`

**목적:** Trae IDE, Cline, Augment Code 런타임으로 GSD 설치를 확장합니다.

**요구사항.**
- REQ-TRAE-01: 설치 프로그램은 Trae IDE 설치를 위한 `--trae` 플래그를 지원해야 합니다.
- REQ-CLINE-01: 설치 프로그램은 `.clinerules` 구성을 통해 Cline을 지원해야 합니다.
- REQ-AUGMENT-01: 설치 프로그램은 스킬 변환 및 구성 관리를 통해 Augment Code를 지원해야 합니다.
