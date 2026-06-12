<purpose>
Emit a section from the full reference for the topic in `$ARGUMENTS`. Read `workflows/help/modes/zh-CN/full.md`, resolve the topic alias to a section heading using the table below, and output the resolved-routing preamble plus the section content. Scope is controlled by a `--brief` flag in `$ARGUMENTS`: full scope (default) emits the entire section; compact scope (`--brief <topic>`) emits only the signature line + one-line summary for a compact scoped lookup. No additions, no surrounding chrome.
</purpose>

<reference>
**Topic resolution table.** Match the topic alias case-insensitively. Strip a single leading `--` if present.

| Topic alias(es) | Section heading in `zh-CN/full.md` |
|---|---|
| `workflow`, `core`, `core-workflow` | `## 核心工作流`（从该节到 `### 快速模式` 末尾） |
| `init`, `new-project` | `### 项目初始化` |
| `map`, `map-codebase` | `### 项目初始化` 下的 `/gsd:map-codebase` 块 |
| `discuss`, `discuss-phase` | `### 阶段规划` 下的 `/gsd:discuss-phase` 块 |
| `plan`, `planning`, `plan-phase` | `### 阶段规划` |
| `execute`, `exec`, `execute-phase` | `### 执行` |
| `progress`, `route` | `### 进度跟踪` 加 `### 智能路由器` |
| `quick`, `quick-mode` | `### 快速模式` |
| `fast` | `### 快速模式` 下的 `/gsd:fast` 块 |
| `phase`, `phases`, `roadmap` | `### 路线图管理` |
| `milestone`, `milestones` | `### 里程碑管理` 加 `### 里程碑审计` |
| `session`, `pause`, `resume` | `### 会话管理` |
| `debug`, `debugging` | `### 调试` |
| `spike` | `### 快速试验与草图` 下的 `/gsd:spike` 和 `/gsd:spike --wrap-up` 块 |
| `sketch` | `### 快速试验与草图` 下的 `/gsd:sketch` 和 `/gsd:sketch --wrap-up` 块 |
| `spike-sketch`, `experiments` | `### 快速试验与草图` |
| `capture`, `notes`, `todos` | `### 捕获想法、笔记和待办事项` |
| `verify`, `verify-work`, `uat` | `### 用户验收测试` 加 `/gsd:audit-uat` 块 |
| `ship`, `pr` | `### 发布工作` 加 `/gsd:pr-branch` 块 |
| `review`, `peer-review` | `### 发布工作` 下的 `/gsd:review` 块 |
| `audit`, `auditing`, `audit-milestone` | `### 里程碑审计` |
| `config`, `settings`, `configuration` | `### 配置` |
| `cleanup` | `### 实用命令` 下的 `/gsd:cleanup` 块 |
| `update` | `### 实用命令` 下的 `/gsd:update` 块 |
| `files`, `structure`, `layout` | `## 文件与结构` |
| `modes`, `interactive`, `yolo` | `## 工作流模式` |
| `planning-config` | `## 规划配置` |
| `workflows`, `common-workflows`, `examples` | `## 常见工作流` |
| `help` | `## 获取帮助` |

**Output rules:**

1. Parse `$ARGUMENTS`: detect a `--brief` (or `-b`) flag — this selects **compact scope**. Otherwise scope is **full**. Strip the flag, then take the remaining token (with a single leading `--` stripped) as the topic alias.
2. Resolve the alias against the table.
3. If no match: emit a one-line error followed by a comma-separated list of the canonical topic names from the leftmost column (one per row, deduplicated). Suggest `/gsd:help --full` for the complete reference. Stop.
4. If matched: emit a single resolved-routing preamble line so the user sees what was matched:

   ```text
   **Topic:** `<alias>` → `<heading>` *(scope: full | compact)*
   ```

   Use the canonical alias from the leftmost column. Use the literal heading text from the matched cell. State the scope you are about to emit.

5. Read `workflows/help/modes/zh-CN/full.md`. Strip `<reference>` / `</reference>` wrapper tags — never emit them. Apply the extraction rule for the matched table cell, modulated by scope:

   5a. **Single section** (cell contains a single `` `## Heading` `` or `` `### Heading` ``):
   - *Full scope:* emit from that heading up to (but not including) the next sibling or higher-level heading.
   - *Compact scope:* emit the heading, then the first `` **`/gsd:...`** `` bold line within the section (the signature) and the single non-blank line immediately after it (the one-line summary). If the section has no `` **`/gsd:...`** `` bold line, emit the heading and the first paragraph.

   5b. **Multiple sections joined by "plus"**: apply rule 5a to each listed section in document order and emit them sequentially with no gap between them.

   5c. **Sub-block** (cell says `the /gsd:X block under ### Heading` or `the /gsd:X ... blocks under ### Heading`): within the named heading's section, start at each `` **`/gsd:X ...`** `` bold line.
   - *Full scope:* stop immediately before the next `` **`/gsd:...`** `` bold line or the next heading, whichever comes first.
   - *Compact scope:* emit the bold line and the single non-blank line immediately after it (the one-line summary).

   For cells listing multiple sub-blocks, emit them sequentially.

6. After the section content, emit a single closing line:

   ```text
   More: /gsd:help --full · /gsd:help <topic> · /gsd:help --brief <topic>
   ```

7. No project-specific commentary, no follow-up questions.
</reference>
