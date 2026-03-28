# 멀티 프로젝트 워크스페이스 (`/gsd:new-workspace`)

**Issue:** #1241
**Date:** 2026-03-20
**Status:** Approved

## 문제

GSD는 작업 디렉토리당 하나의 `.planning/` 디렉토리에 종속되어 있습니다. 20개 이상의 하위 저장소가 있는 모노저장소 스타일 설정에서 여러 독립 프로젝트를 사용하는 사용자나 동일한 저장소에서 피처 브랜치 격리가 필요한 사용자는 수동 클론 및 상태 관리 없이 병렬 GSD 세션을 실행할 수 없습니다.

## 해결책

**물리적 워크스페이스 디렉토리**를 생성, 나열, 제거하는 세 가지 새로운 명령어입니다 — 각각은 저장소 복사본(git worktree 또는 클론)과 독립적인 `.planning/` 디렉토리를 포함합니다.

이것은 두 가지 사용 사례를 다룹니다:
- **멀티 저장소 오케스트레이션(A):** 상위 디렉토리에서 여러 저장소에 걸친 워크스페이스
- **피처 브랜치 격리(B):** 현재 저장소의 worktree를 포함하는 워크스페이스(`--repos .`인 경우 A의 특수 케이스)

## 명령어

### `/gsd:new-workspace`

저장소 복사본과 자체 `.planning/`이 있는 워크스페이스 디렉토리를 생성합니다.

```
/gsd:new-workspace --name feature-b --repos hr-ui,ZeymoAPI --path ~/workspaces/feature-b
/gsd:new-workspace --name feature-b --repos . --strategy worktree   # 동일 저장소 격리
```

**인수.**

| 플래그 | 필수 여부 | 기본값 | 설명 |
|------|----------|---------|-------------|
| `--name` | 예 | — | 워크스페이스 이름 |
| `--repos` | 아니오 | 대화형 선택 | 쉼표로 구분된 저장소 경로 또는 이름 |
| `--path` | 아니오 | `~/gsd-workspaces/<name>` | 대상 디렉토리 |
| `--strategy` | 아니오 | `worktree` | `worktree`(가볍고 .git 공유) 또는 `clone`(완전히 독립) |
| `--branch` | 아니오 | `workspace/<name>` | 체크아웃할 브랜치 |
| `--auto` | 아니오 | false | 대화형 질문 건너뛰고 기본값 사용 |

### `/gsd:list-workspaces`

워크스페이스 매니페스트를 위해 `~/gsd-workspaces/*/WORKSPACE.md`를 스캔합니다. 이름, 경로, 저장소 수, GSD 상태(PROJECT.md 존재 여부, 현재 페이즈)가 있는 표를 표시합니다.

### `/gsd:remove-workspace`

확인 후 워크스페이스 디렉토리를 제거합니다. worktree 전략의 경우 먼저 각 멤버 저장소에 대해 `git worktree remove`를 실행합니다. 저장소에 커밋되지 않은 변경사항이 있으면 거부합니다.

## 디렉토리 구조

```
~/gsd-workspaces/feature-b/          # 워크스페이스 루트
├── WORKSPACE.md                      # 매니페스트
├── .planning/                        # 독립적인 GSD 계획 디렉토리
│   ├── PROJECT.md                    # (사용자가 /gsd:new-project를 실행한 경우)
│   ├── STATE.md
│   └── config.json
├── hr-ui/                            # 소스 저장소의 git worktree
│   └── (workspace/feature-b 브랜치의 저장소 내용)
└── ZeymoAPI/                         # 소스 저장소의 git worktree
    └── (workspace/feature-b 브랜치의 저장소 내용)
```

주요 속성.
- `.planning/`은 개별 저장소 내부가 아닌 워크스페이스 루트에 있습니다.
- 각 저장소는 워크스페이스 루트 아래의 피어 디렉토리입니다.
- `WORKSPACE.md`는 루트에 있는 유일한 GSD 전용 파일입니다(`.planning/` 외).
- `--strategy clone`의 경우 동일한 구조이지만 저장소는 전체 클론입니다.

