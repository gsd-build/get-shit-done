<div align="center">

# GET SHIT DONE

**一个轻量级且强大的元提示、上下文工程和规格驱动开发系统，支持 Claude Code、OpenCode、Gemini CLI、Kilo、Codex、Copilot、Cursor、Windsurf、Antigravity、Augment、Trae 和 Cline。**

**解决上下文衰减 —— 即 Claude 填充上下文窗口时发生的质量退化问题。**

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

![GSD Install](../assets/terminal.svg)

<br>

*"如果你清楚自己想要什么，它真的会帮你构建出来。不忽悠。"*

*"我试过 SpecKit、OpenSpec 和 Taskmaster —— 这是我用过的效果最好的。"*

*"这是我用过的 Claude Code 最强大的扩展。没有过度设计。真的就是把事情做完。"*

<br>

**被 Amazon、Google、Shopify 和 Webflow 的工程师信赖使用。**

[我为什么开发这个](#我为什么开发这个) · [工作原理](#工作原理) · [命令](#命令) · [为什么有效](#为什么有效) · [用户指南](USER-GUIDE.md)

</div>

---

## 我为什么开发这个

我是一名独立开发者。我不写代码 —— Claude Code 写。

其他规格驱动开发工具确实存在，比如 BMAD、Speckit... 但它们似乎都把事情搞得比实际需要的复杂得多（冲刺会议、故事点、干系人同步、回顾、Jira 工作流），或者缺乏对你正在构建的东西的真正大局理解。我不是一个 50 人的软件公司。我不想搞企业级表演。我只是个想构建出好用的东西的创意人。

所以我开发了 GSD。复杂性在系统内部，不在你的工作流里。幕后是：上下文工程、XML 提示格式、子代理编排、状态管理。你看到的是：几个命令，用就完了。

系统给 Claude 提供了它完成工作**以及**验证工作所需的一切。我信任这个工作流。它就是做得好。

这就是它的本质。没有企业级角色扮演的废话。只是一个让 Claude Code 稳定可靠地构建酷东西的极其有效的系统。

— **TÂCHES**

---

Vibecoding 名声不好。你描述想要什么，AI 生成代码，结果得到不一致的垃圾，规模一大就崩。

GSD 解决了这个问题。它是让 Claude Code 变得可靠的上下文工程层。描述你的想法，让系统提取它需要知道的一切，然后让 Claude Code 开始工作。

---

## 这个工具适合谁

想要描述需求然后正确构建出来的人 —— 不用假装自己在运营一个 50 人的工程组织。

内置的质量门禁能捕获真正的问题：模式漂移检测会标记缺少迁移的 ORM 变更，安全强制将验证锚定到威胁模型，范围缩减检测防止规划器默默丢弃你的需求。

---

## 快速开始

```bash
npx get-shit-done-cc@latest
```

安装程序会提示你选择：
1. **运行时** —— Claude Code、OpenCode、Gemini、Kilo、Codex 或全部
2. **位置** —— 全局（所有项目）或本地（仅当前项目）

验证安装：
- Claude Code / Gemini: `/gsd-help`
- OpenCode: `/gsd-help`
- Kilo: `/gsd-help`
- Codex: `$gsd-help`

> [!NOTE]
> Codex 安装使用技能（`skills/gsd-*/SKILL.md`）而非自定义提示。

### 保持更新

GSD 快速迭代。定期更新：

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

# 所有运行时
npx get-shit-done-cc --all --global      # 安装到所有目录
```

使用 `--global`（`-g`）或 `--local`（`-l`）跳过位置提示。
使用 `--claude`、`--opencode`、`--gemini`、`--kilo`、`--codex` 或 `--all` 跳过运行时提示。

</details>

<details>
<summary><strong>开发安装</strong></summary>

克隆仓库并本地运行安装程序：

```bash
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done
node bin/install.js --claude --local
```

安装到 `./.claude/` 用于在贡献前测试修改。

</details>

### 推荐：跳过权限模式

GSD 设计为无摩擦自动化。运行 Claude Code 时使用：

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> 这是 GSD 的预期使用方式 —— 停下来 50 次批准 `date` 和 `git commit` 会失去意义。

<details>
<summary><strong>替代方案：细粒度权限</strong></summary>

如果你不想使用那个标志，在项目的 `.claude/settings.json` 中添加：

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

## 工作原理

> **已有代码？** 先运行 `/gsd-map-codebase`。它会生成并行代理分析你的技术栈、架构、约定和关注点。然后 `/gsd-new-project` 就了解你的代码库了 —— 问题聚焦在你正在**添加**什么，规划会自动加载你的模式。

### 1. 初始化项目

```
/gsd-new-project
```

一条命令，一个流程。系统：

1. **提问** —— 问到完全理解你的想法为止（目标、约束、技术偏好、边缘情况）
2. **研究** —— 生成并行代理调查领域（可选但推荐）
3. **需求** —— 提取哪些是 v1、v2 和范围外
4. **路线图** —— 创建映射到需求的阶段

你批准路线图。现在准备好构建了。

**创建：** `PROJECT.md`、`REQUIREMENTS.md`、`ROADMAP.md`、`STATE.md`、`.planning/research/`

---

### 2. 讨论阶段

```
/gsd-discuss-phase 1
```

**这是你塑造实现方式的地方。**

你的路线图每个阶段有一两句话。这不足以按照**你**想象的方式构建东西。这一步在研究或规划之前捕获你的偏好。

系统分析阶段并根据正在构建的内容识别灰色区域：

- **视觉功能** → 布局、密度、交互、空状态
- **API/CLI** → 响应格式、标志、错误处理、详细程度
- **内容系统** → 结构、语气、深度、流程
- **组织任务** → 分组标准、命名、重复项、例外

对于你选择的每个领域，它会问到让你满意为止。输出 —— `CONTEXT.md` —— 直接输入接下来的两个步骤：

1. **研究员读取它** —— 知道要调查什么模式（"用户想要卡片布局" → 研究卡片组件库）
2. **规划者读取它** —— 知道哪些决策已锁定（"无限滚动已决定" → 规划包含滚动处理）

你在这里走得越深，系统构建的就越是你真正想要的。跳过它你会得到合理的默认值。使用它你会得到**你的**愿景。

**创建：** `{阶段号}-CONTEXT.md`

---

### 3. 规划阶段

```
/gsd-plan-phase 1
```

系统：

1. **研究** —— 调查如何实现这个阶段，由你的 CONTEXT.md 决策指导
2. **规划** —— 创建 2-3 个带有 XML 结构的原子任务计划
3. **验证** —— 根据需求检查计划，循环直到通过

每个计划足够小，可以在全新的上下文窗口中执行。没有退化，没有"我现在会更简洁"。

**创建：** `{阶段号}-RESEARCH.md`、`{阶段号}-{N}-PLAN.md`

---

### 4. 执行阶段

```
/gsd-execute-phase 1
```

系统：

1. **按波次运行计划** —— 可能的话并行，有依赖时顺序
2. **每个计划全新上下文** —— 200k token 纯粹用于实现，零累积垃圾
3. **每个任务提交** —— 每个任务都有自己的原子提交
4. **根据目标验证** —— 检查代码库是否交付了阶段承诺的内容

离开，回来看到完成的工作和干净的 git 历史。

**波次执行工作原理：**

计划根据依赖关系分组到"波次"。在每个波次内，计划并行运行。波次顺序执行。

```
┌─────────────────────────────────────────────────────────────────────┐
│  阶段执行                                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  波次 1 (并行)              波次 2 (并行)              波次 3       │
│  ┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐ │
│  │ 计划 01 │ │ 计划 02 │ →  │ 计划 03 │ │ 计划 04 │ →  │ 计划 05 │ │
│  │         │ │         │    │         │ │         │    │         │ │
│  │ 用户    │ │ 产品    │    │ 订单    │ │ 购物车  │    │ 结账    │ │
│  │ 模型    │ │ 模型    │    │ API     │ │ API     │    │ UI      │ │
│  └─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘ │
│       │           │              ↑           ↑              ↑       │
│       └───────────┴──────────────┴───────────┘              │       │
│              依赖关系: 计划 03 需要计划 01                   │       │
│                          计划 04 需要计划 02                 │       │
│                          计划 05 需要计划 03 + 04            │       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**为什么波次重要：**
- 独立计划 → 同一波次 → 并行运行
- 依赖计划 → 后续波次 → 等待依赖
- 文件冲突 → 顺序计划或同一计划

这就是为什么"垂直切片"（计划 01: 用户功能端到端）比"水平分层"（计划 01: 所有模型，计划 02: 所有 API）并行化更好。

**创建：** `{阶段号}-{N}-SUMMARY.md`、`{阶段号}-VERIFICATION.md`

---

### 5. 验证工作

```
/gsd-verify-work 1
```

**这是你确认它真的有效的地方。**

自动化验证检查代码存在和测试通过。但功能是否按你预期的方式**工作**？这是你使用它的机会。

系统：

1. **提取可测试交付物** —— 你现在应该能做什么
2. **逐个引导你** —— "你能用邮箱登录吗？" 是/否，或描述有什么问题
3. **自动诊断失败** —— 生成调试代理找根本原因
4. **创建已验证的修复计划** —— 准备立即重新执行

如果一切通过，继续。如果有东西坏了，不用手动调试 —— 只需再次运行 `/gsd-execute-phase`，使用它创建的修复计划。

**创建：** `{阶段号}-UAT.md`，如果发现问题则创建修复计划

---

### 6. 循环 → 完成 → 下一个里程碑

```
/gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
...
/gsd-complete-milestone
/gsd-new-milestone
```

循环 **讨论 → 规划 → 执行 → 验证** 直到里程碑完成。

如果你想在讨论期间更快速地输入，使用 `/gsd-discuss-phase <n> --batch` 一次回答一组小问题，而不是一个一个来。使用 `--chain` 可以自动链式执行从讨论到规划+执行，中间不停顿。

每个阶段都会获得你的输入（讨论）、适当的研究（规划）、干净的执行（执行）和人工验证（验证）。上下文保持新鲜。质量保持高水平。

当所有阶段完成后，`/gsd-complete-milestone` 归档里程碑并标记发布。

然后 `/gsd-new-milestone` 开始下一个版本 —— 与 `new-project` 相同的流程，但针对你现有的代码库。你描述接下来想构建什么，系统研究领域，你界定需求范围，它创建新的路线图。每个里程碑是一个干净的周期：定义 → 构建 → 发布。

---

### 快速模式

```
/gsd-quick
```

**用于不需要完整规划的临时任务。**

快速模式给你 GSD 保证（原子提交、状态跟踪）和更快的路径：

- **相同代理** —— 规划者 + 执行者，相同质量
- **跳过可选步骤** —— 默认无研究、无计划检查器、无验证器
- **独立跟踪** —— 存放在 `.planning/quick/`，不是阶段

**`--discuss` 标志：** 规划前的轻量讨论，发现灰色地带。

**`--research` 标志：** 规划前启动聚焦研究员。调查实现方法、库选项和陷阱。当你不确定如何处理任务时使用。

**`--full` 标志：** 启用所有阶段 —— 讨论 + 研究 + 计划检查 + 验证。快速任务形式的完整 GSD 管道。

**`--validate` 标志：** 仅启用计划检查 + 执行后验证（之前 `--full` 的行为）。

标志可组合：`--discuss --research --validate` 提供讨论 + 研究 + 计划检查 + 验证。

```
/gsd-quick
> 你想做什么？"在设置中添加深色模式切换"
```

**创建：** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`、`SUMMARY.md`

---

## 为什么有效

### 上下文工程

Claude Code 非常强大，**如果你**给它需要的上下文。大多数人没有。

GSD 为你处理：

| 文件 | 作用 |
|------|------|
| `PROJECT.md` | 项目愿景，始终加载 |
| `research/` | 生态知识（技术栈、功能、架构、陷阱） |
| `REQUIREMENTS.md` | 界定 v1/v2 需求及阶段可追溯性 |
| `ROADMAP.md` | 你要去哪里，完成了什么 |
| `STATE.md` | 决策、阻塞项、位置 —— 跨会话记忆 |
| `PLAN.md` | 带有 XML 结构和验证步骤的原子任务 |
| `SUMMARY.md` | 发生了什么，改了什么，提交到历史 |
| `todos/` | 为后续工作捕获的想法和任务 |

基于 Claude 质量退化的位置设置大小限制。保持在限制内，获得一致的卓越。

### XML 提示格式

每个计划都是为 Claude 优化的结构化 XML：

```xml
<task type="auto">
  <name>创建登录端点</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    使用 jose 处理 JWT（不用 jsonwebtoken - CommonJS 问题）。
    根据 users 表验证凭据。
    成功时返回 httpOnly cookie。
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login 返回 200 + Set-Cookie</verify>
  <done>有效凭据返回 cookie，无效返回 401</done>
</task>
```

精确的指令。不猜测。内置验证。

### 多代理编排

每个阶段使用相同模式：轻量编排器生成专门代理，收集结果，路由到下一步。

| 阶段 | 编排器做 | 代理做 |
|-------|------------------|-----------|
| 研究 | 协调，呈现发现 | 4 个并行研究员调查技术栈、功能、架构、陷阱 |
| 规划 | 验证，管理迭代 | 规划者创建计划，检查器验证，循环直到通过 |
| 执行 | 分组为波次，跟踪进度 | 执行者并行实现，每个有全新 200k 上下文 |
| 验证 | 呈现结果，路由下一步 | 验证器根据目标检查代码库，调试器诊断失败 |

编排器从不做重活。它生成代理，等待，整合结果。

**结果：** 你可以运行整个阶段 —— 深度研究、多个计划创建和验证、跨并行执行者编写数千行代码、根据目标自动化验证 —— 你的主上下文窗口保持在 30-40%。工作在全新的子代理上下文中完成。你的会话保持快速和响应。

### 原子 Git 提交

每个任务在完成后立即获得自己的提交：

```bash
abc123f docs(08-02): 完成用户注册计划
def456g feat(08-02): 添加邮箱确认流程
hij789k feat(08-02): 实现密码哈希
lmn012o feat(08-02): 创建注册端点
```

> [!NOTE]
> **好处：** Git bisect 找到确切的失败任务。每个任务独立可回滚。未来会话中 Claude 的清晰历史。AI 自动化工作流中更好的可观察性。

每个提交都是精确的、可追溯的、有意义的。

### 模块化设计

- 向当前里程碑添加阶段
- 在阶段之间插入紧急工作
- 完成里程碑并重新开始
- 调整计划而不重建一切

你永远不会被锁定。系统会适应。

---

## 命令

### 核心工作流

| 命令 | 作用 |
|---------|--------------|
| `/gsd-new-project [--auto]` | 完整初始化：提问 → 研究 → 需求 → 路线图 |
| `/gsd-discuss-phase [N] [--auto] [--chain] [--power]` | 在规划前捕获实现决策（`--chain` 自动链式执行规划+执行，`--power` 文件批量输入） |
| `/gsd-plan-phase [N] [--auto]` | 阶段的研究 + 规划 + 验证 |
| `/gsd-execute-phase <N>` | 在并行波次中执行所有计划，完成后验证 |
| `/gsd-verify-work [N]` | 手动用户验收测试 ¹ |
| `/gsd-audit-milestone` | 验证里程碑达到了其完成定义 |
| `/gsd-complete-milestone` | 归档里程碑，标记发布 |
| `/gsd-new-milestone [name]` | 开始下一个版本：提问 → 研究 → 需求 → 路线图 |

### 导航

| 命令 | 作用 |
|---------|--------------|
| `/gsd-progress` | 我在哪？接下来做什么？ |
| `/gsd-help` | 显示所有命令和使用指南 |
| `/gsd-update` | 更新 GSD 并预览变更日志 |
| `/gsd-join-discord` | 加入 GSD Discord 社区 |

### 现有代码库

| 命令 | 作用 |
|---------|--------------|
| `/gsd-map-codebase` | 在 new-project 之前分析现有代码库 |

### 阶段管理

| 命令 | 作用 |
|---------|--------------|
| `/gsd-phase` | 向路线图追加阶段 |
| `/gsd-phase --insert [N]` | 在阶段之间插入紧急工作 |
| `/gsd-phase --remove [N]` | 删除未来阶段，重新编号 |
| `/gsd-list-phase-assumptions [N]` | 规划前查看 Claude 的预期方法 |
| `/gsd-autonomous [--from N] [--to N] [--only N]` | 自主执行所有剩余阶段（`--to N` 执行到阶段 N 停止，`--only N` 只执行单个阶段） |
| `/gsd-analyze-dependencies` | 检测阶段间依赖关系并建议 ROADMAP.md 的 `Depends on` 条目 |

### 会话

| 命令 | 作用 |
|---------|--------------|
| `/gsd-pause-work` | 阶段中途停止时创建交接 |
| `/gsd-resume-work` | 从上次会话恢复 |

### 工具

| 命令 | 作用 |
|---------|--------------|
| `/gsd-settings` | 配置模型配置文件和工作流代理 |
| `/gsd-config --profile <profile>` | 切换模型配置文件（quality/balanced/budget/inherit） |
| `/gsd-capture [desc]` | 捕获想法留待后用 |
| `/gsd-capture --list` | 列出待处理事项 |
| `/gsd-debug [desc] [--diagnose]` | 带持久状态的系统化调试（`--diagnose` 仅诊断不修复） |
| `/gsd-quick [--full] [--discuss] [--research]` | 用 GSD 保证执行临时任务（`--full` 启用全部阶段，`--discuss` 先收集上下文，`--research` 规划前调查方法） |
| `/gsd-health [--repair]` | 验证 `.planning/` 目录完整性，用 `--repair` 自动修复 |

<sup>¹ 由 Reddit 用户 OracleGreyBeard 贡献</sup>

---

## 配置

GSD 在 `.planning/config.json` 中存储项目设置。在 `/gsd-new-project` 期间配置或稍后用 `/gsd-settings` 更新。完整配置模式、工作流开关、git 分支选项和每个代理的模型分解，请参阅[用户指南](USER-GUIDE.md#配置参考)。

### 核心设置

| 设置 | 选项 | 默认值 | 控制内容 |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | 自动批准 vs 每步确认 |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | 阶段粒度 —— 范围切分多细（阶段 × 计划） |

### 模型配置

控制每个代理使用哪个 Claude 模型。平衡质量和 token 消耗。

| 配置 | 规划 | 执行 | 验证 |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced`（默认） | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |

切换配置：
```
/gsd-config --profile budget
```

或通过 `/gsd-settings` 配置。

### 工作流代理

这些在规划/执行期间生成额外代理。它们提高质量但增加 token 和时间。

| 设置 | 默认值 | 作用 |
|---------|---------|--------------|
| `workflow.research` | `true` | 每个阶段规划前研究领域 |
| `workflow.plan_check` | `true` | 执行前验证计划是否达到阶段目标 |
| `workflow.verifier` | `true` | 执行后确认必须项已交付 |
| `workflow.auto_advance` | `false` | 自动链式执行 讨论 → 规划 → 执行 |
| `workflow.use_worktrees` | `true` | `false` 时禁用 git worktree 隔离 |
| `security_enforcement` | `true` | 启用威胁模型安全验证 |
| `response_language` | (无) | 代理响应的语言代码（如 `"zh"`、`"ja"`、`"ko"`） |

使用 `/gsd-settings` 切换这些，或每次调用时覆盖：
- `/gsd-plan-phase --skip-research`
- `/gsd-plan-phase --skip-verify`

### 执行

| 设置 | 默认值 | 控制内容 |
|---------|---------|------------------|
| `parallelization.enabled` | `true` | 同时运行独立计划 |
| `planning.commit_docs` | `true` | 在 git 中跟踪 `.planning/` |

### Git 分支

控制 GSD 在执行期间如何处理分支。

| 设置 | 选项 | 默认值 | 作用 |
|---------|---------|---------|--------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | 分支创建策略 |
| `git.phase_branch_template` | 字符串 | `gsd/phase-{phase}-{slug}` | 阶段分支模板 |
| `git.milestone_branch_template` | 字符串 | `gsd/{milestone}-{slug}` | 里程碑分支模板 |

**策略：**
- **`none`** —— 提交到当前分支（默认 GSD 行为）
- **`phase`** —— 每个阶段创建一个分支，阶段完成时合并
- **`milestone`** —— 为整个里程碑创建一个分支，完成时合并

在里程碑完成时，GSD 提供 squash 合并（推荐）或带历史合并。

---

## 安全

### 保护敏感文件

GSD 的代码库映射和分析命令读取文件以了解你的项目。**保护包含密钥的文件**，将它们添加到 Claude Code 的拒绝列表：

1. 打开 Claude Code 设置（`.claude/settings.json` 或全局）
2. 将敏感文件模式添加到拒绝列表：

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

这完全阻止 Claude 读取这些文件，无论你运行什么命令。

> [!IMPORTANT]
> GSD 包含内置保护以防止提交密钥，但纵深防御是最佳实践。拒绝读取敏感文件作为第一道防线。

---

## 故障排除

**安装后找不到命令？**
- 重启运行时以重新加载命令/技能
- 验证文件是否存在于 `~/.claude/commands/gsd/`（全局）或 `./.claude/commands/gsd/`（本地）
- 对于 Codex，验证技能是否存在于 `~/.codex/skills/gsd-*/SKILL.md`（全局）或 `./.codex/skills/gsd-*/SKILL.md`（本地）

**命令没有按预期工作？**
- 运行 `/gsd-help` 验证安装
- 重新运行 `npx get-shit-done-cc` 重新安装

**更新到最新版本？**
```bash
npx get-shit-done-cc@latest
```

**使用 Docker 或容器化环境？**

如果用波浪号路径（`~/.claude/...`）读取文件失败，在安装前设置 `CLAUDE_CONFIG_DIR`：
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-shit-done-cc --global
```
这确保使用绝对路径而不是 `~`，后者在容器中可能无法正确展开。

### 卸载

完全删除 GSD：

```bash
# 全局安装
npx get-shit-done-cc --claude --global --uninstall
npx get-shit-done-cc --opencode --global --uninstall
npx get-shit-done-cc --kilo --global --uninstall
npx get-shit-done-cc --codex --global --uninstall

# 本地安装（当前项目）
npx get-shit-done-cc --claude --local --uninstall
npx get-shit-done-cc --opencode --local --uninstall
npx get-shit-done-cc --kilo --local --uninstall
npx get-shit-done-cc --codex --local --uninstall
```

这删除所有 GSD 命令、代理、钩子和设置，同时保留你的其他配置。

---

## 社区移植

OpenCode、Gemini CLI、Kilo 和 Codex 现在通过 `npx get-shit-done-cc` 原生支持。

这些社区移植开创了多运行时支持：

| 项目 | 平台 | 描述 |
|---------|----------|-------------|
| [gsd-opencode](https://github.com/rokicool/gsd-opencode) | OpenCode | 原始 OpenCode 适配 |
| gsd-gemini (已归档) | Gemini CLI | 由 uberfuzzy 开发的原始 Gemini 适配 |

---

## Star 历史

<a href="https://star-history.com/#gsd-build/get-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
 </picture>
</a>

---

## 许可证

MIT 许可证。详见 [LICENSE](../LICENSE)。

---

<div align="center">

**Claude Code 很强大。GSD 让它可靠。**

</div>
