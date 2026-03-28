# GSD エージェントリファレンス

> 全18種の専門エージェント — 役割、ツール、スポーンパターン、相互関係。アーキテクチャの詳細は[アーキテクチャ](ARCHITECTURE.md)を参照してください。

---

## 概要

GSD はマルチエージェントアーキテクチャを採用しており、軽量なオーケストレーター（ワークフローファイル）が新しいコンテキストウィンドウを持つ専門エージェントをスポーンします。各エージェントは特定の役割に特化し、限定的なツールアクセス権を持ち、特定の成果物を生成します。

### エージェントカテゴリ

| カテゴリ | 数 | エージェント |
|----------|-----|-------------|
| リサーチャー | 3 | project-researcher, phase-researcher, ui-researcher |
| アナライザー | 2 | assumptions-analyzer, advisor-researcher |
| シンセサイザー | 1 | research-synthesizer |
| プランナー | 1 | planner |
| ロードマッパー | 1 | roadmapper |
| エグゼキューター | 1 | executor |
| チェッカー | 3 | plan-checker, integration-checker, ui-checker |
| ベリファイヤー | 1 | verifier |
| オーディター | 2 | nyquist-auditor, ui-auditor |
| マッパー | 1 | codebase-mapper |
| デバッガー | 1 | debugger |

---

## エージェント詳細

### gsd-project-researcher

**役割:** ロードマップ作成前にドメインエコシステムを調査する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:new-project`, `/gsd:new-milestone` |
| **並列数** | 4インスタンス（stack, features, architecture, pitfalls） |
| **ツール** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **モデル (balanced)** | Sonnet |
| **生成物** | `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` |

**機能:**
- Web検索による最新のエコシステム情報の取得
- Context7 MCP統合によるライブラリドキュメントの参照
- リサーチドキュメントを直接ディスクに書き込み（オーケストレーターのコンテキスト負荷を軽減）

---

### gsd-phase-researcher

**役割:** 計画策定前に、特定フェーズの実装方法を調査する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:plan-phase` |
| **並列数** | 4インスタンス（project-researcher と同じフォーカスエリア） |
| **ツール** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **モデル (balanced)** | Sonnet |
| **生成物** | `{phase}-RESEARCH.md` |

**機能:**
- CONTEXT.md を読み取り、ユーザーの決定事項に焦点を当てた調査を実施
- 特定フェーズのドメインに対する実装パターンの調査
- Nyquist バリデーションマッピング用のテストインフラの検出

---

### gsd-ui-researcher

**役割:** フロントエンドフェーズ向けのUIデザインコントラクトを作成する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:ui-phase` |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Write, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **モデル (balanced)** | Sonnet |
| **カラー** | `#E879F9`（フクシア） |
| **生成物** | `{phase}-UI-SPEC.md` |

**機能:**
- デザインシステムの状態を検出（shadcn の components.json、Tailwind 設定、既存トークン）
- React/Next.js/Vite プロジェクト向けの shadcn 初期化を提案
- 未回答のデザインコントラクトに関する質問のみを提示
- サードパーティコンポーネントに対するレジストリ安全ゲートの適用

---

### gsd-assumptions-analyzer

**役割:** フェーズに対してコードベースを深く分析し、エビデンス・信頼度・誤った場合の影響を含む構造化された前提条件を返す。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `discuss-phase-assumptions` ワークフロー（`workflow.discuss_mode = 'assumptions'` の場合） |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Bash, Grep, Glob |
| **モデル (balanced)** | Sonnet |
| **カラー** | Cyan |
| **生成物** | 決定ステートメント、エビデンスファイルパス、信頼度レベルを含む構造化された前提条件 |

**主な動作:**
- ROADMAP.md のフェーズ説明と過去の CONTEXT.md ファイルを読み取り
- フェーズに関連するファイル（コンポーネント、パターン、類似機能）をコードベースから検索
- エビデンスに基づく前提条件を形成するため、最も関連性の高いソースファイルを5〜15件読み取り
- 信頼度の分類: Confident（コードから明確）、Likely（妥当な推論）、Unclear（複数の方向性がありうる）
- 外部調査が必要なトピック（ライブラリ互換性、エコシステムのベストプラクティス）にフラグを付与
- ティアによる出力の調整: full_maturity（3〜5領域）、standard（3〜4）、minimal_decisive（2〜3）

---

### gsd-advisor-researcher

**役割:** discuss-phase のアドバイザーモードにおいて、単一のグレーエリアの決定事項を調査し、構造化された比較表を返す。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `discuss-phase` ワークフロー（ADVISOR_MODE = true の場合） |
| **並列数** | 複数インスタンス（グレーエリアごとに1つ） |
| **ツール** | Read, Bash, Grep, Glob, WebSearch, WebFetch, mcp (context7) |
| **モデル (balanced)** | Sonnet |
| **カラー** | Cyan |
| **生成物** | 根拠パラグラフ付きの5列比較表（Option / Pros / Cons / Complexity / Recommendation） |

