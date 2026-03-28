<overview>
TDD 关乎设计质量，而非覆盖率指标。红-绿-重构循环迫使你在实现前思考行为，从而产生更清晰的接口和更可测试的代码。

**原则：** 如果在编写 `fn` 之前能用 `expect(fn(input)).toBe(output)` 描述行为，TDD 会改善结果。

**关键洞察：** TDD 工作本质上比标准任务更重 —— 它需要 2-3 个执行周期（RED → GREEN → REFACTOR），每个周期都涉及文件读取、测试运行和可能的调试。TDD 功能获得专门的计划，以确保整个周期内有完整的上下文可用。
</overview>

<when_to_use_tdd>
## 何时 TDD 提高质量

**TDD 候选（创建 TDD 计划）：**
- 有明确输入/输出的业务逻辑
- 有请求/响应契约的 API 端点
- 数据转换、解析、格式化
- 验证规则和约束
- 有可测试行为的算法
- 状态机和工作流
- 有清晰规格的工具函数

**跳过 TDD（使用带 `type="auto"` 任务的标准计划）：**
- UI 布局、样式、视觉组件
- 配置更改
- 连接现有组件的胶水代码
- 一次性脚本和迁移
- 无业务逻辑的简单 CRUD
- 探索性原型

**启发式：** 能在编写 `fn` 之前写 `expect(fn(input)).toBe(output)` 吗？
→ 能：创建 TDD 计划
→ 不能：使用标准计划，事后添加测试（如需要）
</when_to_use_tdd>

<tdd_plan_structure>
## TDD 计划结构

每个 TDD 计划通过完整的 RED-GREEN-REFACTOR 循环实现**一个功能**。

```markdown
---
phase: XX-name
plan: NN
type: tdd
---

<objective>
[什么功能以及为什么]
Purpose: [该功能 TDD 的设计收益]
Output: [可工作的、已测试的功能]
</objective>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@relevant/source/files.ts
</context>

<feature>
  <name>[功能名称]</name>
  <files>[源文件, 测试文件]</files>
  <behavior>
    [可测试术语描述的预期行为]
    Cases: 输入 → 预期输出
  </behavior>
  <implementation>[测试通过后如何实现]</implementation>
</feature>

<verification>
[证明功能有效的测试命令]
</verification>

<success_criteria>
- 失败测试已编写并提交
- 实现通过测试
- 重构完成（如需要）
- 所有 2-3 个提交都存在
</success_criteria>

<output>
完成后，创建包含以下内容的 SUMMARY.md：
- RED: 编写了什么测试，为什么失败
- GREEN: 什么实现让它通过
- REFACTOR: 做了什么清理（如有）
- Commits: 生成的提交列表
</output>
```

**每个 TDD 计划一个功能。** 如果功能足够简单可以批量处理，那就足够简单可以跳过 TDD —— 使用标准计划，事后添加测试。
</tdd_plan_structure>

<execution_flow>
## 红-绿-重构循环

**RED - 编写失败测试：**
1. 按项目约定创建测试文件
2. 编写描述预期行为的测试（来自 `<behavior>` 元素）
3. 运行测试 - 必须**失败**
4. 如果测试通过：功能已存在或测试有误。调查。
5. 提交：`test({phase}-{plan}): add failing test for [feature]`

**GREEN - 实现使其通过：**
1. 编写使测试通过的最小代码
2. 不耍小聪明，不优化 - 只让它工作
3. 运行测试 - 必须**通过**
4. 提交：`feat({phase}-{plan}): implement [feature]`

**REFACTOR（如需要）：**
1. 如果存在明显的改进，清理实现
2. 运行测试 - 必须**仍然通过**
3. 仅在做出更改时提交：`refactor({phase}-{plan}): clean up [feature]`

**结果：** 每个 TDD 计划产生 2-3 个原子提交。
</execution_flow>

<test_quality>
## 好测试 vs 坏测试

**测试行为，而非实现：**
- 好："返回格式化的日期字符串"
- 坏："用正确参数调用 formatDate 辅助函数"
- 测试应该能经受重构

