<div align="center">

# GET SHIT DONE

[English](README.md) · [Português](README.pt-BR.md) · [简体中文](README.zh-CN.md) · **日本語**

**Claude Code、OpenCode、Gemini CLI、Kilo、Codex、Copilot、Cursor、Windsurf、Antigravity、Augment、Trae、Cline向けの軽量かつ強力なメタプロンプティング、コンテキストエンジニアリング、仕様駆動開発システム。**

**コンテキストロット（Claudeがコンテキストウィンドウを消費するにつれ品質が劣化する現象）を解決します。**

[![npm version](https://img.shields.io/npm/v/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![npm downloads](https://img.shields.io/npm/dm/get-shit-done-cc?style=for-the-badge&logo=npm&logoColor=white&color=CB3837)](https://www.npmjs.com/package/get-shit-done-cc)
[![Tests](https://img.shields.io/github/actions/workflow/status/gsd-build/get-shit-done/test.yml?branch=main&style=for-the-badge&logo=github&label=Tests)](https://github.com/gsd-build/get-shit-done/actions/workflows/test.yml)
[![Discord](https://img.shields.io/badge/Discord-Join-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/mYgfVNfA2r)
[![X (Twitter)](https://img.shields.io/badge/X-@gsd__foundation-000000?style=for-the-badge&logo=x&logoColor=white)](https://x.com/gsd_foundation)
[![$GSD Token](https://img.shields.io/badge/$GSD-Dexscreener-1C1C1C?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgZmlsbD0iIzAwRkYwMCIvPjwvc3ZnPg==&logoColor=00FF00)](https://dexscreener.com/solana/dwudwjvan7bzkw9zwlbyv6kspdlvhwzrqy6ebk8xzxkv)
[![GitHub stars](https://img.shields.io/github/stars/gsd-build/get-shit-done?style=for-the-badge&logo=github&color=181717)](https://github.com/gsd-build/get-shit-done)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

<br>

```bash
npx get-shit-done-cc@latest
```

**Mac、Windows、Linuxで動作します。**

<br>

![GSD Install](assets/terminal.svg)

<br>

*「自分が何を作りたいか明確に分かっていれば、これが確実に作ってくれる。嘘じゃない。」*

*「SpecKit、OpenSpec、Taskmasterを試してきたが、これが一番良い結果を出してくれた。」*

*「Claude Codeへの最強の追加ツール。過剰な設計は一切なし。文字通り、やるべきことをやってくれる。」*

<br>

**Amazon、Google、Shopify、Webflowのエンジニアに信頼されています。**

[なぜ作ったのか](#なぜ作ったのか) · [仕組み](#仕組み) · [コマンド](#コマンド) · [なぜ効果的なのか](#なぜ効果的なのか) · [ユーザーガイド](docs/ja-JP/USER-GUIDE.md)

</div>

---

## なぜ作ったのか

私はソロ開発者です。コードは自分で書きません — Claude Codeが書きます。

仕様駆動開発ツールは他にもあります。BMAD、Spekkitなど。しかしどれも必要以上に複雑にしているように見えます（スプリントセレモニー、ストーリーポイント、ステークホルダーとの同期、振り返り、Jiraワークフローなど）。あるいは、何を作ろうとしているのかの全体像を本当には理解していません。私は50人規模のソフトウェア会社ではありません。エンタープライズごっこをしたいわけではありません。ただ、うまく動く素晴らしいものを作りたいクリエイティブな人間です。

だからGSDを作りました。複雑さはシステムの中にあり、ワークフローの中にはありません。裏側では、コンテキストエンジニアリング、XMLプロンプトフォーマッティング、サブエージェントのオーケストレーション、状態管理が動いています。あなたが目にするのは、ただ動くいくつかのコマンドだけです。

このシステムは、Claudeが仕事をし、*かつ*検証するために必要なすべてを提供します。私はこのワークフローを信頼しています。ちゃんといい仕事をしてくれます。

これがGSDです。エンタープライズごっこは一切なし。Claude Codeを使って一貫してクールなものを作るための、非常に効果的なシステムです。

— **TÂCHES**

---

バイブコーディングは評判が悪い。やりたいことを説明し、AIがコードを生成し、スケールすると崩壊する一貫性のないゴミが出来上がる。

GSDはそれを解決します。Claude Codeを信頼性の高いものにするコンテキストエンジニアリングレイヤーです。アイデアを説明し、システムに必要なすべてを抽出させ、Claude Codeに仕事をさせましょう。

---

## こんな人のために

やりたいことを説明するだけで正しく構築してほしい人 — 50人のエンジニア組織を運営しているふりをせずに。

ビルトインの品質ゲートが本当の問題を検出します：スキーマドリフト検出はマイグレーション漏れのORM変更をフラグし、セキュリティ強制は検証を脅威モデルに紐付け、スコープ削減検出はプランナーが要件を暗黙的に落とすのを防止します。

### v1.39.0 ハイライト

完全なリストは [v1.39.0 リリースノート](https://github.com/gsd-build/get-shit-done/releases/tag/v1.39.0) を参照してください。

- **`--minimal` インストールプロファイル** — エイリアス `--core-only`。メインループの6スキル（`new-project`、`discuss-phase`、`plan-phase`、`execute-phase`、`help`、`update`）のみをインストールし、`gsd-*` サブエージェントはゼロ。コールドスタート時のシステムプロンプトのオーバーヘッドを ~12kトークンから ~700トークンへ削減（≥94%減）。32K〜128Kコンテキストのローカル LLM やトークン課金 API に有効。
- **`/gsd-edit-phase`** — `ROADMAP.md` 上の既存フェーズの任意フィールドをその場で編集（番号や位置は変更されない）。`--force` で確認 diff をスキップ、`depends_on` の参照を検証し、書き込み時に `STATE.md` も更新。
- **マージ後ビルド & テストゲート** — `execute-phase` のステップ 5.6 が `workflow.build_command` の設定を自動検出し、無ければ Xcode（`.xcodeproj`）、Makefile、Justfile、Cargo、Go、Python、npm の順にフォールバック。Xcode/iOS プロジェクトでは `xcodebuild build` と `xcodebuild test` を自動実行。並列・直列両モードで動作。
- **ランタイム別レビューモデル選択** — `review.models.<cli>` で各外部レビュー CLI（codex、gemini など）が使うモデルをプランナー/実行プロファイルとは独立に指定可能。
- **ワークストリーム設定の継承** — `GSD_WORKSTREAM` が設定されている場合、ルートの `.planning/config.json` を先に読み込み、ワークストリーム設定をディープマージ（衝突時はワークストリーム側が優先）。ワークストリーム設定で明示的に `null` を指定するとルート値を上書き可能。
- **手動カナリアリリースワークフロー** — `.github/workflows/canary.yml` が `workflow_dispatch` 経由で `dev` ブランチから `{base}-canary.{N}` ビルドを `@canary` dist-tag に手動公開（`get-shit-done-cc` と `@gsd-build/sdk`）。
- **スキルの統合：86 → 59** — 4つの新しいグループ化スキル（`capture`、`phase`、`config`、`workspace`）が31のマイクロスキルを吸収。既存の親スキル6つはラップアップやサブ操作をフラグ化：`update --sync/--reapply`、`sketch --wrap-up`、`spike --wrap-up`、`map-codebase --fast/--query`、`code-review --fix`、`progress --do/--next`。機能の欠損なし。

---

## はじめに

```bash
npx get-shit-done-cc@latest
```

インストーラーが以下の選択を求めます：
1. **ランタイム** — Claude Code、OpenCode、Gemini、Kilo、Codex、Copilot、Cursor、Windsurf、Antigravity、Augment、Trae、Cline、またはすべて（インタラクティブ複数選択 — 1回のインストールセッションで複数のランタイムを選択可能）
2. **インストール先** — グローバル（全プロジェクト）またはローカル（現在のプロジェクトのみ）

確認方法：
- Claude Code / Gemini / Copilot / Antigravity: `/gsd-help`
- OpenCode / Kilo / Augment / Trae: `/gsd-help`
- Codex: `$gsd-help`
- Cline: GSDは`.clinerules`経由でインストール — `.clinerules`の存在を確認

> [!NOTE]
> Claude Code 2.1.88+とCodexはスキル（`skills/gsd-*/SKILL.md`）としてインストールされます。Clineは`.clinerules`を使用します。インストーラーがすべての形式を自動的に処理します。

> [!TIP]
> ソースベースのインストールやnpmが利用できない環境については、**[docs/manual-update.md](docs/manual-update.md)**を参照してください。

### 最新の状態を保つ

GSDは急速に進化しています。定期的にアップデートしてください：

```bash
npx get-shit-done-cc@latest
```

<details>
<summary><strong>非インタラクティブインストール（Docker、CI、スクリプト）</strong></summary>

```bash
# Claude Code
npx get-shit-done-cc --claude --global   # ~/.claude/ にインストール
npx get-shit-done-cc --claude --local    # ./.claude/ にインストール

# OpenCode
npx get-shit-done-cc --opencode --global # ~/.config/opencode/ にインストール

# Gemini CLI
npx get-shit-done-cc --gemini --global   # ~/.gemini/ にインストール

# Kilo
npx get-shit-done-cc --kilo --global     # ~/.config/kilo/ にインストール
npx get-shit-done-cc --kilo --local      # ./.kilo/ にインストール

# Codex
npx get-shit-done-cc --codex --global    # ~/.codex/ にインストール
npx get-shit-done-cc --codex --local     # ./.codex/ にインストール

# Copilot
npx get-shit-done-cc --copilot --global  # ~/.github/ にインストール
npx get-shit-done-cc --copilot --local   # ./.github/ にインストール

# Cursor CLI
npx get-shit-done-cc --cursor --global      # ~/.cursor/ にインストール
npx get-shit-done-cc --cursor --local       # ./.cursor/ にインストール

# Antigravity
npx get-shit-done-cc --antigravity --global # ~/.gemini/antigravity/ にインストール
npx get-shit-done-cc --antigravity --local  # ./.agent/ にインストール

# Augment
npx get-shit-done-cc --augment --global     # ~/.augment/ にインストール
npx get-shit-done-cc --augment --local      # ./.augment/ にインストール

# Trae
npx get-shit-done-cc --trae --global        # ~/.trae/ にインストール
npx get-shit-done-cc --trae --local         # ./.trae/ にインストール

# Cline
npx get-shit-done-cc --cline --global       # ~/.cline/ にインストール
npx get-shit-done-cc --cline --local        # ./.clinerules にインストール

# 全ランタイム
npx get-shit-done-cc --all --global      # すべてのディレクトリにインストール
```

`--global`（`-g`）または `--local`（`-l`）でインストール先の質問をスキップできます。
`--claude`、`--opencode`、`--gemini`、`--kilo`、`--codex`、`--copilot`、`--cursor`、`--windsurf`、`--antigravity`、`--augment`、`--trae`、`--cline`、または `--all` でランタイムの質問をスキップできます。

</details>

<details>
<summary><strong>開発用インストール</strong></summary>

リポジトリをクローンしてインストーラーをローカルで実行します：

```bash
git clone https://github.com/gsd-build/get-shit-done.git
cd get-shit-done
node bin/install.js --claude --local
```

コントリビュートする前に変更をテストするため、`./.claude/` にインストールされます。

</details>

### 推奨：パーミッションスキップモード

GSDは摩擦のない自動化のために設計されています。Claude Codeを以下のように実行してください：

```bash
claude --dangerously-skip-permissions
```

> [!TIP]
> これがGSDの意図された使い方です — `date` や `git commit` を50回も承認するために止まっていては目的が台無しです。

<details>
<summary><strong>代替案：詳細なパーミッション設定</strong></summary>

このフラグを使いたくない場合は、プロジェクトの `.claude/settings.json` に以下を追加してください：

```json
{
  "permissions": {
    "allow": [
      "Bash(date:*)",
      "Bash(echo:*)",
      "Bash(cat:*)",
      "Bash(ls:*)",
      "Bash(mkdir:*)",
      "Bash(wc:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(sort:*)",
      "Bash(grep:*)",
      "Bash(tr:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git status:*)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(git tag:*)"
    ]
  }
}
```

</details>

---

## 仕組み

> **既存のコードがある場合は？** まず `/gsd-map-codebase` を実行してください。並列エージェントが起動し、スタック、アーキテクチャ、規約、懸念点を分析します。その後 `/gsd-new-project` がコードベースを把握した状態で動作し、質問は追加する内容に焦点を当て、計画時にはパターンが自動的に読み込まれます。

### 1. プロジェクトの初期化

```
/gsd-new-project
```

1つのコマンド、1つのフロー。システムが以下を行います：

1. **質問** — アイデアを完全に理解するまで質問します（目標、制約、技術的な好み、エッジケース）
2. **リサーチ** — 並列エージェントが起動しドメインを調査します（オプションですが推奨）
3. **要件定義** — v1、v2、スコープ外を抽出します
4. **ロードマップ** — 要件に紐づくフェーズを作成します

ロードマップを承認します。これでビルドの準備が整いました。

**作成されるファイル：** `PROJECT.md`、`REQUIREMENTS.md`、`ROADMAP.md`、`STATE.md`、`.planning/research/`

---

### 2. フェーズの議論

```
/gsd-discuss-phase 1
```

**ここで実装の方向性を決めます。**

ロードマップには各フェーズにつき1〜2文しかありません。あなたが*想像する*通りに構築するには十分なコンテキストではありません。このステップでは、リサーチや計画の前にあなたの好みを記録します。

システムがフェーズを分析し、構築内容に基づいてグレーゾーンを特定します：

- **ビジュアル機能** → レイアウト、密度、インタラクション、空状態
- **API/CLI** → レスポンス形式、フラグ、エラーハンドリング、詳細度
- **コンテンツシステム** → 構造、トーン、深さ、フロー
- **整理タスク** → グルーピング基準、命名、重複、例外

選択した各領域について、あなたが満足するまで質問します。出力される `CONTEXT.md` は、次の2つのステップに直接反映されます：

1. **リサーチャーが読む** — どんなパターンを調査すべきかを把握（「ユーザーはカードレイアウトを希望」→ カードコンポーネントライブラリを調査）
2. **プランナーが読む** — どの決定が確定済みかを把握（「無限スクロールに決定」→ スクロール処理を計画に含める）

ここで深く掘り下げるほど、システムはあなたが本当に望むものを構築します。スキップすれば妥当なデフォルトが使われます。活用すれば*あなたのビジョン*が反映されます。

**作成されるファイル：** `{phase_num}-CONTEXT.md`

> **前提モード：** 質問よりもコードベース分析を優先したい場合は、`/gsd-settings` で `workflow.discuss_mode` を `assumptions` に設定してください。システムがコードを読み、何をなぜそうするかを提示し、間違っている部分だけ修正を求めます。詳しくは[ディスカスモード](docs/ja-JP/workflow-discuss-mode.md)をご覧ください。

---

### 3. フェーズの計画

```
/gsd-plan-phase 1
```

システムが以下を行います：

1. **リサーチ** — CONTEXT.mdの決定事項をもとに、このフェーズの実装方法を調査します
2. **計画** — XML構造で2〜3個のアトミックなタスクプランを作成します
3. **検証** — プランを要件と照合し、合格するまでループします

各プランは新しいコンテキストウィンドウで実行できるほど小さくなっています。品質の劣化も「もっと簡潔にしますね」もありません。

**作成されるファイル：** `{phase_num}-RESEARCH.md`、`{phase_num}-{N}-PLAN.md`

---

### 4. フェーズの実行

```
/gsd-execute-phase 1
```

システムが以下を行います：

1. **ウェーブでプランを実行** — 可能な限り並列、依存関係がある場合は逐次
2. **プランごとにフレッシュなコンテキスト** — 実装に200kトークンをフル活用、蓄積されたゴミはゼロ
3. **タスクごとにコミット** — 各タスクが独自のアトミックコミットを取得
4. **目標に対して検証** — コードベースがフェーズの約束を果たしているか確認

席を離れて、戻ってきたらクリーンなgit履歴とともに完了した作業が待っています。

**ウェーブ実行の仕組み：**

プランは依存関係に基づいて「ウェーブ」にグループ化されます。各ウェーブ内のプランは並列実行されます。ウェーブは逐次実行されます。

```
┌────────────────────────────────────────────────────────────────────┐
│  PHASE EXECUTION                                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  WAVE 1 (parallel)          WAVE 2 (parallel)          WAVE 3      │
│  ┌─────────┐ ┌─────────┐    ┌─────────┐ ┌─────────┐    ┌─────────┐ │
│  │ Plan 01 │ │ Plan 02 │ →  │ Plan 03 │ │ Plan 04 │ →  │ Plan 05 │ │
│  │         │ │         │    │         │ │         │    │         │ │
│  │ User    │ │ Product │    │ Orders  │ │ Cart    │    │ Checkout│ │
│  │ Model   │ │ Model   │    │ API     │ │ API     │    │ UI      │ │
│  └─────────┘ └─────────┘    └─────────┘ └─────────┘    └─────────┘ │
│       │           │              ↑           ↑              ↑      │
│       └───────────┴──────────────┴───────────┘              │      │
│              Dependencies: Plan 03 needs Plan 01            │      │
│                          Plan 04 needs Plan 02              │      │
│                          Plan 05 needs Plans 03 + 04        │      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**ウェーブが重要な理由：**
- 独立したプラン → 同じウェーブ → 並列実行
- 依存するプラン → 後のウェーブ → 依存関係を待つ
- ファイル競合 → 逐次プランまたは同一プラン内

これが「バーティカルスライス」（Plan 01: ユーザー機能をエンドツーエンド）が「ホリゾンタルレイヤー」（Plan 01: 全モデル、Plan 02: 全API）より並列化に適している理由です。

**作成されるファイル：** `{phase_num}-{N}-SUMMARY.md`、`{phase_num}-VERIFICATION.md`

---

### 5. 作業の検証

```
/gsd-verify-work 1
```

**ここで実際に動作するか確認します。**

自動検証はコードの存在とテストの合格を確認します。しかし、その機能は*期待通りに*動作していますか？ここはあなたが実際に使ってみる場です。

システムが以下を行います：

1. **テスト可能な成果物を抽出** — 今できるようになっているはずのこと
2. **1つずつ案内** — 「メールでログインできますか？」はい/いいえ、または何が問題かを説明
3. **障害を自動診断** — デバッグエージェントが起動し根本原因を特定
4. **検証済みの修正プランを作成** — 即座に再実行可能

すべてパスすれば次に進みます。何か壊れていれば、手動でデバッグする必要はありません — 作成された修正プランで `/gsd-execute-phase` を再度実行するだけです。

**作成されるファイル：** `{phase_num}-UAT.md`、問題が見つかった場合は修正プラン

---

### 6. 繰り返し → シップ → 完了 → 次のマイルストーン

```
/gsd-discuss-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
/gsd-verify-work 2
/gsd-ship 2                  # 検証済みの作業からPRを作成
...
/gsd-complete-milestone
/gsd-new-milestone
```

またはGSDに次のステップを自動判定させます：

```
/gsd-next                    # 次のステップを自動検出して実行
```

**discuss → plan → execute → verify → ship** のループをマイルストーン完了まで繰り返します。

ディスカッション中のインプットを速くしたい場合は、`/gsd-discuss-phase <n> --batch` で1つずつではなく小さなグループにまとめた質問に一括で回答できます。`--chain` を使うと、ディスカッションからプラン+実行まで途中で止まらずに自動チェインできます。

各フェーズであなたのインプット（discuss）、適切なリサーチ（plan）、クリーンな実行（execute）、人間による検証（verify）が行われます。コンテキストは常にフレッシュ。品質は常に高い。

すべてのフェーズが完了したら、`/gsd-complete-milestone` でマイルストーンをアーカイブしリリースをタグ付けします。

次に `/gsd-new-milestone` で次のバージョンを開始します — `new-project` と同じフローですが既存のコードベース向けです。次に構築したいものを説明し、システムがドメインを調査し、要件をスコーピングし、新しいロードマップを作成します。各マイルストーンはクリーンなサイクルです：定義 → 構築 → シップ。

---

### クイックモード

```
/gsd-quick
```

**フル計画が不要なアドホックタスク向け。**

クイックモードはGSDの保証（アトミックコミット、状態トラッキング）をより速いパスで提供します：

- **同じエージェント** — プランナー + エグゼキューター、同じ品質
- **オプションステップをスキップ** — デフォルトではリサーチ、プランチェッカー、ベリファイアなし
- **別トラッキング** — `.planning/quick/` に保存、フェーズとは別管理

**`--discuss` フラグ：** 計画前にグレーゾーンを洗い出す軽量ディスカッション。

**`--research` フラグ：** 計画前にフォーカスされたリサーチャーを起動。実装アプローチ、ライブラリの選択肢、落とし穴を調査します。タスクへのアプローチが不明な場合に使用してください。

**`--full` フラグ：** 全フェーズを有効化 — ディスカッション + リサーチ + プランチェック + 検証。クイックタスク形式のフルGSDパイプライン。

**`--validate` フラグ：** プランチェック + 実行後の検証のみを有効化（以前の `--full` の動作）。

フラグは組み合わせ可能：`--discuss --research --validate` でディスカッション + リサーチ + プランチェック + 検証が行われます。

```
/gsd-quick
> What do you want to do? "Add dark mode toggle to settings"
```

**作成されるファイル：** `.planning/quick/001-add-dark-mode-toggle/PLAN.md`、`SUMMARY.md`

---

## なぜ効果的なのか

### コンテキストエンジニアリング

Claude Codeは必要なコンテキストを与えれば非常に強力です。ほとんどの人はそれをしていません。

GSDがそれを代わりに処理します：

| ファイル | 役割 |
|------|--------------|
| `PROJECT.md` | プロジェクトビジョン、常に読み込まれる |
| `research/` | エコシステムの知識（スタック、機能、アーキテクチャ、落とし穴） |
| `REQUIREMENTS.md` | フェーズとのトレーサビリティを持つスコープ済みv1/v2要件 |
| `ROADMAP.md` | 進む方向、完了済みの作業 |
| `STATE.md` | 決定事項、ブロッカー、現在地 — セッション間のメモリ |
| `PLAN.md` | XML構造のアトミックタスク、検証ステップ付き |
| `SUMMARY.md` | 何が起きたか、何が変わったか、履歴にコミット |
| `todos/` | 後で取り組むアイデアやタスクのキャプチャ |
| `threads/` | セッションをまたぐ作業のための永続コンテキストスレッド |
| `seeds/` | 適切なマイルストーンで浮上する将来志向のアイデア |

サイズ制限はClaudeの品質が劣化するポイントに基づいています。制限内に収まれば、一貫した高品質が得られます。

### XMLプロンプトフォーマッティング

すべてのプランはClaude向けに最適化された構造化XMLです：

```xml
<task type="auto">
  <name>Create login endpoint</name>
  <files>src/app/api/auth/login/route.ts</files>
  <action>
    <!-- CommonJSの問題があるため、jsonwebtokenではなくjoseをJWTに使用。 -->
    <!-- usersテーブルに対して認証情報を検証。 -->
    <!-- 成功時にhttpOnly cookieを返す。 -->
    Use jose for JWT (not jsonwebtoken - CommonJS issues).
    Validate credentials against users table.
    Return httpOnly cookie on success.
  </action>
  <verify>curl -X POST localhost:3000/api/auth/login returns 200 + Set-Cookie</verify>
  <done>Valid credentials return cookie, invalid return 401</done>
</task>
```

正確な指示。推測なし。検証が組み込み済み。

### マルチエージェントオーケストレーション

すべてのステージで同じパターンを使用します：薄いオーケストレーターが専門エージェントを起動し、結果を収集し、次のステップにルーティングします。

| ステージ | オーケストレーターの役割 | エージェントの役割 |
|-------|------------------|-----------|
| リサーチ | 調整し、発見事項を提示 | 4つの並列リサーチャーがスタック、機能、アーキテクチャ、落とし穴を調査 |
| プランニング | 検証し、イテレーションを管理 | プランナーがプランを作成、チェッカーが検証、合格するまでループ |
| 実行 | ウェーブにグループ化し、進捗を追跡 | エグゼキューターがフレッシュな200kコンテキストで並列実装 |
| 検証 | 結果を提示し、次にルーティング | ベリファイアがコードベースを目標と照合、デバッガーが障害を診断 |

オーケストレーターは重い処理を行いません。エージェントを起動し、待機し、結果を統合します。

**結果：** フェーズ全体を実行できます — 深いリサーチ、複数のプランの作成と検証、並列エグゼキューターによる数千行のコード記述、目標に対する自動検証 — そしてメインのコンテキストウィンドウは30〜40%に留まります。処理はフレッシュなサブエージェントコンテキストで行われます。セッションは高速でレスポンシブなままです。

### アトミックGitコミット

各タスクは完了直後に独自のコミットを取得します：

```bash
abc123f docs(08-02): complete user registration plan
def456g feat(08-02): add email confirmation flow
hij789k feat(08-02): implement password hashing
lmn012o feat(08-02): create registration endpoint
```

> [!NOTE]
> **メリット：** git bisectで問題のある正確なタスクを特定可能。各タスクを個別にリバート可能。将来のセッションでClaudeに明確な履歴を提供。AI自動化ワークフローにおけるオブザーバビリティの向上。

すべてのコミットは的確で、追跡可能で、意味があります。

### モジュラー設計

- 現在のマイルストーンにフェーズを追加
- フェーズ間に緊急作業を挿入
- マイルストーンを完了して新しく開始
- すべてを再構築せずにプランを調整

ロックインされることはありません。システムが適応します。

---

## コマンド

### コアワークフロー

| コマンド | 説明 |
|---------|--------------|
| `/gsd-new-project [--auto]` | フル初期化：質問 → リサーチ → 要件定義 → ロードマップ |
| `/gsd-discuss-phase [N] [--auto] [--analyze] [--chain]` | 計画前に実装の決定事項をキャプチャ（`--analyze` でトレードオフ分析を追加、`--chain` でプラン+実行へ自動チェイン） |
| `/gsd-plan-phase [N] [--auto] [--reviews]` | フェーズのリサーチ + プラン + 検証（`--reviews` でコードベースレビューの発見事項を読み込み） |
| `/gsd-execute-phase <N>` | 全プランを並列ウェーブで実行し、完了時に検証 |
| `/gsd-verify-work [N]` | 手動ユーザー受入テスト ¹ |
| `/gsd-ship [N] [--draft]` | 検証済みのフェーズ作業から自動生成された本文付きのPRを作成 |
| `/gsd-next` | 次の論理的なワークフローステップに自動的に進む |
| `/gsd-fast <text>` | インラインの軽微タスク — 計画を完全にスキップし即座に実行 |
| `/gsd-audit-milestone` | マイルストーンが完了の定義を達成したか検証 |
| `/gsd-complete-milestone` | マイルストーンをアーカイブし、リリースをタグ付け |
| `/gsd-new-milestone [name]` | 次のバージョンを開始：質問 → リサーチ → 要件定義 → ロードマップ |
| `/gsd-forensics [desc]` | 失敗したワークフロー実行の事後分析（停止ループ、欠落成果物、git異常の診断） |
| `/gsd-milestone-summary [version]` | チームオンボーディングとレビュー向けの包括的なプロジェクトサマリーを生成 |

### ワークストリーム

| コマンド | 説明 |
|---------|--------------|
| `/gsd-workstreams list` | 全ワークストリームとそのステータスを表示 |
| `/gsd-workstreams create <name>` | 並列マイルストーン作業用の名前空間付きワークストリームを作成 |
| `/gsd-workstreams switch <name>` | アクティブなワークストリームを切り替え |
| `/gsd-workstreams complete <name>` | ワークストリームを完了しマージ |

### マルチプロジェクトワークスペース

| コマンド | 説明 |
|---------|--------------|
| `/gsd-new-workspace` | リポジトリのコピー（worktreeまたはクローン）で隔離されたワークスペースを作成 |
| `/gsd-list-workspaces` | すべてのGSDワークスペースとそのステータスを表示 |
| `/gsd-remove-workspace` | ワークスペースを削除しworktreeをクリーンアップ |

### UIデザイン

| コマンド | 説明 |
|---------|--------------|
| `/gsd-ui-phase [N]` | フロントエンドフェーズ用のUIデザイン契約（UI-SPEC.md）を生成 |
| `/gsd-ui-review [N]` | 実装済みフロントエンドコードの6つの柱によるビジュアル監査（遡及的） |

### ナビゲーション

| コマンド | 説明 |
|---------|--------------|
| `/gsd-progress` | 今どこにいる？次は何？ |
| `/gsd-next` | 状態を自動検出し次のステップを実行 |
| `/gsd-help` | 全コマンドと使い方ガイドを表示 |
| `/gsd-update` | チェンジログプレビュー付きでGSDをアップデート |
| `/gsd-join-discord` | GSD Discordコミュニティに参加 |
| `/gsd-manager` | 複数フェーズ管理用のインタラクティブコマンドセンター |

### ブラウンフィールド

| コマンド | 説明 |
|---------|--------------|
| `/gsd-map-codebase [area]` | new-project前に既存のコードベースを分析 |

### フェーズ管理

| コマンド | 説明 |
|---------|--------------|
| `/gsd-add-phase` | ロードマップにフェーズを追加 |
| `/gsd-insert-phase [N]` | フェーズ間に緊急作業を挿入 |
| `/gsd-edit-phase [N] [--force]` | 既存フェーズの任意フィールドをその場で編集 — 番号と位置は変更されない |
| `/gsd-remove-phase [N]` | 将来のフェーズを削除し番号を振り直し |
| `/gsd-list-phase-assumptions [N]` | 計画前にClaudeの意図するアプローチを確認 |
| `/gsd-plan-milestone-gaps` | 監査で見つかったギャップを埋めるフェーズを作成 |

### セッション

| コマンド | 説明 |
|---------|--------------|
| `/gsd-pause-work` | フェーズ途中で停止する際の引き継ぎを作成（HANDOFF.jsonを書き込み） |
| `/gsd-resume-work` | 前回のセッションから復元 |
| `/gsd-session-report` | 実行した作業と結果のセッションサマリーを生成 |

### ワークストリーム

| コマンド | 説明 |
|---------|--------------|
| `/gsd-workstreams` | 並列ワークストリームを管理（list、create、switch、status、progress、complete） |

### コード品質

| コマンド | 説明 |
|---------|--------------|
| `/gsd-review` | 現在のフェーズまたはブランチのクロスAIピアレビュー |
| `/gsd-pr-branch` | `.planning/` コミットをフィルタリングしたクリーンなPRブランチを作成 |
| `/gsd-audit-uat` | 検証負債を監査 — UATが未実施のフェーズを検出 |

### バックログ & スレッド

| コマンド | 説明 |
|---------|--------------|
| `/gsd-plant-seed <idea>` | トリガー条件付きの将来志向のアイデアをキャプチャ — 適切なマイルストーンで浮上 |
| `/gsd-add-backlog <desc>` | バックログのパーキングロットにアイデアを追加（999.xナンバリング、アクティブシーケンス外） |
| `/gsd-review-backlog` | バックログ項目をレビューし、アクティブマイルストーンに昇格またはstaleエントリを削除 |
| `/gsd-thread [name]` | 永続コンテキストスレッド — 複数セッションにまたがる作業用の軽量クロスセッション知識 |

### ユーティリティ

| コマンド | 説明 |
|---------|--------------|
| `/gsd-settings` | モデルプロファイルとワークフローエージェントを設定 |
| `/gsd-set-profile <profile>` | モデルプロファイルを切り替え（quality/balanced/budget/inherit） |
| `/gsd-add-todo [desc]` | 後で取り組むアイデアをキャプチャ |
| `/gsd-check-todos` | 保留中のtodoを一覧表示 |
| `/gsd-debug [desc]` | 永続状態を持つ体系的デバッグ |
| `/gsd-do <text>` | フリーフォームテキストを適切なGSDコマンドに自動ルーティング |
| `/gsd-note <text>` | ゼロフリクションのアイデアキャプチャ — ノートの追加、一覧、todoへの昇格 |
| `/gsd-quick [--full] [--discuss] [--research]` | GSDの保証付きでアドホックタスクを実行（`--full` で全フェーズを有効化、`--discuss` で事前にコンテキストを収集、`--research` で計画前にアプローチを調査） |
| `/gsd-health [--repair]` | `.planning/` ディレクトリの整合性を検証、`--repair` で自動修復 |
| `/gsd-stats` | プロジェクト統計を表示 — フェーズ、プラン、要件、gitメトリクス |
| `/gsd-profile-user [--questionnaire] [--refresh]` | セッション分析から開発者行動プロファイルを生成し、パーソナライズされた応答を提供 |

<sup>¹ Redditユーザー OracleGreyBeard による貢献</sup>

---

## 設定

GSDはプロジェクト設定を `.planning/config.json` に保存します。`/gsd-new-project` 実行時に設定するか、後から `/gsd-settings` で更新できます。完全な設定スキーマ、ワークフロートグル、gitブランチオプション、エージェントごとのモデル内訳については、[ユーザーガイド](docs/ja-JP/USER-GUIDE.md#configuration-reference)をご覧ください。

### コア設定

| 設定 | オプション | デフォルト | 制御内容 |
|---------|---------|---------|------------------|
| `mode` | `yolo`, `interactive` | `interactive` | 自動承認 vs 各ステップで確認 |
| `granularity` | `coarse`, `standard`, `fine` | `standard` | フェーズの粒度 — スコープをどれだけ細かく分割するか（フェーズ × プラン） |

### モデルプロファイル

各エージェントが使用するClaudeモデルを制御します。品質とトークン消費のバランスを取ります。

| プロファイル | プランニング | 実行 | 検証 |
|---------|----------|-----------|--------------|
| `quality` | Opus | Opus | Sonnet |
| `balanced`（デフォルト） | Opus | Sonnet | Sonnet |
| `budget` | Sonnet | Sonnet | Haiku |
| `inherit` | Inherit | Inherit | Inherit |

プロファイルの切り替え：
```
/gsd-set-profile budget
```

非Anthropicプロバイダー（OpenRouter、ローカルモデル）を使用する場合や、現在のランタイムのモデル選択に従う場合（例：OpenCode `/model`）は `inherit` を使用してください。

または `/gsd-settings` で設定できます。

### ワークフローエージェント

プランニング/実行時に追加のエージェントを起動します。品質は向上しますが、トークンと時間が追加されます。

| 設定 | デフォルト | 説明 |
|---------|---------|--------------|
| `workflow.research` | `true` | 各フェーズの計画前にドメインを調査 |
| `workflow.plan_check` | `true` | 実行前にプランがフェーズ目標を達成しているか検証 |
| `workflow.verifier` | `true` | 実行後に必須項目が提供されたか確認 |
| `workflow.auto_advance` | `false` | discuss → plan → execute を停止せずに自動チェーン |
| `workflow.research_before_questions` | `false` | ディスカッション質問の後ではなく前にリサーチを実行 |
| `workflow.discuss_mode` | `'discuss'` | ディスカッションモード：`discuss`（インタビュー）、`assumptions`（コードベースファースト） |
| `workflow.skip_discuss` | `false` | 自律モードでdiscuss-phaseをスキップ |
| `workflow.text_mode` | `false` | リモートセッション用のテキスト専用モード（TUIメニューなし） |

これらのトグルには `/gsd-settings` を使用するか、呼び出し時にオーバーライドできます：
- `/gsd-plan-phase --skip-research`
- `/gsd-plan-phase --skip-verify`

### 実行

| 設定 | デフォルト | 制御内容 |
|---------|---------|------------------|
| `parallelization.enabled` | `true` | 独立したプランを同時に実行 |
| `planning.commit_docs` | `true` | `.planning/` をgitで追跡 |
| `hooks.context_warnings` | `true` | コンテキストウィンドウの使用量警告を表示 |

### Gitブランチ

GSDが実行中にブランチをどう扱うかを制御します。

| 設定 | オプション | デフォルト | 説明 |
|---------|---------|---------|--------------|
| `git.branching_strategy` | `none`, `phase`, `milestone` | `none` | ブランチ作成戦略 |
| `git.phase_branch_template` | string | `gsd/phase-{phase}-{slug}` | フェーズブランチのテンプレート |
| `git.milestone_branch_template` | string | `gsd/{milestone}-{slug}` | マイルストーンブランチのテンプレート |

**戦略：**
- **`none`** — 現在のブランチにコミット（デフォルトのGSD動作）
- **`phase`** — フェーズごとにブランチを作成し、フェーズ完了時にマージ
- **`milestone`** — マイルストーン全体で1つのブランチを作成し、完了時にマージ

マイルストーン完了時、GSDはスカッシュマージ（推奨）または履歴付きマージを提案します。

---

## セキュリティ

### 組み込みセキュリティハードニング

GSDはv1.27以降、多層防御セキュリティを備えています：

- **パストラバーサル防止** — ユーザー提供のすべてのファイルパス（`--text-file`、`--prd`）がプロジェクトディレクトリ内に解決されるか検証
- **プロンプトインジェクション検出** — 集中型 `security.cjs` モジュールが計画成果物に入る前にユーザー提供テキストのインジェクションパターンをスキャン
- **PreToolUseプロンプトガードフック** — `gsd-prompt-guard` が `.planning/` への書き込みに埋め込まれたインジェクションベクトルをスキャン（アドバイザリー、ブロッキングではない）
- **安全なJSON解析** — 不正な `--fields` 引数が状態を破損する前にキャッチ
- **シェル引数バリデーション** — シェル補間前にユーザーテキストをサニタイズ
- **CI対応インジェクションスキャナー** — `prompt-injection-scan.test.cjs` が全エージェント/ワークフロー/コマンドファイルの埋め込みインジェクションベクトルをスキャン

> [!NOTE]
> GSDはLLMシステムプロンプトとなるマークダウンファイルを生成するため、計画成果物に流入するユーザー制御テキストは潜在的な間接プロンプトインジェクションベクトルとなります。これらの保護は、そのようなベクトルを複数のレイヤーで捕捉するように設計されています。

### 機密ファイルの保護

GSDのコードベースマッピングおよび分析コマンドは、プロジェクトを理解するためにファイルを読み取ります。**シークレットを含むファイルを保護する**には、Claude Codeの拒否リストに追加してください：

1. Claude Code設定（`.claude/settings.json` またはグローバル）を開きます
2. 機密ファイルパターンを拒否リストに追加します：

```json
{
  "permissions": {
    "deny": [
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/*)",
      "Read(**/*credential*)",
      "Read(**/*.pem)",
      "Read(**/*.key)"
    ]
  }
}
```

これにより、どのコマンドを実行しても、Claudeがこれらのファイルを完全に読み取ることを防ぎます。

> [!IMPORTANT]
> GSDにはシークレットのコミットに対する組み込み保護がありますが、多層防御がベストプラクティスです。防御の第一線として、機密ファイルへの読み取りアクセスを拒否してください。

---

## トラブルシューティング

**インストール後にコマンドが見つからない？**
- ランタイムを再起動してコマンド/スキルを再読み込みしてください
- `~/.claude/commands/gsd/`（グローバル）または `./.claude/commands/gsd/`（ローカル）にファイルが存在するか確認してください
- Codexの場合、`~/.codex/skills/gsd-*/SKILL.md`（グローバル）または `./.codex/skills/gsd-*/SKILL.md`（ローカル）にスキルが存在するか確認してください

**コマンドが期待通りに動作しない？**
- `/gsd-help` を実行してインストールを確認してください
- `npx get-shit-done-cc` を再実行して再インストールしてください

**最新バージョンへのアップデート？**
```bash
npx get-shit-done-cc@latest
```

**Dockerまたはコンテナ化環境を使用している？**

チルダパス（`~/.claude/...`）でファイル読み取りが失敗する場合、インストール前に `CLAUDE_CONFIG_DIR` を設定してください：
```bash
CLAUDE_CONFIG_DIR=/home/youruser/.claude npx get-shit-done-cc --global
```
これにより、コンテナ内で正しく展開されない可能性がある `~` の代わりに絶対パスが使用されます。

### アンインストール

GSDを完全に削除するには：

```bash
# グローバルインストール
npx get-shit-done-cc --claude --global --uninstall
npx get-shit-done-cc --opencode --global --uninstall
npx get-shit-done-cc --gemini --global --uninstall
npx get-shit-done-cc --kilo --global --uninstall
npx get-shit-done-cc --codex --global --uninstall
npx get-shit-done-cc --copilot --global --uninstall
npx get-shit-done-cc --cursor --global --uninstall
npx get-shit-done-cc --antigravity --global --uninstall
npx get-shit-done-cc --trae --global --uninstall

# ローカルインストール（現在のプロジェクト）
npx get-shit-done-cc --claude --local --uninstall
npx get-shit-done-cc --opencode --local --uninstall
npx get-shit-done-cc --gemini --local --uninstall
npx get-shit-done-cc --kilo --local --uninstall
npx get-shit-done-cc --codex --local --uninstall
npx get-shit-done-cc --copilot --local --uninstall
npx get-shit-done-cc --cursor --local --uninstall
npx get-shit-done-cc --antigravity --local --uninstall
npx get-shit-done-cc --trae --local --uninstall
```

これにより、他の設定を保持しながら、すべてのGSDコマンド、エージェント、フック、設定が削除されます。

---

## コミュニティポート

OpenCode、Gemini CLI、Kilo、Codexは `npx get-shit-done-cc` でネイティブサポートされています。

以下のコミュニティポートがマルチランタイムサポートの先駆けとなりました：

| プロジェクト | プラットフォーム | 説明 |
|---------|----------|-------------|
| [gsd-opencode](https://github.com/rokicool/gsd-opencode) | OpenCode | オリジナルのOpenCode対応版 |
| gsd-gemini（アーカイブ済み） | Gemini CLI | uberfuzzyによるオリジナルのGemini対応版 |

---

## スター履歴

<a href="https://star-history.com/#gsd-build/get-shit-done&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=gsd-build/get-shit-done&type=Date" />
 </picture>
</a>

---

## ライセンス

MITライセンス。詳細は [LICENSE](LICENSE) をご覧ください。

---

<div align="center">

**Claude Codeは強力です。GSDはそれを信頼性の高いものにします。**

</div>