## WORKSPACE.md 형식

```markdown
# Workspace: feature-b

Created: 2026-03-20
Strategy: worktree

## Member Repos

| Repo | Source | Branch | Strategy |
|------|--------|--------|----------|
| hr-ui | /root/source/repos/hr-ui | workspace/feature-b | worktree |
| ZeymoAPI | /root/source/repos/ZeymoAPI | workspace/feature-b | worktree |

## Notes

[사용자가 이 워크스페이스의 목적에 대한 컨텍스트를 추가할 수 있습니다]
```

## 워크플로우

### `/gsd:new-workspace` 워크플로우 단계

1. **설정** — `init new-workspace` 호출, JSON 컨텍스트 파싱
2. **입력 수집** — `--name`/`--repos`/`--path`가 제공되지 않으면 대화형으로 질문합니다. 저장소의 경우 cwd의 하위 `.git` 디렉토리를 옵션으로 표시합니다.
3. **유효성 검사** — 대상 경로가 존재하지 않거나 비어 있음. 소스 저장소가 존재하고 git 저장소임.
4. **워크스페이스 디렉토리 생성** — `mkdir -p <path>`
5. **저장소 복사** — 각 저장소에 대해.
   - Worktree: `git worktree add <workspace>/<repo-name> -b workspace/<name>`
   - Clone: `git clone <source> <workspace>/<repo-name>`
6. **WORKSPACE.md 작성** — 소스 경로, 전략, 브랜치가 있는 매니페스트
7. **.planning/ 초기화** — `mkdir -p <workspace>/.planning`
8. **/gsd:new-project 제안** — 새 워크스페이스에서 프로젝트 초기화를 실행할지 사용자에게 질문
9. **커밋** — commit_docs가 활성화된 경우 WORKSPACE.md의 원자적 커밋
10. **완료** — 워크스페이스 경로와 다음 단계 출력

### Init 함수(`cmdInitNewWorkspace`)

다음을 감지합니다.
- cwd의 하위 git 저장소(대화형 저장소 선택을 위해)
- 대상 경로가 이미 존재하는지 여부
- 소스 저장소에 커밋되지 않은 변경사항이 있는지 여부
- `git worktree`를 사용할 수 있는지 여부
- 기본 워크스페이스 기본 디렉토리(`~/gsd-workspaces/`)

워크플로우 게이팅을 위한 플래그가 포함된 JSON을 반환합니다.

## 오류 처리

### 유효성 검사 오류(생성 차단)

- **대상 경로가 존재하고 비어 있지 않음** — 다른 이름/경로 선택 제안과 함께 오류
- **소스 저장소 경로가 존재하지 않거나 git 저장소가 아님** — 실패한 저장소를 나열하는 오류
- **`git worktree add` 실패**(예: 브랜치가 이미 존재) — `workspace/<name>-<timestamp>` 브랜치로 폴백, 그것도 실패하면 오류

### 정상적인 처리

- **소스 저장소에 커밋되지 않은 변경사항** — 경고하되 허용(worktree는 브랜치를 새로 체크아웃하며 작업 디렉토리 상태를 복사하지 않음)
- **멀티 저장소 워크스페이스에서 부분 실패** — 성공한 저장소로 워크스페이스를 생성하고 실패를 보고하며 부분적인 WORKSPACE.md 작성
- **`--repos .`(현재 저장소, 케이스 B)** — 디렉토리 이름 또는 git remote에서 저장소 이름 감지, 하위 디렉토리 이름으로 사용

### Remove-Workspace 안전성

- **워크스페이스 저장소에 커밋되지 않은 변경사항** — 제거를 거부하고 변경사항이 있는 저장소 출력
- **Worktree 제거 실패**(예: 소스 저장소가 삭제됨) — 경고하고 디렉토리 정리를 계속 진행
- **확인** — 워크스페이스 이름을 직접 입력하는 명시적 확인 필요

