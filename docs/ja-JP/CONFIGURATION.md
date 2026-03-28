# GSD 設定リファレンス

> 設定スキーマの全容、ワークフロートグル、モデルプロファイル、Git ブランチオプション。機能の詳細については[機能リファレンス](FEATURES.md)を参照してください。

---

## 設定ファイル

GSD はプロジェクト設定を `.planning/config.json` に保存します。`/gsd:new-project` 実行時に作成され、`/gsd:settings` で更新できます。

### 完全スキーマ

```json
{
  "mode": "interactive",
  "granularity": "standard",
  "model_profile": "balanced",
  "model_overrides": {},
  "planning": {
    "commit_docs": true,
    "search_gitignored": false
  },
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "auto_advance": false,
    "nyquist_validation": true,
    "ui_phase": true,
    "ui_safety_gate": true,
    "node_repair": true,
    "node_repair_budget": 2,
    "research_before_questions": false,
    "discuss_mode": "discuss",
    "skip_discuss": false,
    "text_mode": false
  },
  "hooks": {
    "context_warnings": true,
    "workflow_guard": false
  },
  "parallelization": {
    "enabled": true,
    "plan_level": true,
    "task_level": false,
    "skip_checkpoints": true,
    "max_concurrent_agents": 3,
    "min_plans_for_parallel": 2
  },
  "git": {
    "branching_strategy": "none",
    "phase_branch_template": "gsd/phase-{phase}-{slug}",
    "milestone_branch_template": "gsd/{milestone}-{slug}",
    "quick_branch_template": null
  },
  "gates": {
    "confirm_project": true,
    "confirm_phases": true,
    "confirm_roadmap": true,
    "confirm_breakdown": true,
    "confirm_plan": true,
    "execute_next_plan": true,
    "issues_review": true,
    "confirm_transition": true
  },
  "safety": {
    "always_confirm_destructive": true,
    "always_confirm_external_services": true
  }
}
```

---

## コア設定

