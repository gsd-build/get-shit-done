# 초기화 시 new-project config 완전 구체화

> **에이전트 작업자를 위한 안내:** 필수 하위 기술: superpowers:subagent-driven-development(권장) 또는 superpowers:executing-plans를 사용하여 이 계획을 작업 단위로 구현하세요. 단계는 체크박스(`- [ ]`) 형식으로 진행 상황을 추적합니다.

**목표:** `/gsd-new-project`가 `.planning/config.json`을 생성할 때, 파일에 사용자가 선택한 6개 키만이 아닌 모든 유효한 기본값이 포함되도록 하여 개발자가 소스 코드를 읽지 않고도 모든 설정을 확인할 수 있게 합니다.

**아키텍처:** 새 프로젝트의 전체 config에 대한 단일 진실 공급원으로서 `config.cjs`에 단일 JS 함수 `buildNewProjectConfig(cwd, userChoices)`를 추가합니다. CLI 명령어 `config-new-project`로 노출합니다. 부분적인 JSON을 인라인으로 작성하는 대신 이 명령어를 호출하도록 `new-project.md` 워크플로우를 업데이트합니다.

**기술 스택:** Node.js/CommonJS, 기존 gsd-tools CLI, 테스트에는 `node:test`.

---

## 배경: 현재 상태

`new-project.md` Step 5는 이 부분적인 config를 작성합니다(AI가 템플릿을 채움):

```json
{
  "mode": "...", "granularity": "...", "parallelization": "...",
  "commit_docs": "...", "model_profile": "...",
  "workflow": { "research", "plan_check", "verifier", "nyquist_validation" }
}
```

런타임에 `loadConfig()`가 자동으로 해석하는 누락된 키들:

- `search_gitignored: false`
- `brave_search: false` (또는 환경 감지 시 `true`)
- `git.branching_strategy: "none"`
- `git.phase_branch_template: "gsd/phase-{phase}-{slug}"`
- `git.milestone_branch_template: "gsd/{milestone}-{slug}"`

처음부터 존재해야 하는 전체 config:

```json
{
  "mode": "yolo|interactive",
  "granularity": "coarse|standard|fine",
  "model_profile": "balanced",
  "commit_docs": true,
  "parallelization": true,
  "search_gitignored": false,
  "brave_search": false,
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}"
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  }
}
```

---

## 파일 맵

| 파일 | 액션 | 목적 |
|------|--------|---------|
| `get-shit-done/bin/lib/config.cjs` | 수정 | `buildNewProjectConfig()` + `cmdConfigNewProject()` 추가 |
| `get-shit-done/bin/gsd-tools.cjs` | 수정 | `config-new-project` case 등록 + usage 문자열 업데이트 |
| `get-shit-done/workflows/new-project.md` | 수정 | Steps 2a + 5: 인라인 JSON 작성을 CLI 호출로 교체 |
| `tests/config.test.cjs` | 수정 | `config-new-project` 테스트 스위트 추가 |

---

## 작업 1: config.cjs에 `buildNewProjectConfig`와 `cmdConfigNewProject` 추가

**파일.**

- 수정: `get-shit-done/bin/lib/config.cjs`

- [ ] **Step 1.1: 실패하는 테스트 먼저 작성**

`tests/config.test.cjs`에 추가(`config-get` 스위트 뒤, `module.exports` 앞):

