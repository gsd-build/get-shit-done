# 检查点

计划自主执行。检查点用于规范化需要人工验证或决策的交互点。

**核心原则：** Claude 用 CLI/API 自动化一切。检查点用于验证和决策，而非手动工作。

**黄金法则：**
1. **如果 Claude 能运行，Claude 就运行** - 绝不让用户执行 CLI 命令、启动服务器或运行构建
2. **Claude 设置验证环境** - 启动开发服务器、填充数据库、配置环境变量
3. **用户只做需要人工判断的事** - 视觉检查、UX 评估、"这个感觉对吗？"
4. **密钥来自用户，自动化来自 Claude** - 询问 API 密钥，然后 Claude 通过 CLI 使用它们
5. **自动模式绕过验证/决策检查点** — 当 config 中 `workflow._auto_chain_active` 或 `workflow.auto_advance` 为 true 时：human-verify 自动批准，decision 自动选择第一个选项，human-action 仍会停止（认证门控无法自动化）

## 检查点类型

### checkpoint:human-verify（最常见 - 90%）

**何时使用：** Claude 完成自动化工作，人工确认其正常工作。

**用于：**
- 视觉 UI 检查（布局、样式、响应式）
- 交互流程（点击向导、测试用户流程）
- 功能验证（功能按预期工作）
- 音频/视频播放质量
- 动画流畅度
- 无障碍测试

**结构：**
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>[Claude 自动化并部署/构建的内容]</what-built>
  <how-to-verify>
    [测试的确切步骤 - URL、命令、预期行为]
  </how-to-verify>
  <resume-signal>[如何继续 - "approved"、"yes" 或描述问题]</resume-signal>
</task>
```

**示例：UI 组件（展示关键模式：Claude 在检查点之前启动服务器）**
```xml
<task type="auto">
  <name>构建响应式仪表板布局</name>
  <files>src/components/Dashboard.tsx, src/app/dashboard/page.tsx</files>
  <action>创建带侧边栏、标题和内容区域的仪表板。使用 Tailwind 响应式类处理移动端。</action>
  <verify>npm run build 成功，无 TypeScript 错误</verify>
  <done>仪表板组件构建无错误</done>
</task>

<task type="auto">
  <name>启动开发服务器用于验证</name>
  <action>在后台运行 `npm run dev`，等待 "ready" 消息，捕获端口</action>
  <verify>curl http://localhost:3000 返回 200</verify>
  <done>开发服务器运行于 http://localhost:3000</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>响应式仪表板布局 - 开发服务器运行于 http://localhost:3000</what-built>
  <how-to-verify>
    访问 http://localhost:3000/dashboard 并验证：
    1. 桌面端 (>1024px): 左侧边栏，右侧内容，顶部标题
    2. 平板端 (768px): 侧边栏折叠为汉堡菜单
    3. 移动端 (375px): 单列布局，出现底部导航
    4. 任何尺寸无布局偏移或水平滚动
  </how-to-verify>
  <resume-signal>输入 "approved" 或描述布局问题</resume-signal>
</task>
```

### checkpoint:decision（9%）

**何时使用：** 人工必须做出影响实现方向的选择。

**用于：**
- 技术选型（哪个认证提供商、哪个数据库）
- 架构决策（monorepo 还是独立仓库）
- 设计选择（配色方案、布局方式）
- 功能优先级（构建哪个变体）
- 数据模型决策（模式结构）

**结构：**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>[正在决策的内容]</decision>
  <context>[为什么这个决策重要]</context>
  <options>
    <option id="option-a">
      <name>[选项名称]</name>
      <pros>[好处]</pros>
      <cons>[权衡]</cons>
    </option>
    <option id="option-b">
      <name>[选项名称]</name>
      <pros>[好处]</pros>
      <cons>[权衡]</cons>
    </option>
  </options>
  <resume-signal>[如何表明选择]</resume-signal>
</task>
```

**示例：认证提供商选择**
```xml
<task type="checkpoint:decision" gate="blocking">
  <decision>选择认证提供商</decision>
  <context>
    应用需要用户认证。三个可靠选项各有权衡。
  </context>
  <options>
    <option id="supabase">
      <name>Supabase Auth</name>
      <pros>与我们使用的 Supabase DB 内置集成，慷慨的免费额度，行级安全集成</pros>
      <cons>UI 定制性较差，绑定 Supabase 生态</cons>
    </option>
    <option id="clerk">
      <name>Clerk</name>
      <pros>精美的预构建 UI，最佳开发体验，优秀文档</pros>
      <cons>10k MAU 后付费，供应商锁定</cons>
    </option>
    <option id="nextauth">
      <name>NextAuth.js</name>
      <pros>免费，自托管，最大控制权，广泛采用</pros>
      <cons>更多设置工作，需自行管理安全更新，UI 需自己构建</cons>
    </option>
  </options>
  <resume-signal>选择：supabase、clerk 或 nextauth</resume-signal>
</task>
```

