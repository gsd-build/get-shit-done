# GSD 에이전트 레퍼런스

> 18개의 전문화된 에이전트 — 역할, 도구, 생성 패턴, 관계를 모두 포함합니다. 아키텍처 맥락은 [Architecture](ARCHITECTURE.md)를 참조하세요.

---

## 개요

GSD는 멀티 에이전트 아키텍처를 사용합니다. 가벼운 오케스트레이터(워크플로우 파일)가 전문화된 에이전트를 새로운 컨텍스트 윈도우로 생성합니다. 각 에이전트는 집중된 역할, 제한된 도구 접근 권한을 가지며 특정 결과물을 생성합니다.

### 에이전트 카테고리

| 카테고리 | 수 | 에이전트 |
|----------|-------|--------|
| Researchers | 3 | project-researcher, phase-researcher, ui-researcher |
| Analyzers | 2 | assumptions-analyzer, advisor-researcher |
| Synthesizers | 1 | research-synthesizer |
| Planners | 1 | planner |
| Roadmappers | 1 | roadmapper |
| Executors | 1 | executor |
| Checkers | 3 | plan-checker, integration-checker, ui-checker |
| Verifiers | 1 | verifier |
| Auditors | 2 | nyquist-auditor, ui-auditor |
| Mappers | 1 | codebase-mapper |
| Debuggers | 1 | debugger |

---

## 에이전트 상세

### gsd-project-researcher

**역할:** 로드맵 생성 전에 도메인 생태계를 조사합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:new-project`, `/gsd:new-milestone` |
| **병렬성** | 4개 인스턴스 (stack, features, architecture, pitfalls) |
| **도구** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **모델 (balanced)** | Sonnet |
| **생성물** | `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` |

**기능.**
- 최신 생태계 정보를 위한 웹 검색
- 라이브러리 문서를 위한 Context7 MCP 통합
- 조사 문서를 디스크에 직접 작성 (오케스트레이터 컨텍스트 부하 감소)

---

### gsd-phase-researcher

**역할:** 계획 수립 전에 특정 단계의 구현 방법을 조사합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:plan-phase` |
| **병렬성** | 4개 인스턴스 (project-researcher와 동일한 집중 영역) |
| **도구** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **모델 (balanced)** | Sonnet |
| **생성물** | `{phase}-RESEARCH.md` |

**기능.**
- CONTEXT.md를 읽어 사용자 결정에 맞게 조사 방향을 설정합니다
- 특정 단계 도메인의 구현 패턴을 조사합니다
- Nyquist 검증 매핑을 위한 테스트 인프라를 감지합니다

---

### gsd-ui-researcher

**역할:** 프론트엔드 단계를 위한 UI 디자인 계약서를 생성합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:ui-phase` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **모델 (balanced)** | Sonnet |
| **색상** | `#E879F9` (fuchsia) |
| **생성물** | `{phase}-UI-SPEC.md` |

**기능.**
- 디자인 시스템 상태 감지 (shadcn components.json, Tailwind config, 기존 토큰)
- React/Next.js/Vite 프로젝트를 위한 shadcn 초기화 제안
- 아직 답변되지 않은 디자인 계약 질문만 질의합니다
- 서드파티 컴포넌트에 대한 레지스트리 안전 게이트를 적용합니다

---

### gsd-assumptions-analyzer

**역할:** 단계에 대한 코드베이스를 심층 분석하고 증거, 신뢰 수준, 오류 시 결과를 포함한 구조화된 가정을 반환합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `discuss-phase-assumptions` 워크플로우 (`workflow.discuss_mode = 'assumptions'`인 경우) |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Bash, Grep, Glob |
| **모델 (balanced)** | Sonnet |
| **색상** | Cyan |
| **생성물** | 결정문, 증거 파일 경로, 신뢰 수준을 포함한 구조화된 가정 |

