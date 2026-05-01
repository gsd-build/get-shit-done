<div align="center">

# GET SHIT DONE

[English](README.md) · [Português](README.pt-BR.md) · **简体中文** · [日本語](README.ja-JP.md) · [한국어](README.ko-KR.md)

**一个轻量但强大的元提示、上下文工程与规格驱动开发系统，适用于 Claude Code、OpenCode、Gemini CLI、Kilo、Codex、Copilot、Cursor、Windsurf、Antigravity、Augment、Trae、CodeBuddy 和 Cline。**

**它解决的是 context rot：随着 Claude 的上下文窗口被填满，输出质量逐步劣化的问题。**

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

**支持 Mac、Windows 和 Linux。**

<br>

![GSD Install](assets/terminal.svg)

<br>

*"只要你清楚自己想要什么，它就真的能给你做出来。不扯淡。"*

*"我试过 SpecKit、OpenSpec 和 Taskmaster，这套东西目前给我的结果最好。"*

*"这是我给 Claude Code 加过最强的增强。没有过度设计，是真的把事做完。"*

<br>

**已被 Amazon、Google、Shopify 和 Webflow 的工程师采用。**

[我为什么做这个](#我为什么做这个) · [它是怎么工作的](#它是怎么工作的) · [命令](#命令) · [为什么它有效](#为什么它有效) · [用户指南](docs/USER-GUIDE.md)

</div>

---

## 我为什么做这个

我是独立开发者。我不写代码，Claude Code 写。

市面上已经有其他规格驱动开发工具，比如 BMAD、Speckit……但它们要么把事情搞得比必要的复杂得多了些（冲刺仪式、故事点、利益相关方同步、复盘、Jira 流程），要么根本缺少对你到底在构建什么的整体理解。我不是一家 50 人的软件公司。我不想演企业流程。我只是个想把好东西真正做出来的创作者。

所以我做了 GSD。复杂性在系统内部，不在你的工作流里。幕后是上下文工程、XML 提示格式、子代理编排、状态管理；你看到的是几个真能工作的命令。

这套系统会把 Claude 完成工作 *以及* 验证结果所需的一切上下文都准备好。我信任这个工作流，因为它确实能把事情做好。

这就是它。没有企业角色扮演式的废话，只有一套非常有效、能让你持续用 Claude Code 构建酷东西的系统。

— **TÂCHES**

---

Vibecoding 的名声不算好。你描述需求，AI 生成代码，结果往往是质量不稳定、规模一上来就散架的垃圾。

GSD 解决的就是这个问题。它是让 Claude Code 变得可靠的上下文工程层。你只要描述想法，系统会自动提取它需要知道的一切，然后让 Claude Code 去干活。

---

## 适合谁用

适合那些想把自己的需求说明白，然后让系统正确构建出来的人，而不是假装自己在运营一个 50 人工程组织的人。

### v1.39.0 亮点

完整列表请参阅 [v1.39.0 发行说明](https://github.com/gsd-build/get-shit-done/releases/tag/v1.39.0)。

- **`--minimal` 安装档** — 别名 `--core-only`。仅安装主循环的 6 个核心技能（`new-project`、`discuss-phase`、`plan-phase`、`execute-phase`、`help`、`update`），不安装任何 `gsd-*` 子代理。将冷启动系统提示开销从 ~12k token 降至 ~700 token（≥94% 减少）。适合 32K–128K 上下文的本地 LLM 和按 token 计费的 API。
- **`/gsd-edit-phase`** — 就地修改 `ROADMAP.md` 中已有阶段的任意字段，不改变其编号或位置。`--force` 跳过确认 diff，验证 `depends_on` 引用，并在写入时更新 `STATE.md`。
- **合并后构建与测试门** — `execute-phase` 步骤 5.6 优先自动检测 `workflow.build_command` 配置，否则按 Xcode（`.xcodeproj`）、Makefile、Justfile、Cargo、Go、Python、npm 顺序回退。Xcode/iOS 项目自动运行 `xcodebuild build` 和 `xcodebuild test`。在并行与串行模式下均生效。
- **每运行时评审模型选择** — `review.models.<cli>` 让每个外部评审 CLI（codex、gemini 等）独立于规划/执行档选择自己的模型。
- **工作流设置继承** — 设置 `GSD_WORKSTREAM` 后，先加载根 `.planning/config.json`，再与该工作流的配置进行深合并（冲突时工作流优先）。工作流配置中显式 `null` 会覆盖根值。
- **手动 canary 发布工作流** — `.github/workflows/canary.yml` 通过 `workflow_dispatch` 从 `dev` 分支按需将 `{base}-canary.{N}` 构建（`get-shit-done-cc` 与 `@gsd-build/sdk`）发布到 `@canary` dist-tag。
- **技能整合：86 → 59** — 4 个新分组技能（`capture`、`phase`、`config`、`workspace`）吸收了 31 个微技能。6 个已有父技能将收尾与子操作合并为标志：`update --sync/--reapply`、`sketch --wrap-up`、`spike --wrap-up`、`map-codebase --fast/--query`、`code-review --fix`、`progress --do/--next`。功能无损失。

---

## 快速开始

```bash
npx get-shit-done-cc@latest
```

安装器会提示你选择：
1. **运行时**：Claude Code、OpenCode、Gemini、Kilo、Codex、Copilot、Cursor、Windsurf、Antigravity、Augment、Trae、CodeBuddy、Cline，或全部
2. **安装位置**：全局（所有项目）或本地（仅当前项目）

安装后可这样验证：
- Claude Code / Gemini / Copilot / Antigravity：`/gsd-help`
- OpenCode / Kilo / Augment / Trae / CodeBuddy：`/gsd-help`
- Codex：`$gsd-help`
- Cline：GSD 通过 `.clinerules` 安装 — 检查 `.clinerules` 是否存在

> [!NOTE]
> Claude Code 2.1.88+ 和 Codex 以 skill 形式安装（`skills/gsd-*/SKILL.md`）。Cline 使用 `.clinerules`。安装器会自动处理所有格式。

> [!TIP]
> 基于源码安装或无法使用 npm 的环境，请参阅 **[docs/manual-update.md](docs/manual-update.md)**。

### 保持更新

GSD 迭代很快，建议定期更新：

```bash
npx get-shit-done-cc@latest
```

<details>
<summary><strong>非交互式安装（Docker、CI、脚本）</strong></summary>

```bash
# Claude Code
npx get-shit-done-cc --claude --global   # 安装到 ~/.claude/
npx get-shit-done-cc --claude --local    # 安装到 ./.claude/

# OpenCode
npx get-shit-done-cc --opencode --global # 安装到 ~/.config/opencode/

# Gemini CLI
npx get-shit-done-cc --gemini --global   # 安装到 ~/.gemini/

# Kilo
npx get-shit-done-cc --kilo --global     # 安装到 ~/.config/kilo/
npx get-shit-done-cc --kilo --local      # 安装到 ./.kilo/

# Codex
npx get-shit-done-cc --codex --global    # 安装到 ~/.codex/
npx get-shit-done-cc --codex --local     # 安装到 ./.codex/

# Copilot
npx get-shit-done-cc --copilot --global  # 安装到 ~/.github/
npx get-shit-done-cc --copilot --local   # 安装到 ./.github/

# Cursor CLI
npx get-shit-done-cc --cursor --global   # 安装到 ~/.cursor/
npx get-shit-done-cc --cursor --local    # 安装到 ./.cursor/

# Antigravity
npx get-shit-done-cc --antigravity --global # 安装到 ~/.gemini/antigravity/
npx get-shit-done-cc --antigravity --local  # 安装到 ./.agent/

# Augment
npx get-shit-done-cc --augment --global     # 安装到 ~/.augment/
npx get-shit-done-cc --augment --local      # 安装到 ./.augment/

# Trae
npx get-shit-done-cc --trae --global     # 安装到 ~/.trae/
npx get-shit-done-cc --trae --local      # 安装到 ./.trae/

# CodeBuddy
npx get-shit-done-cc --codebuddy --global # 安装到 ~/.codebuddy/
npx get-shit-done-cc --codebuddy --local  # 安装到 ./.codebuddy/

# Cline
npx get-shit-done-cc --cline --global       # 安装到 ~/.cline/
npx get-shit-done-cc --cline --local        # 安装到 ./.clinerules

# 所有运行时
npx get-shit-done-cc --all --global      # 安装到所有目录
```

使用 `--global`（`-g`）或 `--local`（`-l`）可以跳过安装位置提示。
使用 `--claude`、`--opencode`、`--gemini`、`--kilo`、`--codex`、`--copilot`、`--cursor`、`--windsurf`、`--antigravity`、`--augment`、`--trae`、`--codebuddy`、`--cline` 或 `--all` 可以跳过运行时提示。

</details>

<details>
<summary><strong>开发安装</strong></summary>

克隆仓库并在本地运行安装器：

```bash
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done
node bin/install.js --claude --local
```

这样会安装到 `./.claude/`，方便你在贡献代码前测试自己的改动。

</details>

### 推荐：跳过权限确认模式

GSD 的设计目标是无摩擦自动化。运行 Claude Code 时建议使用：

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> 这才是 GSD 的预期用法。连 `date` 和 `git commit` 都要来回确认 50 次，整个体验就废了。

<details>
<summary><strong>替代方案：细粒度权限</strong></summary>

如果你不想使用这个 flag，可以在项目的 `.claude/settings.json` 中加入：

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

## 它是怎么工作的

> **已经有现成代码库？** 先运行 `/gsd-map-codebase`。它会并行拉起多个代理分析你的技术栈、架构、约定和风险点。之后 `/gsd-new-project` 就会真正“理解”你的代码库，提问会聚焦在你打算新增的部分，规划时也会自动加载你的现有模式。

### 1. 初始化项目

```
/gsd-new-project
```

一个命令，一条完整流程。系统会：

1. **提问**：一直问到它彻底理解你的想法（目标、约束、技术偏好、边界情况）
2. **研究**：并行拉起代理调研领域知识（可选，但强烈建议）
3. **需求梳理**：提取哪些属于 v1、v2，哪些不在范围内
4. **路线图**：创建与需求映射的阶段规划

你审核并批准路线图后，就可以开始构建。

**生成：** `PROJECT.md`、`REQUIREMENTS.md`、`ROADMAP.md`、`STATE.md`、`.planning/research/`

---

### 2. 讨论阶段

```
/gsd-discuss-phase 1
```

**这是你塑造实现方式的地方。**

你的路线图里，每个阶段通常只有一两句话。这点信息不足以让系统按 *你脑中的样子* 把东西做出来。这一步的作用，就是在研究和规划之前，把你的偏好先收进去。

系统会分析该阶段，并根据要构建的内容识别灰区：

- **视觉功能**：布局、信息密度、交互、空状态
- **API / CLI**：返回格式、flags、错误处理、详细程度
- **内容系统**：结构、语气、深度、流转方式
- **组织型任务**：分组标准、命名、去重、例外情况

对每个你选择的区域，系统都会持续追问，直到你满意为止。最终产物 `CONTEXT.md` 会直接喂给后续两个步骤：

1. **研究代理会读取它**：知道该研究哪些模式（例如“用户想要卡片布局” → 去研究卡片组件库）
2. **规划代理会读取它**：知道哪些决策已经锁定（例如“已决定使用无限滚动” → 计划里就会包含滚动处理）

你在这里给出的信息越具体，系统越能构建出你真正想要的东西。跳过它，你拿到的是合理默认值；用好它，你拿到的是 *你的* 方案。

**生成：** `{phase_num}-CONTEXT.md`

---

### 3. 规划阶段

```
/gsd-plan-phase 1
```

系统会：

1. **研究**：结合你的 `CONTEXT.md` 决策，调研这一阶段该怎么实现
2. **制定计划**：创建 2-3 份原子化任务计划，使用 XML 结构
3. **验证**：将计划与需求对照检查，直到通过为止

每份计划都足够小，可以在一个全新的上下文窗口里执行。没有质量衰减，也不会出现“我接下来会更简洁一些”的退化状态。

**生成：** `{phase_num}-RESEARCH.md`、`{phase_num}-{N}-PLAN.md`

---

### 4. 执行阶段

```
/gsd-execute-phase 1
```

系统会：

1. **按 wave 执行计划**：能并行的并行，有依赖的顺序执行
2. **每个计划使用新上下文**：20 万 token 纯用于实现，零历史垃圾
3. **每个任务单独提交**：每项任务都有自己的原子提交
4. **对照目标验证**：检查代码库是否真的交付了该阶段承诺的内容

你可以离开，回来时看到的是已经完成的工作和干净的 git 历史。

**Wave 执行方式：**

计划会根据依赖关系被分组为不同的 “wave”。同一 wave 内并行执行，不同 wave 之间顺序推进。

```
┌─────────────────────────────────────────────────────────────────────┐
│  PHASE EXECUTION                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  WAVE 1 (parallel)          WAVE 2 (parallel)          WAVE 3       │
│  ┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐ │
│  │ Plan 01 │ │ Plan 02 │ →  │ Plan 03 │ │ Plan 04 │ →  │ Plan 05 │ │
│  │         │ │         │    │         │ │         │    │         │ │
│  │ User    │ │ Product │    │ Orders  │ │ Cart    │    │ Checkout│ │
│  │ Model   │ │ Model   │    │ API     │ │ API     │    │ UI      │ │
│  └─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘ │
│       │           │              ↑           ↑              ↑       │
│       └───────────┴──────────────┴───────────┘              │       │
│              Dependencies: Plan 03 needs Plan 01            │       │
│                          Plan 04 needs Plan 02              │       │
│                          Plan 05 needs Plans 03 + 04        │       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**为什么 wave 很重要：**
- 独立计划 → 同一 wave → 并行执行
- 依赖计划 → 更晚的 wave → 等依赖完成
- 文件冲突 → 顺序执行，或合并到同一个计划里

这也是为什么“垂直切片”（Plan 01：端到端完成用户功能）比“水平分层”（Plan 01：所有 model，Plan 02：所有 API）更容易并行化。

**生成：** `{phase_num}-{N}-SUMMARY.md`、`{phase_num}-VERIFICATION.md`

---

### 5. 验证工作

```
/gsd-verify-work 1
```

**这是你确认它是否真的可用的地方。**

自动化验证能检查代码存在、测试通过。但这个功能是否真的按你的预期工作？这一步就是让你亲自用。

系统会：

1. **提取可测试的交付项**：你现在应该能做到什么
2. **逐项带你验证**：“能否用邮箱登录？” 可以 / 不可以，或者描述哪里不对
3. **自动诊断失败**：拉起 debug 代理定位根因
4. **创建验证过的修复计划**：可立刻重新执行

如果一切通过，就进入下一步；如果哪里坏了，你不需要手动 debug，只要重新运行 `/gsd-execute-phase`，执行它自动生成的修复计划即可。

**生成：** `{phase_num}-UAT.md`，以及发现问题时的修复计划

---

### 6. 重复 → 发布 → 完成 → 下一个里程碑

```
/gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
/gsd-ship 2                  # 从已验证的工作创建 PR
...
/gsd-complete-milestone
/gsd-new-milestone
```

或者让 GSD 自动判断下一步：

```
/gsd-next                    # 自动检测并执行下一步
```

循环执行 **讨论 → 规划 → 执行 → 验证 → 发布**，直到整个里程碑完成。

如果你希望在讨论阶段更快收集信息，可以用 `/gsd-discuss-phase <n> --batch`，一次回答一小组问题，而不是逐个问答。

每个阶段都会得到你的输入（discuss）、充分研究（plan）、干净执行（execute）和人工验证（verify）。上下文始终保持新鲜，质量也能持续稳定。

当所有阶段完成后，`/gsd-complete-milestone` 会归档当前里程碑并打 release tag。

接着用 `/gsd-new-milestone` 开启下一个版本。它和 `new-project` 流程相同，只是面向你现有的代码库。你描述下一步想构建什么，系统研究领域、梳理需求，再产出新的路线图。每个里程碑都是一个干净周期：定义 → 构建 → 发布。

---

### 快速模式

```
/gsd-quick
```

**适用于不需要完整规划的临时任务。**

快速模式保留 GSD 的核心保障（原子提交、状态跟踪），但路径更短：

- **相同的代理体系**：同样是 planner + executor，质量不降
- **跳过可选步骤**：默认不启用 research、plan checker、verifier
- **独立跟踪**：数据存放在 `.planning/quick/`，不和 phase 混在一起

**`--discuss` 参数：** 在规划前先进行轻量讨论，理清灰区。

**`--research` 参数：** 在规划前拉起研究代理。调查实现方式、库选型和潜在坑点。适合你不确定怎么下手的场景。

**`--full` 参数：** 启用计划检查（最多 2 轮迭代）和执行后验证。

参数可组合使用：`--discuss --research --full` 可同时获得讨论 + 研究 + 计划检查 + 验证。

```
/gsd-quick
> What do you want to do? "Add dark mode toggle to settings"
```

**生成：** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`、`SUMMARY.md`

---

## 为什么它有效

### 上下文工程

Claude Code 非常强大，前提是你把它需要的上下文给对。大多数人做不到。

GSD 会替你处理：

| 文件 | 作用 |
|------|------|
| `PROJECT.md` | 项目愿景，始终加载 |
| `research/` | 生态知识（技术栈、功能、架构、坑点） |
| `REQUIREMENTS.md` | 带 phase 可追踪性的 v1/v2 范围定义 |
| `ROADMAP.md` | 你要去哪里、哪些已经完成 |
| `STATE.md` | 决策、阻塞、当前位置，跨会话记忆 |
| `PLAN.md` | 带 XML 结构和验证步骤的原子任务 |
| `SUMMARY.md` | 做了什么、改了什么、已写入历史 |
| `todos/` | 留待后续处理的想法和任务 |

这些尺寸限制都是基于 Claude 在何处开始质量退化得出的。控制在阈值内，输出才能持续稳定。

### XML 提示格式

每个计划都会使用为 Claude 优化过的结构化 XML：

```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    Use jose for JWT (not jsonwebtoken - CommonJS issues).
    Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

指令足够精确，不需要猜。验证也内建在计划里。

### 多代理编排

每个阶段都遵循同一种模式：一个轻量 orchestrator 拉起专用代理、汇总结果，再路由到下一步。

| 阶段 | Orchestrator 做什么 | Agents 做什么 |
|------|---------------------|---------------|
| 研究 | 协调与展示研究结果 | 4 个并行研究代理分别调查技术栈、功能、架构、坑点 |
| 规划 | 校验并管理迭代 | Planner 生成计划，checker 验证，循环直到通过 |
| 执行 | 按 wave 分组并跟踪进度 | Executors 并行实现，每个都有全新的 20 万上下文 |
| 验证 | 呈现结果并决定下一步 | Verifier 对照目标检查代码库，debuggers 诊断失败 |

Orchestrator 本身不做重活，只负责拉代理、等待、整合结果。

**最终效果：** 你可以在一个阶段里完成深度研究、生成并验证多个计划、让多个执行代理并行写下成千上万行代码，再自动对照目标验证，而主上下文窗口依然能维持在 30-40% 左右。真正的工作都发生在新鲜的子代理上下文里，所以你的主会话始终保持快速、响应稳定。

### 原子 Git 提交

每个任务完成后都会立刻生成独立提交：

```bash
abc123f docs(08-02): complete user registration plan
def456g feat(08-02): add email confirmation flow
hij789k feat(08-02): implement password hashing
lmn012o feat(08-02): create registration endpoint
```

> [!NOTE]
> **好处：** `git bisect` 能精准定位是哪项任务引入故障；每个任务都可单独回滚；未来 Claude 读取历史时也更清晰；整个 AI 自动化工作流的可观测性更好。

每个 commit 都是外科手术式的：精确、可追踪、有意义。

### 模块化设计

- 给当前里程碑追加 phase
- 在 phase 之间插入紧急工作
- 完成当前里程碑后开启新的周期
- 在不推倒重来的前提下调整计划

你不会被这套系统绑死，它会随着项目变化而调整。

---

## 命令

### 核心工作流

| 命令 | 作用 |
|------|------|
| `/gsd-new-project [--auto]` | 完整初始化：提问 → 研究 → 需求 → 路线图 |
| `/gsd-discuss-phase [N] [--auto] [--analyze]` | 在规划前收集实现决策（`--analyze` 增加权衡分析） |
| `/gsd-plan-phase [N] [--auto] [--reviews]` | 为某个阶段执行研究 + 规划 + 验证（`--reviews` 加载代码库审查结果） |
| `/gsd-execute-phase <N>` | 以并行 wave 执行全部计划，完成后验证 |
| `/gsd-verify-work [N]` | 人工用户验收测试 ¹ |
| `/gsd-ship [N] [--draft]` | 从已验证的阶段工作创建 PR，自动生成 PR 描述 |
| `/gsd-fast <text>` | 内联处理琐碎任务——完全跳过规划，立即执行 |
| `/gsd-next` | 自动推进到下一个逻辑工作流步骤 |
| `/gsd-audit-milestone` | 验证里程碑是否达到完成定义 |
| `/gsd-complete-milestone` | 归档里程碑并打 release tag |
| `/gsd-new-milestone [name]` | 开始下一个版本：提问 → 研究 → 需求 → 路线图 |
| `/gsd-milestone-summary` | 从已完成的里程碑产物生成项目概览，用于团队上手 |
| `/gsd-forensics` | 对失败或卡住的工作流进行事后调查 |

### 工作流（Workstreams）

| 命令 | 作用 |
|------|------|
| `/gsd-workstreams list` | 显示所有工作流及其状态 |
| `/gsd-workstreams create <name>` | 创建命名空间工作流，用于并行里程碑工作 |
| `/gsd-workstreams switch <name>` | 切换当前活跃工作流 |
| `/gsd-workstreams complete <name>` | 完成并合并工作流 |

### 多项目工作区

| 命令 | 作用 |
|------|------|
| `/gsd-new-workspace` | 创建隔离工作区，包含仓库副本（worktree 或 clone） |
| `/gsd-list-workspaces` | 显示所有 GSD 工作区及其状态 |
| `/gsd-remove-workspace` | 移除工作区并清理 worktree |

### UI 设计

| 命令 | 作用 |
|------|------|
| `/gsd-ui-phase [N]` | 为前端阶段生成 UI 设计合约（UI-SPEC.md） |
| `/gsd-ui-review [N]` | 对已实现前端代码进行 6 维视觉审计 |

### 导航

| 命令 | 作用 |
|------|------|
| `/gsd-progress` | 我现在在哪？下一步是什么？ |
| `/gsd-next` | 自动检测状态并执行下一步 |
| `/gsd-help` | 显示全部命令和使用指南 |
| `/gsd-update` | 更新 GSD，并预览变更日志 |
| `/gsd-join-discord` | 加入 GSD Discord 社区 |

### Brownfield

| 命令 | 作用 |
|------|------|
| `/gsd-map-codebase` | 在 `new-project` 前分析现有代码库 |

### 阶段管理

| 命令 | 作用 |
|------|------|
| `/gsd-add-phase` | 在路线图末尾追加 phase |
| `/gsd-insert-phase [N]` | 在 phase 之间插入紧急工作 |
| `/gsd-edit-phase [N] [--force]` | 就地修改已有 phase 的任意字段 — 编号与位置保持不变 |
| `/gsd-remove-phase [N]` | 删除未来 phase，并重编号 |
| `/gsd-list-phase-assumptions [N]` | 在规划前查看 Claude 打算采用的方案 |
| `/gsd-plan-milestone-gaps` | 为 audit 发现的缺口创建 phase |

### 代码质量

| 命令 | 作用 |
|------|------|
| `/gsd-review` | 对当前阶段或分支进行跨 AI 同行评审 |
| `/gsd-pr-branch` | 创建过滤 `.planning/` 提交的干净 PR 分支 |
| `/gsd-audit-uat` | 审计验证债务——找出缺少 UAT 的阶段 |

### 积压

| 命令 | 作用 |
|------|------|
| `/gsd-plant-seed <idea>` | 将想法存入积压停车场，留待未来里程碑 |

### 会话

| 命令 | 作用 |
|------|------|
| `/gsd-pause-work` | 在中途暂停时创建交接上下文（写入 HANDOFF.json） |
| `/gsd-resume-work` | 从上一次会话恢复 |
| `/gsd-session-report` | 生成会话摘要，包含已完成工作和结果 |

### 工具

| 命令 | 作用 |
|------|------|
| `/gsd-settings` | 配置模型 profile 和工作流代理 |
| `/gsd-set-profile <profile>` | 切换模型 profile（quality / balanced / budget / inherit） |
| `/gsd-add-todo [desc]` | 记录一个待办想法 |
| `/gsd-check-todos` | 查看待办列表 |
| `/gsd-debug [desc]` | 使用持久状态进行系统化调试 |
| `/gsd-do <text>` | 将自由文本自动路由到正确的 GSD 命令 |
| `/gsd-note <text>` | 零摩擦想法捕捉——追加、列出或提升为待办 |
| `/gsd-quick [--full] [--discuss] [--research]` | 以 GSD 保障执行临时任务（`--full` 增加计划检查和验证，`--discuss` 先补上下文，`--research` 在规划前先调研） |
| `/gsd-health [--repair]` | 校验 `.planning/` 目录完整性，带 `--repair` 时自动修复 |
| `/gsd-stats` | 显示项目统计——阶段、计划、需求、git 指标 |
| `/gsd-profile-user [--questionnaire] [--refresh]` | 从会话分析生成开发者行为档案，用于个性化响应 |

<sup>¹ 由 reddit 用户 OracleGreyBeard 贡献</sup>

---

## 配置

GSD 将项目设置保存在 `.planning/config.json`。你可以在 `/gsd-new-project` 时配置，也可以稍后通过 `/gsd-settings` 修改。完整的配置 schema、工作流开关、git branching 选项以及各代理的模型分配，请查看[用户指南](docs/USER-GUIDE.md#configuration-reference)。

### 核心设置

| Setting | Options | Default | 作用 |
|---------|---------|---------|------|
| `mode` | `yolo`, `interactive` | `interactive` | 自动批准，还是每一步确认 |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | phase 粒度，也就是范围切分得多细 |

### 模型 Profile

控制各代理使用哪种 Claude 模型，在质量和 token 成本之间平衡。

| Profile | Planning | Execution | Verification |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced`（默认） | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |
| `inherit` | Inherit | Inherit | Inherit |

切换方式：
```
/gsd-set-profile budget
```

使用非 Anthropic 提供商（OpenRouter、本地模型）时，或想跟随当前运行时的模型选择时（如 OpenCode 的 `/model`），可用 `inherit`。

也可以通过 `/gsd-settings` 配置。

### 工作流代理

这些设置会在规划或执行时拉起额外代理。它们能提升质量，但也会增加 token 消耗和耗时。

| Setting | Default | 作用 |
|---------|---------|------|
| `workflow.research` | `true` | 每个 phase 规划前先调研领域知识 |
| `workflow.plan_check` | `true` | 执行前验证计划是否真能达成阶段目标 |
| `workflow.verifier` | `true` | 执行后确认“必须交付项”是否已经落地 |
| `workflow.auto_advance` | `false` | 自动串联 discuss → plan → execute，不中途停下 |
| `workflow.research_before_questions` | `false` | 在讨论提问前先运行研究，而非之后 |
| `workflow.skip_discuss` | `false` | 在自主模式下完全跳过讨论阶段 |
| `workflow.discuss_mode` | `null` | 控制讨论阶段行为（`assumptions` 使用推断默认值） |

可以用 `/gsd-settings` 开关这些项，也可以在单次命令里覆盖：
- `/gsd-plan-phase --skip-research`
- `/gsd-plan-phase --skip-verify`

### 执行

| Setting | Default | 作用 |
|---------|---------|------|
| `parallelization.enabled` | `true` | 是否并行执行独立计划 |
| `planning.commit_docs` | `true` | 是否将 `.planning/` 纳入 git 跟踪 |
| `hooks.context_warnings` | `true` | 显示上下文窗口使用量警告 |

### Git 分支策略

控制 GSD 在执行过程中如何处理分支。

| Setting | Options | Default | 作用 |
|---------|---------|---------|------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | 分支创建策略 |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | phase 分支模板 |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | milestone 分支模板 |

**策略说明：**
- **`none`**：直接提交到当前分支（GSD 默认行为）
- **`phase`**：每个 phase 创建一个分支，在 phase 完成时合并
- **`milestone`**：整个里程碑只用一个分支，在里程碑完成时合并

在里程碑完成时，GSD 会提供 squash merge（推荐）或保留历史的 merge 选项。

---

## 安全

### 保护敏感文件

GSD 的代码库映射和分析命令会读取文件来理解你的项目。**包含机密信息的文件应当加入 Claude Code 的 deny list**：

1. 打开 Claude Code 设置（项目级 `.claude/settings.json` 或全局设置）
2. 把敏感文件模式加入 deny list：

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

这样无论你运行什么命令，Claude 都无法读取这些文件。

> [!IMPORTANT]
> GSD 内建了防止提交 secrets 的保护，但纵深防御依然是最佳实践。第一道防线应该是直接禁止读取敏感文件。

---

## 故障排查

**安装后找不到命令？**
- 重启你的运行时，让命令或 skills 重新加载
- 检查文件是否存在于 `~/.claude/commands/gsd/`（全局）或 `./.claude/commands/gsd/`（本地）
- 对 Codex，检查 skills 是否存在于 `~/.codex/skills/gsd-*/SKILL.md`（全局）或 `./.codex/skills/gsd-*/SKILL.md`（本地）

**命令行为不符合预期？**
- 运行 `/gsd-help` 确认安装成功
- 重新执行 `npx get-shit-done-cc` 进行重装

**想更新到最新版本？**
```bash
npx get-shit-done-cc@latest
```

**在 Docker 或容器环境中使用？**

如果使用波浪线路径（`~/.claude/...`）时读取失败，请在安装前设置 `CLAUDE_CONFIG_DIR`：
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-shit-done-cc --global
```
这样可以确保使用绝对路径，而不是在容器里可能无法正确展开的 `~`。

### 卸载

如果你想彻底移除 GSD：

```bash
# 全局安装
npx get-shit-done-cc --claude --global --uninstall
npx get-shit-done-cc --opencode --global --uninstall
npx get-shit-done-cc --gemini --global --uninstall
npx get-shit-done-cc --kilo --global --uninstall
npx get-shit-done-cc --codex --global --uninstall
npx get-shit-done-cc --copilot --global --uninstall
npx get-shit-done-cc --cursor --global --uninstall
npx get-shit-done-cc --antigravity --global --uninstall
npx get-shit-done-cc --augment --global --uninstall
npx get-shit-done-cc --trae --global --uninstall
npx get-shit-done-cc --cline --global --uninstall

# 本地安装（当前项目）
npx get-shit-done-cc --claude --local --uninstall
npx get-shit-done-cc --opencode --local --uninstall
npx get-shit-done-cc --gemini --local --uninstall
npx get-shit-done-cc --kilo --local --uninstall
npx get-shit-done-cc --codex --local --uninstall
npx get-shit-done-cc --copilot --local --uninstall
npx get-shit-done-cc --cursor --local --uninstall
npx get-shit-done-cc --antigravity --local --uninstall
npx get-shit-done-cc --augment --local --uninstall
npx get-shit-done-cc --trae --local --uninstall
npx get-shit-done-cc --cline --local --uninstall
```

这会移除所有 GSD 命令、代理、hooks 和设置，但会保留你其他配置。

---

## 社区移植版本

OpenCode、Gemini CLI、Kilo 和 Codex 现在都已经通过 `npx get-shit-done-cc` 获得原生支持。

这些社区移植版本曾率先探索多运行时支持：

| Project | Platform | Description |
|---------|----------|-------------|
| [gsd-opencode](https://github.com/rokicool/gsd-opencode) | OpenCode | 最初的 OpenCode 适配版本 |
| gsd-gemini (archived) | Gemini CLI | uberfuzzy 制作的最初 Gemini 适配版本 |

---

## Star History

<a href="https://star-history.com/#gsd-build/get-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
 </picture>
</a>

---

## License

MIT License。详情见 [LICENSE](LICENSE)。

---

<div align="center">

**Claude Code 很强，GSD 让它变得可靠。**

</div>
