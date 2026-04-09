# 模型配置

模型配置控制每个 GSD 代理使用哪个 Claude 模型。这允许平衡质量和 token 消耗。

## 配置定义

| 代理 | `quality` | `balanced` | `budget` |
|-------|-----------|------------|----------|
| gsd-planner | opus | opus | sonnet |
| gsd-roadmapper | opus | sonnet | sonnet |
| gsd-executor | opus | sonnet | sonnet |
| gsd-phase-researcher | opus | sonnet | haiku |
| gsd-project-researcher | opus | sonnet | haiku |
| gsd-research-synthesizer | sonnet | sonnet | haiku |
| gsd-debugger | opus | sonnet | sonnet |
| gsd-codebase-mapper | sonnet | haiku | haiku |
| gsd-verifier | sonnet | sonnet | haiku |
| gsd-plan-checker | sonnet | sonnet | haiku |
| gsd-integration-checker | sonnet | sonnet | haiku |
| gsd-nyquist-auditor | sonnet | sonnet | haiku |

## 配置理念

**quality** - 最大推理能力
- 所有决策代理使用 Opus
- 只读验证使用 Sonnet
- 适用场景：有配额可用、关键架构工作

**balanced**（默认）- 智能分配
- 仅规划（架构决策发生的地方）使用 Opus
- 执行和研究使用 Sonnet（遵循明确指令）
- 验证使用 Sonnet（需要推理，不仅仅是模式匹配）
- 适用场景：正常开发、质量与成本的良好平衡

**budget** - 最小化 Opus 使用
- 编写代码的使用 Sonnet
- 研究和验证使用 Haiku
- 适用场景：节省配额、大量工作、不太关键的阶段

## 解析逻辑

编排器在生成代理前解析模型：

```
1. 读取 .planning/config.json
2. 检查 model_overrides 是否有代理特定覆盖
3. 如果没有覆盖，在配置表中查找代理
4. 将 model 参数传递给 Task 调用
```

## 单代理覆盖

覆盖特定代理而不更改整个配置：

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

覆盖优先于配置。有效值：`opus`、`sonnet`、`haiku`。

## 切换配置

运行时：`/gsd-set-profile <profile>`

项目默认值：在 `.planning/config.json` 中设置：
```json
{
  "model_profile": "balanced"
}
```

## 设计理由

**为什么 gsd-planner 使用 Opus？**
规划涉及架构决策、目标分解和任务设计。这是模型质量影响最大的地方。

**为什么 gsd-executor 使用 Sonnet？**
执行者遵循明确的 PLAN.md 指令。计划已包含推理；执行只是实现。

**为什么 balanced 中验证器使用 Sonnet（而非 Haiku）？**
验证需要目标回溯推理 —— 检查代码是否**交付**了阶段承诺的内容，而不仅仅是模式匹配。Sonnet 处理得很好；Haiku 可能会遗漏细微的差距。

**为什么 gsd-codebase-mapper 使用 Haiku？**
只读探索和模式提取。不需要推理，只需从文件内容输出结构化结果。

**为什么用 `inherit` 而不是直接传递 `opus`？**
Claude Code 的 `"opus"` 别名映射到特定模型版本。组织可能阻止旧版 opus 而允许新版。GSD 为 opus 级代理返回 `"inherit"`，使其使用用户在会话中配置的任何 opus 版本。这避免了版本冲突和静默回退到 Sonnet。