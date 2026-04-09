# GSD CLI ツールリファレンス

> `gsd-tools.cjs` のプログラマティック API リファレンスです。ワークフローやエージェントが内部的に使用します。ユーザー向けコマンドについては、[コマンドリファレンス](COMMANDS.md) を参照してください。

---

## 概要

`gsd-tools.cjs` は、GSD の約50個のコマンド、ワークフロー、エージェントファイル全体で繰り返し使われるインライン bash パターンを置き換える Node.js CLI ユーティリティです。設定の解析、モデル解決、フェーズ検索、git コミット、サマリー検証、状態管理、テンプレート操作を一元化しています。

**配置場所:** `get-shit-done/bin/gsd-tools.cjs`
**モジュール:** `get-shit-done/bin/lib/` 内の15個のドメインモジュール

**使い方:**
```bash
node gsd-tools.cjs <command> [args] [--raw] [--cwd <path>]
```

**グローバルフラグ:**
| フラグ | 説明 |
|--------|------|
| `--raw` | 機械可読な出力（JSON またはプレーンテキスト、フォーマットなし） |
| `--cwd <path>` | 作業ディレクトリの上書き（サンドボックス化されたサブエージェント向け） |

---

## State コマンド

`.planning/STATE.md` を管理します — プロジェクトの生きた記憶です。

```bash
# プロジェクトの全設定 + 状態を JSON として読み込む
node gsd-tools.cjs state load

# STATE.md のフロントマターを JSON として出力
node gsd-tools.cjs state json

# 単一フィールドを更新
node gsd-tools.cjs state update <field> <value>

# STATE.md の内容または特定セクションを取得
node gsd-tools.cjs state get [section]

# 複数フィールドの一括更新
node gsd-tools.cjs state patch --field1 val1 --field2 val2

# プランカウンターをインクリメント
node gsd-tools.cjs state advance-plan

# 実行メトリクスを記録
node gsd-tools.cjs state record-metric --phase N --plan M --duration Xmin [--tasks N] [--files N]

# プログレスバーを再計算
node gsd-tools.cjs state update-progress

# 決定事項を追加
node gsd-tools.cjs state add-decision --summary "..." [--phase N] [--rationale "..."]
# ファイルから追加する場合:
node gsd-tools.cjs state add-decision --summary-file path [--rationale-file path]

# ブロッカーの追加・解決
node gsd-tools.cjs state add-blocker --text "..."
node gsd-tools.cjs state resolve-blocker --text "..."

# セッション継続性を記録
node gsd-tools.cjs state record-session --stopped-at "..." [--resume-file path]
```

### State スナップショット

STATE.md 全体の構造化パース:

```bash
node gsd-tools.cjs state-snapshot
```

現在位置、フェーズ、プラン、ステータス、決定事項、ブロッカー、メトリクス、最終アクティビティを含む JSON を返します。

---

## Phase コマンド

フェーズを管理します — ディレクトリ、番号付け、ロードマップとの同期。

```bash
# 番号でフェーズディレクトリを検索
node gsd-tools.cjs find-phase <phase>

# 挿入用の次の小数フェーズ番号を計算
node gsd-tools.cjs phase next-decimal <phase>

# ロードマップに新しいフェーズを追加 + ディレクトリを作成
node gsd-tools.cjs phase add <description>

# 既存フェーズの後に小数フェーズを挿入
node gsd-tools.cjs phase insert <after> <description>

# フェーズを削除し、後続を振り直し
node gsd-tools.cjs phase remove <phase> [--force]

# フェーズを完了としてマークし、状態 + ロードマップを更新
node gsd-tools.cjs phase complete <phase>

# ウェーブとステータス付きでプランをインデックス化
node gsd-tools.cjs phase-plan-index <phase>

# フィルタリング付きでフェーズを一覧表示
node gsd-tools.cjs phases list [--type planned|executed|all] [--phase N] [--include-archived]
```

---

## Roadmap コマンド

`ROADMAP.md` の解析と更新。

```bash
# ROADMAP.md からフェーズセクションを抽出
node gsd-tools.cjs roadmap get-phase <phase>

# ディスク状態を含む完全なロードマップ解析
node gsd-tools.cjs roadmap analyze

# ディスクからプログレステーブル行を更新
node gsd-tools.cjs roadmap update-plan-progress <N>
```