```js
// ─── config-new-project ──────────────────────────────────────────────────────

describe('config-new-project command', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTempProject();
  });

  afterEach(() => {
    cleanup(tmpDir);
  });

  test('creates full config with all expected top-level and nested keys', () => {
    const choices = JSON.stringify({
      mode: 'interactive',
      granularity: 'standard',
      parallelization: true,
      commit_docs: true,
      model_profile: 'balanced',
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true },
    });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);

    // 사용자 선택값 확인
    assert.strictEqual(config.mode, 'interactive');
    assert.strictEqual(config.granularity, 'standard');
    assert.strictEqual(config.parallelization, true);
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.model_profile, 'balanced');

    // 기본값이 구체화되었는지 확인
    assert.strictEqual(typeof config.search_gitignored, 'boolean');
    assert.strictEqual(typeof config.brave_search, 'boolean');

    // git 섹션에 세 가지 키가 모두 존재하는지 확인
    assert.ok(config.git && typeof config.git === 'object', 'git section should exist');
    assert.strictEqual(config.git.branching_strategy, 'none');
    assert.strictEqual(config.git.phase_branch_template, 'gsd/phase-{phase}-{slug}');
    assert.strictEqual(config.git.milestone_branch_template, 'gsd/{milestone}-{slug}');

    // workflow 섹션에 네 가지 키가 모두 존재하는지 확인
    assert.ok(config.workflow && typeof config.workflow === 'object', 'workflow section should exist');
    assert.strictEqual(config.workflow.research, true);
    assert.strictEqual(config.workflow.plan_check, true);
    assert.strictEqual(config.workflow.verifier, true);
    assert.strictEqual(config.workflow.nyquist_validation, true);
  });

  test('user choices override defaults', () => {
    const choices = JSON.stringify({
      mode: 'yolo',
      granularity: 'coarse',
      parallelization: false,
      commit_docs: false,
      model_profile: 'quality',
      workflow: { research: false, plan_check: false, verifier: true, nyquist_validation: false },
    });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.mode, 'yolo');
    assert.strictEqual(config.granularity, 'coarse');
    assert.strictEqual(config.parallelization, false);
    assert.strictEqual(config.commit_docs, false);
    assert.strictEqual(config.model_profile, 'quality');
    assert.strictEqual(config.workflow.research, false);
    assert.strictEqual(config.workflow.plan_check, false);
    assert.strictEqual(config.workflow.verifier, true);
    assert.strictEqual(config.workflow.nyquist_validation, false);
    // 선택하지 않은 키에 대해서도 기본값이 존재해야 함
    assert.strictEqual(config.git.branching_strategy, 'none');
    assert.strictEqual(typeof config.search_gitignored, 'boolean');
  });

  test('works with empty choices — all defaults materialized', () => {
    const result = runGsdTools(['config-new-project', '{}'], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.model_profile, 'balanced');
    assert.strictEqual(config.commit_docs, true);
    assert.strictEqual(config.parallelization, true);
    assert.strictEqual(config.search_gitignored, false);
    assert.ok(config.git && typeof config.git === 'object');
    assert.strictEqual(config.git.branching_strategy, 'none');
    assert.ok(config.workflow && typeof config.workflow === 'object');
    assert.strictEqual(config.workflow.nyquist_validation, true);
  });

  test('is idempotent — returns already_exists if config exists', () => {
    // 첫 번째 호출: 생성
    const choices = JSON.stringify({ mode: 'yolo', granularity: 'fine' });
    const first = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(first.success, `First call failed: ${first.error}`);
    const firstOut = JSON.parse(first.output);
    assert.strictEqual(firstOut.created, true);

    // 두 번째 호출: 멱등성
    const second = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(second.success, `Second call failed: ${second.error}`);
    const secondOut = JSON.parse(second.output);
    assert.strictEqual(secondOut.created, false);
    assert.strictEqual(secondOut.reason, 'already_exists');

    // config 변경되지 않음
    const config = readConfig(tmpDir);
    assert.strictEqual(config.mode, 'yolo');
    assert.strictEqual(config.granularity, 'fine');
  });

  test('auto_advance in workflow choices is preserved', () => {
    const choices = JSON.stringify({
      mode: 'yolo',
      granularity: 'standard',
      workflow: { research: true, plan_check: true, verifier: true, nyquist_validation: true, auto_advance: true },
    });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);

    const config = readConfig(tmpDir);
    assert.strictEqual(config.workflow.auto_advance, true);
  });

  test('rejects invalid JSON choices', () => {
    const result = runGsdTools(['config-new-project', '{not-json}'], tmpDir);
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('Invalid JSON'), `Expected "Invalid JSON" in: ${result.error}`);
  });

  test('output JSON has created:true on success', () => {
    const choices = JSON.stringify({ mode: 'interactive', granularity: 'standard' });
    const result = runGsdTools(['config-new-project', choices], tmpDir);
    assert.ok(result.success, `Command failed: ${result.error}`);
    const out = JSON.parse(result.output);
    assert.strictEqual(out.created, true);
    assert.strictEqual(out.path, '.planning/config.json');
  });
});
```