**主な動作:**
- Claude の知識、Context7、Web検索を使用して、割り当てられた単一のグレーエリアを調査
- 実質的に有効な選択肢を提示 — 水増しのための代替案は含めない
- Complexity 列は影響範囲+リスクで表記（時間見積もりは使用しない）
- 推奨は条件付き（「Xの場合は推奨」「Yの場合は推奨」）— 単一の勝者ランキングにはしない
- ティアによる出力の調整: full_maturity（成熟度シグナル付き3〜5選択肢）、standard（2〜4）、minimal_decisive（2選択肢、決定的な推奨）

---

### gsd-research-synthesizer

**役割:** 並列リサーチャーの出力を統合サマリーにまとめる。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:new-project`（4つのリサーチャー完了後） |
| **並列数** | 単一インスタンス（リサーチャー後に順次実行） |
| **ツール** | Read, Write, Bash |
| **モデル (balanced)** | Sonnet |
| **カラー** | Purple |
| **生成物** | `.planning/research/SUMMARY.md` |

---

### gsd-planner

**役割:** タスク分解、依存関係分析、ゴール逆算検証を含む実行可能なフェーズ計画を作成する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:plan-phase`, `/gsd:quick` |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Write, Bash, Glob, Grep, WebFetch, mcp (context7) |
| **モデル (balanced)** | Opus |
| **カラー** | Green |
| **生成物** | `{phase}-{N}-PLAN.md` ファイル |

**主な動作:**
- PROJECT.md、REQUIREMENTS.md、CONTEXT.md、RESEARCH.md を読み取り
- 単一のコンテキストウィンドウに収まるサイズの原子的タスク計画を2〜3個作成
- `<task>` 要素を含むXML構造を使用
- `read_first` および `acceptance_criteria` セクションを含む
- 計画を依存関係のウェーブにグループ化

---

### gsd-roadmapper

**役割:** フェーズ分解と要件マッピングを含むプロジェクトロードマップを作成する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:new-project` |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Write, Bash, Glob, Grep |
| **モデル (balanced)** | Sonnet |
| **カラー** | Purple |
| **生成物** | `ROADMAP.md` |

**主な動作:**
- 要件をフェーズにマッピング（トレーサビリティ）
- 要件から成功基準を導出
- 粒度設定に基づくフェーズ数の調整
- カバレッジの検証（すべての v1 要件がフェーズにマッピングされていること）

---

### gsd-executor

**役割:** アトミックコミット、逸脱処理、チェックポイントプロトコルを使用して GSD 計画を実行する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:execute-phase`, `/gsd:quick` |
| **並列数** | 複数（ウェーブ内は並列、ウェーブ間は順次） |
| **ツール** | Read, Write, Edit, Bash, Grep, Glob |
| **モデル (balanced)** | Sonnet |
| **カラー** | Yellow |
| **生成物** | コード変更、git コミット、`{phase}-{N}-SUMMARY.md` |

**主な動作:**
- 計画ごとに新しい200Kコンテキストウィンドウを使用
- XMLタスク指示に正確に従う
- 完了したタスクごとにアトミックな git コミットを作成
- チェックポイントタイプの処理: auto, human-verify, decision, human-action
- 計画からの逸脱を SUMMARY.md に報告
- 検証失敗時にノードリペアを実行

---

### gsd-plan-checker

**役割:** 実行前に計画がフェーズ目標を達成できるかを検証する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:plan-phase`（検証ループ、最大3回の反復） |
| **並列数** | 単一インスタンス（反復型） |
| **ツール** | Read, Bash, Glob, Grep |
| **モデル (balanced)** | Sonnet |
| **カラー** | Green |
| **生成物** | 具体的なフィードバック付きの PASS/FAIL 判定 |

**8つの検証ディメンション:**
1. 要件カバレッジ
2. タスクの原子性
3. 依存関係の順序
4. ファイルスコープ
5. 検証コマンド
6. コンテキスト適合性
7. ギャップ検出
8. Nyquist コンプライアンス（有効時）

---

### gsd-integration-checker

**役割:** フェーズ間の統合とエンドツーエンドフローを検証する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:audit-milestone` |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Bash, Grep, Glob |
| **モデル (balanced)** | Sonnet |
| **カラー** | Blue |
| **生成物** | 統合検証レポート |

---

### gsd-ui-checker

**役割:** UI-SPEC.md のデザインコントラクトを品質ディメンションに対して検証する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:ui-phase`（検証ループ、最大2回の反復） |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Bash, Glob, Grep |
| **モデル (balanced)** | Sonnet |
| **カラー** | `#22D3EE`（シアン） |
| **生成物** | BLOCK/FLAG/PASS 判定 |

---

### gsd-verifier

**役割:** ゴール逆算分析によりフェーズ目標の達成を検証する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:execute-phase`（すべてのエグゼキューター完了後） |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Write, Bash, Grep, Glob |
| **モデル (balanced)** | Sonnet |
| **カラー** | Green |
| **生成物** | `{phase}-VERIFICATION.md` |

**主な動作:**
- タスク完了だけでなく、フェーズ目標に対してコードベースを検証
- 具体的なエビデンス付きの PASS/FAIL 判定
- `/gsd:verify-work` で対処すべき問題をログに記録

---

### gsd-nyquist-auditor

**役割:** テストを生成して Nyquist バリデーションのギャップを埋める。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:validate-phase` |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Write, Edit, Bash, Grep, Glob |
| **モデル (balanced)** | Sonnet |
| **生成物** | テストファイル、更新された `VALIDATION.md` |