---

## Config コマンド

`.planning/config.json` の読み書き。

```bash
# デフォルト値で config.json を初期化
node gsd-tools.cjs config-ensure-section

# 設定値をセット（ドット記法）
node gsd-tools.cjs config-set <key> <value>

# 設定値を取得
node gsd-tools.cjs config-get <key>

# モデルプロファイルを設定
node gsd-tools.cjs config-set-model-profile <profile>
```

---

## モデル解決

```bash
# 現在のプロファイルに基づいてエージェント用モデルを取得
node gsd-tools.cjs resolve-model <agent-name>
# 戻り値: opus | sonnet | haiku | inherit
```

エージェント名: `gsd-planner`, `gsd-executor`, `gsd-phase-researcher`, `gsd-project-researcher`, `gsd-research-synthesizer`, `gsd-verifier`, `gsd-plan-checker`, `gsd-integration-checker`, `gsd-roadmapper`, `gsd-debugger`, `gsd-codebase-mapper`, `gsd-nyquist-auditor`

---

## Verification コマンド

プラン、フェーズ、参照、コミットを検証します。

```bash
# SUMMARY.md ファイルを検証
node gsd-tools.cjs verify-summary <path> [--check-count N]

# PLAN.md の構造 + タスクをチェック
node gsd-tools.cjs verify plan-structure <file>

# 全プランにサマリーがあるか確認
node gsd-tools.cjs verify phase-completeness <phase>

# @参照 + パスが解決可能か確認
node gsd-tools.cjs verify references <file>

# コミットハッシュの一括検証
node gsd-tools.cjs verify commits <hash1> [hash2] ...

# must_haves.artifacts をチェック
node gsd-tools.cjs verify artifacts <plan-file>

# must_haves.key_links をチェック
node gsd-tools.cjs verify key-links <plan-file>
```

---

## Validation コマンド

プロジェクトの整合性をチェックします。

```bash
# フェーズ番号、ディスク/ロードマップの同期を確認
node gsd-tools.cjs validate consistency

# .planning/ の整合性チェック、任意で修復
node gsd-tools.cjs validate health [--repair]
```

---

## Template コマンド

テンプレートの選択と穴埋め。

```bash
# 粒度に基づいてサマリーテンプレートを選択
node gsd-tools.cjs template select <type>

# 変数でテンプレートを穴埋め
node gsd-tools.cjs template fill <type> --phase N [--plan M] [--name "..."] [--type execute|tdd] [--wave N] [--fields '{json}']
```

`fill` のテンプレートタイプ: `summary`, `plan`, `verification`

---

## Frontmatter コマンド

任意の Markdown ファイルに対する YAML フロントマターの CRUD 操作。

```bash
# フロントマターを JSON として抽出
node gsd-tools.cjs frontmatter get <file> [--field key]

# 単一フィールドを更新
node gsd-tools.cjs frontmatter set <file> --field key --value jsonVal

# JSON をフロントマターにマージ
node gsd-tools.cjs frontmatter merge <file> --data '{json}'

# 必須フィールドを検証
node gsd-tools.cjs frontmatter validate <file> --schema plan|summary|verification
```

---

## Scaffold コマンド

事前構造化されたファイルとディレクトリを作成します。

```bash
# CONTEXT.md テンプレートを作成
node gsd-tools.cjs scaffold context --phase N

# UAT.md テンプレートを作成
node gsd-tools.cjs scaffold uat --phase N

# VERIFICATION.md テンプレートを作成
node gsd-tools.cjs scaffold verification --phase N

# フェーズディレクトリを作成
node gsd-tools.cjs scaffold phase-dir --phase N --name "phase name"
```

---

## Init コマンド（複合コンテキスト読み込み）

特定のワークフローに必要なすべてのコンテキストを一度に読み込みます。プロジェクト情報、設定、状態、ワークフロー固有のデータを含む JSON を返します。

```bash
node gsd-tools.cjs init execute-phase <phase>
node gsd-tools.cjs init plan-phase <phase>
node gsd-tools.cjs init new-project
node gsd-tools.cjs init new-milestone
node gsd-tools.cjs init quick <description>
node gsd-tools.cjs init resume
node gsd-tools.cjs init verify-work <phase>
node gsd-tools.cjs init phase-op <phase>
node gsd-tools.cjs init todos [area]
node gsd-tools.cjs init milestone-op
node gsd-tools.cjs init map-codebase
node gsd-tools.cjs init progress
```