- [ ] **Step 1.2: 실패하는 테스트 실행하여 실패 확인**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/config.test.cjs 2>&1 | grep -E "config-new-project|FAIL|Error"
```

예상 결과: 모든 `config-new-project` 테스트가 "config-new-project is not a valid command" 또는 유사한 오류로 실패합니다.

- [ ] **Step 1.3: config.cjs에 `buildNewProjectConfig`와 `cmdConfigNewProject` 구현**

`get-shit-done/bin/lib/config.cjs`에서 `validateKnownConfigKeyPath` 함수 뒤(약 35번째 줄)와 `ensureConfigFile` 앞에 다음을 추가하세요:

```js
/**
 * 새 프로젝트의 완전히 구체화된 config를 빌드합니다.
 *
 * 다음 우선순위 순서로 병합합니다:
 *   1. 하드코딩된 기본값
 *   2. ~/.gsd/defaults.json의 사용자 수준 기본값(있는 경우)
 *   3. userChoices (new-project 중 사용자가 명시적으로 선택한 설정)
 *
 * 일반 객체를 반환합니다 — 파일을 직접 작성하지 않습니다.
 */
function buildNewProjectConfig(cwd, userChoices) {
  const choices = userChoices || {};
  const homedir = require('os').homedir();

  // Brave Search API 키 가용성 감지
  const braveKeyFile = path.join(homedir, '.gsd', 'brave_api_key');
  const hasBraveSearch = !!(process.env.BRAVE_API_KEY || fs.existsSync(braveKeyFile));

  // 사용 가능한 경우 ~/.gsd/defaults.json에서 사용자 수준 기본값 로드
  const globalDefaultsPath = path.join(homedir, '.gsd', 'defaults.json');
  let userDefaults = {};
  try {
    if (fs.existsSync(globalDefaultsPath)) {
      userDefaults = JSON.parse(fs.readFileSync(globalDefaultsPath, 'utf-8'));
      // 더 이상 사용되지 않는 "depth" 키를 "granularity"로 마이그레이션
      if ('depth' in userDefaults && !('granularity' in userDefaults)) {
        const depthToGranularity = { quick: 'coarse', standard: 'standard', comprehensive: 'fine' };
        userDefaults.granularity = depthToGranularity[userDefaults.depth] || userDefaults.depth;
        delete userDefaults.depth;
        try {
          fs.writeFileSync(globalDefaultsPath, JSON.stringify(userDefaults, null, 2), 'utf-8');
        } catch {}
      }
    }
  } catch {
    // 잘못된 전역 기본값 무시
  }

  const hardcoded = {
    model_profile: 'balanced',
    commit_docs: true,
    parallelization: true,
    search_gitignored: false,
    brave_search: hasBraveSearch,
    git: {
      branching_strategy: 'none',
      phase_branch_template: 'gsd/phase-{phase}-{slug}',
      milestone_branch_template: 'gsd/{milestone}-{slug}',
    },
    workflow: {
      research: true,
      plan_check: true,
      verifier: true,
      nyquist_validation: true,
    },
  };

  // 세 단계 병합: hardcoded <- userDefaults <- choices
  return {
    ...hardcoded,
    ...userDefaults,
    ...choices,
    git: {
      ...hardcoded.git,
      ...(userDefaults.git || {}),
      ...(choices.git || {}),
    },
    workflow: {
      ...hardcoded.workflow,
      ...(userDefaults.workflow || {}),
      ...(choices.workflow || {}),
    },
  };
}

/**
 * 명령어: 새 프로젝트를 위한 완전히 구체화된 .planning/config.json을 생성합니다.
 *
 * 사용자가 선택한 설정을 JSON 문자열로 받습니다(/gsd-new-project 중 명시적으로
 * 구성한 키들). 나머지 키들은 하드코딩된 기본값과 선택적 ~/.gsd/defaults.json에서 채워집니다.
 *
 * 멱등성: config.json이 이미 존재하면 { created: false }를 반환합니다.
 */
