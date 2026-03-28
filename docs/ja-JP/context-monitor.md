# コンテキストウィンドウモニター

ツール使用後に実行されるフック（Claude Code では `PostToolUse`、Gemini CLI では `AfterTool`）で、コンテキストウィンドウの使用量が高くなった際にエージェントに警告します。

## 課題

ステータスラインはコンテキスト使用量を**ユーザー**に表示しますが、**エージェント**自身はコンテキストの制限を認識していません。コンテキストが不足すると、エージェントは限界に達するまで作業を続行し、タスクの途中で状態を保存できないまま停止する可能性があります。

## 仕組み

1. ステータスラインフックがコンテキストメトリクスを `/tmp/claude-ctx-{session_id}.json` に書き込む
2. 各ツール使用後、コンテキストモニターがこのメトリクスを読み取る
3. 残りコンテキストがしきい値を下回ると、`additionalContext` として警告を注入する
4. エージェントが会話内で警告を受け取り、適切に対応できる

## しきい値

| レベル | 残量 | エージェントの動作 |
|--------|------|------------------|
| Normal | > 35% | 警告なし |
| WARNING | <= 35% | 現在のタスクをまとめ、新しい複雑な作業の開始を避ける |
| CRITICAL | <= 25% | 即座に停止し、状態を保存する（`/gsd:pause-work`） |

## デバウンス

エージェントへの繰り返し警告を防ぐため:
- 最初の警告は即座に発火
- 以降の警告は間に5回のツール使用が必要
- 深刻度のエスカレーション（WARNING -> CRITICAL）はデバウンスをバイパス

## アーキテクチャ

```
ステータスラインフック (gsd-statusline.js)
    | 書き込み
    v
/tmp/claude-ctx-{session_id}.json
    ^ 読み取り
    |
コンテキストモニター (gsd-context-monitor.js, PostToolUse/AfterTool)
    | 注入
    v
additionalContext -> エージェントが警告を確認
```

ブリッジファイルはシンプルな JSON オブジェクトです:

```json
{
  "session_id": "abc123",
  "remaining_percentage": 28.5,
  "used_pct": 71,
  "timestamp": 1708200000
}
```

## GSD との統合

GSD の `/gsd:pause-work` コマンドは実行状態を保存します。WARNING メッセージはこのコマンドの使用を提案し、CRITICAL メッセージは即座の状態保存を指示します。

## セットアップ

両フックは `npx get-shit-done-cc` のインストール時に自動的に登録されます:

- **ステータスライン**（ブリッジファイルの書き込み）: settings.json の `statusLine` として登録
- **コンテキストモニター**（ブリッジファイルの読み取り）: settings.json の `PostToolUse` フックとして登録（Gemini では `AfterTool`）

`~/.claude/settings.json`（Claude Code）への手動登録:

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/hooks/gsd-statusline.js"
  },
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.claude/hooks/gsd-context-monitor.js"
          }
        ]
      }
    ]
  }
}
```

Gemini CLI（`~/.gemini/settings.json`）の場合、`PostToolUse` の代わりに `AfterTool` を使用します:

```json
{
  "hooks": {
    "AfterTool": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node ~/.gemini/hooks/gsd-context-monitor.js"
          }
        ]
      }
    ]
  }
}
```

## 安全性

- フックは全体を try/catch で囲み、エラー時はサイレントに終了
- ツール実行をブロックしない — モニターの故障がエージェントのワークフローを壊してはならない
- 古いメトリクス（60秒以上前）は無視
- ブリッジファイルが存在しない場合も正常に処理（サブエージェント、新規セッション）