**主な動作:**
- 実装コードは一切変更しない — テストファイルのみ
- ギャップごとに最大3回の試行
- 実装のバグはユーザーへのエスカレーションとしてフラグを付与

---

### gsd-ui-auditor

**役割:** 実装済みフロントエンドコードの事後的な6ピラービジュアル監査を行う。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:ui-review` |
| **並列数** | 単一インスタンス |
| **ツール** | Read, Write, Bash, Grep, Glob |
| **モデル (balanced)** | Sonnet |
| **カラー** | `#F472B6`（ピンク） |
| **生成物** | スコア付きの `{phase}-UI-REVIEW.md` |

**6つの監査ピラー（1〜4でスコアリング）:**
1. コピーライティング
2. ビジュアル
3. カラー
4. タイポグラフィ
5. スペーシング
6. エクスペリエンスデザイン

---

### gsd-codebase-mapper

**役割:** コードベースを探索し、構造化された分析ドキュメントを作成する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:map-codebase` |
| **並列数** | 4インスタンス（tech, architecture, quality, concerns） |
| **ツール** | Read, Bash, Grep, Glob, Write |
| **モデル (balanced)** | Haiku |
| **カラー** | Cyan |
| **生成物** | `.planning/codebase/*.md`（7ドキュメント） |

**主な動作:**
- 読み取り専用の探索 + 構造化された出力
- ドキュメントを直接ディスクに書き込み
- 推論不要 — ファイル内容からのパターン抽出

---

### gsd-debugger

**役割:** 永続的な状態を持つ科学的手法でバグを調査する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:debug`, `/gsd:verify-work`（失敗時） |
| **並列数** | 単一インスタンス（インタラクティブ） |
| **ツール** | Read, Write, Edit, Bash, Grep, Glob, WebSearch |
| **モデル (balanced)** | Sonnet |
| **カラー** | Orange |
| **生成物** | `.planning/debug/*.md`、ナレッジベースの更新 |

**デバッグセッションのライフサイクル:**
`gathering` → `investigating` → `fixing` → `verifying` → `awaiting_human_verify` → `resolved`

**主な動作:**
- 仮説、エビデンス、排除された理論を追跡
- コンテキストリセット後も状態が永続化
- 解決済みとマークする前に人間による検証を要求
- 解決時に永続的なナレッジベースに追記
- 新しいセッション開始時にナレッジベースを参照

---

### gsd-user-profiler

**役割:** 8つの行動ディメンションにわたってセッションメッセージを分析し、スコア付きの開発者プロファイルを作成する。

| プロパティ | 値 |
|------------|-----|
| **スポーン元** | `/gsd:profile-user` |
| **並列数** | 単一インスタンス |
| **ツール** | Read |
| **モデル (balanced)** | Sonnet |
| **カラー** | Magenta |
| **生成物** | `USER-PROFILE.md`、`/gsd:dev-preferences`、`CLAUDE.md` プロファイルセクション |

**行動ディメンション:**
コミュニケーションスタイル、意思決定パターン、デバッグアプローチ、UXの好み、ベンダー選択、フラストレーショントリガー、学習スタイル、説明の深度。

**主な動作:**
- 読み取り専用エージェント — 抽出されたセッションデータを分析し、ファイルは変更しない
- 信頼度レベルとエビデンス引用を含むスコア付きディメンションを生成
- セッション履歴が利用できない場合はアンケートにフォールバック

---

## エージェントツール権限サマリー

| エージェント | Read | Write | Edit | Bash | Grep | Glob | WebSearch | WebFetch | MCP |
|-------------|------|-------|------|------|------|------|-----------|----------|-----|
| project-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| phase-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| ui-researcher | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| assumptions-analyzer | ✓ | | | ✓ | ✓ | ✓ | | | |
| advisor-researcher | ✓ | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| research-synthesizer | ✓ | ✓ | | ✓ | | | | | |
| planner | ✓ | ✓ | | ✓ | ✓ | ✓ | | ✓ | ✓ |
| roadmapper | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| executor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| plan-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| integration-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| ui-checker | ✓ | | | ✓ | ✓ | ✓ | | | |
| verifier | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| nyquist-auditor | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| ui-auditor | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| codebase-mapper | ✓ | ✓ | | ✓ | ✓ | ✓ | | | |
| debugger | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | | |
| user-profiler | ✓ | | | | | | | | |

**最小権限の原則:**
- チェッカーは読み取り専用（Write/Edit なし） — 評価のみを行い、変更は行わない
- リサーチャーは Web アクセスを持つ — 最新のエコシステム情報が必要なため
- エグゼキューターは Edit を持つ — コードを変更するが Web アクセスは不要
- マッパーは Write を持つ — 分析ドキュメントを作成するが Edit は不要（コード変更なし）