function cmdConfigNewProject(cwd, choicesJson, raw) {
  const configPath = path.join(cwd, '.planning', 'config.json');
  const planningDir = path.join(cwd, '.planning');

  // 멱등성: 기존 config를 덮어쓰지 않음
  if (fs.existsSync(configPath)) {
    output({ created: false, reason: 'already_exists' }, raw, 'exists');
    return;
  }

  // 사용자 선택값 파싱
  let userChoices = {};
  if (choicesJson && choicesJson.trim() !== '') {
    try {
      userChoices = JSON.parse(choicesJson);
    } catch (err) {
      error('Invalid JSON for config-new-project: ' + err.message);
    }
  }

  // .planning 디렉토리가 존재하는지 확인
  try {
    if (!fs.existsSync(planningDir)) {
      fs.mkdirSync(planningDir, { recursive: true });
    }
  } catch (err) {
    error('Failed to create .planning directory: ' + err.message);
  }

  const config = buildNewProjectConfig(cwd, userChoices);

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    output({ created: true, path: '.planning/config.json' }, raw, 'created');
  } catch (err) {
    error('Failed to write config.json: ' + err.message);
  }
}
```

`config.cjs` 하단의 `module.exports`에 `cmdConfigNewProject`도 추가하세요.

- [ ] **Step 1.4: 테스트 실행하여 통과 확인**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/config.test.cjs 2>&1 | tail -20
```

예상 결과: 모든 `config-new-project` 테스트가 통과합니다. 기존 테스트도 계속 통과합니다.

- [ ] **Step 1.5: 커밋**

```bash
cd /Users/diego/Dev/get-shit-done
git add get-shit-done/bin/lib/config.cjs tests/config.test.cjs
git commit -m "feat: add config-new-project command for full config materialization"
```

---

## 작업 2: gsd-tools.cjs에 `config-new-project` 등록

**파일.**

- 수정: `get-shit-done/bin/gsd-tools.cjs`

- [ ] **Step 2.1: gsd-tools.cjs의 switch에 case 추가**

`config-get` case 뒤(약 401번째 줄)에 다음을 추가하세요:

```js
    case 'config-new-project': {
      config.cmdConfigNewProject(cwd, args[1], raw);
      break;
    }
```

178번째 줄의 usage 문자열도 `config-new-project`를 포함하도록 업데이트하세요:

현재: `...config-ensure-section, init`
변경: `...config-ensure-section, config-new-project, init`

- [ ] **Step 2.2: CLI 등록 스모크 테스트**

```bash
cd /Users/diego/Dev/get-shit-done
node get-shit-done/bin/gsd-tools.cjs config-new-project '{"mode":"interactive","granularity":"standard"}' --cwd /tmp/gsd-smoke-$(date +%s)
```

예상 결과: `{"created":true,"path":".planning/config.json"}` (또는 유사한 형태)가 출력됩니다.

정리: `rm -rf /tmp/gsd-smoke-*`

- [ ] **Step 2.3: 전체 테스트 스위트 실행**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/config.test.cjs 2>&1 | tail -10
```

예상 결과: 모두 통과합니다.

- [ ] **Step 2.4: 커밋**

```bash
cd /Users/diego/Dev/get-shit-done
git add get-shit-done/bin/gsd-tools.cjs
git commit -m "feat: register config-new-project in gsd-tools CLI router"
```

---

## 작업 3: config-new-project를 사용하도록 new-project.md 워크플로우 업데이트

**파일.**

- 수정: `get-shit-done/workflows/new-project.md`

이것이 핵심 변경사항입니다. 두 곳을 업데이트해야 합니다:

- **Step 2a** (auto 모드 config 생성, 약 168–195번째 줄)
- **Step 5** (대화형 모드 config 생성, 약 470–498번째 줄)

- [ ] **Step 3.1: Step 2a(auto 모드) 업데이트**

Step 2a에서 config.json을 생성하는 블록을 찾으세요:

```markdown
Create `.planning/config.json` with mode set to "yolo":

```json
{
  "mode": "yolo",
  "granularity": "[selected]",
  ...
}
```

