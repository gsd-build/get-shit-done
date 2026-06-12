<purpose>
Display the complete GSD command reference. Output ONLY the reference content. Do NOT add project-specific analysis, git status, next-step suggestions, or any commentary beyond the reference.
</purpose>

<reference>
# GSD 命令参考

**GSD** (Get Shit Done) 创建层级化项目计划，专为 Claude Code 的单智能体开发优化。

## 快速开始

1. `/gsd:new-project` - 初始化项目（包含研究、需求、路线图）
2. `/gsd:plan-phase 1` - 为第一阶段创建详细计划
3. `/gsd:execute-phase 1` - 执行该阶段

## 保持更新

GSD 迭代很快，定期更新：

```bash
npx get-shit-done-cc@latest
```

## 核心工作流

```text
/gsd:new-project → /gsd:plan-phase → /gsd:execute-phase → 重复
```

### 项目初始化

**`/gsd:new-project`**
通过统一流程初始化新项目。

一个命令即可从想法到准备规划：
- 深度提问了解你要构建的内容
- 可选领域研究（启动 4 个并行研究代理）
- 带有 v1/v2/超出范围 的需求定义
- 带阶段分解和成功标准的路线图创建

创建所有 `.planning/` 工件：
- `PROJECT.md` — 愿景和需求
- `config.json` — 工作流模式（交互式/yolo）
- `research/` — 领域研究（如果选择了）
- `REQUIREMENTS.md` — 带 REQ-ID 的范围需求
- `ROADMAP.md` — 映射到需求的阶段
- `STATE.md` — 项目记忆

用法：`/gsd:new-project`

**`/gsd:map-codebase [--fast] [--focus <area>] [--query <term>]`**
为棕地项目映射现有代码库。

- `--fast` — 快速轻量评估（替代原来的 `gsd-scan`）
- `--focus <area>` — 将映射范围限定到特定区域
- `--query <term>` — 查询 `.planning/intel/` 中的代码库智能索引（替代原来的 `gsd-intel`）

- 使用并行探索代理分析代码库
- 创建 `.planning/codebase/` 包含 7 个聚焦文档
- 涵盖技术栈、架构、结构、约定、测试、集成、问题
- 在现有代码库上使用 `/gsd:new-project` 之前使用

用法：`/gsd:map-codebase`

### 阶段规划

**`/gsd:discuss-phase <number> [--chain | --analyze | --power | --assumptions] [--batch[=N]]`**
在规划前帮助表达你对阶段的愿景。

- `--chain` — 链式提示讨论流程
- `--analyze` — 深度假设分析
- `--power` — 扩展问题集的高级用户模式
- `--assumptions` — 在不进行交互会话的情况下揭示 Claude 对该阶段的实现假设

- 捕获你想象中这个阶段的工作方式
- 创建包含你的愿景、要点和边界的 CONTEXT.md
- 当你对某物应该如何外观/感觉有想法时使用
- 可选 `--batch` 每次问 2-5 个相关问题而非逐一提问

用法：`/gsd:discuss-phase 2`
用法：`/gsd:discuss-phase 2 --batch`
用法：`/gsd:discuss-phase 2 --batch=3`

**`/gsd:plan-phase <number> [--research] [--skip-research] [--research-phase <N>] [--view] [--gaps] [--skip-verify] [--prd <file>] [--ingest <path-or-glob>] [--ingest-format <auto|nygard|madr|narrative>] [--reviews] [--text] [--tdd] [--mvp]`**
为特定阶段创建详细执行计划。

