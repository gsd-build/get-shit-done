# 阶段参数解析

为操作阶段的命令解析和规范化阶段参数。

## 提取

从 `$ARGUMENTS` 中：
- 提取阶段编号（第一个数字参数）
- 提取标志（以 `--` 为前缀）
- 剩余文本为描述（用于 insert/add 命令）

## 使用 gsd-tools

`find-phase` 命令一步完成规范化和验证：

```bash
PHASE_INFO=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PHASE}")
```

返回 JSON 包含：
- `found`: true/false
- `directory`: 阶段目录的完整路径
- `phase_number`: 规范化的编号（如 "06"、"06.1"）
- `phase_name`: 名称部分（如 "foundation"）
- `plans`: PLAN.md 文件数组
- `summaries`: SUMMARY.md 文件数组

## 手动规范化（遗留）

将整数阶段补零到 2 位。保留小数后缀。

```bash
# 规范化阶段编号
if [[ "$PHASE" =~ ^[0-9]+$ ]]; then
  # 整数: 8 → 08
  PHASE=$(printf "%02d" "$PHASE")
elif [[ "$PHASE" =~ ^([0-9]+)\.([0-9]+)$ ]]; then
  # 小数: 2.1 → 02.1
  PHASE=$(printf "%02d.%s" "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}")
fi
```

## 验证

使用 `roadmap get-phase` 验证阶段存在：

```bash
PHASE_CHECK=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" roadmap get-phase "${PHASE}")
if [ "$(printf '%s\n' "$PHASE_CHECK" | jq -r '.found')" = "false" ]; then
  echo "ERROR: Phase ${PHASE} not found in roadmap"
  exit 1
fi
```

## 目录查找

使用 `find-phase` 进行目录查找：

```bash
PHASE_DIR=$(node "$HOME/.claude/get-shit-done/bin/gsd-tools.cjs" find-phase "${PHASE}" --raw)
```