```

인라인 JSON 작성 지침을 다음으로 교체하세요:

```markdown
Create `.planning/config.json` using the CLI (fills in all defaults automatically):

```bash
mkdir -p .planning
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-new-project "$(cat <<'CHOICES'
{
  "mode": "yolo",
  "granularity": "[selected: coarse|standard|fine]",
  "parallelization": [true|false],
  "commit_docs": [true|false],
  "model_profile": "[selected: quality|balanced|budget|inherit]",
  "workflow": {
    "research": [true|false],
    "plan_check": [true|false],
    "verifier": [true|false],
    "nyquist_validation": [true|false],
    "auto_advance": true
  }
}
CHOICES
)"
```

The command merges your selections with all runtime defaults (`search_gitignored`, `brave_search`, `git` section), producing a fully-materialized config.

```

- [ ] **Step 3.2: Step 5(대화형 모드) 업데이트**

Step 5에서 config.json을 생성하는 블록을 찾으세요:

```markdown
Create `.planning/config.json` with all settings:

```json
{
  "mode": "yolo|interactive",
  ...
}
```

```

다음으로 교체하세요:

```markdown
Create `.planning/config.json` using the CLI (fills in all defaults automatically):

```bash
mkdir -p .planning
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" config-new-project "$(cat <<'CHOICES'
{
  "mode": "[selected: yolo|interactive]",
  "granularity": "[selected: coarse|standard|fine]",
  "parallelization": [true|false],
  "commit_docs": [true|false],
  "model_profile": "[selected: quality|balanced|budget|inherit]",
  "workflow": {
    "research": [true|false],
    "plan_check": [true|false],
    "verifier": [true|false],
    "nyquist_validation": [true|false]
  }
}
CHOICES
)"
```

The command merges your selections with all runtime defaults (`search_gitignored`, `brave_search`, `git` section), producing a fully-materialized config.

```

- [ ] **Step 3.3: 워크플로우 파일이 올바르게 읽히는지 확인**

```bash
cd /Users/diego/Dev/get-shit-done
grep -n "config-new-project\|config\.json\|CHOICES" get-shit-done/workflows/new-project.md
```

예상 결과: `config-new-project` 2회 등장(단계당 하나씩), config 생성을 위한 인라인 JSON 템플릿 없음.

- [ ] **Step 3.4: 커밋**

```bash
cd /Users/diego/Dev/get-shit-done
git add get-shit-done/workflows/new-project.md
git commit -m "feat: use config-new-project in new-project workflow for full config materialization"
```

---

## 작업 4: 검증

- [ ] **Step 4.1: 전체 테스트 스위트 실행**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/ 2>&1 | tail -30
```

예상 결과: 모든 테스트가 통과합니다(회귀 없음).

- [ ] **Step 4.2: 수동 엔드투엔드 검증**

`new-project.md`가 새 프로젝트에서 수행하는 작업을 시뮬레이션합니다:

```bash
# 새로운 프로젝트 디렉토리 생성
TMP=$(mktemp -d)
cd "$TMP"

# Step 1 시뮬레이션: init new-project가 반환하는 내용
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs init new-project --cwd "$TMP"

# Step 5 시뮬레이션: 전체 config 생성
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project '{
  "mode": "interactive",
  "granularity": "standard",
  "parallelization": true,
  "commit_docs": true,
  "model_profile": "balanced",
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  }
}' --cwd "$TMP"

# 파일에 예상되는 12개 키가 모두 있는지 확인
echo "=== Generated config.json ==="
cat "$TMP/.planning/config.json"

# 정리
rm -rf "$TMP"
```

예상 출력: `mode`, `granularity`, `model_profile`, `commit_docs`, `parallelization`, `search_gitignored`, `brave_search`, `git`(3개 하위 키), `workflow`(4개 하위 키)가 있는 config.json — 총 12개 최상위 키(또는 `git`과 `workflow`를 단일 키로 계산하면 10개).

- [ ] **Step 4.3: 멱등성 확인**