**핵심 동작.**
- ROADMAP.md 단계 설명과 이전 CONTEXT.md 파일을 읽습니다
- 단계 관련 파일(컴포넌트, 패턴, 유사 기능)을 코드베이스에서 검색합니다
- 증거 기반 가정 형성을 위해 가장 관련성 높은 소스 파일 5~15개를 읽습니다
- 신뢰 수준을 분류합니다. Confident(코드에서 명확), Likely(합리적 추론), Unclear(여러 방향 가능)
- 외부 조사가 필요한 항목을 표시합니다 (라이브러리 호환성, 생태계 모범 사례)
- 티어에 따라 출력을 조정합니다. full_maturity(3~5개 영역), standard(3~4개), minimal_decisive(2~3개)

---

### gsd-advisor-researcher

**역할:** discuss-phase 어드바이저 모드에서 단일 회색 지대 결정을 조사하고 구조화된 비교 표를 반환합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `discuss-phase` 워크플로우 (ADVISOR_MODE = true인 경우) |
| **병렬성** | 복수 인스턴스 (회색 지대당 하나) |
| **도구** | Read, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **모델 (balanced)** | Sonnet |
| **색상** | Cyan |
| **생성물** | 5열 비교 표 (Option / Pros / Cons / Complexity / Recommendation)와 근거 단락 |

**핵심 동작.**
- Claude의 지식, Context7, 웹 검색을 사용하여 할당된 단일 회색 지대를 조사합니다
- 실질적으로 실행 가능한 옵션만 제시합니다 — 형식적인 대안은 포함하지 않습니다
- Complexity 열은 영향 범위와 위험을 사용합니다 (시간 추정치는 사용하지 않음)
- 권장 사항은 조건부로 제시합니다 ("Rec if X", "Rec if Y") — 단일 승자 순위는 없습니다
- 티어에 따라 출력을 조정합니다. full_maturity(성숙도 신호 포함 3~5개 옵션), standard(2~4개), minimal_decisive(2개 옵션, 결정적 권장 사항)

---

### gsd-research-synthesizer

**역할:** 병렬 조사자들의 출력을 통합된 요약으로 합칩니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:new-project` (4개 조사자 완료 후) |
| **병렬성** | 단일 인스턴스 (조사자 이후 순차적) |
| **도구** | Read, Write, Bash |
| **모델 (balanced)** | Sonnet |
| **색상** | Purple |
| **생성물** | `.planning/research/SUMMARY.md` |

---

### gsd-planner

**역할:** 작업 분류, 의존성 분석, 목표 역방향 검증을 포함한 실행 가능한 단계 계획을 생성합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:plan-phase`, `/gsd:quick` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Write, Bash, Glob, Grep, WebFetch, mcp (context7) |
| **모델 (balanced)** | Opus |
| **색상** | Green |
| **생성물** | `{phase}-{N}-PLAN.md` 파일 |

**핵심 동작.**
- PROJECT.md, REQUIREMENTS.md, CONTEXT.md, RESEARCH.md를 읽습니다
- 단일 컨텍스트 윈도우에 맞는 크기의 2~3개 원자적 작업 계획을 생성합니다
- `<task>` 요소를 포함한 XML 구조를 사용합니다
- `read_first`와 `acceptance_criteria` 섹션을 포함합니다
- 계획을 의존성 웨이브로 그룹화합니다

---

### gsd-roadmapper

**역할:** 단계 분류 및 요구 사항 매핑을 포함한 프로젝트 로드맵을 생성합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:new-project` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Write, Bash, Glob, Grep |
| **모델 (balanced)** | Sonnet |
| **색상** | Purple |
| **생성물** | `ROADMAP.md` |

**핵심 동작.**
- 요구 사항을 단계에 매핑합니다 (추적성)
- 요구 사항으로부터 성공 기준을 도출합니다
- 단계 수에 대한 세분화 설정을 준수합니다
- 커버리지를 검증합니다 (모든 v1 요구 사항이 단계에 매핑됨)

---

### gsd-executor

**역할:** 원자적 커밋, 이탈 처리, 체크포인트 프로토콜로 GSD 계획을 실행합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:execute-phase`, `/gsd:quick` |
| **병렬성** | 복수 (웨이브 내 병렬, 웨이브 간 순차적) |
| **도구** | Read, Write, Edit, Bash, Grep, Glob |
| **모델 (balanced)** | Sonnet |
| **색상** | Yellow |
| **생성물** | 코드 변경사항, git 커밋, `{phase}-{N}-SUMMARY.md` |