### checkpoint:human-action（1% - 罕见）

**何时使用：** 操作没有 CLI/API 且需要仅人工交互，或者 Claude 在自动化过程中遇到认证门控。

**仅用于：**
- **认证门控** - Claude 尝试了 CLI/API 但需要凭证（这不是失败）
- 邮箱验证链接（点击邮件）
- 短信两步验证码（手机验证）
- 人工账户审批（平台需要人工审核）
- 信用卡 3D Secure 流程（基于 Web 的支付授权）
- OAuth 应用审批（基于 Web 的审批）

**不要用于预定的手动工作：**
- 部署（使用 CLI - 如需要则认证门控）
- 创建 webhooks/数据库（使用 API/CLI - 如需要则认证门控）
- 运行构建/测试（使用 Bash 工具）
- 创建文件（使用 Write 工具）

**结构：**
```xml
<task type="checkpoint:human-action" gate="blocking">
  <action>[人工必须做什么 - Claude 已完成所有可自动化的]</action>
  <instructions>
    [Claude 已自动化的内容]
    [需要人工操作的一件事]
  </instructions>
  <verification>[Claude 之后可以检查的内容]</verification>
  <resume-signal>[如何继续]</resume-signal>
</task>
```

**示例：认证门控（动态检查点）**
```xml
<task type="auto">
  <name>部署到 Vercel</name>
  <files>.vercel/, vercel.json</files>
  <action>运行 `vercel --yes` 进行部署</action>
  <verify>vercel ls 显示部署，curl 返回 200</verify>
</task>

<!-- 如果 vercel 返回 "Error: Not authenticated"，Claude 即时创建检查点 -->

<task type="checkpoint:human-action" gate="blocking">
  <action>认证 Vercel CLI 以便我继续部署</action>
  <instructions>
    我尝试部署但收到认证错误。
    运行：vercel login
    这将打开你的浏览器 - 完成认证流程。
  </instructions>
  <verification>vercel whoami 返回你的账户邮箱</verification>
  <resume-signal>认证完成后输入 "done"</resume-signal>
</task>

<!-- 认证后，Claude 重试部署 -->

<task type="auto">
  <name>重试 Vercel 部署</name>
  <action>运行 `vercel --yes`（已认证）</action>
  <verify>vercel ls 显示部署，curl 返回 200</verify>
</task>
```

**关键区别：** 认证门控是 Claude 遇到认证错误时动态创建的。不是预定的 — Claude 先自动化，只有在被阻止时才请求凭证。

## 执行协议

当 Claude 遇到 `type="checkpoint:*"` 时：

1. **立即停止** - 不继续下一个任务
2. **清晰显示检查点** 使用下面的格式
3. **等待用户响应** - 不幻想完成
4. **如可能则验证** - 检查文件、运行测试、任何指定的内容
5. **恢复执行** - 仅在确认后继续下一个任务

**对于 checkpoint:human-verify:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: 需要验证                                  ║
╚═══════════════════════════════════════════════════════╝

进度: 5/8 任务完成
任务: 响应式仪表板布局

已构建: /dashboard 的响应式仪表板

如何验证:
  1. 访问: http://localhost:3000/dashboard
  2. 桌面端 (>1024px): 侧边栏可见，内容填充剩余空间
  3. 平板端 (768px): 侧边栏折叠为图标
  4. 移动端 (375px): 侧边栏隐藏，出现汉堡菜单

────────────────────────────────────────────────────────
→ 你的操作: 输入 "approved" 或描述问题
────────────────────────────────────────────────────────
```

**对于 checkpoint:decision:**
```
╔═══════════════════════════════════════════════════════╗
║  CHECKPOINT: 需要决策                                  ║
╚═══════════════════════════════════════════════════════╝

进度: 2/6 任务完成
任务: 选择认证提供商

决策: 我们应该使用哪个认证提供商？

上下文: 需要用户认证。三个选项各有权衡。

选项:
  1. supabase - 与我们的数据库内置集成，免费额度
     优点: 行级安全集成，慷慨的免费额度
     缺点: UI 定制性较差，生态锁定

  2. clerk - 最佳 DX，10k 用户后付费
     优点: 精美的预构建 UI，优秀文档
     缺点: 供应商锁定，规模化时价格问题

  3. nextauth - 自托管，最大控制权
     优点: 免费，无供应商锁定，广泛采用
     缺点: 更多设置工作，自行 DIY 安全更新