**每个测试一个概念：**
- 好：分别为有效输入、空输入、畸形输入编写测试
- 坏：用多个断言检查所有边缘情况的单个测试

**描述性名称：**
- 好："should reject empty email"、"returns null for invalid ID"
- 坏："test1"、"handles error"、"works correctly"

**不包含实现细节：**
- 好：测试公共 API、可观察行为
- 坏：Mock 内部实现、测试私有方法、断言内部状态
</test_quality>

<framework_setup>
## 测试框架设置（如不存在）

当执行 TDD 计划但没有配置测试框架时，作为 RED 阶段的一部分进行设置：

**1. 检测项目类型：**
```bash
# JavaScript/TypeScript
if [ -f package.json ]; then echo "node"; fi

# Python
if [ -f requirements.txt ] || [ -f pyproject.toml ]; then echo "python"; fi

# Go
if [ -f go.mod ]; then echo "go"; fi

# Rust
if [ -f Cargo.toml ]; then echo "rust"; fi
```

**2. 安装最小框架：**
| 项目 | 框架 | 安装 |
|---------|-----------|---------|
| Node.js | Jest | `npm install -D jest @types/jest ts-jest` |
| Node.js (Vite) | Vitest | `npm install -D vitest` |
| Python | pytest | `pip install pytest` |
| Go | testing | 内置 |
| Rust | cargo test | 内置 |

**3. 按需创建配置：**
- Jest: 带 ts-jest preset 的 `jest.config.js`
- Vitest: 带测试全局变量的 `vitest.config.ts`
- pytest: `pytest.ini` 或 `pyproject.toml` 部分

**4. 验证设置：**
```bash
# 运行空测试套件 - 应该以 0 个测试通过
npm test  # Node
pytest    # Python
go test ./...  # Go
cargo test    # Rust
```

**5. 创建第一个测试文件：**
遵循项目约定的测试位置：
- 源文件旁边的 `*.test.ts` / `*.spec.ts`
- `__tests__/` 目录
- 根目录的 `tests/` 目录

框架设置是第一个 TDD 计划 RED 阶段的一次性成本。
</framework_setup>

<error_handling>
## 错误处理

**测试在 RED 阶段没有失败：**
- 功能可能已存在 - 调查
- 测试可能有误（没测试你以为的东西）
- 前进前修复

**测试在 GREEN 阶段没有通过：**
- 调试实现
- 不要跳到重构
- 持续迭代直到绿色

**测试在 REFACTOR 阶段失败：**
- 撤销重构
- 提交过早
- 用更小的步骤重构

**不相关的测试失败：**
- 停下来调查
- 可能表明耦合问题
- 前进前修复
</error_handling>

<commit_pattern>
## TDD 计划的提交模式

TDD 计划产生 2-3 个原子提交（每个阶段一个）：

```
test(08-02): add failing test for email validation

- Tests valid email formats accepted
- Tests invalid formats rejected
- Tests empty input handling

feat(08-02): implement email validation

- Regex pattern matches RFC 5322
- Returns boolean for validity
- Handles edge cases (empty, null)

refactor(08-02): extract regex to constant (optional)

- Moved pattern to EMAIL_REGEX constant
- No behavior changes
- Tests still pass
```

**与标准计划对比：**
- 标准计划：每个任务 1 个提交，每个计划 2-4 个提交
- TDD 计划：单个功能 2-3 个提交

两者遵循相同格式：`{type}({phase}-{plan}): {description}`

**好处：**
- 每个提交独立可回滚
- Git bisect 在提交级别工作
- 显示 TDD 纪律的清晰历史
- 与整体提交策略一致
</commit_pattern>

<context_budget>
## 上下文预算

TDD 计划目标 **~40% 上下文使用率**（低于标准计划的 ~50%）。

为什么更低：
- RED 阶段：编写测试、运行测试、可能调试为什么没有失败
- GREEN 阶段：实现、运行测试、可能对失败进行迭代
- REFACTOR 阶段：修改代码、运行测试、验证无回归

每个阶段涉及读取文件、运行命令、分析输出。来回往复本质上比线性任务执行更重。

单一功能聚焦确保整个周期保持完整质量。
</context_budget>