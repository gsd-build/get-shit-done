# マルチプロジェクトワークスペース (`/gsd-new-workspace`)

**Issue:** #1241
**Date:** 2026-03-20
**Status:** Approved

## 課題

GSD は作業ディレクトリごとに1つの `.planning/` ディレクトリに紐づいています。複数の独立したプロジェクトを持つユーザー（20以上の子リポジトリを含むモノレポ構成など）や、同一リポジトリ内でフィーチャーブランチの分離が必要なユーザーは、手動でのクローンや状態管理なしに並行して GSD セッションを実行することができません。

## 解決策

3つの新しいコマンドで**物理的なワークスペースディレクトリ**を作成・一覧表示・削除します。各ワークスペースにはリポジトリのコピー（git worktree またはクローン）と独立した `.planning/` ディレクトリが含まれます。

これにより2つのユースケースに対応します：
- **マルチリポジトリオーケストレーション (A):** 親ディレクトリから複数のリポジトリにまたがるワークスペース
- **フィーチャーブランチの分離 (B):** 現在のリポジトリの worktree を含むワークスペース（`--repos .` を使用した A の特殊ケース）

## コマンド

### `/gsd-new-workspace`

リポジトリのコピーと独自の `.planning/` を持つワークスペースディレクトリを作成します。

```
/gsd-new-workspace --name feature-b --repos hr-ui,ZeymoAPI --path ~/workspaces/feature-b
/gsd-new-workspace --name feature-b --repos . --strategy worktree   # same-repo isolation
```

**引数:**

| フラグ | 必須 | デフォルト | 説明 |
|------|----------|---------|-------------|
| `--name` | はい | — | ワークスペース名 |
| `--repos` | いいえ | 対話的な選択 | カンマ区切りのリポジトリパスまたは名前 |
| `--path` | いいえ | `~/gsd-workspaces/<name>` | 出力先ディレクトリ |
| `--strategy` | いいえ | `worktree` | `worktree`（軽量、.git を共有）または `clone`（完全に独立） |
| `--branch` | いいえ | `workspace/<name>` | チェックアウトするブランチ |
| `--auto` | いいえ | false | 対話的な質問をスキップし、デフォルト値を使用 |

### `/gsd-list-workspaces`

`~/gsd-workspaces/*/WORKSPACE.md` をスキャンしてワークスペースマニフェストを検索します。名前、パス、リポジトリ数、GSD ステータス（PROJECT.md の有無、現在のフェーズ）をテーブル形式で表示します。

### `/gsd-remove-workspace`

確認後にワークスペースディレクトリを削除します。worktree 戦略の場合、まず各メンバーリポジトリに対して `git worktree remove` を実行します。コミットされていない変更があるリポジトリがある場合は削除を拒否します。

## ディレクトリ構造

```
~/gsd-workspaces/feature-b/          # workspace root
├── WORKSPACE.md                      # manifest
├── .planning/                        # independent GSD planning directory
│   ├── PROJECT.md                    # (if user ran /gsd-new-project)
│   ├── STATE.md
│   └── config.json
├── hr-ui/                            # git worktree of source repo
│   └── (repo contents on workspace/feature-b branch)
└── ZeymoAPI/                         # git worktree of source repo
    └── (repo contents on workspace/feature-b branch)
```

主要な特性：
- `.planning/` はワークスペースのルートに配置され、個々のリポジトリ内には配置されない
- 各リポジトリはワークスペースルート直下の対等なディレクトリ
- `WORKSPACE.md` はルートにある唯一の GSD 固有ファイル（`.planning/` を除く）
- `--strategy clone` の場合も同じ構造だが、リポジトリは完全なクローンとなる

## WORKSPACE.md のフォーマット

```markdown
# Workspace: feature-b

Created: 2026-03-20
Strategy: worktree

## Member Repos

| Repo | Source | Branch | Strategy |
|------|--------|--------|----------|
| hr-ui | /root/source/repos/hr-ui | workspace/feature-b | worktree |
| ZeymoAPI | /root/source/repos/ZeymoAPI | workspace/feature-b | worktree |

## Notes

[User can add context about what this workspace is for]
```

## ワークフロー

### `/gsd-new-workspace` のワークフロー手順

1. **セットアップ** — `init new-workspace` を呼び出し、JSON コンテキストを解析する
2. **入力の収集** — `--name`/`--repos`/`--path` が指定されていない場合、対話的に質問する。リポジトリの選択時は、カレントディレクトリ内の子 `.git` ディレクトリを選択肢として表示する
3. **バリデーション** — 出力先パスが存在しない（または空である）こと。ソースリポジトリが存在し、git リポジトリであることを確認する
4. **ワークスペースディレクトリの作成** — `mkdir -p <path>`
5. **リポジトリのコピー** — 各リポジトリについて：
   - Worktree: `git worktree add <workspace>/<repo-name> -b workspace/<name>`
   - Clone: `git clone <source> <workspace>/<repo-name>`
6. **WORKSPACE.md の書き込み** — ソースパス、戦略、ブランチを含むマニフェスト
7. **.planning/ の初期化** — `mkdir -p <workspace>/.planning`
8. **/gsd-new-project の提案** — 新しいワークスペースでプロジェクト初期化を実行するか確認する
9. **コミット** — commit_docs が有効な場合、WORKSPACE.md のアトミックコミット
10. **完了** — ワークスペースのパスと次のステップを表示する

### Init 関数 (`cmdInitNewWorkspace`)

