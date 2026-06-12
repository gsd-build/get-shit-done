<purpose>
One-page newcomer-oriented tour of GSD. Output ONLY the `<reference>` content below. No additions.
</purpose>

<reference>
# GSD — Get Shit Done

面向 Claude Code 单智能体开发的计划驱动开发系统。GSD 将模糊想法转化为层级化计划，然后通过状态跟踪和原子提交逐阶段执行。

## 从这里开始（3 个命令）

```text
/gsd:new-project        # 全新项目：提问 → 研究 → 需求 → 路线图
/gsd:plan-phase 1       # 为阶段 1 创建详细计划
/gsd:execute-phase 1    # 执行阶段中的所有计划
```

已有代码库？先运行 `/gsd:map-codebase` 让 GSD 理解你的代码。

## 常用命令

| 命令 | 用途 |
|------|------|
| `/gsd:progress` | 我在哪、下一步是什么 — 也支持 `--do "..."` 路由自由文本 |
| `/gsd:quick` | 小型临时任务，保留 GSD 保障（规划目录 + 原子提交） |
| `/gsd:fast "<task>"` | 简单内联修改 — 无子代理，≤3 个文件编辑 |
| `/gsd:discuss-phase <N>` | 规划前捕获愿景和决策 |
| `/gsd:debug "<symptom>"` | 持久调试会话，跨 `/clear` 保持 |
| `/gsd:capture` | 保存想法、待办、笔记、种子或积压项 |
| `/gsd:verify-work <N>` | 已完成阶段的对话式 UAT |
| `/gsd:ship <N>` | 从已完成阶段创建 PR |
| `/gsd:help --full` | 完整参考（所有命令、所有标志） |

## 想了解更多？

```text
/gsd:help --brief         # 10 行核心命令速览
/gsd:help --full          # 完整参考
/gsd:help <topic>         # 仅显示某一章节 — 见下方主题列表
/gsd:help --brief <topic> # 紧凑范围查询 — 签名 + 一行摘要
```

主题：`workflow` · `planning` · `execute` · `quick` · `debug` · `capture` · `ship` · `config` · `milestones` · `spike` · `sketch` · `review` · `audit` · `progress`

## 更新 GSD

```bash
npx get-shit-done-cc@latest
```
</reference>
