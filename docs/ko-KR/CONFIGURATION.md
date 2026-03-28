# GSD 설정 레퍼런스

> 전체 설정 스키마, 워크플로우 토글, 모델 프로필, git 브랜칭 옵션입니다. 기능에 대한 맥락은 [Feature Reference](FEATURES.md)를 참조하세요.

---

## 설정 파일

GSD는 프로젝트 설정을 `.planning/config.json`에 저장합니다. `/gsd:new-project` 실행 시 생성되며 `/gsd:settings`를 통해 업데이트할 수 있습니다.

### 전체 스키마

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "text_mode": false
  },
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

---

## 핵심 설정

| 설정 | 타입 | 옵션 | 기본값 | 설명 |
|------|------|------|--------|------|
| `mode` | enum | `interactive`, `yolo` | `interactive` | `yolo`는 결정을 자동 승인하고 `interactive`는 각 단계에서 확인을 요청합니다. |
| `granularity` | enum | `coarse`, `standard`, `fine` | `standard` | 단계 수를 조절합니다. `coarse` (3~5), `standard` (5~8), `fine` (8~12) |
| `model_profile` | enum | `quality`, `balanced`, `budget`, `inherit` | `balanced` | 각 에이전트의 모델 티어입니다. ([Model Profiles](#model-profiles) 참조) |

> **참고:** `granularity`는 v1.22.3에서 `depth`에서 이름이 변경되었습니다. 기존 설정은 자동으로 마이그레이션됩니다.

---

## 워크플로우 토글

모든 워크플로우 토글은 **키가 없으면 활성화** 패턴을 따릅니다. 설정에서 키가 없으면 기본값은 `true`입니다.

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `workflow.research` | boolean | `true` | 각 단계 플래닝 전 도메인 조사 |
| `workflow.plan_check` | boolean | `true` | 플랜 검증 루프 (최대 3회 반복) |
| `workflow.verifier` | boolean | `true` | 실행 후 단계 목표 대비 검증 |
| `workflow.auto_advance` | boolean | `false` | discuss → plan → execute를 중단 없이 자동으로 연결 |
| `workflow.nyquist_validation` | boolean | `true` | plan 단계 리서치 중 테스트 커버리지 매핑 |
| `workflow.ui_phase` | boolean | `true` | 프론트엔드 단계를 위한 UI 디자인 계약서 생성 |
| `workflow.ui_safety_gate` | boolean | `true` | plan 단계에서 프론트엔드 단계에 대해 /gsd:ui-phase 실행 여부 확인 |
| `workflow.node_repair` | boolean | `true` | 검증 실패 시 자율적 태스크 복구 |
| `workflow.node_repair_budget` | number | `2` | 실패한 태스크당 최대 복구 시도 횟수 |
| `workflow.research_before_questions` | boolean | `false` | 토론 질문 후가 아닌 전에 리서치 실행 |
| `workflow.discuss_mode` | string | `'discuss'` | `/gsd:discuss-phase`의 컨텍스트 수집 방식을 제어합니다. `'discuss'` (기본값)는 질문을 하나씩 합니다. `'assumptions'`는 코드베이스를 먼저 읽고 신뢰도 수준이 있는 구조화된 가정을 생성하여 틀린 부분만 수정하도록 요청합니다. v1.28에서 추가 |
| `workflow.skip_discuss` | boolean | `false` | `true`로 설정하면 `/gsd:autonomous`가 discuss 단계를 완전히 건너뛰고 ROADMAP 단계 목표로부터 최소한의 CONTEXT.md를 작성합니다. 개발자 선호사항이 PROJECT.md/REQUIREMENTS.md에 모두 캡처된 프로젝트에 유용합니다. v1.28에서 추가 |
| `workflow.text_mode` | boolean | `false` | AskUserQuestion TUI 메뉴를 일반 텍스트 번호 목록으로 대체합니다. TUI 메뉴가 렌더링되지 않는 Claude Code 원격 세션 (`/rc` 모드)에 필요합니다. discuss 단계에서 `--text` 플래그로 세션별 설정도 가능합니다. v1.28에서 추가 |

### 권장 프리셋

| 시나리오 | mode | granularity | profile | research | plan_check | verifier |
|---------|------|-------------|---------|----------|------------|----------|
| 프로토타이핑 | `yolo` | `coarse` | `budget` | `false` | `false` | `false` |
| 일반 개발 | `interactive` | `standard` | `balanced` | `true` | `true` | `true` |
| 프로덕션 릴리스 | `interactive` | `fine` | `quality` | `true` | `true` | `true` |

---

## 플래닝 설정

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `planning.commit_docs` | boolean | `true` | `.planning/` 파일을 git에 커밋할지 여부 |
| `planning.search_gitignored` | boolean | `false` | 광범위한 검색에 `--no-ignore`를 추가하여 `.planning/`을 포함 |

### 자동 감지

`.planning/`이 `.gitignore`에 포함되어 있으면 config.json 설정과 무관하게 `commit_docs`가 자동으로 `false`로 설정됩니다. 이는 git 오류를 방지합니다.

---

## 훅 설정

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `hooks.context_warnings` | boolean | `true` | context monitor 훅을 통해 컨텍스트 윈도우 사용 경고 표시 |
| `hooks.workflow_guard` | boolean | `false` | GSD 워크플로우 컨텍스트 밖에서 파일 편집이 발생할 때 경고 ((`/gsd:quick` 또는 `/gsd:fast` 사용 권고)) |

프롬프트 주입 방지 훅 (`gsd-prompt-guard.js`)은 항상 활성화되며 비활성화할 수 없습니다. 워크플로우 토글이 아닌 보안 기능입니다.

### 플래닝 비공개 설정

플래닝 아티팩트를 git에서 제외하려면 다음과 같이 설정합니다.

1. `planning.commit_docs: false` 및 `planning.search_gitignored: true` 설정
2. `.planning/`을 `.gitignore`에 추가
3. 이미 추적 중인 경우: `git rm -r --cached .planning/ && git commit -m "chore: stop tracking planning docs"`

---

## 병렬화 설정

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `parallelization.enabled` | boolean | `true` | 독립적인 플랜을 동시에 실행 |
| `parallelization.plan_level` | boolean | `true` | 플랜 수준에서 병렬화 |
| `parallelization.task_level` | boolean | `false` | 플랜 내 태스크를 병렬화 |
| `parallelization.skip_checkpoints` | boolean | `true` | 병렬 실행 중 체크포인트 건너뜀 |
| `parallelization.max_concurrent_agents` | number | `3` | 동시 실행 가능한 최대 에이전트 수 |
| `parallelization.min_plans_for_parallel` | number | `2` | 병렬 실행을 시작하기 위한 최소 플랜 수 |

> **Pre-commit 훅과 병렬 실행:** 병렬화가 활성화되면 executor 에이전트는 빌드 잠금 경합(예: Rust 프로젝트의 cargo lock 충돌)을 피하기 위해 `--no-verify`로 커밋합니다. 오케스트레이터는 각 wave가 완료된 후 훅을 한 번 검증합니다. STATE.md 쓰기는 동시 쓰기 충돌을 방지하기 위해 파일 수준 잠금으로 보호됩니다. 커밋마다 훅을 실행해야 한다면 `parallelization.enabled: false`로 설정하세요.

---

## Git 브랜칭

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `git.branching_strategy` | enum | `none` | `none`, `phase`, 또는 `milestone` |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | phase 전략의 브랜치 이름 템플릿 |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | milestone 전략의 브랜치 이름 템플릿 |
| `git.quick_branch_template` | string 또는 null | `null` | `/gsd:quick` 태스크를 위한 선택적 브랜치 이름 템플릿 |

### 전략 비교

| 전략 | 브랜치 생성 | 범위 | 병합 시점 | 적합한 경우 |
|------|------------|------|----------|------------|
| `none` | 없음 | 해당 없음 | 해당 없음 | 개인 개발, 단순 프로젝트 |
| `phase` | `execute-phase` 시작 시 | 단일 단계 | 단계 완료 후 사용자가 병합 | 단계별 코드 리뷰, 세밀한 롤백 |
| `milestone` | 첫 번째 `execute-phase` 시 | milestone 내 모든 단계 | `complete-milestone` 시 | 릴리스 브랜치, 버전별 PR |

### 템플릿 변수

| 변수 | 사용 가능한 템플릿 | 예시 |
|------|------------------|------|
| `{phase}` | `phase_branch_template` | `03` (0 패딩) |
| `{slug}` | 두 템플릿 모두 | `user-authentication` (소문자, 하이픈) |
| `{milestone}` | `milestone_branch_template` | `v1.0` |
| `{num}` / `{quick}` | `quick_branch_template` | `260317-abc` (quick 태스크 ID) |

quick 태스크 브랜칭 예시:

```json
"git": {
  "quick_branch_template": "gsd/quick-{num}-{slug}"
}
```

### Milestone 완료 시 병합 옵션

| 옵션 | Git 명령어 | 결과 |
|------|-----------|------|
| Squash merge (권장) | `git merge --squash` | 브랜치당 단일 클린 커밋 |
| Merge with history | `git merge --no-ff` | 모든 개별 커밋 보존 |
| Delete without merging | `git branch -D` | 브랜치 작업 폐기 |
| Keep branches | (없음) | 나중에 수동으로 처리 |

---

## Gate 설정

워크플로우 중 확인 프롬프트를 제어합니다.

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `gates.confirm_project` | boolean | `true` | 확정 전 프로젝트 세부사항 확인 |
| `gates.confirm_phases` | boolean | `true` | 단계 분류 확인 |
| `gates.confirm_roadmap` | boolean | `true` | 진행 전 로드맵 확인 |
| `gates.confirm_breakdown` | boolean | `true` | 태스크 분류 확인 |
| `gates.confirm_plan` | boolean | `true` | 실행 전 각 플랜 확인 |
| `gates.execute_next_plan` | boolean | `true` | 다음 플랜 실행 전 확인 |
| `gates.issues_review` | boolean | `true` | 수정 플랜 생성 전 이슈 검토 |
| `gates.confirm_transition` | boolean | `true` | 단계 전환 확인 |

---

## 안전성 설정

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `safety.always_confirm_destructive` | boolean | `true` | 파괴적 작업(삭제, 덮어쓰기) 확인 |
| `safety.always_confirm_external_services` | boolean | `true` | 외부 서비스 상호작용 확인 |

---

## 훅 설정

| 설정 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `hooks.context_warnings` | boolean | `true` | 세션 중 컨텍스트 윈도우 사용 경고 표시 |

---

## 모델 프로필

### 프로필 정의

| 에이전트 | `quality` | `balanced` | `budget` | `inherit` |
|---------|-----------|------------|----------|-----------|
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

### 에이전트별 재정의

전체 프로필을 변경하지 않고 특정 에이전트만 재정의할 수 있습니다.

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

유효한 재정의 값: `opus`, `sonnet`, `haiku`, `inherit`, 또는 완전히 정규화된 모델 ID (예: `"openai/o3"`, `"google/gemini-2.5-pro"`).

### 비 Claude 런타임 (Codex, OpenCode, Gemini CLI)

비 Claude 런타임에 GSD를 설치하면 인스톨러가 자동으로 `~/.gsd/defaults.json`에 `resolve_model_ids: "omit"`을 설정합니다. 이로 인해 GSD는 모든 에이전트에 빈 model 파라미터를 반환하며 각 에이전트는 런타임에 설정된 모델을 사용합니다. 기본 사용 시 추가 설정은 필요하지 않습니다.

에이전트마다 다른 모델을 사용하려면 런타임이 인식하는 완전히 정규화된 모델 ID로 `model_overrides`를 사용합니다.

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
```

의도는 Claude 프로필 티어와 동일합니다. 추론 품질이 가장 중요한 플래닝과 디버깅에는 더 강력한 모델을 사용하고 플랜에 추론이 이미 포함된 실행과 매핑에는 저렴한 모델을 사용합니다.

**접근 방식 선택 기준.**

| 시나리오 | 설정 | 효과 |
|---------|------|------|
| 비 Claude 런타임, 단일 모델 | `resolve_model_ids: "omit"` (인스톨러 기본값) | 모든 에이전트가 런타임 기본 모델 사용 |
| 비 Claude 런타임, 계층형 모델 | `resolve_model_ids: "omit"` + `model_overrides` | 지정된 에이전트는 특정 모델 사용, 나머지는 런타임 기본값 사용 |
| Claude Code + OpenRouter/로컬 프로바이더 | `model_profile: "inherit"` | 모든 에이전트가 세션 모델을 따름 |
| Claude Code + OpenRouter, 계층형 | `model_profile: "inherit"` + `model_overrides` | 지정된 에이전트는 특정 모델 사용, 나머지는 상속 |

**`resolve_model_ids` 값.**

| 값 | 동작 | 사용 시점 |
|----|------|----------|
| `false` (기본값) | Claude 별칭 반환 (`opus`, `sonnet`, `haiku`) | 네이티브 Anthropic API를 사용하는 Claude Code |
| `true` | 별칭을 전체 Claude 모델 ID로 매핑 (`claude-opus-4-0`) | 전체 ID가 필요한 API를 사용하는 Claude Code |
| `"omit"` | 빈 문자열 반환 (런타임이 기본값 선택) | 비 Claude 런타임 (Codex, OpenCode, Gemini CLI) |

### 프로필 철학

| 프로필 | 철학 | 사용 시점 |
|--------|------|----------|
| `quality` | 모든 의사결정에 Opus, 검증에 Sonnet | 할당량 여유가 있을 때, 중요한 아키텍처 작업 |
| `balanced` | 플래닝에만 Opus, 나머지는 Sonnet | 일반 개발 (기본값) |
| `budget` | 코드 작성에 Sonnet, 리서치/검증에 Haiku | 대용량 작업, 덜 중요한 단계 |
| `inherit` | 모든 에이전트가 현재 세션 모델 사용 | 동적 모델 전환, **비 Anthropic 프로바이더** (OpenRouter, 로컬 모델) |

---

## 환경 변수

| 변수 | 용도 |
|------|------|
| `CLAUDE_CONFIG_DIR` | 기본 설정 디렉토리 재정의 (`~/.claude/`) |
| `GEMINI_API_KEY` | context monitor가 훅 이벤트 이름을 전환하기 위해 감지 |
| `WSL_DISTRO_NAME` | 인스톨러가 WSL 경로 처리를 위해 감지 |

---

## 전역 기본값

향후 프로젝트를 위한 전역 기본값으로 설정을 저장할 수 있습니다.

**위치:** `~/.gsd/defaults.json`

`/gsd:new-project`가 새 `config.json`을 생성할 때 전역 기본값을 읽어 초기 설정으로 병합합니다. 프로젝트별 설정은 항상 전역 설정보다 우선합니다.