────────────────────────────────────────────────────────
→ 你的操作: 选择 supabase、clerk 或 nextauth
────────────────────────────────────────────────────────
```

## 认证门控

**认证门控 = Claude 尝试了 CLI/API，收到认证错误。** 不是失败 — 是需要人工输入来解除阻止的门控。

**模式：** Claude 尝试自动化 → 认证错误 → 创建 checkpoint:human-action → 用户认证 → Claude 重试 → 继续

**门控协议：**
1. 认识到这不是失败 - 缺少认证是正常的
2. 停止当前任务 - 不要反复重试
3. 动态创建 checkpoint:human-action
4. 提供确切的认证步骤
5. 验证认证有效
6. 重试原始任务
7. 正常继续

**关键区别：**
- 预定的检查点："我需要你做 X"（错误 - Claude 应该自动化）
- 认证门控："我尝试自动化 X 但需要凭证"（正确 - 解除自动化阻止）

## 自动化参考

**规则：** 如果有 CLI/API，Claude 就做。绝不让人工执行可自动化的工作。

### 服务 CLI 参考

| 服务 | CLI/API | 关键命令 | 认证门控 |
|------|---------|----------|----------|
| Vercel | `vercel` | `--yes`, `env add`, `--prod`, `ls` | `vercel login` |
| Railway | `railway` | `init`, `up`, `variables set` | `railway login` |
| Fly | `fly` | `launch`, `deploy`, `secrets set` | `fly auth login` |
| Stripe | `stripe` + API | `listen`, `trigger`, API 调用 | .env 中的 API key |
| Supabase | `supabase` | `init`, `link`, `db push`, `gen types` | `supabase login` |
| Upstash | `upstash` | `redis create`, `redis get` | `upstash auth login` |
| PlanetScale | `pscale` | `database create`, `branch create` | `pscale auth login` |
| GitHub | `gh` | `repo create`, `pr create`, `secret set` | `gh auth login` |
| Node | `npm`/`pnpm` | `install`, `run build`, `test`, `run dev` | N/A |
| Xcode | `xcodebuild` | `-project`, `-scheme`, `build`, `test` | N/A |
| Convex | `npx convex` | `dev`, `deploy`, `env set`, `env get` | `npx convex login` |

### 环境变量自动化

**Env 文件：** 使用 Write/Edit 工具。绝不让用户手动创建 .env。

**通过 CLI 的仪表板环境变量：**

| 平台 | CLI 命令 | 示例 |
|------|----------|------|
| Convex | `npx convex env set` | `npx convex env set OPENAI_API_KEY sk-...` |
| Vercel | `vercel env add` | `vercel env add STRIPE_KEY production` |
| Railway | `railway variables set` | `railway variables set API_KEY=value` |
| Fly | `fly secrets set` | `fly secrets set DATABASE_URL=...` |
| Supabase | `supabase secrets set` | `supabase secrets set MY_SECRET=value` |

### 开发服务器自动化

| 框架 | 启动命令 | 就绪信号 | 默认 URL |
|------|----------|----------|----------|
| Next.js | `npm run dev` | "Ready in" 或 "started server" | http://localhost:3000 |
| Vite | `npm run dev` | "ready in" | http://localhost:5173 |
| Convex | `npx convex dev` | "Convex functions ready" | N/A（仅后端）|
| Express | `npm start` | "listening on port" | http://localhost:3000 |
| Django | `python manage.py runserver` | "Starting development server" | http://localhost:8000 |

**服务器生命周期：**
```bash
# 后台运行，捕获 PID
npm run dev &
DEV_SERVER_PID=$!

