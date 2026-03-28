# 模型配置解析

在编排开始时解析一次模型配置，然后在所有 Task 生成时使用。

## 解析模式

```bash
MODEL_PROFILE=$(cat .planning/config.json 2>/dev/null | grep -o '"model_profile"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"' || echo "balanced")
```

默认值：未设置或缺少 config 时为 `balanced`。

## 查找表

@~/.claude/get-shit-done/references/model-profiles.md

在表中查找已解析配置对应的代理。将 model 参数传递给 Task 调用：

```
Task(
  prompt="...",
  subagent_type="gsd-planner",
  model="{resolved_model}"  # "inherit"、"sonnet" 或 "haiku"
)
```

**注意：** Opus 级代理解析为 `"inherit"`（而非 `"opus"`）。这会使代理使用父会话的模型，避免与可能阻止特定 opus 版本的组织策略冲突。

## 使用方法

1. 在编排开始时解析一次
2. 存储 profile 值
3. 生成时在表中查找每个代理的模型
4. 将 model 参数传递给每个 Task 调用（值：`"inherit"`、`"sonnet"`、`"haiku"`）