| 設定 | 型 | 選択肢 | デフォルト | 説明 |
|------|-----|--------|-----------|------|
| `mode` | enum | `interactive`, `yolo` | `interactive` | `yolo` は判断を自動承認、`interactive` は各ステップで確認 |
| `granularity` | enum | `coarse`, `standard`, `fine` | `standard` | フェーズ数を制御: `coarse`（3〜5）、`standard`（5〜8）、`fine`（8〜12） |
| `model_profile` | enum | `quality`, `balanced`, `budget`, `inherit` | `balanced` | 各エージェントのモデルティア（[モデルプロファイル](#モデルプロファイル)を参照） |

> **注意:** `granularity` は v1.22.3 で `depth` から改名されました。既存の設定は自動的に移行されます。

---

## ワークフロートグル

すべてのワークフロートグルは **未設定 = 有効** のパターンに従います。config にキーが存在しない場合、デフォルトは `true` になります。

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `workflow.research` | boolean | `true` | 各フェーズの計画前にドメイン調査を実施 |
| `workflow.plan_check` | boolean | `true` | プラン検証ループ（最大3回の反復） |
| `workflow.verifier` | boolean | `true` | 実行後にフェーズ目標に対する検証を実施 |
| `workflow.auto_advance` | boolean | `false` | discuss → plan → execute を停止せずに自動連鎖 |
| `workflow.nyquist_validation` | boolean | `true` | plan-phase のリサーチ中にテストカバレッジマッピングを実施 |
| `workflow.ui_phase` | boolean | `true` | フロントエンドフェーズで UI デザインコントラクトを生成 |
| `workflow.ui_safety_gate` | boolean | `true` | plan-phase 中にフロントエンドフェーズに対して /gsd:ui-phase の実行を促すプロンプトを表示 |
| `workflow.node_repair` | boolean | `true` | 検証失敗時にタスクを自律的に修復 |
| `workflow.node_repair_budget` | number | `2` | 失敗タスクあたりの最大修復試行回数 |
| `workflow.research_before_questions` | boolean | `false` | ディスカッション質問の後ではなく前にリサーチを実行 |
| `workflow.discuss_mode` | string | `'discuss'` | `/gsd:discuss-phase` のコンテキスト収集方法を制御。`'discuss'`（デフォルト）は質問を1つずつ行います。`'assumptions'` はまずコードベースを読み取り、信頼度レベル付きの構造化された仮説を生成し、誤っている点のみ修正を求めます。v1.28 で追加 |
| `workflow.skip_discuss` | boolean | `false` | `true` の場合、`/gsd:autonomous` は discuss-phase を完全にスキップし、ROADMAP のフェーズ目標から最小限の CONTEXT.md を作成します。開発者の要望が PROJECT.md/REQUIREMENTS.md に十分に記載されているプロジェクトに適しています。v1.28 で追加 |
| `workflow.text_mode` | boolean | `false` | AskUserQuestion の TUI メニューをプレーンテキストの番号付きリストに置き換えます。TUI メニューが表示されない Claude Code リモートセッション（`/rc` モード）で必要です。discuss-phase で `--text` フラグを使用してセッションごとに設定することもできます。v1.28 で追加 |

### 推奨プリセット

| シナリオ | mode | granularity | profile | research | plan_check | verifier |
|---------|------|-------------|---------|----------|------------|----------|
| プロトタイピング | `yolo` | `coarse` | `budget` | `false` | `false` | `false` |
| 通常の開発 | `interactive` | `standard` | `balanced` | `true` | `true` | `true` |
| 本番リリース | `interactive` | `fine` | `quality` | `true` | `true` | `true` |

---

## プランニング設定

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `planning.commit_docs` | boolean | `true` | `.planning/` ファイルを git にコミットするかどうか |
| `planning.search_gitignored` | boolean | `false` | `.planning/` を含めるために広範な検索に `--no-ignore` を追加 |

### 自動検出

`.planning/` が `.gitignore` に含まれている場合、config.json の設定に関係なく `commit_docs` は自動的に `false` になります。これにより git エラーが防止されます。

---

## フック設定

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `hooks.context_warnings` | boolean | `true` | コンテキストモニターフックによるコンテキストウィンドウ使用量の警告を表示 |
| `hooks.workflow_guard` | boolean | `false` | GSD ワークフローのコンテキスト外でファイル編集が行われた場合に警告（`/gsd:quick` または `/gsd:fast` の使用を推奨） |

プロンプトインジェクションガードフック（`gsd-prompt-guard.js`）は常に有効であり、無効にすることはできません。これはワークフロートグルではなく、セキュリティ機能です。

### プライベートプランニングのセットアップ

プランニング成果物を git から除外するには：

1. `planning.commit_docs: false` と `planning.search_gitignored: true` を設定
2. `.planning/` を `.gitignore` に追加
3. 既にトラッキング済みの場合: `git rm -r --cached .planning/ && git commit -m "chore: stop tracking planning docs"`

---

## 並列化設定

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `parallelization.enabled` | boolean | `true` | 独立したプランを同時に実行 |
| `parallelization.plan_level` | boolean | `true` | プランレベルで並列化 |
| `parallelization.task_level` | boolean | `false` | プラン内のタスクを並列化 |
| `parallelization.skip_checkpoints` | boolean | `true` | 並列実行中にチェックポイントをスキップ |
| `parallelization.max_concurrent_agents` | number | `3` | 同時実行エージェントの最大数 |
| `parallelization.min_plans_for_parallel` | number | `2` | 並列実行をトリガーする最小プラン数 |

> **pre-commit フックと並列実行について**: 並列化が有効な場合、executor エージェントはビルドロックの競合（例: Rust プロジェクトでの cargo lock の競合）を回避するために `--no-verify` でコミットします。オーケストレーターは各ウェーブの完了後にフックを1回検証します。STATE.md の書き込みはファイルレベルのロックで保護され、同時書き込みによる破損を防ぎます。コミットごとにフックを実行する必要がある場合は、`parallelization.enabled: false` に設定してください。

---

## Git ブランチ

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `git.branching_strategy` | enum | `none` | `none`、`phase`、または `milestone` |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | phase 戦略のブランチ名テンプレート |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | milestone 戦略のブランチ名テンプレート |
| `git.quick_branch_template` | string or null | `null` | `/gsd:quick` タスク用のオプションのブランチ名テンプレート |

### 戦略の比較

| 戦略 | ブランチ作成 | スコープ | マージポイント | 適したケース |
|------|------------|---------|--------------|-------------|
| `none` | なし | N/A | N/A | 個人開発、シンプルなプロジェクト |
| `phase` | `execute-phase` 開始時 | 1フェーズ | フェーズ後にユーザーがマージ | フェーズごとのコードレビュー、きめ細かいロールバック |
| `milestone` | 最初の `execute-phase` 時 | マイルストーン内の全フェーズ | `complete-milestone` 時 | リリースブランチ、バージョンごとの PR |

### テンプレート変数

| 変数 | 使用可能な場所 | 例 |
|------|--------------|-----|
| `{phase}` | `phase_branch_template` | `03`（ゼロパディング） |
| `{slug}` | 両方のテンプレート | `user-authentication`（小文字、ハイフン区切り） |
| `{milestone}` | `milestone_branch_template` | `v1.0` |
| `{num}` / `{quick}` | `quick_branch_template` | `260317-abc`（quick タスク ID） |

quick タスクのブランチ設定例：

```json
"git": {
  "quick_branch_template": "gsd/quick-{num}-{slug}"
}
```

### マイルストーン完了時のマージオプション

| オプション | Git コマンド | 結果 |
|-----------|-------------|------|
| スカッシュマージ（推奨） | `git merge --squash` | ブランチごとに1つのクリーンなコミット |
| 履歴付きマージ | `git merge --no-ff` | 個別のコミットをすべて保持 |
| マージせずに削除 | `git branch -D` | ブランチの作業を破棄 |
| ブランチを保持 | （なし） | 後で手動対応 |

---

## ゲート設定

ワークフロー中の確認プロンプトを制御します。

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `gates.confirm_project` | boolean | `true` | 確定前にプロジェクトの詳細を確認 |
| `gates.confirm_phases` | boolean | `true` | フェーズの分割を確認 |
| `gates.confirm_roadmap` | boolean | `true` | 続行前にロードマップを確認 |
| `gates.confirm_breakdown` | boolean | `true` | タスクの分割を確認 |
| `gates.confirm_plan` | boolean | `true` | 実行前に各プランを確認 |
| `gates.execute_next_plan` | boolean | `true` | 次のプラン実行前に確認 |
| `gates.issues_review` | boolean | `true` | 修正プラン作成前に課題をレビュー |
| `gates.confirm_transition` | boolean | `true` | フェーズ遷移を確認 |

---

## セーフティ設定

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `safety.always_confirm_destructive` | boolean | `true` | 破壊的操作（削除、上書き）の確認 |
| `safety.always_confirm_external_services` | boolean | `true` | 外部サービスとのやり取りの確認 |

---

## フック設定

| 設定 | 型 | デフォルト | 説明 |
|------|-----|-----------|------|
| `hooks.context_warnings` | boolean | `true` | セッション中にコンテキストウィンドウの使用量警告を表示 |

---

## モデルプロファイル

### プロファイル定義

| エージェント | `quality` | `balanced` | `budget` | `inherit` |
|------------|-----------|------------|----------|-----------|
| gsd-planner | Opus | Opus | Sonnet | Inherit |
| gsd-roadmapper | Opus | Sonnet | Sonnet | Inherit |
| gsd-executor | Opus | Sonnet | Sonnet | Inherit |
| gsd-phase-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-project-researcher | Opus | Sonnet | Haiku | Inherit |
| gsd-research-synthesizer | Sonnet | Sonnet | Haiku | Inherit |
| gsd-debugger | Opus | Sonnet | Sonnet | Inherit |
| gsd-codebase-mapper | Sonnet | Haiku | Haiku | Inherit |
| gsd-verifier | Sonnet | Sonnet | Haiku | Inherit |
| gsd-plan-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-integration-checker | Sonnet | Sonnet | Haiku | Inherit |
| gsd-nyquist-auditor | Sonnet | Sonnet | Haiku | Inherit |

### エージェントごとのオーバーライド

プロファイル全体を変更せずに特定のエージェントをオーバーライドできます：

```json
{
  "model_profile": "balanced",
  "model_overrides": {
    "gsd-executor": "opus",
    "gsd-planner": "haiku"
  }
}
```

有効なオーバーライド値: `opus`、`sonnet`、`haiku`、`inherit`、または完全修飾モデル ID（例: `"openai/o3"`、`"google/gemini-2.5-pro"`）。

### 非 Claude ランタイム（Codex、OpenCode、Gemini CLI）

GSD が非 Claude ランタイム向けにインストールされると、インストーラーは自動的に `~/.gsd/defaults.json` に `resolve_model_ids: "omit"` を設定します。これにより GSD はすべてのエージェントに対して空のモデルパラメータを返し、各エージェントはランタイムで設定されたモデルを使用します。デフォルトの場合、追加のセットアップは不要です。

異なるエージェントに異なるモデルを使用させたい場合は、ランタイムが認識する完全修飾モデル ID で `model_overrides` を使用してください：

```json
{
  "resolve_model_ids": "omit",
  "model_overrides": {
    "gsd-planner": "o3",
    "gsd-executor": "o4-mini",
    "gsd-debugger": "o3",
    "gsd-codebase-mapper": "o4-mini"
  }
}
```

意図は Claude のプロファイルティアと同じです。計画やデバッグ（推論品質が最も重要な部分）にはより強力なモデルを使用し、実行やマッピング（プランに既に推論が含まれている部分）にはより安価なモデルを使用します。

**どのアプローチを使うべきか：**

| シナリオ | 設定 | 効果 |
|---------|------|------|
| 非 Claude ランタイム、単一モデル | `resolve_model_ids: "omit"`（インストーラーのデフォルト） | すべてのエージェントがランタイムのデフォルトモデルを使用 |
| 非 Claude ランタイム、ティアードモデル | `resolve_model_ids: "omit"` + `model_overrides` | 指定されたエージェントは特定のモデルを使用、それ以外はランタイムのデフォルト |
| Claude Code + OpenRouter/ローカルプロバイダー | `model_profile: "inherit"` | すべてのエージェントがセッションモデルに従う |
| Claude Code + OpenRouter、ティアード | `model_profile: "inherit"` + `model_overrides` | 指定されたエージェントは特定のモデルを使用、それ以外は継承 |

**`resolve_model_ids` の値：**

| 値 | 動作 | 使用場面 |
|----|------|---------|
| `false`（デフォルト） | Claude エイリアス（`opus`、`sonnet`、`haiku`）を返す | Claude Code + ネイティブ Anthropic API |
| `true` | エイリアスを完全な Claude モデル ID（`claude-opus-4-0`）にマッピング | 完全な ID が必要な API を使用する Claude Code |
| `"omit"` | 空文字列を返す（ランタイムがデフォルトを選択） | 非 Claude ランタイム（Codex、OpenCode、Gemini CLI） |

### プロファイルの設計思想

| プロファイル | 設計思想 | 使用場面 |
|------------|---------|---------|
| `quality` | すべての意思決定に Opus、検証に Sonnet | クォータに余裕がある場合、重要なアーキテクチャ作業 |
| `balanced` | 計画のみ Opus、それ以外は Sonnet | 通常の開発（デフォルト） |
| `budget` | コード記述に Sonnet、リサーチ/検証に Haiku | 大量の作業、重要度の低いフェーズ |
| `inherit` | すべてのエージェントが現在のセッションモデルを使用 | 動的なモデル切り替え、**非 Anthropic プロバイダー**（OpenRouter、ローカルモデル） |

---

## 環境変数

| 変数 | 用途 |
|------|------|
| `CLAUDE_CONFIG_DIR` | デフォルトの設定ディレクトリ（`~/.claude/`）をオーバーライド |
| `GEMINI_API_KEY` | コンテキストモニターがフックイベント名を切り替えるために検出 |
| `WSL_DISTRO_NAME` | インストーラーが WSL のパス処理のために検出 |

---

## グローバルデフォルト

将来のプロジェクト向けにグローバルデフォルトとして設定を保存できます。

**保存場所:** `~/.gsd/defaults.json`

`/gsd:new-project` が新しい `config.json` を作成する際、グローバルデフォルトを読み込み、初期設定としてマージします。プロジェクトごとの設定は常にグローバル設定を上書きします。