- `--skip-research` — 跳过研究子代理
- `--research-phase <N>` — 仅研究模式。为阶段 `<N>` 启动研究代理，写入 `RESEARCH.md`，然后在规划器运行前退出。适用于跨阶段研究、规划前的文档审查、无重新规划的纠正循环。替代已删除的 `gsd-research-phase` 独立命令 (#3042)。
  - 修改器：`--research` 强制刷新（重新启动研究代理，无提示）。`--view` 将现有 `RESEARCH.md` 输出到标准输出而不启动。两者都没有时，如果 `RESEARCH.md` 已存在则提示 `更新 / 查看 / 跳过`。
- `--gaps` — 仅专注于关闭先前计划检查中的差距
- `--skip-verify` — 跳过计划后验证器循环
- `--ingest <path-or-glob>` — 规划前预导入外部 ADR/PRD/SPEC（见下方 *PRD 快速通道*）
- `--ingest-format <auto|nygard|madr|narrative>` — 设置 `--ingest` 时提示 ADR 导入器的解析器；默认为 `auto`
- `--tdd` — 按测试驱动顺序规划（测试在代码之前）
- `--mvp` — 垂直切片 MVP 规划模式（另见 `/gsd:mvp-phase`）

- 生成 `.planning/phases/XX-phase-name/XX-YY-PLAN.md`
- 将阶段分解为具体可操作的任务
- 包含验证标准和成功指标
- 每阶段支持多个计划（XX-01、XX-02 等）

用法：`/gsd:plan-phase 1`
用法：`/gsd:plan-phase --research-phase 2` — 仅对阶段 2 进行研究（如果 `RESEARCH.md` 存在则提示）
用法：`/gsd:plan-phase --research-phase 2 --view` — 打印现有 `RESEARCH.md`，不启动
用法：`/gsd:plan-phase --research-phase 2 --research` — 强制刷新，无提示
结果：创建 `.planning/phases/01-foundation/01-01-PLAN.md`

**PRD 快速通道：** 传递 `--prd path/to/requirements.md` 以完全跳过讨论阶段。你的 PRD 成为 CONTEXT.md 中锁定的决策。当你已有明确验收标准时有用。

### 执行

**`/gsd:execute-phase <phase-number> [--wave N] [--gaps-only] [--tdd]`**
执行阶段中的所有计划，或运行特定波次。

- `--wave N` — 仅执行波次 N（见下文 *每个波次中的计划*）
- `--gaps-only` — 仅重新运行先前验证器标记为差距的计划
- `--tdd` — 在执行期间强制执行测试驱动顺序

- 按波次分组计划（来自 frontmatter），顺序执行波次
- 每个波次中的计划通过任务工具并行运行
- 可选 `--wave N` 标志仅执行波次 `N`，并在阶段全部完成后停止
- 所有计划完成后验证阶段目标
- 更新 REQUIREMENTS.md、ROADMAP.md、STATE.md

用法：`/gsd:execute-phase 5`
用法：`/gsd:execute-phase 5 --wave 2`

### 智能路由器

**`/gsd:progress --do "<description>"`**
将自由文本自动路由到正确的 GSD 命令。

- 分析自然语言输入以找到最佳匹配的 GSD 命令
- 充当调度器 — 本身不执行任何工作
- 通过让你在顶级匹配之间选择来解决歧义
- 当你知道想要什么但不知道运行哪个 `/gsd-*` 命令时使用

用法：`/gsd:progress --do "修复登录按钮"`
用法：`/gsd:progress --do "重构认证系统"`
用法：`/gsd:progress --do "我想开始一个新的里程碑"`

### 快速模式

**`/gsd:quick [--full] [--validate] [--discuss] [--research]`**
执行小型临时任务，具有 GSD 保障但跳过可选代理。

快速模式使用相同的系统但路径更短：
- 启动规划器 + 执行器（默认跳过研究器、检查器、验证器）
- 快速任务存储在 `.planning/quick/` 中，与规划阶段分离
- 更新 STATE.md 跟踪（而非 ROADMAP.md）

标志启用额外的质量步骤：
- `--full` — 完整质量管道：讨论 + 研究 + 计划检查 + 验证
- `--validate` — 仅计划检查（最多 2 次迭代）和执行后验证
- `--discuss` — 在规划前轻量讨论以发现灰色地带
- `--research` — 聚焦研究代理在规划前调查方法

细粒度标志可组合：`--discuss --research --validate` 等同于 `--full`。

用法：`/gsd:quick`
用法：`/gsd:quick --full`
用法：`/gsd:quick --research --validate`
结果：创建 `.planning/quick/NNN-slug/PLAN.md`、`.planning/quick/NNN-slug/NNN-slug-SUMMARY.md`

---

**`/gsd:fast [description]`**
内联执行简单任务 — 无子代理、无规划文件、无开销。

对于太小而不值得规划的任务：错别字修复、配置更改、遗漏的提交、简单添加。在当前上下文中运行，进行更改，提交并记录到 STATE.md。

- 不创建 PLAN.md 或 SUMMARY.md
- 不启动子代理（内联运行）
- ≤ 3 个文件编辑 — 如果任务不简单则重定向到 `/gsd:quick`
- 使用约定提交消息的原子提交

用法：`/gsd:fast "修复 README 中的错别字"`
用法：`/gsd:fast "将 .env 添加到 gitignore"`

### 路线图管理

**`/gsd:phase <description>`**
向当前里程碑末尾添加新阶段。

- 追加到 ROADMAP.md
- 使用下一个顺序编号
- 更新阶段目录结构

用法：`/gsd:phase "添加管理仪表板"`

**`/gsd:phase --insert <after> <description>`**
在现有阶段之间插入紧急工作作为子阶段。

- 创建中间阶段（例如，7 和 8 之间的 7.1）
- 用于必须在里程碑中间进行的已发现工作
- 维护阶段排序

用法：`/gsd:phase --insert 7 "修复关键认证错误"`
结果：创建阶段 7.1

**`/gsd:phase --remove <number>`**
删除未来阶段并重新编号后续阶段。

- 删除阶段目录和所有引用
- 重新编号所有后续阶段以关闭间隙
- 仅适用于未来（未开始的）阶段
- Git 提交保留历史记录

用法：`/gsd:phase --remove 17`
结果：阶段 17 被删除，阶段 18-20 变为 17-19

**`/gsd:phase --edit <number> [--force]`**
原地编辑现有路线图阶段的任何字段，保留编号和位置。

- 更新 `ROADMAP.md` 中的标题、描述、需求、依赖项
- `--force` 允许编辑已开始的阶段（请谨慎使用）

### 里程碑管理

**`/gsd:new-milestone <name>`**
通过统一流程开始新里程碑。

- 深度提问了解接下来要构建的内容
- 可选领域研究（启动 4 个并行研究代理）
- 带范围的需求定义
- 带阶段分解的路线图创建
- 可选 `--reset-phase-numbers` 标志从阶段 1 重新开始编号并首先归档旧阶段目录以确保安全

镜像 `/gsd:new-project` 流程用于棕地项目（现有 PROJECT.md）。

用法：`/gsd:new-milestone "v2.0 功能"`
用法：`/gsd:new-milestone --reset-phase-numbers "v2.0 功能"`

**`/gsd:complete-milestone <version>`**
归档已完成的里程碑并准备下一个版本。

- 在 MILESTONES.md 中创建条目并包含统计信息
- 将完整详细信息归档到 milestones/ 目录
- 为发布创建 git 标签
- 准备工作区用于下一个版本

用法：`/gsd:complete-milestone 1.0.0`

### 进度跟踪

**`/gsd:progress [--next | --forensic | --do "<description>"]`**
检查项目状态并智能路由到下一步操作。

- 显示可视化进度条和完成百分比
- 从 SUMMARY 文件总结近期工作
- 显示当前位置和接下来的内容
- 列出关键决策和开放问题
- 提供执行下一个计划或在缺失时创建它的选项
- 检测 100% 里程碑完成

模式：
- **默认** — 进度报告 + 智能路由
- **`--next`** — 自动前进到下一个逻辑步骤（使用 `--next --force` 绕过安全门）
- **`--forensic`** — 在进度报告后附加 6 项完整性审计
- **`--do "<text>"`** — 智能路由器：将自由意图路由到匹配的 `/gsd-*` 命令（见上方 *智能路由器*）

用法：`/gsd:progress`
用法：`/gsd:progress --next`
用法：`/gsd:progress --forensic`

### 会话管理

**`/gsd:resume-work`**
从上一个会话恢复工作，恢复完整上下文。

- 从 STATE.md 读取项目上下文
- 显示当前位置和近期进展
- 根据项目状态提供下一步操作

用法：`/gsd:resume-work`

**`/gsd:pause-work [--report]`**
在阶段中间暂停工作时创建上下文交接。

- `--report` — 在 `.planning/reports/` 中生成会话后摘要，捕获提交、文件更改和阶段进展
- 创建 .continue-here 文件包含当前状态
- 更新 STATE.md 会话连续性部分
- 捕获进行中工作上下文

用法：`/gsd:pause-work`

### 调试

**`/gsd:debug [issue description] [--diagnose]`**
跨上下文重置的系统化调试，具有持久状态。

- `--diagnose` — 运行一次性诊断而不打开持久调试会话

- 通过适应性提问收集症状
- 创建 `.planning/debug/[slug].md` 以跟踪调查
- 使用科学方法调查（证据 → 假设 → 测试）
- 在 `/clear` 后存活 — 运行不带参数的 `/gsd:debug` 以恢复
- 将已解决的问题归档到 `.planning/debug/resolved/`

用法：`/gsd:debug "登录按钮不工作"`
用法：`/gsd:debug`（恢复活动会话）

### 快速试验与草图

**`/gsd:spike [idea] [--quick]`**
使用可丢弃实验快速试验想法以验证可行性。

- 将想法分解为 2-5 个聚焦实验（按风险排序）
- 每个试验回答一个特定的给定/当/然后问题
- 构建最少代码，运行，捕获结果（已验证/无效/部分）
- 保存到 `.planning/spikes/` 并包含 MANIFEST.md 跟踪
- 不需要 `/gsd:new-project` — 在任何仓库中工作
- `--quick` 跳过分解，立即构建

用法：`/gsd:spike "我们能否通过 WebSockets 流式传输 LLM 输出？"`
用法：`/gsd:spike --quick "测试 pdfjs 是否提取表格"`

**`/gsd:sketch [idea] [--quick]`**
使用可丢弃 HTML 模型快速草图 UI/设计想法，具有多变体探索。

- 构建前的对话式氛围/方向输入
- 每个草图产生 2-3 个变体作为标签式 HTML 页面
- 用户比较变体、选择元素、迭代
- 共享 CSS 主题系统跨草图复合
- 保存到 `.planning/sketches/` 并包含 MANIFEST.md 跟踪
- 不需要 `/gsd:new-project` — 在任何仓库中工作
- `--quick` 跳过氛围输入，跳转到构建

用法：`/gsd:sketch "管理面板的仪表板布局"`
用法：`/gsd:sketch --quick "表单卡片分组"`

**`/gsd:spike --wrap-up`**
将试验发现打包为持久项目技能。

- 逐一整理每个试验（包含/排除/部分/UAT）
- 按功能区域分组发现
- 生成 `./.claude/skills/spike-findings-[project]/` 并包含引用和来源
- 将摘要写入 `.planning/spikes/WRAP-UP-SUMMARY.md`
- 向项目 CLAUDE.md 添加自动加载路由行

用法：`/gsd:spike --wrap-up`

**`/gsd:sketch --wrap-up`**
将草图设计发现打包为持久项目技能。

- 逐一整理每个草图（包含/排除/部分/重新访问）
- 按设计区域分组发现
- 生成 `./.claude/skills/sketch-findings-[project]/` 并包含设计决策、CSS 模式、HTML 结构
- 将摘要写入 `.planning/sketches/WRAP-UP-SUMMARY.md`
- 向项目 CLAUDE.md 添加自动加载路由行

用法：`/gsd:sketch --wrap-up`

### 捕获想法、笔记和待办事项

**`/gsd:capture [description]`**
从当前对话捕获想法或任务为结构化待办事项。

- 从对话提取上下文（或使用提供的描述）
- 在 `.planning/todos/pending/` 中创建结构化待办文件
- 从文件路径推断区域用于分组
- 创建前检查重复项
- 更新 STATE.md 待办计数

用法：`/gsd:capture`（从对话推断）
用法：`/gsd:capture 添加认证令牌刷新`

**`/gsd:capture --note <text>`**
零摩擦笔记捕获 — 一个命令，即时保存，无需确认。

- 将带时间戳的笔记保存到 `.planning/notes/`（或全局的 `~/.claude/notes/`）
- 三个子命令：追加（默认）、列表、提升
- 提升将笔记转换为结构化待办事项
- 无项目时也能工作（回退到全局范围）

用法：`/gsd:capture --note 重构钩子系统`
用法：`/gsd:capture --note list`
用法：`/gsd:capture --note promote 3`
用法：`/gsd:capture --note --global 跨项目想法`

**`/gsd:capture --list [area]`**
列出待处理的待办事项并选择一个进行处理。

- 列出所有待处理的待办事项及其标题、区域、年龄
- 可选区域过滤器（例如 `/gsd:capture --list api`）
- 加载所选待办事项的完整上下文
- 路由到适当的操作（立即工作、添加到阶段、头脑风暴）
- 开始工作时将待办事项移至 done/

用法：`/gsd:capture --list`
用法：`/gsd:capture --list api`

### 用户验收测试

**`/gsd:verify-work [phase]`**
通过对话式 UAT 验证构建的功能。

- 从 SUMMARY.md 文件提取可测试的交付物
- 逐个呈现测试（是/否响应）
- 自动诊断失败并创建修复计划
- 如果发现问题则准备好重新执行

用法：`/gsd:verify-work 3`

### 发布工作

**`/gsd:ship [phase]`**
从已完成的阶段工作创建 PR，具有自动生成的正文。

- 将分支推送到远程
- 使用来自 SUMMARY.md、VERIFICATION.md、REQUIREMENTS.md 的摘要创建 PR
- 可选请求代码审查
- 用发布状态更新 STATE.md

先决条件：阶段已验证，`gh` CLI 已安装并认证。

用法：`/gsd:ship 4` 或 `/gsd:ship 4 --draft`

---

**`/gsd:review --phase N [--gemini] [--claude] [--codex] [--coderabbit] [--opencode] [--qwen] [--cursor] [--all]`**
跨 AI 同行审查 — 调用外部 AI CLI 独立审查阶段计划。

- 检测可用的 CLI（gemini、claude、codex、coderabbit）
- 每个 CLI 使用相同的结构化提示独立审查计划
- CodeRabbit 审查当前 git diff（不是提示）— 可能需要最多 5 分钟
- 生成 REVIEWS.md 包含每个审查者的反馈和共识摘要
- 将审查反馈回规划：`/gsd:plan-phase N --reviews`

用法：`/gsd:review --phase 3 --all`

---

**`/gsd:pr-branch [target]`**
通过过滤 .planning/ 提交创建干净的 PR 分支。

- 分类提交：仅代码（包含）、仅规划（排除）、混合（包含不含 .planning/）
- 将代码提交 cherry-pick 到干净分支
- 审查者仅看到代码更改，没有 GSD 工件

用法：`/gsd:pr-branch` 或 `/gsd:pr-branch main`

---

**`/gsd:capture --seed [idea]`**
捕获具有触发条件以自动浮现的前瞻性想法。

- 种子保留原因、触发时机和相关代码线索
- 在 `/gsd:new-milestone` 期间当触发条件匹配时自动浮现
- 优于推迟项 — 触发器会被检查，而非被遗忘

用法：`/gsd:capture --seed "在我们构建事件系统时添加实时通知"`

**`/gsd:capture --backlog [description]`**
将想法添加到未来里程碑的待办事项暂存区。

- 在 ROADMAP.md 中创建 999.x 编号下的待办事项条目
- 在不占用当前里程碑配额的情况下保留想法
- 稍后通过 `/gsd:review-backlog` 浮现和提升

用法：`/gsd:capture --backlog "事件发布后的实时通知"`

---

**`/gsd:audit-uat`**
所有未完成 UAT 和验证项目的跨阶段审计。
- 扫描每个阶段的待处理、跳过、阻塞和需要人类的项目
- 交叉引用代码库以检测过时文档
- 生成按可测试性分组的优先级人类测试计划
- 在开始新里程碑前使用以清除验证债务

用法：`/gsd:audit-uat`

### 里程碑审计

**`/gsd:audit-milestone [version]`**
根据原始意图审计里程碑完成情况。

- 读取所有阶段 VERIFICATION.md 文件
- 检查需求覆盖率
- 启动跨阶段连接的集成检查器
- 创建 MILESTONE-AUDIT.md 包含差距和技术债务

用法：`/gsd:audit-milestone`

### 配置

**`/gsd:settings`**
交互式配置工作流切换和模型配置文件。

- 切换研究器、计划检查器、验证器代理
- 选择模型配置文件（质量/平衡/预算/继承）
- 更新 `.planning/config.json`

用法：`/gsd:settings`

**`/gsd:config [--profile <profile> | --advanced | --integrations]`**
配置超越基本设置的 GSD：模型配置文件、高级调优和第三方集成。

- `--profile <profile>` — 快速切换模型配置文件（`质量 | 平衡 | 预算 | 继承`）
- `--advanced` — 高级用户调优：计划反弹、超时、分支模板、跨 AI 执行（替代原来的 `gsd-settings-advanced`）
- `--integrations` — 第三方 API 密钥、代码审查 CLI 路由、代理技能注入（替代原来的 `gsd-settings-integrations`）

- `质量` — 验证外的所有代理使用 Opus
- `平衡` — 规划使用 Opus，执行使用 Sonnet（默认）
- `预算` — 写入使用 Sonnet，研究/验证使用 Haiku
- `继承` — 所有代理使用当前会话模型（OpenCode `/model`）

用法：`/gsd:config --profile budget`

**`/gsd:surface [list|status|profile <name>|disable <cluster>|enable <cluster>|reset]`**
切换哪些技能被显示 — 应用配置文件、列表或禁用集群而无需重新安装。

- `list` / `status` — 显示启用和禁用的集群和技能及其令牌成本
- `profile <name>` — 切换到命名的基础配置文件（`core`、`standard`、`full`）
- `disable <cluster>` — 从活动表面移除集群
- `enable <cluster>` — 将集群添加回活动表面
- `reset` — 删除表面增量并返回安装时的配置文件

用法：`/gsd:surface list`
用法：`/gsd:surface profile standard`
用法：`/gsd:surface disable utility`

### 实用命令

**`/gsd:cleanup`**
归档来自已完成里程碑的累积阶段目录。

- 识别仍存在于 `.planning/phases/` 中的已完成里程碑的阶段
- 在移动任何内容前显示模拟运行摘要
- 将阶段目录移动到 `.planning/milestones/v{X.Y}-phases/`
- 在多个里程碑后使用以减少 `.planning/phases/` 杂乱

用法：`/gsd:cleanup`

**`/gsd:help [--brief | --full | <topic> | --brief <topic>]`**
按你要求的层级显示 GSD 命令帮助。

- `--brief` — 核心命令一行速览（约 10 行）
- *（无标志）* — 新手一页导览（默认）
- `--full` — 你现在正在阅读的完整参考
- `<topic>` — 仅输出匹配的章节（例如 `/gsd:help debug`、`/gsd:help workflow`）
- `--brief <topic>` — 紧凑范围查询：签名 + 匹配章节的一行摘要

每个主题输出都以 `**Topic:** \`<alias>\` → \`<heading>\` *(scope: full | compact)*` 前言开始，以便看到已解析的路由。完整别名表见 `get-shit-done/workflows/help/modes/zh-CN/topic.md`。未知主题会打印已识别的列表。

用法：`/gsd:help`
用法：`/gsd:help --brief`
用法：`/gsd:help --full`
用法：`/gsd:help debug`
用法：`/gsd:help --brief debug`

**`/gsd:update [--sync] [--reapply]`**
更新 GSD 到最新版本并预览更新日志。

- `--sync` — 跨运行时根目录同步托管的 GSD 技能（替代原来的 `gsd-sync-skills`）
- `--reapply` — 更新后重新应用本地修改（替代原来的 `gsd-reapply-patches`）

- 显示已安装与最新版本比较
- 显示你错过的版本的更新日志条目
- 突出显示重大更改
- 运行安装前确认
- 优于原始 `npx get-shit-done-cc`

用法：`/gsd:update`

## 附加命令

上述命令涵盖最常见的日常工作流程。此处列出的每个命令也是可用的 `/gsd-*` 斜杠命令，按用途分组。

### 发现与规范

- **`/gsd:explore`** — 探索式构思和想法路由。在提交到计划前思考想法。
- **`/gsd:spec-phase <phase> [--auto] [--text]`** — 通过模糊评分澄清阶段交付什么；在讨论阶段前生成 SPEC.md。
- **`/gsd:ai-integration-phase [phase]`** — 为涉及构建 AI 系统的阶段生成 AI-SPEC.md 设计合同。
- **`/gsd:ui-phase [phase]`** — 为前端阶段生成 UI 设计合同 (UI-SPEC.md)。
- **`/gsd:import --from <filepath> | --from-gsd2`** — 导入外部计划并进行冲突检测，或反向迁移 GSD-2 (`.gsd/`) 项目回 GSD v1 (`.planning/`) 格式。
- **`/gsd:ingest-docs [path] [--mode new|merge] [--manifest <file>] [--resolve auto|interactive]`** — 从仓库中的现有 ADR、PRD、SPEC 和文档引导或合并 `.planning/` 设置。

### 规划与执行

- **`/gsd:mvp-phase <phase-number>`** — 将阶段规划为垂直 MVP 切片（用户故事 + SPIDR 拆分），然后移交给 plan-phase。与 `/gsd:plan-phase --mvp` 终态相同，带有引导式 MVP 塑形介绍。
- **`/gsd:ultraplan-phase [phase]`** — [BETA] 将规划阶段卸载到 Claude Code 的 ultraplan 云；在浏览器中审查并导入回来。
- **`/gsd:plan-review-convergence <phase> [--codex] [--gemini] [--claude] [--opencode] [--ollama] [--lm-studio] [--llama-cpp] [--all] [--text] [--ws <name>] [--max-cycles N]`** — 跨 AI 计划收敛循环 — 使用审查反馈重新规划直到没有高关注度。支持云端审查者（Codex/Gemini/Claude/OpenCode）和本地模型运行时（Ollama、LM Studio、llama.cpp）。
- **`/gsd:autonomous [--from N] [--to N] [--only N] [--interactive]`** — 自主运行所有剩余阶段：讨论 → 规划 → 执行每个阶段。

### 质量、审查与验证

- **`/gsd:code-review <phase> [--depth=quick|standard|deep] [--files file1,file2,...] [--fix [--all] [--auto]]`** — 审查阶段期间更改的源文件以查找错误、安全问题和代码质量问题。
- **`/gsd:secure-phase [phase]`** — 事后验证已完成阶段的威胁缓解。
- **`/gsd:validate-phase [phase]`** — 事后审计并填补已完成阶段的 Nyquist 验证差距。
- **`/gsd:ui-review [phase]`** — 已实现前端代码的事后 6 支柱视觉审计。
- **`/gsd:eval-review [phase]`** — 审计已执行 AI 阶段的评估覆盖率并生成 EVAL-REVIEW.md 补救计划。
- **`/gsd:audit-fix --source <audit-uat> [--severity medium|high|all] [--max N] [--dry-run]`** — 自主审计到修复管道：发现、分类、修复、测试、提交。
- **`/gsd:add-tests <phase> [additional instructions]`** — 根据 UAT 标准和实现为已完成阶段生成测试。

### 诊断与维护

- **`/gsd:health [--repair] [--context]`** — 诊断规划目录健康状况并可选修复问题。
- **`/gsd:forensics [problem description]`** — 失败 GSD 工作流的事后调查；诊断出了什么问题。
- **`/gsd:undo --last N | --phase NN | --plan NN-MM`** — 安全 git 回退。使用阶段清单和依赖检查回滚阶段或计划提交。
- **`/gsd:docs-update [--force] [--verify-only]`** — 生成或更新针对代码库验证的项目文档。
- **`/gsd:extract-learnings <phase>`** — 从已完成阶段工件中提取决策、教训、模式和惊喜。

### 知识与上下文

- **`/gsd:graphify [build|query <term>|status|diff]`** — 在 `.planning/graphs/` 中构建、查询和检查项目知识图谱。
- **`/gsd:thread [list [--open|--resolved] | close <slug> | status <slug> | name | description]`** — 管理跨会话工作的持久上下文线程。
- **`/gsd:profile-user [--questionnaire] [--refresh]`** — 生成开发者行为配置文件并创建 Claude 可发现的工件。
- **`/gsd:stats`** — 显示项目统计：阶段、计划、需求、git 指标和时间线。

### 工作流与编排

- **`/gsd:manager [--analyze-deps]`** — 从一个终端管理多个阶段的交互式命令中心。`--analyze-deps` 在并行执行前扫描 ROADMAP 阶段的依赖关系。
- **`/gsd:workspace [--new | --list | --remove] [name]`** — 管理 GSD 工作区：创建、列出或移除隔离工作区环境。
- **`/gsd:workstreams`** — 管理并行工作流：列出、创建、切换、状态、进度、完成和恢复。
- **`/gsd:review-backlog`** — 审查并将待办事项提升到活动里程碑。
- **`/gsd:milestone-summary [version]`** — 从里程碑工件生成综合项目摘要，用于团队入职和审查。

### 仓库集成

- **`/gsd:inbox [--issues] [--prs] [--label] [--close-incomplete] [--repo owner/repo]`** — 根据项目模板和贡献指南对 GitHub 问题和 PR 进行分类和审查。

### 命名空间路由器（面向模型的元技能）

这六个技能主要用于模型在 60+ 技能间执行两阶段分层路由。当你想交互式浏览类别时可以直接调用它们。

- **`/gsd-context`** — 代码库智能路由（map、graphify、docs、learnings）。
- **`/gsd-ideate`** — 探索/捕获路由（explore、sketch、spike、spec、capture）。
- **`/gsd-manage`** — 配置和工作区路由（workstreams、thread、update、ship、inbox）。
- **`/gsd-project`** — 项目生命周期路由（milestones、audits、summary）。
- **`/gsd-quality`** — 质量门路由（code review、debug、audit、security、eval、ui）。
- **`/gsd-workflow`** — 阶段管道路由（discuss、plan、execute、verify、phase、progress）。

## 文件与结构

```text
.planning/
├── PROJECT.md            # 项目愿景
├── ROADMAP.md            # 当前阶段分解
├── STATE.md              # 项目记忆与上下文
├── RETROSPECTIVE.md      # 活动回顾（每个里程碑更新）
├── config.json           # 工作流模式与门
├── todos/                # 捕获的想法和任务
│   ├── pending/          # 等待处理的待办事项
│   └── done/             # 已完成的待办事项
├── spikes/               # 试验实验 (/gsd:spike)
│   ├── MANIFEST.md       # 试验清单和结果
│   └── NNN-name/         # 单独的试验目录
├── sketches/             # 设计草图 (/gsd:sketch)
│   ├── MANIFEST.md       # 草图清单和优胜者
│   ├── themes/           # 共享 CSS 主题文件
│   └── NNN-name/         # 单独的草图目录（HTML + README）
├── debug/                # 活动调试会话
│   └── resolved/         # 已归档的已解决问题
├── milestones/
│   ├── v1.0-ROADMAP.md       # 归档的路线图快照
│   ├── v1.0-REQUIREMENTS.md  # 归档的需求
│   └── v1.0-phases/          # 归档的阶段目录（通过 /gsd:cleanup 或 --archive-phases）
│       ├── 01-foundation/
│       └── 02-core-features/
├── codebase/             # 代码库映射（棕地项目）
│   ├── STACK.md          # 语言、框架、依赖项
│   ├── ARCHITECTURE.md   # 模式、层、数据流
│   ├── STRUCTURE.md      # 目录布局、关键文件
│   ├── CONVENTIONS.md    # 编码标准、命名
│   ├── TESTING.md        # 测试设置、模式
│   ├── INTEGRATIONS.md   # 外部服务、API
│   └── CONCERNS.md       # 技术债务、已知问题
└── phases/
    ├── 01-foundation/
    │   ├── 01-01-PLAN.md
    │   └── 01-01-SUMMARY.md
    └── 02-core-features/
        ├── 02-01-PLAN.md
        └── 02-01-SUMMARY.md
```

## 工作流模式

在 `/gsd:new-project` 期间设置：

**交互模式**

- 确认每个主要决策
- 在检查点暂停以获得批准
- 整个过程提供更多指导

**YOLO 模式**

- 自动批准大多数决策
- 执行计划无需确认
- 仅在关键检查点停止

随时通过编辑 `.planning/config.json` 更改

## 规划配置

在 `.planning/config.json` 中配置规划工件的管理方式：

**`planning.commit_docs`**（默认：`true`）
- `true`：规划工件提交到 git（标准工作流）
- `false`：规划工件保持本地，不提交

当 `commit_docs: false` 时：
- 将 `.planning/` 添加到你的 `.gitignore`
- 对于 OSS 贡献、客户项目或保持规划私密很有用
- 所有规划文件仍然正常工作，只是不被 git 跟踪

**`planning.search_gitignored`**（默认：`false`）
- `true`：向广泛的 ripgrep 搜索添加 `--no-ignore`
- 仅在 `.planning/` 被 gitignore 且你希望项目范围搜索包含它时需要

示例配置：
```json
{
  "planning": {
    "commit_docs": false,
    "search_gitignored": true
  }
}
```

## 常见工作流

**开始新项目：**

```text
/gsd:new-project        # 统一流程：提问 → 研究 → 需求 → 路线图
/clear
/gsd:plan-phase 1       # 为第一阶段创建计划
/clear
/gsd:execute-phase 1    # 执行阶段中的所有计划
```

**休息后恢复工作：**

```text
/gsd:progress  # 查看你上次停在哪里并继续
```

**添加紧急的里程碑中间工作：**

```text
/gsd:phase --insert 5 "关键安全修复"
/gsd:plan-phase 5.1
/gsd:execute-phase 5.1
```

**完成里程碑：**

```text
/gsd:complete-milestone 1.0.0
/clear
/gsd:new-milestone  # 开始下一个里程碑（提问 → 研究 → 需求 → 路线图）
```

**工作期间捕获想法：**

```text
/gsd:capture                                  # 从对话上下文捕获
/gsd:capture Fix modal z-index                # 带明确描述捕获
/gsd:capture --note refactor auth system      # 快速零摩擦笔记
/gsd:capture --seed "real-time notifications" # 带触发器的前瞻性想法
/gsd:capture --list                           # 审查并处理待办事项
/gsd:capture --list api                       # 按区域过滤
```

**调试问题：**

```text
/gsd:debug "表单提交静默失败"  # 开始调试会话
# ... 调查进行，上下文填满 ...
/clear
/gsd:debug                                    # 从上次停下的地方恢复
```

## 获取帮助

- 阅读 `.planning/PROJECT.md` 了解项目愿景
- 阅读 `.planning/STATE.md` 了解当前上下文
- 检查 `.planning/ROADMAP.md` 了解阶段状态
- 运行 `/gsd:progress` 检查你的进度
</reference>