### List-Workspaces 엣지 케이스

- **`~/gsd-workspaces/`가 존재하지 않음** — "No workspaces found"
- **WORKSPACE.md는 있지만 내부 저장소가 사라짐** — 워크스페이스를 표시하되 저장소를 누락으로 표시

## 테스팅

### 단위 테스트(`tests/workspace.test.cjs`)

1. `cmdInitNewWorkspace`가 올바른 JSON 반환 — 하위 git 저장소 감지, 대상 경로 유효성 검사, git worktree 가용성 감지
2. WORKSPACE.md 생성 — 저장소 표, 전략, 날짜가 있는 올바른 형식
3. 저장소 발견 — cwd 하위 항목에서 `.git` 디렉토리 식별, git 디렉토리가 아닌 디렉토리와 파일 건너뜀
4. 유효성 검사 — 비어 있지 않은 기존 대상 경로 거부, git이 아닌 소스 경로 거부

### 통합 테스트(동일 파일)

5. Worktree 생성 — 워크스페이스 생성, 저장소 디렉토리가 유효한 git worktree인지 확인
6. Clone 생성 — 워크스페이스 생성, 저장소가 독립적인 클론인지 확인
7. 워크스페이스 나열 — 두 개의 워크스페이스 생성, 나열 출력에 둘 다 포함되는지 확인
8. 워크스페이스 제거 — worktree로 워크스페이스 생성, 제거, 정리 확인
9. 부분 실패 — 유효한 저장소 하나 + 유효하지 않은 경로 하나, 유효한 저장소만으로 워크스페이스 생성

모든 테스트는 임시 디렉토리를 사용하고 완료 후 정리합니다. 기존 `node:test` + `node:assert` 패턴을 따릅니다.

## 구현 파일

| 컴포넌트 | 경로 |
|-----------|------|
| 명령어: new-workspace | `commands/gsd/new-workspace.md` |
| 명령어: list-workspaces | `commands/gsd/list-workspaces.md` |
| 명령어: remove-workspace | `commands/gsd/remove-workspace.md` |
| 워크플로우: new-workspace | `get-shit-done/workflows/new-workspace.md` |
| 워크플로우: list-workspaces | `get-shit-done/workflows/list-workspaces.md` |
| 워크플로우: remove-workspace | `get-shit-done/workflows/remove-workspace.md` |
| Init 함수 | `get-shit-done/bin/lib/init.cjs`(`cmdInitNewWorkspace`, `cmdInitListWorkspaces`, `cmdInitRemoveWorkspace` 추가) |
| 라우팅 | `get-shit-done/bin/gsd-tools.cjs`(init switch에 case 추가) |
| 테스트 | `tests/workspace.test.cjs` |

## 설계 결정

| 결정 | 근거 |
|----------|-----------|
| 논리적 레지스트리 대신 물리적 디렉토리 | 파일 시스템이 진실 공급원 — GSD의 기존 cwd 기반 감지 패턴과 일치 |
| 기본 전략으로 Worktree | 가볍고(.git 오브젝트 공유) 생성이 빠르며 정리가 쉬움 |
| 워크스페이스 루트에 `.planning/` | 개별 저장소 계획으로부터 완전한 격리를 제공. 각 워크스페이스는 독립적인 GSD 프로젝트 |
| 중앙 레지스트리 없음 | 상태 드리프트 방지. `list-workspaces`가 파일 시스템을 직접 스캔 |
| A의 특수 케이스로서 케이스 B | `--repos .`는 동일한 메커니즘을 재사용하므로 특별한 피처 브랜치 코드 불필요 |
| 기본 경로 `~/gsd-workspaces/<name>` | `list-workspaces`가 스캔할 예측 가능한 위치, 소스 저장소 외부에 워크스페이스 유지 |