**大容量ペイロードの処理:** 出力が約50KBを超える場合、CLI は一時ファイルに書き出し、`@file:/tmp/gsd-init-XXXXX.json` を返します。ワークフローは `@file:` プレフィックスを確認し、ディスクから読み込みます:

```bash
INIT=$(node gsd-tools.cjs init execute-phase "1")
if [[ "$INIT" == @file:* ]]; then INIT=$(cat "${INIT#@file:}"); fi
```

---

## Milestone コマンド

```bash
# マイルストーンをアーカイブ
node gsd-tools.cjs milestone complete <version> [--name <name>] [--archive-phases]

# 要件を完了としてマーク
node gsd-tools.cjs requirements mark-complete <ids>
# 受け付ける形式: REQ-01,REQ-02 または REQ-01 REQ-02 または [REQ-01, REQ-02]
```

---

## ユーティリティコマンド

```bash
# テキストを URL セーフなスラッグに変換
node gsd-tools.cjs generate-slug "Some Text Here"
# → some-text-here

# タイムスタンプを取得
node gsd-tools.cjs current-timestamp [full|date|filename]

# 保留中の TODO をカウントして一覧表示
node gsd-tools.cjs list-todos [area]

# ファイル/ディレクトリの存在確認
node gsd-tools.cjs verify-path-exists <path>

# 全 SUMMARY.md データを集約
node gsd-tools.cjs history-digest

# SUMMARY.md から構造化データを抽出
node gsd-tools.cjs summary-extract <path> [--fields field1,field2]

# プロジェクト統計
node gsd-tools.cjs stats [json|table]

# 進捗表示
node gsd-tools.cjs progress [json|table|bar]

# TODO を完了にする
node gsd-tools.cjs todo complete <filename>

# UAT 監査 — 全フェーズの未解決項目をスキャン
node gsd-tools.cjs audit-uat

# 設定チェック付き git コミット
node gsd-tools.cjs commit <message> [--files f1 f2] [--amend] [--no-verify]
```

> **`--no-verify`**: プリコミットフックをスキップします。ウェーブベース実行時に並列エグゼキューターエージェントが使用し、ビルドロックの競合（例: Rust プロジェクトでの cargo ロック競合）を回避します。オーケストレーターは各ウェーブ完了後にフックを一度実行します。順次実行時には `--no-verify` を使用せず、フックを通常通り実行してください。

```bash
# Web 検索（Brave API キーが必要）
node gsd-tools.cjs websearch <query> [--limit N] [--freshness day|week|month]
```

---

## モジュールアーキテクチャ

| モジュール | ファイル | エクスポート |
|------------|----------|--------------|
| Core | `lib/core.cjs` | `error()`, `output()`, `parseArgs()`, 共通ユーティリティ |
| State | `lib/state.cjs` | すべての `state` サブコマンド、`state-snapshot` |
| Phase | `lib/phase.cjs` | フェーズ CRUD、`find-phase`、`phase-plan-index`、`phases list` |
| Roadmap | `lib/roadmap.cjs` | ロードマップ解析、フェーズ抽出、進捗更新 |
| Config | `lib/config.cjs` | 設定の読み書き、セクション初期化 |
| Verify | `lib/verify.cjs` | すべての検証・バリデーションコマンド |
| Template | `lib/template.cjs` | テンプレート選択と変数の穴埋め |
| Frontmatter | `lib/frontmatter.cjs` | YAML フロントマター CRUD |
| Init | `lib/init.cjs` | 全ワークフロー向け複合コンテキスト読み込み |
| Milestone | `lib/milestone.cjs` | マイルストーンアーカイブ、要件マーキング |
| Commands | `lib/commands.cjs` | その他: slug、タイムスタンプ、TODO、scaffold、統計、Web 検索 |
| Model Profiles | `lib/model-profiles.cjs` | プロファイル解決テーブル |
| UAT | `lib/uat.cjs` | 全フェーズ横断 UAT/検証監査 |
| Profile Output | `lib/profile-output.cjs` | 開発者プロファイルのフォーマット |
| Profile Pipeline | `lib/profile-pipeline.cjs` | セッション分析パイプライン |
