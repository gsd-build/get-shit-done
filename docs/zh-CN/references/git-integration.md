<overview>
GSD 框架的 Git 集成。
</overview>

<core_principle>

**提交结果，而非过程。**

git 日志应该读起来像是发布内容的变更日志，而不是规划活动的日记。
</core_principle>

<commit_points>

| 事件 | 提交? | 原因 |
| ----------------------- | ------- | ------------------------------------------------ |
| BRIEF + ROADMAP 创建 | 是 | 项目初始化 |
| PLAN.md 创建 | 否 | 中间产物 - 与计划完成一起提交 |
| RESEARCH.md 创建 | 否 | 中间产物 |
| DISCOVERY.md 创建 | 否 | 中间产物 |
| **任务完成** | 是 | 原子工作单元（每个任务 1 个提交） |
| **计划完成** | 是 | 元数据提交（SUMMARY + STATE + ROADMAP） |
| 交接创建 | 是 | WIP 状态保留 |

</commit_points>

<git_check>

```bash
[ -d .git ] && echo "GIT_EXISTS" || echo "NO_GIT"
```

如果 NO_GIT：静默运行 `git init`。GSD 项目总是有自己的仓库。
</git_check>

<commit_formats>

<format name="initialization">
## 项目初始化（brief + roadmap 一起）

```
docs: initialize [project-name] ([N] phases)

[PROJECT.md 中的一句话描述]

Phases:
1. [phase-name]: [goal]
2. [phase-name]: [goal]
3. [phase-name]: [goal]
```

提交内容：

```bash
gsd-sdk query commit "docs: initialize [project-name] ([N] phases)" --files .planning/
```

</format>

<format name="task-completion">
## 任务完成（计划执行期间）

每个任务在完成后立即获得自己的提交。

```
{type}({phase}-{plan}): {task-name}

- [关键变更 1]
- [关键变更 2]
- [关键变更 3]
```

**提交类型：**
- `feat` - 新功能/功能
- `fix` - Bug 修复
- `test` - 仅测试（TDD RED 阶段）
- `refactor` - 代码清理（TDD REFACTOR 阶段）
- `perf` - 性能改进
- `chore` - 依赖、配置、工具

**示例：**

```bash
# 标准任务
git add src/api/auth.ts src/types/user.ts
git commit -m "feat(08-02): create user registration endpoint

- POST /auth/register validates email and password
- Checks for duplicate users
- Returns JWT token on success
"

# TDD 任务 - RED 阶段
git add src/__tests__/jwt.test.ts
git commit -m "test(07-02): add failing test for JWT generation

- Tests token contains user ID claim
- Tests token expires in 1 hour
- Tests signature verification
"

# TDD 任务 - GREEN 阶段
git add src/utils/jwt.ts
git commit -m "feat(07-02): implement JWT generation

- Uses jose library for signing
- Includes user ID and expiry claims
- Signs with HS256 algorithm
"
```

</format>

<format name="plan-completion">
## 计划完成（所有任务完成后）

所有任务提交后，最后一个元数据提交捕获计划完成。

```
docs({phase}-{plan}): complete [plan-name] plan

Tasks completed: [N]/[N]
- [Task 1 name]
- [Task 2 name]
- [Task 3 name]

SUMMARY: .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md
```

提交内容：

```bash
gsd-sdk query commit "docs({phase}-{plan}): complete [plan-name] plan" --files .planning/phases/XX-name/{phase}-{plan}-PLAN.md .planning/phases/XX-name/{phase}-{plan}-SUMMARY.md .planning/STATE.md .planning/ROADMAP.md
```

**注意：** 代码文件不包含 - 已按任务提交。

</format>

<format name="handoff">
## 交接（WIP）

```
wip: [phase-name] paused at task [X]/[Y]

Current: [task name]
[如果阻塞:] Blocked: [reason]
```

提交内容：

```bash
gsd-sdk query commit "wip: [phase-name] paused at task [X]/[Y]" --files .planning/
```

</format>
</commit_formats>

<example_log>

**旧方法（每个计划提交）：**
```
a7f2d1 feat(checkout): Stripe payments with webhook verification
3e9c4b feat(products): catalog with search, filters, and pagination
8a1b2c feat(auth): JWT with refresh rotation using jose
5c3d7e feat(foundation): Next.js 15 + Prisma + Tailwind scaffold
2f4a8d docs: initialize ecommerce-app (5 phases)
```

**新方法（每个任务提交）：**
```
# Phase 04 - Checkout
1a2b3c docs(04-01): complete checkout flow plan
4d5e6f feat(04-01): add webhook signature verification
7g8h9i feat(04-01): implement payment session creation
0j1k2l feat(04-01): create checkout page component

# Phase 03 - Products
3m4n5o docs(03-02): complete product listing plan
6p7q8r feat(03-02): add pagination controls
9s0t1u feat(03-02): implement search and filters
2v3w4x feat(03-01): create product catalog schema

# Phase 02 - Auth
5y6z7a docs(02-02): complete token refresh plan
8b9c0d feat(02-02): implement refresh token rotation
1e2f3g test(02-02): add failing test for token refresh
4h5i6j docs(02-01): complete JWT setup plan
7k8l9m feat(02-01): add JWT generation and validation
0n1o2p chore(02-01): install jose library

# Phase 01 - Foundation
3q4r5s docs(01-01): complete scaffold plan
6t7u8v feat(01-01): configure Tailwind and globals
9w0x1y feat(01-01): set up Prisma with database
2z3a4b feat(01-01): create Next.js 15 project

# Initialization
5c6d7e docs: initialize ecommerce-app (5 phases)
```

每个计划产生 2-4 个提交（任务 + 元数据）。清晰、细粒度、可 bisect。

</example_log>

<anti_patterns>

**仍不要提交（中间产物）：**
- PLAN.md 创建（与计划完成一起提交）
- RESEARCH.md（中间产物）
- DISCOVERY.md（中间产物）
- 小的规划调整
- "Fixed typo in roadmap"

**要提交（结果）：**
- 每个任务完成（feat/fix/test/refactor）
- 计划完成元数据（docs）
- 项目初始化（docs）

**关键原则：** 提交可工作的代码和已发布的结果，而非规划过程。

</anti_patterns>

<commit_strategy_rationale>

## 为什么使用每任务提交？

**AI 上下文工程：**
- Git 历史成为未来 Claude 会话的主要上下文源
- `git log --grep="{phase}-{plan}"` 显示计划的所有工作
- `git diff <hash>^..<hash>` 显示每个任务的确切变更
- 减少对解析 SUMMARY.md 的依赖 = 更多上下文用于实际工作

**失败恢复：**
- 任务 1 已提交 ✅，任务 2 失败 ❌
- 下次会话中的 Claude：看到任务 1 完成，可以重试任务 2
- 可以 `git reset --hard` 到最后一个成功的任务

**调试：**
- `git bisect` 找到确切的失败任务，而不仅仅是失败计划
- `git blame` 将行追溯到特定任务上下文
- 每个提交独立可回滚

**可观察性：**
- 独立开发者 + Claude 工作流受益于细粒度归因
- 原子提交是 git 最佳实践
- 当消费者是 Claude 而非人类时，"提交噪音"无关紧要

</commit_strategy_rationale>