**핵심 동작.**
- 계획당 새로운 200K 컨텍스트 윈도우를 사용합니다
- XML 작업 지시를 정확히 따릅니다
- 완료된 작업마다 원자적 git 커밋을 수행합니다
- 체크포인트 유형을 처리합니다. auto, human-verify, decision, human-action
- SUMMARY.md에 계획 이탈을 보고합니다
- 검증 실패 시 노드 복구를 실행합니다

---

### gsd-plan-checker

**역할:** 실행 전에 계획이 단계 목표를 달성할 수 있는지 검증합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:plan-phase` (검증 루프, 최대 3회 반복) |
| **병렬성** | 단일 인스턴스 (반복적) |
| **도구** | Read, Bash, Glob, Grep |
| **모델 (balanced)** | Sonnet |
| **색상** | Green |
| **생성물** | 구체적인 피드백을 포함한 PASS/FAIL 판정 |

**8가지 검증 차원.**
1. 요구 사항 커버리지
2. 작업 원자성
3. 의존성 순서
4. 파일 범위
5. 검증 명령어
6. 컨텍스트 적합성
7. 누락 감지
8. Nyquist 준수 (활성화된 경우)

---

### gsd-integration-checker

**역할:** 단계 간 통합 및 엔드투엔드 흐름을 검증합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:audit-milestone` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Bash, Grep, Glob |
| **모델 (balanced)** | Sonnet |
| **색상** | Blue |
| **생성물** | 통합 검증 보고서 |

---

### gsd-ui-checker

**역할:** 품질 차원에 대해 UI-SPEC.md 디자인 계약서를 검증합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:ui-phase` (검증 루프, 최대 2회 반복) |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Bash, Glob, Grep |
| **모델 (balanced)** | Sonnet |
| **색상** | `#22D3EE` (cyan) |
| **생성물** | BLOCK/FLAG/PASS 판정 |

---

### gsd-verifier

**역할:** 목표 역방향 분석을 통해 단계 목표 달성 여부를 검증합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:execute-phase` (모든 executor 완료 후) |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Write, Bash, Grep, Glob |
| **모델 (balanced)** | Sonnet |
| **색상** | Green |
| **생성물** | `{phase}-VERIFICATION.md` |

**핵심 동작.**
- 작업 완료 여부가 아닌 단계 목표에 대해 코드베이스를 확인합니다
- 구체적인 증거를 포함한 PASS/FAIL 결과를 제공합니다
- `/gsd:verify-work`가 처리할 문제를 기록합니다

---

### gsd-nyquist-auditor

**역할:** 테스트를 생성하여 Nyquist 검증 누락을 채웁니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:validate-phase` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Write, Edit, Bash, Grep, Glob |
| **모델 (balanced)** | Sonnet |
| **생성물** | 테스트 파일, 업데이트된 `VALIDATION.md` |

**핵심 동작.**
- 구현 코드는 절대 수정하지 않습니다 — 테스트 파일만 수정합니다
- 누락당 최대 3번 시도합니다
- 구현 버그는 사용자에게 에스컬레이션으로 표시합니다

---

### gsd-ui-auditor

**역할:** 구현된 프론트엔드 코드에 대한 사후 6기둥 시각적 감사를 수행합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:ui-review` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read, Write, Bash, Grep, Glob |
| **모델 (balanced)** | Sonnet |
| **색상** | `#F472B6` (pink) |
| **생성물** | 점수를 포함한 `{phase}-UI-REVIEW.md` |

**6가지 감사 기둥 (1-4점 채점).**
1. 카피라이팅
2. 시각적 요소
3. 색상
4. 타이포그래피
5. 간격
6. 경험 디자인

---

### gsd-codebase-mapper

