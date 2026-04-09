# GSD 사용자 가이드

워크플로우, 문제 해결, 설정에 대한 상세 레퍼런스입니다. 빠른 시작 설정은 [README](../README.md)를 참고하세요.

---

## 목차

- [워크플로우 다이어그램](#워크플로우-다이어그램)
- [UI 설계 계약](#ui-설계-계약)
- [백로그 및 스레드](#백로그-및-스레드)
- [워크스트림](#워크스트림)
- [보안](#보안)
- [명령어 레퍼런스](#명령어-레퍼런스)
- [설정 레퍼런스](#설정-레퍼런스)
- [사용 예시](#사용-예시)
- [문제 해결](#문제-해결)
- [복구 빠른 레퍼런스](#복구-빠른-레퍼런스)

---

## 워크플로우 다이어그램

### 전체 프로젝트 생명주기

```
  ┌──────────────────────────────────────────────────┐
  │                   NEW PROJECT                    │
  │  /gsd-new-project                                │
  │  Questions -> Research -> Requirements -> Roadmap│
  └─────────────────────────┬────────────────────────┘
                            │
             ┌──────────────▼─────────────┐
             │      FOR EACH PHASE:       │
             │                            │
             │  ┌────────────────────┐    │
             │  │ /gsd-discuss-phase │    │  <- Lock in preferences
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-ui-phase      │    │  <- Design contract (frontend)
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-plan-phase    │    │  <- Research + Plan + Verify
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-execute-phase │    │  <- Parallel execution
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-verify-work   │    │  <- Manual UAT
             │  └──────────┬─────────┘    │
             │             │              │
             │  ┌──────────▼─────────┐    │
             │  │ /gsd-ship          │    │  <- Create PR (optional)
             │  └──────────┬─────────┘    │
             │             │              │
             │     Next Phase?────────────┘
             │             │ No
             └─────────────┼──────────────┘
                            │
            ┌───────────────▼──────────────┐
            │  /gsd-audit-milestone        │
            │  /gsd-complete-milestone     │
            └───────────────┬──────────────┘
                            │
                   Another milestone?
                       │          │
                      Yes         No -> Done!
                       │
               ┌───────▼──────────────┐
               │  /gsd-new-milestone  │
               └──────────────────────┘
```

### 계획 에이전트 조정

```
  /gsd-plan-phase N
         │
         ├── Phase Researcher (x4 parallel)
         │     ├── Stack researcher
         │     ├── Features researcher
         │     ├── Architecture researcher
         │     └── Pitfalls researcher
         │           │
         │     ┌──────▼──────┐
         │     │ RESEARCH.md │
         │     └──────┬──────┘
         │            │
         │     ┌──────▼──────┐
         │     │   Planner   │  <- Reads PROJECT.md, REQUIREMENTS.md,
         │     │             │     CONTEXT.md, RESEARCH.md
         │     └──────┬──────┘
         │            │
         │     ┌──────▼───────────┐     ┌────────┐
         │     │   Plan Checker   │────>│ PASS?  │
         │     └──────────────────┘     └───┬────┘
         │                                  │
         │                             Yes  │  No
         │                              │   │   │
         │                              │   └───┘  (loop, up to 3x)
         │                              │
         │                        ┌─────▼──────┐
         │                        │ PLAN files │
         │                        └────────────┘
         └── Done
```

### 검증 아키텍처 (Nyquist 레이어)

plan-phase 조사 단계에서 GSD는 코드 작성 전에 각 페이즈 요구사항에 대한 자동화된 테스트 커버리지를 매핑합니다. 이를 통해 Claude의 실행자가 작업을 커밋할 때 몇 초 안에 검증할 수 있는 피드백 메커니즘이 이미 갖춰져 있습니다.

조사자는 기존 테스트 인프라를 감지하고 각 요구사항을 특정 테스트 명령어에 매핑하며 구현 시작 전에 생성해야 할 테스트 스캐폴딩을 식별합니다 (Wave 0 작업).

계획 검사기는 이를 8번째 검증 차원으로 적용합니다. 작업에 자동화된 검증 명령어가 없는 계획은 승인되지 않습니다.

**출력:** `{phase}-VALIDATION.md` — 해당 페이즈의 피드백 계약.

**비활성화:** 테스트 인프라가 중요하지 않은 빠른 프로토타이핑 페이즈에서는 `/gsd-settings`에서 `workflow.nyquist_validation: false`로 설정하세요.

### 소급 검증 (`/gsd-validate-phase`)

Nyquist 검증 도입 전에 실행된 페이즈나 전통적인 테스트 스위트만 있는 기존 코드베이스의 경우 커버리지 갭을 소급하여 감사하고 보완할 수 있습니다.

```
  /gsd-validate-phase N
         |
         +-- Detect state (VALIDATION.md exists? SUMMARY.md exists?)
         |
         +-- Discover: scan implementation, map requirements to tests
         |
         +-- Analyze gaps: which requirements lack automated verification?
         |
         +-- Present gap plan for approval
         |
         +-- Spawn auditor: generate tests, run, debug (max 3 attempts)
         |
         +-- Update VALIDATION.md
               |
               +-- COMPLIANT -> all requirements have automated checks
               +-- PARTIAL -> some gaps escalated to manual-only
```

감사자는 구현 코드를 수정하지 않으며 테스트 파일과 VALIDATION.md만 수정합니다. 테스트에서 구현 버그가 발견되면 사용자가 처리할 수 있도록 에스컬레이션으로 표시됩니다.

**사용 시점:** Nyquist가 활성화되기 전에 계획된 페이즈를 실행한 후 또는 `/gsd-audit-milestone`에서 Nyquist 준수 갭이 발견된 후에 사용합니다.

### 가정 토론 모드

기본적으로 `/gsd-discuss-phase`는 구현 선호도에 대한 개방형 질문을 합니다. 가정 모드는 이를 역전시킵니다. GSD가 먼저 코드베이스를 읽고 페이즈를 어떻게 구축할지에 대한 구조화된 가정을 제시한 후 수정사항만 요청합니다.

**활성화:** `/gsd-settings`에서 `workflow.discuss_mode`를 `'assumptions'`로 설정합니다.

**작동 방식.**
1. PROJECT.md, 코드베이스 매핑, 기존 관례를 읽습니다.
2. 구조화된 가정 목록을 생성합니다 (기술 선택, 패턴, 파일 위치).
3. 가정을 확인, 수정 또는 확장하도록 제시합니다.
4. 확인된 가정으로 CONTEXT.md를 작성합니다.

**사용 시점.**
- 코드베이스를 잘 아는 숙련된 개발자
- 개방형 질문이 속도를 저해하는 빠른 반복 개발
- 패턴이 잘 확립되고 예측 가능한 프로젝트

전체 discuss-mode 레퍼런스는 [docs/workflow-discuss-mode.md](workflow-discuss-mode.md)를 참고하세요.

---

## UI 설계 계약

### 배경

AI 생성 프론트엔드가 시각적으로 일관성이 없는 이유는 Claude Code의 UI 능력이 부족해서가 아닙니다. 실행 전에 설계 계약이 존재하지 않았기 때문입니다. 공유 간격 척도, 색상 계약, 또는 카피라이팅 기준 없이 구축된 다섯 개의 컴포넌트는 다섯 가지 약간씩 다른 시각적 결정을 만들어냅니다.

`/gsd-ui-phase`는 계획 전에 설계 계약을 확정합니다. `/gsd-ui-review`는 실행 후 결과를 감사합니다.

### 명령어

| 명령어 | 설명 |
|--------|------|
| `/gsd-ui-phase [N]` | 프론트엔드 페이즈를 위한 UI-SPEC.md 설계 계약 생성 |
| `/gsd-ui-review [N]` | 구현된 UI의 6개 기둥 기반 시각적 감사 소급 수행 |

### 워크플로우: `/gsd-ui-phase`

**실행 시점:** `/gsd-discuss-phase` 이후, `/gsd-plan-phase` 이전 — 프론트엔드/UI 작업이 포함된 페이즈.

**흐름.**
1. CONTEXT.md, RESEARCH.md, REQUIREMENTS.md에서 기존 결정사항을 읽습니다.
2. 디자인 시스템 상태를 감지합니다 (shadcn components.json, Tailwind 설정, 기존 토큰).
3. shadcn 초기화 게이트 — React/Next.js/Vite 프로젝트에 없으면 초기화를 제안합니다.
4. 아직 답변되지 않은 설계 계약 질문만 묻습니다 (간격, 타이포그래피, 색상, 카피라이팅, 레지스트리 안전).
5. 페이즈 디렉터리에 `{phase}-UI-SPEC.md`를 작성합니다.
6. 6개 차원에 대해 검증합니다 (카피라이팅, 시각, 색상, 타이포그래피, 간격, 레지스트리 안전).
7. BLOCKED인 경우 수정 루프 (최대 2회 반복).

**출력:** `.planning/phases/{phase-dir}/`의 `{padded_phase}-UI-SPEC.md`

### 워크플로우: `/gsd-ui-review`

**실행 시점:** `/gsd-execute-phase` 또는 `/gsd-verify-work` 이후 — 프론트엔드 코드가 있는 모든 프로젝트.

**독립 실행:** 모든 프로젝트에서 작동하며 GSD 관리 프로젝트가 아니어도 됩니다. UI-SPEC.md가 없으면 추상적인 6개 기둥 기준으로 감사합니다.

**6개 기둥 (각 1-4점 평가).**
1. 카피라이팅 — CTA 레이블, 빈 상태, 오류 상태
2. 시각 — 초점, 시각적 계층, 아이콘 접근성
3. 색상 — 강조 사용 규율, 60/30/10 준수
4. 타이포그래피 — 폰트 크기/굵기 제약 준수
5. 간격 — 그리드 정렬, 토큰 일관성
6. 경험 디자인 — 로딩/오류/빈 상태 커버리지

**출력:** 점수와 상위 3개 우선 수정사항이 포함된 페이즈 디렉터리의 `{padded_phase}-UI-REVIEW.md`

### 설정

| 설정 | 기본값 | 설명 |
|------|--------|------|
| `workflow.ui_phase` | `true` | 프론트엔드 페이즈를 위한 UI 설계 계약 생성 |
| `workflow.ui_safety_gate` | `true` | plan-phase가 프론트엔드 페이즈에서 /gsd-ui-phase 실행을 유도합니다 |

두 설정 모두 부재 시 활성화 패턴을 따릅니다. `/gsd-settings`에서 비활성화할 수 있습니다.

### shadcn 초기화

React/Next.js/Vite 프로젝트에서 `components.json`이 없으면 UI 조사자가 shadcn 초기화를 제안합니다. 흐름은 다음과 같습니다.

1. `ui.shadcn.com/create`를 방문하여 프리셋을 구성합니다.
2. 프리셋 문자열을 복사합니다.
3. `npx shadcn init --preset {paste}`를 실행합니다.
4. 프리셋은 전체 디자인 시스템(색상, 테두리 반경, 폰트)을 인코딩합니다.

프리셋 문자열은 GSD의 1급 계획 아티팩트가 되어 페이즈와 마일스톤에 걸쳐 재현 가능합니다.

### 레지스트리 안전 게이트

서드파티 shadcn 레지스트리는 임의의 코드를 주입할 수 있습니다. 안전 게이트는 다음을 요구합니다.
- `npx shadcn view {component}` — 설치 전 검사
- `npx shadcn diff {component}` — 공식 버전과 비교

`workflow.ui_safety_gate` 설정 토글로 제어됩니다.

### 스크린샷 저장

`/gsd-ui-review`는 Playwright CLI를 통해 `.planning/ui-reviews/`에 스크린샷을 캡처합니다. 바이너리 파일이 git에 포함되지 않도록 `.gitignore`가 자동으로 생성됩니다. 스크린샷은 `/gsd-complete-milestone` 실행 시 정리됩니다.

---

## 백로그 및 스레드

### 백로그 파킹 롯

활성 계획에 아직 준비되지 않은 아이디어는 999.x 번호 체계를 사용하여 백로그에 보관하며 활성 페이즈 순서 밖에 유지됩니다.

```
/gsd-add-backlog "GraphQL API layer"     # Creates 999.1-graphql-api-layer/
/gsd-add-backlog "Mobile responsive"     # Creates 999.2-mobile-responsive/
```

백로그 항목은 전체 페이즈 디렉터리를 얻으므로 `/gsd-discuss-phase 999.1`로 아이디어를 더 탐구하거나 준비가 되면 `/gsd-plan-phase 999.1`을 사용할 수 있습니다.

`/gsd-review-backlog`으로 **검토 및 승격**합니다 — 모든 백로그 항목을 표시하고 승격 (활성 순서로 이동), 유지 (백로그에 남김), 또는 제거 (삭제)를 선택할 수 있습니다.

### 시드

시드는 트리거 조건이 있는 미래 지향적인 아이디어입니다. 백로그 항목과 달리 시드는 적절한 마일스톤 시점에 자동으로 표면화됩니다.

```
/gsd-plant-seed "Add real-time collab when WebSocket infra is in place"
```

시드는 전체 WHY와 언제 표면화할지를 보존합니다. `/gsd-new-milestone`은 모든 시드를 스캔하여 일치 항목을 제시합니다.

**저장 위치:** `.planning/seeds/SEED-NNN-slug.md`

### 지속적인 컨텍스트 스레드

스레드는 여러 세션에 걸쳐 이어지지만 특정 페이즈에 속하지 않는 작업을 위한 경량 교차 세션 지식 저장소입니다.

```
/gsd-thread                              # List all threads
/gsd-thread fix-deploy-key-auth          # Resume existing thread
/gsd-thread "Investigate TCP timeout"    # Create new thread
```

스레드는 `/gsd-pause-work`보다 가볍습니다. 페이즈 상태나 계획 컨텍스트가 없습니다. 각 스레드 파일에는 목표, 컨텍스트, 참조, 다음 단계 섹션이 포함됩니다.

스레드가 성숙해지면 페이즈(`/gsd-add-phase`)나 백로그 항목(`/gsd-add-backlog`)으로 승격할 수 있습니다.

**저장 위치:** `.planning/threads/{slug}.md`

---

## 워크스트림

워크스트림을 사용하면 상태 충돌 없이 여러 마일스톤 영역을 동시에 작업할 수 있습니다. 각 워크스트림은 독립적인 `.planning/` 상태를 가지므로 워크스트림 간 전환 시 진행 상황이 덮어쓰이지 않습니다.

**사용 시점:** 서로 다른 관심 영역(예: 백엔드 API와 프론트엔드 대시보드)에 걸친 마일스톤 기능을 독립적으로 계획, 실행 또는 토론하면서 컨텍스트 혼합 없이 작업하고 싶을 때 사용합니다.

### 명령어

| 명령어 | 목적 |
|--------|------|
| `/gsd-workstreams create <name>` | 격리된 계획 상태로 새 워크스트림 생성 |
| `/gsd-workstreams switch <name>` | 활성 컨텍스트를 다른 워크스트림으로 전환 |
| `/gsd-workstreams list` | 모든 워크스트림과 활성 워크스트림 표시 |
| `/gsd-workstreams complete <name>` | 워크스트림을 완료로 표시하고 상태 아카이브 |

### 작동 방식

각 워크스트림은 자체 `.planning/` 디렉터리 하위 트리를 유지합니다. 워크스트림을 전환하면 GSD가 활성 계획 컨텍스트를 교체하여 `/gsd-progress`, `/gsd-discuss-phase`, `/gsd-plan-phase` 및 기타 명령어가 해당 워크스트림의 상태로 동작합니다.

이는 `/gsd-new-workspace`(별도 저장소 worktree를 생성)보다 가볍습니다. 워크스트림은 동일한 코드베이스와 git 히스토리를 공유하지만 계획 아티팩트를 격리합니다.

---

## 보안

### 심층 방어 (v1.27)

GSD는 LLM 시스템 프롬프트가 되는 마크다운 파일을 생성합니다. 즉 계획 아티팩트로 유입되는 사용자 제어 텍스트는 잠재적인 간접 프롬프트 인젝션 벡터입니다. v1.27에서 중앙화된 보안 강화가 도입되었습니다.

**경로 순회 방지.**
모든 사용자 제공 파일 경로(`--text-file`, `--prd`)는 프로젝트 디렉터리 내에서 해석되는지 검증합니다. macOS `/var` → `/private/var` 심볼릭 링크 해석을 처리합니다.

**프롬프트 인젝션 감지.**
`security.cjs` 모듈은 사용자 제공 텍스트가 계획 아티팩트에 입력되기 전에 알려진 인젝션 패턴(역할 재정의, 지시 우회, 시스템 태그 인젝션)을 스캔합니다.

**런타임 훅.**
- `gsd-prompt-guard.js` — `.planning/`에 대한 Write/Edit 호출에서 인젝션 패턴 스캔 (항상 활성, 권고만)
- `gsd-workflow-guard.js` — GSD 워크플로우 컨텍스트 밖의 파일 편집 시 경고 (`hooks.workflow_guard`로 선택적 활성화)

**CI 스캐너.**
`prompt-injection-scan.test.cjs`는 모든 에이전트, 워크플로우, 명령어 파일에서 내장된 인젝션 벡터를 스캔합니다. 테스트 스위트의 일부로 실행됩니다.

---

### 실행 웨이브 조정

```
  /gsd-execute-phase N
         │
         ├── Analyze plan dependencies
         │
         ├── Wave 1 (independent plans):
         │     ├── Executor A (fresh 200K context) -> commit
         │     └── Executor B (fresh 200K context) -> commit
         │
         ├── Wave 2 (depends on Wave 1):
         │     └── Executor C (fresh 200K context) -> commit
         │
         └── Verifier
               └── Check codebase against phase goals
                     │
                     ├── PASS -> VERIFICATION.md (success)
                     └── FAIL -> Issues logged for /gsd-verify-work
```

### 브라운필드 워크플로우 (기존 코드베이스)

```
  /gsd-map-codebase
         │
         ├── Stack Mapper     -> codebase/STACK.md
         ├── Arch Mapper      -> codebase/ARCHITECTURE.md
         ├── Convention Mapper -> codebase/CONVENTIONS.md
         └── Concern Mapper   -> codebase/CONCERNS.md
                │
        ┌───────▼──────────┐
        │ /gsd-new-project │  <- Questions focus on what you're ADDING
        └──────────────────┘
```

---

## 명령어 레퍼런스

### 핵심 워크플로우

| 명령어 | 목적 | 사용 시점 |
|--------|------|----------|
| `/gsd-new-project` | 전체 프로젝트 초기화: 질문, 조사, 요구사항, 로드맵 | 새 프로젝트 시작 시 |
| `/gsd-new-project --auto @idea.md` | 문서에서 자동 초기화 | PRD나 아이디어 문서가 준비된 경우 |
| `/gsd-discuss-phase [N]` | 구현 결정사항 캡처 | 계획 전 구축 방식을 결정할 때 |
| `/gsd-ui-phase [N]` | UI 설계 계약 생성 | discuss-phase 이후, plan-phase 이전 (프론트엔드 페이즈) |
| `/gsd-plan-phase [N]` | 조사 + 계획 + 검증 | 페이즈 실행 전 |
| `/gsd-execute-phase <N>` | 병렬 웨이브로 모든 계획 실행 | 계획이 완료된 후 |
| `/gsd-verify-work [N]` | 자동 진단을 포함한 수동 UAT | 실행 완료 후 |
| `/gsd-ship [N]` | 검증된 작업으로 PR 생성 | 검증 통과 후 |
| `/gsd-fast <text>` | 계획을 완전히 건너뛰는 인라인 간단 작업 | 오타 수정, 설정 변경, 소규모 리팩터링 |
| `/gsd-next` | 상태 자동 감지 및 다음 단계 실행 | 언제든 — "다음에 무엇을 해야 하나?" |
| `/gsd-ui-review [N]` | 6개 기둥 기반 시각적 감사 소급 수행 | 실행 또는 verify-work 이후 (프론트엔드 프로젝트) |
| `/gsd-audit-milestone` | 마일스톤이 완료 정의를 충족했는지 검증 | 마일스톤 완료 전 |
| `/gsd-complete-milestone` | 마일스톤 아카이브 및 릴리스 태그 생성 | 모든 페이즈 검증 완료 시 |
| `/gsd-new-milestone [name]` | 다음 버전 사이클 시작 | 마일스톤 완료 후 |

### 탐색

| 명령어 | 목적 | 사용 시점 |
|--------|------|----------|
| `/gsd-progress` | 상태 및 다음 단계 표시 | 언제든 -- "지금 어디 있나?" |
| `/gsd-resume-work` | 마지막 세션의 전체 컨텍스트 복원 | 새 세션 시작 시 |
| `/gsd-pause-work` | 구조화된 핸드오프 저장 (HANDOFF.json + continue-here.md) | 페이즈 중간에 중단할 때 |
| `/gsd-session-report` | 작업 및 결과가 포함된 세션 요약 생성 | 세션 종료 시, 이해관계자 공유 시 |
| `/gsd-help` | 모든 명령어 표시 | 빠른 레퍼런스 |
| `/gsd-update` | 변경 로그 미리보기와 함께 GSD 업데이트 | 새 버전 확인 시 |
| `/gsd-join-discord` | Discord 커뮤니티 초대 링크 열기 | 질문이나 커뮤니티 참여 시 |

### 페이즈 관리

| 명령어 | 목적 | 사용 시점 |
|--------|------|----------|
| `/gsd-add-phase` | 로드맵에 새 페이즈 추가 | 초기 계획 후 범위가 늘어날 때 |
| `/gsd-insert-phase [N]` | 긴급 작업 삽입 (소수점 번호 체계) | 마일스톤 중간의 긴급 수정 시 |
| `/gsd-remove-phase [N]` | 미래 페이즈 제거 및 재번호 | 기능 범위 축소 시 |
| `/gsd-list-phase-assumptions [N]` | Claude의 예상 접근 방식 미리 확인 | 계획 전 방향 검증 시 |
| `/gsd-plan-milestone-gaps` | 감사 갭을 위한 페이즈 생성 | 감사에서 누락 항목이 발견된 후 |
| `/gsd-research-phase [N]` | 심층 에코시스템 조사만 수행 | 복잡하거나 익숙하지 않은 도메인 |

### 브라운필드 및 유틸리티

| 명령어 | 목적 | 사용 시점 |
|--------|------|----------|
| `/gsd-map-codebase` | 기존 코드베이스 분석 | 기존 코드에서 `/gsd-new-project` 실행 전 |
| `/gsd-quick` | GSD 보증을 갖춘 임시 작업 | 버그 수정, 소규모 기능, 설정 변경 |
| `/gsd-debug [desc]` | 지속적인 상태를 유지하는 체계적인 디버깅 | 문제가 발생했을 때 |
| `/gsd-forensics` | 워크플로우 실패에 대한 진단 보고서 | 상태, 아티팩트, git 히스토리가 손상된 것 같을 때 |
| `/gsd-add-todo [desc]` | 나중을 위한 아이디어 캡처 | 세션 중에 생각이 날 때 |
| `/gsd-check-todos` | 보류 중인 할 일 목록 | 캡처된 아이디어 검토 시 |
| `/gsd-settings` | 워크플로우 토글 및 모델 프로필 설정 | 모델 변경, 에이전트 토글 시 |
| `/gsd-set-profile <profile>` | 빠른 프로필 전환 | 비용/품질 트레이드오프 변경 시 |
| `/gsd-reapply-patches` | 업데이트 후 로컬 수정사항 복원 | 로컬 편집이 있는 상태에서 `/gsd-update` 이후 |

### 코드 품질 및 리뷰

| 명령어 | 목적 | 사용 시점 |
|--------|------|----------|
| `/gsd-review --phase N` | 외부 CLI를 통한 교차 AI 동료 리뷰 | 실행 전 계획 검증 시 |
| `/gsd-pr-branch` | `.planning/` 커밋을 필터링한 깔끔한 PR 브랜치 | 계획 없는 diff로 PR 생성 전 |
| `/gsd-audit-uat` | 모든 페이즈의 검증 부채 감사 | 마일스톤 완료 전 |

### 백로그 및 스레드

| 명령어 | 목적 | 사용 시점 |
|--------|------|----------|
| `/gsd-add-backlog <desc>` | 백로그 파킹 롯에 아이디어 추가 (999.x) | 활성 계획에 준비되지 않은 아이디어 |
| `/gsd-review-backlog` | 백로그 항목 승격/유지/제거 | 새 마일스톤 전 우선순위 결정 시 |
| `/gsd-plant-seed <idea>` | 트리거 조건이 있는 미래 지향적인 아이디어 | 미래 마일스톤에서 표면화되어야 할 아이디어 |
| `/gsd-thread [name]` | 지속적인 컨텍스트 스레드 | 페이즈 구조 밖의 교차 세션 작업 |

---

## 설정 레퍼런스

GSD는 프로젝트 설정을 `.planning/config.json`에 저장합니다. `/gsd-new-project` 중에 설정하거나 나중에 `/gsd-settings`로 업데이트할 수 있습니다.

### 전체 config.json 스키마

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "research_before_questions": false,
    "discuss_mode": "standard",
    "skip_discuss": false
  },
  "resolve_model_ids": "anthropic",
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  }
}
```

### 핵심 설정

| 설정 | 옵션 | 기본값 | 제어 대상 |
|------|------|--------|----------|
| `mode` | `interactive`, `yolo` | `interactive` | `yolo`는 결정을 자동 승인하고 `interactive`는 각 단계에서 확인합니다 |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | 페이즈 세분화: 범위를 얼마나 세밀하게 나눌지 (3-5, 5-8, 또는 8-12 페이즈) |
| `model_profile` | `quality`, `balanced`, `budget`, `inherit` | `balanced` | 각 에이전트의 모델 티어 (아래 표 참고) |

### 계획 설정

| 설정 | 옵션 | 기본값 | 제어 대상 |
|------|------|--------|----------|
| `planning.commit_docs` | `true`, `false` | `true` | `.planning/` 파일을 git에 커밋할지 여부 |
| `planning.search_gitignored` | `true`, `false` | `false` | 광범위한 검색에 `--no-ignore`를 추가하여 `.planning/` 포함 |

> **참고:** `.planning/`이 `.gitignore`에 있으면 설정 값에 관계없이 `commit_docs`는 자동으로 `false`가 됩니다.

### 워크플로우 토글

| 설정 | 옵션 | 기본값 | 제어 대상 |
|------|------|--------|----------|
| `workflow.research` | `true`, `false` | `true` | 계획 전 도메인 조사 |
| `workflow.plan_check` | `true`, `false` | `true` | 계획 검증 루프 (최대 3회 반복) |
| `workflow.verifier` | `true`, `false` | `true` | 페이즈 목표에 대한 실행 후 검증 |
| `workflow.nyquist_validation` | `true`, `false` | `true` | plan-phase 중 검증 아키텍처 조사 및 8번째 plan-check 차원 |
| `workflow.ui_phase` | `true`, `false` | `true` | 프론트엔드 페이즈를 위한 UI 설계 계약 생성 |
| `workflow.ui_safety_gate` | `true`, `false` | `true` | plan-phase가 프론트엔드 페이즈에서 /gsd-ui-phase 실행을 유도합니다 |
| `workflow.research_before_questions` | `true`, `false` | `false` | 토론 질문 이후가 아닌 이전에 조사를 실행합니다 |
| `workflow.discuss_mode` | `standard`, `assumptions` | `standard` | 토론 방식: 개방형 질문 vs. 코드베이스 기반 가정 |
| `workflow.skip_discuss` | `true`, `false` | `false` | 자율 모드에서 discuss-phase를 완전히 건너뜁니다. ROADMAP 페이즈 목표에서 최소한의 CONTEXT.md를 작성합니다 |

### 훅 설정

| 설정 | 옵션 | 기본값 | 제어 대상 |
|------|------|--------|----------|
| `hooks.context_warnings` | `true`, `false` | `true` | 컨텍스트 윈도우 사용량 경고 |
| `hooks.workflow_guard` | `true`, `false` | `false` | GSD 워크플로우 컨텍스트 밖의 파일 편집 시 경고 |

익숙한 도메인에서 페이즈를 빠르게 진행하거나 토큰을 절약할 때 워크플로우 토글을 비활성화하세요.

### Git 브랜칭

| 설정 | 옵션 | 기본값 | 제어 대상 |
|------|------|--------|----------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | 브랜치 생성 시점과 방법 |
| `git.phase_branch_template` | 템플릿 문자열 | `gsd/phase-{phase}-{slug}` | phase 전략의 브랜치 이름 |
| `git.milestone_branch_template` | 템플릿 문자열 | `gsd/{milestone}-{slug}` | milestone 전략의 브랜치 이름 |
| `git.quick_branch_template` | 템플릿 문자열 또는 `null` | `null` | `/gsd-quick` 작업의 선택적 브랜치 이름 |

**브랜칭 전략 설명.**

| 전략 | 브랜치 생성 | 범위 | 적합한 경우 |
|------|------------|------|------------|
| `none` | 생성 안 함 | N/A | 개인 개발, 간단한 프로젝트 |
| `phase` | 각 `execute-phase` 시 | 페이즈당 하나의 브랜치 | 페이즈별 코드 리뷰, 세분화된 롤백 |
| `milestone` | 첫 `execute-phase` 시 | 모든 페이즈가 하나의 브랜치 공유 | 릴리스 브랜치, 버전별 PR |

**템플릿 변수:** `{phase}` = 0 패딩된 번호 (예: "03"), `{slug}` = 소문자 하이픈 이름, `{milestone}` = 버전 (예: "v1.0"), `{num}` / `{quick}` = 빠른 작업 ID (예: "260317-abc").

빠른 작업 브랜칭 예시:

```json
"git": {
  "quick_branch_template": "gsd/quick-{num}-{slug}"
}
```

### 모델 프로필 (에이전트별 분류)

| 에이전트 | `quality` | `balanced` | `budget` | `inherit` |
|----------|-----------|------------|----------|-----------|
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

**프로필 철학.**
- **quality** -- 모든 의사결정 에이전트에 Opus를 사용하고 읽기 전용 검증에 Sonnet을 사용합니다. 할당량이 충분하고 작업이 중요할 때 사용합니다.
- **balanced** -- 아키텍처 결정이 이루어지는 계획에만 Opus를 사용하고 나머지는 Sonnet을 사용합니다. 합당한 이유로 기본값입니다.
- **budget** -- 코드를 작성하는 모든 것에 Sonnet을 사용하고 조사 및 검증에 Haiku를 사용합니다. 대량 작업이나 덜 중요한 페이즈에 사용합니다.
- **inherit** -- 모든 에이전트가 현재 세션 모델을 사용합니다. 동적으로 모델을 전환할 때 (예: OpenCode 또는 Kilo `/model`) 또는 예상치 못한 API 비용을 방지하기 위해 비Anthropic 공급자 (OpenRouter, 로컬 모델)와 함께 Claude Code를 사용할 때 적합합니다. 비Claude 런타임 (Codex, OpenCode, Gemini CLI, Kilo)의 경우 설치 프로그램이 자동으로 `resolve_model_ids: "omit"`을 설정합니다 — [비Claude 런타임](#비claude-런타임-codex-opencode-gemini-cli-kilo-사용)을 참고하세요.

---

## 사용 예시

### 새 프로젝트 (전체 사이클)

```bash
claude --dangerously-skip-permissions
/gsd-new-project            # Answer questions, configure, approve roadmap
/clear
/gsd-discuss-phase 1        # Lock in your preferences
/gsd-ui-phase 1             # Design contract (frontend phases)
/gsd-plan-phase 1           # Research + plan + verify
/gsd-execute-phase 1        # Parallel execution
/gsd-verify-work 1          # Manual UAT
/gsd-ship 1                 # Create PR from verified work
/gsd-ui-review 1            # Visual audit (frontend phases)
/clear
/gsd-next                   # Auto-detect and run next step
...
/gsd-audit-milestone        # Check everything shipped
/gsd-complete-milestone     # Archive, tag, done
/gsd-session-report         # Generate session summary
```

### 기존 문서로 새 프로젝트 시작

```bash
/gsd-new-project --auto @prd.md   # Auto-runs research/requirements/roadmap from your doc
/clear
/gsd-discuss-phase 1               # Normal flow from here
```

### 기존 코드베이스

```bash
/gsd-map-codebase           # Analyze what exists (parallel agents)
/gsd-new-project            # Questions focus on what you're ADDING
# (normal phase workflow from here)
```

### 빠른 버그 수정

```bash
/gsd-quick
> "Fix the login button not responding on mobile Safari"
```

### 휴식 후 재개

```bash
/gsd-progress               # See where you left off and what's next
# or
/gsd-resume-work            # Full context restoration from last session
```

### 릴리스 준비

```bash
/gsd-audit-milestone        # Check requirements coverage, detect stubs
/gsd-plan-milestone-gaps    # If audit found gaps, create phases to close them
/gsd-complete-milestone     # Archive, tag, done
```

### 속도 vs 품질 프리셋

| 시나리오 | Mode | Granularity | Profile | Research | Plan Check | Verifier |
|---------|------|-------------|---------|----------|------------|---------|
| 프로토타이핑 | `yolo` | `coarse` | `budget` | 끄기 | 끄기 | 끄기 |
| 일반 개발 | `interactive` | `standard` | `balanced` | 켜기 | 켜기 | 켜기 |
| 프로덕션 | `interactive` | `fine` | `quality` | 켜기 | 켜기 | 켜기 |

**자율 모드에서 discuss-phase 건너뛰기:** PROJECT.md에 선호도가 이미 충분히 캡처된 `yolo` 모드에서 실행할 때 `/gsd-settings`에서 `workflow.skip_discuss: true`로 설정하세요. 이렇게 하면 discuss-phase를 완전히 우회하고 ROADMAP 페이즈 목표에서 파생된 최소한의 CONTEXT.md를 작성합니다. PROJECT.md와 관례가 충분히 포괄적이어서 토론이 새로운 정보를 제공하지 않을 때 유용합니다.

### 마일스톤 중간 범위 변경

```bash
/gsd-add-phase              # Append a new phase to the roadmap
# or
/gsd-insert-phase 3         # Insert urgent work between phases 3 and 4
# or
/gsd-remove-phase 7         # Descope phase 7 and renumber
```

### 멀티 프로젝트 워크스페이스

격리된 GSD 상태로 여러 저장소나 기능을 병렬로 작업합니다.

```bash
# Create a workspace with repos from your monorepo
/gsd-new-workspace --name feature-b --repos hr-ui,ZeymoAPI

# Feature branch isolation — worktree of current repo with its own .planning/
/gsd-new-workspace --name feature-b --repos .

# Then cd into the workspace and initialize GSD
cd ~/gsd-workspaces/feature-b
/gsd-new-project

# List and manage workspaces
/gsd-list-workspaces
/gsd-remove-workspace feature-b
```

각 워크스페이스는 다음을 포함합니다.
- 자체 `.planning/` 디렉터리 (원본 저장소와 완전히 독립)
- 지정된 저장소의 git worktree (기본값) 또는 클론
- 멤버 저장소를 추적하는 `WORKSPACE.md` 매니페스트

---

## 문제 해결

### "Project already initialized"

`.planning/PROJECT.md`가 이미 존재하는데 `/gsd-new-project`를 실행했습니다. 이것은 안전 검사입니다. 처음부터 다시 시작하려면 먼저 `.planning/` 디렉터리를 삭제하세요.

### 긴 세션 중 컨텍스트 저하

주요 명령어 사이에 컨텍스트 윈도우를 지우세요: Claude Code에서 `/clear`를 사용합니다. GSD는 새로운 컨텍스트를 기반으로 설계되었습니다 — 모든 서브에이전트는 깨끗한 200K 윈도우를 받습니다. 메인 세션의 품질이 저하되면 지우고 `/gsd-resume-work` 또는 `/gsd-progress`를 사용하여 상태를 복원하세요.

### 계획이 잘못되거나 맞지 않는 경우

계획 전에 `/gsd-discuss-phase [N]`을 실행하세요. 대부분의 계획 품질 문제는 `CONTEXT.md`가 있었다면 방지할 수 있었던 가정을 Claude가 세우기 때문에 발생합니다. `/gsd-list-phase-assumptions [N]`을 실행하여 계획에 동의하기 전에 Claude가 무엇을 하려는지 확인할 수도 있습니다.

### 실행이 실패하거나 스텁을 생성하는 경우

계획이 너무 야심차지 않은지 확인하세요. 계획에는 최대 2-3개의 작업이 있어야 합니다. 작업이 너무 크면 단일 컨텍스트 윈도우에서 안정적으로 처리할 수 있는 범위를 초과합니다. 더 작은 범위로 재계획하세요.

### 현재 위치를 잃어버린 경우

`/gsd-progress`를 실행하세요. 모든 상태 파일을 읽고 현재 위치와 다음에 할 일을 정확히 알려줍니다.

### 실행 후 변경이 필요한 경우

`/gsd-execute-phase`를 다시 실행하지 마세요. 목표를 정확히 수정하려면 `/gsd-quick`을 사용하거나 UAT를 통해 체계적으로 문제를 식별하고 수정하려면 `/gsd-verify-work`를 사용하세요.

### 모델 비용이 너무 높은 경우

예산 프로필로 전환하세요: `/gsd-set-profile budget`. 도메인이 익숙하다면 (또는 Claude에게 익숙하다면) `/gsd-settings`에서 조사 및 plan-check 에이전트를 비활성화하세요.

### 비Claude 런타임 사용 (Codex, OpenCode, Gemini CLI, Kilo)

비Claude 런타임용으로 GSD를 설치했다면 설치 프로그램이 이미 모든 에이전트가 런타임의 기본 모델을 사용하도록 모델 해석을 구성했습니다. 수동 설정이 필요하지 않습니다. 구체적으로 설치 프로그램은 config에 `resolve_model_ids: "omit"`을 설정하여 GSD가 Anthropic 모델 ID 해석을 건너뛰고 런타임이 자체 기본 모델을 선택하도록 합니다.

비Claude 런타임에서 에이전트별로 다른 모델을 할당하려면 런타임이 인식하는 완전한 자격을 갖춘 모델 ID와 함께 `.planning/config.json`에 `model_overrides`를 추가하세요.

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3"
  }
}
```

설치 프로그램은 Gemini CLI, OpenCode, Kilo, Codex에 대해 `resolve_model_ids: "omit"`을 자동으로 구성합니다. 비Claude 런타임을 수동으로 설정하는 경우 직접 `.planning/config.json`에 추가하세요.

전체 설명은 [Configuration Reference](CONFIGURATION.md#non-claude-runtimes-codex-opencode-gemini-cli-kilo)를 참고하세요.

### 비Anthropic 공급자와 함께 Claude Code 사용 (OpenRouter, 로컬)

GSD 서브에이전트가 Anthropic 모델을 호출하는데 OpenRouter나 로컬 공급자를 통해 비용을 지불하고 있다면 `inherit` 프로필로 전환하세요: `/gsd-set-profile inherit`. 이렇게 하면 모든 에이전트가 특정 Anthropic 모델 대신 현재 세션 모델을 사용합니다. `/gsd-settings` → Model Profile → Inherit도 참고하세요.

### 민감하거나 비공개 프로젝트에서 작업하는 경우

`/gsd-new-project` 중에 또는 `/gsd-settings`에서 `commit_docs: false`로 설정하세요. `.planning/`을 `.gitignore`에 추가하세요. 계획 아티팩트는 로컬에 유지되며 git에 절대 포함되지 않습니다.

### GSD 업데이트가 로컬 변경사항을 덮어쓴 경우

v1.17부터 설치 프로그램이 로컬로 수정된 파일을 `gsd-local-patches/`에 백업합니다. 변경사항을 다시 병합하려면 `/gsd-reapply-patches`를 실행하세요.

### 워크플로우 진단 (`/gsd-forensics`)

워크플로우가 명확하지 않은 방식으로 실패할 때 — 계획이 존재하지 않는 파일을 참조하거나 실행이 예상치 못한 결과를 생성하거나 상태가 손상된 것 같을 때 — `/gsd-forensics`를 실행하여 진단 보고서를 생성하세요.

**검사 항목.**
- Git 히스토리 이상 (고아 커밋, 예상치 못한 브랜치 상태, rebase 아티팩트)
- 아티팩트 무결성 (누락되거나 잘못된 계획 파일, 끊어진 교차 참조)
- 상태 불일치 (실제 파일 존재 여부 대비 ROADMAP 상태, 설정 드리프트)

**출력:** 발견사항과 권장 수정 단계가 포함된 `.planning/forensics/`의 진단 보고서.

### 서브에이전트가 실패한 것 같지만 작업이 완료된 경우

Claude Code 분류 버그에 대한 알려진 해결 방법이 있습니다. GSD의 오케스트레이터 (execute-phase, quick)는 실패를 보고하기 전에 실제 출력을 현장 확인합니다. 실패 메시지가 표시되었지만 커밋이 이루어진 경우 `git log`를 확인하세요 — 작업이 성공했을 수 있습니다.

### 병렬 실행으로 인한 빌드 잠금 오류

병렬 웨이브 실행 중에 pre-commit 훅 실패, cargo lock 경합, 또는 30분 이상의 실행 시간이 발생한다면 여러 에이전트가 동시에 빌드 도구를 실행하기 때문입니다. GSD는 v1.26부터 이를 자동으로 처리합니다 — 병렬 에이전트는 커밋에 `--no-verify`를 사용하고 오케스트레이터가 각 웨이브 후 한 번 훅을 실행합니다. 이전 버전을 사용하는 경우 프로젝트의 `CLAUDE.md`에 다음을 추가하세요.

```markdown
## Git Commit Rules for Agents
All subagent/executor commits MUST use `--no-verify`.
```

병렬 실행을 완전히 비활성화하려면: `/gsd-settings` → `parallelization.enabled`를 `false`로 설정합니다.

### Windows: 보호된 디렉터리에서 설치 충돌

Windows에서 설치 프로그램이 `EPERM: operation not permitted, scandir`으로 충돌하는 경우 OS 보호 디렉터리 (예: Chromium 브라우저 프로필) 때문입니다. v1.24부터 수정되었으니 최신 버전으로 업데이트하세요. 해결 방법으로 설치 프로그램을 실행하기 전에 문제가 되는 디렉터리를 임시로 이름을 변경하세요.

---

## 복구 빠른 레퍼런스

| 문제 | 해결 방법 |
|------|----------|
| 컨텍스트 손실 / 새 세션 | `/gsd-resume-work` 또는 `/gsd-progress` |
| 페이즈가 잘못됨 | 페이즈 커밋에 `git revert` 후 재계획 |
| 범위 변경 필요 | `/gsd-add-phase`, `/gsd-insert-phase`, 또는 `/gsd-remove-phase` |
| 마일스톤 감사에서 갭 발견 | `/gsd-plan-milestone-gaps` |
| 무언가 고장남 | `/gsd-debug "description"` |
| 워크플로우 상태 손상 의심 | `/gsd-forensics` |
| 빠른 목표 수정 | `/gsd-quick` |
| 계획이 비전과 맞지 않음 | `/gsd-discuss-phase [N]` 후 재계획 |
| 비용이 높아짐 | `/gsd-set-profile budget` 및 `/gsd-settings`에서 에이전트 비활성화 |
| 업데이트가 로컬 변경사항 파괴 | `/gsd-reapply-patches` |
| 이해관계자를 위한 세션 요약 필요 | `/gsd-session-report` |
| 다음 단계를 모르겠음 | `/gsd-next` |
| 병렬 실행 빌드 오류 | GSD 업데이트 또는 `parallelization.enabled: false` 설정 |

---

## 프로젝트 파일 구조

참고로 GSD가 프로젝트에 생성하는 파일 구조입니다.

```
.planning/
  PROJECT.md              # Project vision and context (always loaded)
  REQUIREMENTS.md         # Scoped v1/v2 requirements with IDs
  ROADMAP.md              # Phase breakdown with status tracking
  STATE.md                # Decisions, blockers, session memory
  config.json             # Workflow configuration
  MILESTONES.md           # Completed milestone archive
  HANDOFF.json            # Structured session handoff (from /gsd-pause-work)
  research/               # Domain research from /gsd-new-project
  reports/                # Session reports (from /gsd-session-report)
  todos/
    pending/              # Captured ideas awaiting work
    done/                 # Completed todos
  debug/                  # Active debug sessions
    resolved/             # Archived debug sessions
  codebase/               # Brownfield codebase mapping (from /gsd-map-codebase)
  phases/
    XX-phase-name/
      XX-YY-PLAN.md       # Atomic execution plans
      XX-YY-SUMMARY.md    # Execution outcomes and decisions
      CONTEXT.md          # Your implementation preferences
      RESEARCH.md         # Ecosystem research findings
      VERIFICATION.md     # Post-execution verification results
      XX-UI-SPEC.md       # UI design contract (from /gsd-ui-phase)
      XX-UI-REVIEW.md     # Visual audit scores (from /gsd-ui-review)
  ui-reviews/             # Screenshots from /gsd-ui-review (gitignored)
```