```bash
TMP=$(mktemp -d)
CHOICES='{"mode":"yolo","granularity":"coarse"}'

node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project "$CHOICES" --cwd "$TMP"
FIRST=$(cat "$TMP/.planning/config.json")

# 두 번째 호출은 no-op이어야 함
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project "$CHOICES" --cwd "$TMP"
SECOND=$(cat "$TMP/.planning/config.json")

[ "$FIRST" = "$SECOND" ] && echo "IDEMPOTENT: OK" || echo "IDEMPOTENT: FAIL"
rm -rf "$TMP"
```

예상 결과: `IDEMPOTENT: OK`

- [ ] **Step 4.4: loadConfig가 새 형식을 올바르게 읽는지 확인**

```bash
TMP=$(mktemp -d)
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-new-project '{
  "mode":"yolo","granularity":"standard","parallelization":true,"commit_docs":true,
  "model_profile":"balanced",
  "workflow":{"research":true,"plan_check":false,"verifier":true,"nyquist_validation":true}
}' --cwd "$TMP"

# loadConfig는 plan_check(중첩된 workflow.plan_check로)를 올바르게 읽어야 함
node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-get workflow.plan_check --cwd "$TMP"
# 예상: false

node /Users/diego/Dev/get-shit-done/get-shit-done/bin/gsd-tools.cjs config-get git.branching_strategy --cwd "$TMP"
# 예상: "none"

rm -rf "$TMP"
```

- [ ] **Step 4.5: 최종 전체 테스트 스위트 + 커밋**

```bash
cd /Users/diego/Dev/get-shit-done
node --test tests/ 2>&1 | grep -E "pass|fail|error" | tail -5
```

예상 결과: 모두 통과, 0개 실패.

---

## 부록: 업스트림용 PR 설명

```
feat: materialize all config defaults at new-project initialization

**문제:**
`/gsd-new-project`는 온보딩 중 사용자가 명시적으로 선택한 6개 키만으로
`.planning/config.json`을 생성합니다. 5개의 추가 키
(`search_gitignored`, `brave_search`, `git.branching_strategy`,
`git.phase_branch_template`, `git.milestone_branch_template`)는
런타임에 `loadConfig()`가 자동으로 해석하지만 디스크에는 기록되지 않습니다.

이로 인해 두 가지 문제가 발생합니다:
1. **발견성**: 소스 코드를 읽지 않고는 `git.branching_strategy`를
   확인하거나 이해할 수 없습니다 — config에 표시되지 않습니다.
2. **암묵적 확장**: `/gsd-settings` 또는 `config-set`이 처음으로 config에
   기록할 때도 해당 키들이 추가되지 않습니다. config는 유효한 구성의
   일부만 반영합니다.

**해결책:**
`gsd-tools.cjs`에 `config-new-project` CLI 명령어를 추가합니다. 이 명령어는:
- 사용자가 선택한 값을 JSON으로 받습니다.
- 모든 런타임 기본값(환경 감지 `brave_search` 포함)과 병합합니다.
- 완전히 구체화된 config를 한 번에 작성합니다.

하드코딩된 부분 JSON 템플릿을 작성하는 대신 이 명령어를 호출하도록
`new-project.md` 워크플로우(Steps 2a와 5)를 업데이트합니다. 기본값은 이제
정확히 한 곳에 있습니다: `config.cjs`의 `buildNewProjectConfig()`.

**이 접근이 보수적인 이유:**
- `loadConfig()`, `ensureConfigFile()`, 또는 읽기 경로에는 변경 없음
- 새로운 config 키 도입 없음
- 의미적 변경 없음 — 시스템이 이미 자동으로 해석하던 동일한 값들
- 완전한 하위 호환성: `loadConfig()`는 이전 부분 형식(기존 프로젝트)과
  새로운 전체 형식을 모두 계속 처리합니다.
- 멱등성: `config-new-project`를 두 번 호출해도 안전합니다.
- 새로운 사용자 대면 플래그 없음

**이것이 발견성을 개선하는 이유:**
처음으로 `.planning/config.json`을 여는 개발자는 이제
`git.branching_strategy: "none"`을 확인하고 GSD 소스를 읽지 않고도
브랜칭이 가능하고 구성 가능하다는 것을 즉시 이해할 수 있습니다.
```