# 等待就绪（最多 30s）
timeout 30 bash -c 'until curl -s localhost:3000 > /dev/null 2>&1; do sleep 1; done'
```

**端口冲突：** 终止陈旧进程（`lsof -ti:3000 | xargs kill`）或使用备用端口（`--port 3001`）。

**服务器保持运行** 直到检查点结束。仅在计划完成、切换到生产环境或端口需要用于不同服务时终止。

### CLI 安装处理

| CLI | 自动安装？ | 命令 |
|-----|------------|------|
| npm/pnpm/yarn | 否 - 询问用户 | 用户选择包管理器 |
| vercel | 是 | `npm i -g vercel` |
| gh (GitHub) | 是 | `brew install gh` (macOS) 或 `apt install gh` (Linux) |
| stripe | 是 | `npm i -g stripe` |
| supabase | 是 | `npm i -g supabase` |
| convex | 否 - 使用 npx | `npx convex`（无需安装）|
| fly | 是 | `brew install flyctl` 或 curl 安装器 |
| railway | 是 | `npm i -g @railway/cli` |

**协议：** 尝试命令 → "command not found" → 可自动安装？→ 是：静默安装，重试 → 否：检查点请求用户安装。

## 检查点前自动化失败处理

| 失败 | 响应 |
|------|------|
| 服务器无法启动 | 检查错误，修复问题，重试（不进入检查点）|
| 端口被占用 | 终止陈旧进程或使用备用端口 |
| 缺少依赖 | 运行 `npm install`，重试 |
| 构建错误 | 先修复错误（是 bug，不是检查点问题）|
| 认证错误 | 创建认证门控检查点 |
| 网络超时 | 带退避重试，如果持续则检查点 |

**绝不呈现验证环境损坏的检查点。** 如果 `curl localhost:3000` 失败，不要让用户"访问 localhost:3000"。

## 可自动化快速参考

| 操作 | 可自动化？| Claude 做？|
|------|------------|------------|
| 部署到 Vercel | 是 (`vercel`) | 是 |
| 创建 Stripe webhook | 是 (API) | 是 |
| 写入 .env 文件 | 是 (Write 工具) | 是 |
| 创建 Upstash DB | 是 (`upstash`) | 是 |
| 运行测试 | 是 (`npm test`) | 是 |
| 启动开发服务器 | 是 (`npm run dev`) | 是 |
| 添加环境变量到 Convex | 是 (`npx convex env set`) | 是 |
| 添加环境变量到 Vercel | 是 (`vercel env add`) | 是 |
| 填充数据库 | 是 (CLI/API) | 是 |
| 点击邮件验证链接 | 否 | 否 |
| 输入带 3DS 的信用卡 | 否 | 否 |
| 在浏览器中完成 OAuth | 否 | 否 |
| 视觉验证 UI 是否正确 | 否 | 否 |
| 测试交互式用户流程 | 否 | 否 |

## 反模式

### ❌ 错误：让用户启动开发服务器
```xml
<task type="checkpoint:human-verify" gate="blocking">
  <what-built>仪表板组件</what-built>
  <how-to-verify>
    1. 运行: npm run dev
    2. 访问: http://localhost:3000/dashboard
    3. 检查布局是否正确
  </how-to-verify>
</task>
```
**为什么错误：** Claude 可以运行 `npm run dev`。用户应该只访问 URL，不执行命令。

### ✅ 正确：Claude 启动服务器，用户访问
```xml
<task type="auto">
  <name>启动开发服务器</name>
  <action>在后台运行 `npm run dev`</action>
  <verify>curl localhost:3000 返回 200</verify>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>http://localhost:3000/dashboard 的仪表板（服务器运行中）</what-built>
  <how-to-verify>
    访问 http://localhost:3000/dashboard 并验证：
    1. 布局匹配设计
    2. 无控制台错误
  </how-to-verify>
</task>
```

### ❌ 错误：让用户部署 / ✅ 正确：Claude 自动化
```xml
<!-- 错误：让用户通过仪表板部署 -->
<task type="checkpoint:human-action" gate="blocking">
  <action>部署到 Vercel</action>
  <instructions>访问 vercel.com/new → 导入仓库 → 点击部署 → 复制 URL</instructions>
</task>

<!-- 正确：Claude 部署，用户验证 -->
<task type="auto">
  <name>部署到 Vercel</name>
  <action>运行 `vercel --yes`。捕获 URL。</action>
  <verify>vercel ls 显示部署，curl 返回 200</verify>
</task>

<task type="checkpoint:human-verify">
  <what-built>已部署到 {url}</what-built>
  <how-to-verify>访问 {url}，检查首页加载</how-to-verify>
  <resume-signal>输入 "approved"</resume-signal>
</task>
```

## 摘要

检查点规范化人工介入点用于验证和决策，而非手动工作。

**黄金法则：** 如果 Claude 能自动化它，Claude 就必须自动化它。

**检查点优先级：**
1. **checkpoint:human-verify**（90%）- Claude 自动化一切，人工确认视觉/功能正确性
2. **checkpoint:decision**（9%）- 人工做出架构/技术选择
3. **checkpoint:human-action**（1%）- 真正无法避免的、没有 API/CLI 的手动步骤

**何时不用检查点：**
- Claude 可以编程验证的事情（测试、构建）
- 文件操作（Claude 可以读取文件）
- 代码正确性（测试和静态分析）
- 任何可通过 CLI/API 自动化的内容