検出項目：
- カレントディレクトリ内の子 git リポジトリ（対話的なリポジトリ選択用）
- 出力先パスが既に存在するかどうか
- ソースリポジトリにコミットされていない変更があるかどうか
- `git worktree` が利用可能かどうか
- デフォルトのワークスペースベースディレクトリ (`~/gsd-workspaces/`)

ワークフローの分岐制御用フラグを含む JSON を返します。

## エラーハンドリング

### バリデーションエラー（作成をブロック）

- **出力先パスが存在し、空でない場合** — 別の名前/パスを選択するよう提案するエラー
- **ソースリポジトリのパスが存在しない、または git リポジトリでない場合** — 失敗したリポジトリを一覧表示するエラー
- **`git worktree add` が失敗した場合**（例：ブランチが既に存在する） — `workspace/<name>-<timestamp>` ブランチにフォールバックし、それも失敗した場合はエラー

### グレースフルハンドリング

- **ソースリポジトリにコミットされていない変更がある場合** — 警告するが許可する（worktree はブランチを新規にチェックアウトし、作業ディレクトリの状態はコピーしない）
- **マルチリポジトリワークスペースでの部分的な失敗** — 成功したリポジトリでワークスペースを作成し、失敗を報告し、部分的な WORKSPACE.md を書き込む
- **`--repos .`（現在のリポジトリ、ケース B）** — ディレクトリ名または git remote からリポジトリ名を検出し、サブディレクトリ名として使用する

### Remove-Workspace の安全性

- **ワークスペース内のリポジトリにコミットされていない変更がある場合** — 削除を拒否し、変更のあるリポジトリを表示する
- **Worktree の削除が失敗した場合**（例：ソースリポジトリが削除されている） — 警告し、ディレクトリのクリーンアップを続行する
- **確認** — ワークスペース名を入力する明示的な確認を要求する

### List-Workspaces のエッジケース

- **`~/gsd-workspaces/` が存在しない場合** — 「ワークスペースが見つかりません」
- **WORKSPACE.md は存在するが、内部のリポジトリがなくなっている場合** — ワークスペースを表示し、リポジトリを欠落としてマークする

## テスト

### ユニットテスト (`tests/workspace.test.cjs`)

1. `cmdInitNewWorkspace` が正しい JSON を返す — 子 git リポジトリの検出、出力先パスのバリデーション、git worktree の利用可能性の検出
2. WORKSPACE.md の生成 — リポジトリテーブル、戦略、日付を含む正しいフォーマット
3. リポジトリの検出 — カレントディレクトリの子要素内の `.git` ディレクトリを識別し、git 以外のディレクトリやファイルをスキップする
4. バリデーション — 既存の空でない出力先パスを拒否し、git リポジトリでないソースパスを拒否する

### 統合テスト（同一ファイル）

5. Worktree の作成 — ワークスペースを作成し、リポジトリディレクトリが有効な git worktree であることを検証する
6. クローンの作成 — ワークスペースを作成し、リポジトリが独立したクローンであることを検証する
7. ワークスペースの一覧表示 — 2つのワークスペースを作成し、一覧出力に両方が含まれることを検証する
8. ワークスペースの削除 — worktree でワークスペースを作成し、削除してクリーンアップを検証する
9. 部分的な失敗 — 有効なリポジトリ1つと無効なパス1つで、有効なリポジトリのみでワークスペースが作成されることを検証する

すべてのテストは一時ディレクトリを使用し、終了時にクリーンアップします。既存の `node:test` + `node:assert` パターンに従います。

## 実装ファイル

| コンポーネント | パス |
|-----------|------|
| コマンド: new-workspace | `commands/gsd/new-workspace.md` |
| コマンド: list-workspaces | `commands/gsd/list-workspaces.md` |
| コマンド: remove-workspace | `commands/gsd/remove-workspace.md` |
| ワークフロー: new-workspace | `get-shit-done/workflows/new-workspace.md` |
| ワークフロー: list-workspaces | `get-shit-done/workflows/list-workspaces.md` |
| ワークフロー: remove-workspace | `get-shit-done/workflows/remove-workspace.md` |
| Init 関数 | `get-shit-done/bin/lib/init.cjs`（`cmdInitNewWorkspace`、`cmdInitListWorkspaces`、`cmdInitRemoveWorkspace` を追加） |
| ルーティング | `get-shit-done/bin/gsd-tools.cjs`（init switch にケースを追加） |
| テスト | `tests/workspace.test.cjs` |

## 設計上の決定

| 決定事項 | 根拠 |
|----------|-----------|
| 論理的なレジストリではなく物理ディレクトリを採用 | ファイルシステムを信頼の源とする — GSD の既存の cwd ベースの検出パターンと一致する |
| Worktree をデフォルト戦略とする | 軽量（.git オブジェクトを共有）、作成が高速、クリーンアップが容易 |
| `.planning/` をワークスペースルートに配置 | 個々のリポジトリの planning から完全に分離できる。各ワークスペースは独立した GSD プロジェクトとなる |
| 中央レジストリを使用しない | 状態の乖離を回避する。`list-workspaces` はファイルシステムを直接スキャンする |
| ケース B を A の特殊ケースとする | `--repos .` で同じ仕組みを再利用し、フィーチャーブランチ専用のコードが不要 |
| デフォルトパスを `~/gsd-workspaces/<name>` とする | `list-workspaces` がスキャンしやすい予測可能な場所に配置し、ワークスペースをソースリポジトリの外に保つ |
