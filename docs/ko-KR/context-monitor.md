# 컨텍스트 윈도우 모니터

에이전트의 컨텍스트 윈도우 사용량이 높을 때 경고를 주는 post-tool 훅입니다 (Claude Code의 경우 `PostToolUse`, Gemini CLI의 경우 `AfterTool`).

## 문제

상태바(statusline)는 **사용자**에게 컨텍스트 사용량을 보여주지만 **에이전트** 자체는 컨텍스트 한계를 인식하지 못합니다. 컨텍스트가 부족해지면 에이전트는 한계에 부딪힐 때까지 작업을 계속 진행하며 상태가 저장되지 않은 채 작업 도중에 멈출 수 있습니다.

## 동작 방식

1. statusline 훅이 컨텍스트 메트릭을 `/tmp/claude-ctx-{session_id}.json`에 기록합니다.
2. 각 도구 사용 후 context monitor가 해당 메트릭을 읽습니다.
3. 남은 컨텍스트가 임계값 아래로 떨어지면 `additionalContext`로 경고를 주입합니다.
4. 에이전트는 대화에서 경고를 받고 그에 맞게 대응할 수 있습니다.

## 임계값

| 레벨 | 남은 비율 | 에이전트 동작 |
|------|-----------|---------------|
| Normal | > 35% | 경고 없음 |
| WARNING | <= 35% | 현재 작업 마무리, 새로운 복잡한 작업 시작 금지 |
| CRITICAL | <= 25% | 즉시 중단 후 상태 저장 (`/gsd:pause-work`) |

## Debounce

에이전트에게 반복적인 경고가 쌓이는 것을 방지하기 위한 동작입니다.
- 첫 번째 경고는 항상 즉시 발생합니다.
- 이후 경고는 5번의 도구 사용 간격이 필요합니다.
- 심각도 상승 (WARNING → CRITICAL) 시에는 debounce를 우회합니다.

## 아키텍처

```
Statusline Hook (gsd-statusline.js)
    | 기록
    v
/tmp/claude-ctx-{session_id}.json
    ^ 읽기
    |
Context Monitor (gsd-context-monitor.js, PostToolUse/AfterTool)
    | 주입
    v
additionalContext -> 에이전트가 경고를 받음
```

브리지 파일은 단순한 JSON 객체입니다.

```json
{
  "session_id": "abc123",
  "remaining_percentage": 28.5,
  "used_pct": 71,
  "timestamp": 1708200000
}
```

## GSD와의 통합

GSD의 `/gsd:pause-work` 명령어는 실행 상태를 저장합니다. WARNING 메시지는 해당 명령어 사용을 권장하며 CRITICAL 메시지는 즉각적인 상태 저장을 지시합니다.

## 설정

두 훅 모두 `npx get-shit-done-cc` 설치 중에 자동으로 등록됩니다.

- **Statusline** (브리지 파일 기록): settings.json에 `statusLine`으로 등록
- **Context Monitor** (브리지 파일 읽기): settings.json에 `PostToolUse` 훅으로 등록 (Gemini의 경우 `AfterTool`)

`~/.claude/settings.json`에 수동으로 등록하는 방법 (Claude Code):

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

Gemini CLI (`~/.gemini/settings.json`)의 경우 `PostToolUse` 대신 `AfterTool`을 사용합니다.

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

## 안전성

- 훅은 모든 동작을 try/catch로 감싸며 오류 발생 시 조용히 종료합니다.
- 도구 실행을 절대 차단하지 않습니다. 모니터에 문제가 생겨도 에이전트 워크플로우가 중단되지 않습니다.
- 60초 이상 된 오래된 메트릭은 무시됩니다.
- 누락된 브리지 파일은 정상적으로 처리됩니다 (서브에이전트, 새 세션 등의 경우).
