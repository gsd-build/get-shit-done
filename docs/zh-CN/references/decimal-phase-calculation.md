# 小数阶段计算

为紧急插入计算下一个小数阶段编号。

## 使用 gsd-tools

```bash
# 获取阶段 6 之后的下一个小数阶段
node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase next-decimal 6
```

输出：
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.1",
  "existing": []
}
```

已有小数时：
```json
{
  "found": true,
  "base_phase": "06",
  "next": "06.3",
  "existing": ["06.1", "06.2"]
}
```

## 提取值

```bash
DECIMAL_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase next-decimal "${AFTER_PHASE}")
DECIMAL_PHASE=$(printf '%s\n' "$DECIMAL_INFO" | jq -r '.next')
BASE_PHASE=$(printf '%s\n' "$DECIMAL_INFO" | jq -r '.base_phase')
```

或使用 --raw 标志：
```bash
DECIMAL_PHASE=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" phase next-decimal "${AFTER_PHASE}" --raw)
# 返回: 06.1
```

## 示例

| 已有阶段 | 下一个阶段 |
|----------|------------|
| 仅 06 | 06.1 |
| 06, 06.1 | 06.2 |
| 06, 06.1, 06.2 | 06.3 |
| 06, 06.1, 06.3（有空缺）| 06.4 |

## 目录命名

小数阶段目录使用完整的小数编号：

```bash
SLUG=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" generate-slug "$DESCRIPTION" --raw)
PHASE_DIR=".planning/phases/${DECIMAL_PHASE}-${SLUG}"
mkdir -p "$PHASE_DIR"
```

示例：`.planning/phases/06.1-fix-critical-auth-bug/`