**역할:** 코드베이스를 탐색하고 구조화된 분석 문서를 작성합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:map-codebase` |
| **병렬성** | 4개 인스턴스 (tech, architecture, quality, concerns) |
| **도구** | Read, Bash, Grep, Glob, Write |
| **모델 (balanced)** | Haiku |
| **색상** | Cyan |
| **생성물** | `.planning/codebase/*.md` (7개 문서) |

**핵심 동작.**
- 읽기 전용 탐색과 구조화된 출력
- 문서를 디스크에 직접 작성합니다
- 추론 불필요 — 파일 내용에서 패턴 추출

---

### gsd-debugger

**역할:** 영구 상태를 활용한 과학적 방법으로 버그를 조사합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:debug`, `/gsd:verify-work` (실패 시) |
| **병렬성** | 단일 인스턴스 (대화형) |
| **도구** | Read, Write, Edit, Bash, Grep, Glob, WebSearch |
| **모델 (balanced)** | Sonnet |
| **색상** | Orange |
| **생성물** | `.planning/debug/*.md`, 지식 베이스 업데이트 |

**디버그 세션 생명주기.**
`gathering` → `investigating` → `fixing` → `verifying` → `awaiting_human_verify` → `resolved`

**핵심 동작.**
- 가설, 증거, 제거된 이론을 추적합니다
- 컨텍스트 초기화 이후에도 상태가 유지됩니다
- 해결됨으로 표시하기 전에 사람의 검증이 필요합니다
- 해결 시 영구 지식 베이스에 추가합니다
- 새 세션 시작 시 지식 베이스를 참조합니다

---

### gsd-user-profiler

**역할:** 8가지 행동 차원에 걸쳐 세션 메시지를 분석하여 점수화된 개발자 프로필을 생성합니다.

| 속성 | 값 |
|----------|-------|
| **생성 주체** | `/gsd:profile-user` |
| **병렬성** | 단일 인스턴스 |
| **도구** | Read |
| **모델 (balanced)** | Sonnet |
| **색상** | Magenta |
| **생성물** | `USER-PROFILE.md`, `/gsd:dev-preferences`, `CLAUDE.md` 프로필 섹션 |

**행동 차원.**
커뮤니케이션 스타일, 결정 패턴, 디버깅 접근 방식, UX 선호도, 벤더 선택, 불만 요인, 학습 스타일, 설명 깊이.

**핵심 동작.**
- 읽기 전용 에이전트 — 추출된 세션 데이터를 분석하며 파일을 수정하지 않습니다
- 신뢰 수준과 증거 인용을 포함한 점수화된 차원을 생성합니다
- 세션 기록이 없는 경우 설문지 대체 방식을 사용합니다

---

## 에이전트 도구 권한 요약

| 에이전트 | Read | Write | Edit | Bash | Grep | Glob | WebSearch | WebFetch | MCP |
|-------|------|-------|------|------|------|------|-----------|----------|-----|
| project-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phase-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ui-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| assumptions-analyzer | ✓ | | | ✓ | ✓ | ✓ | | | |
| advisor-researcher | ✓ | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| research-synthesizer | ✓ | ✓ | | ✓ | | | | | |
| planner | ✓ | ✓ | | ✓ | ✓ | ✓ | | ✓ | ✓ |
| roadmapper | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| executor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| plan-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| integration-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| ui-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| verifier | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| nyquist-auditor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| ui-auditor | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| codebase-mapper | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| debugger | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| user-profiler | ✓ | | | | | | | | |

**최소 권한 원칙.**
- Checker는 읽기 전용입니다 (Write/Edit 없음) — 평가만 하며 수정하지 않습니다
- Researcher는 웹 접근 권한을 가집니다 — 최신 생태계 정보가 필요하기 때문입니다
- Executor는 Edit 권한을 가집니다 — 코드를 수정하지만 웹 접근은 없습니다
- Mapper는 Write 권한을 가집니다 — 분석 문서를 작성하지만 Edit은 없습니다 (코드 변경 없음)
