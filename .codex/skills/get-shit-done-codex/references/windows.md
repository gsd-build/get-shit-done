# Windows + PowerShell conversion notes

## JSON parse

```powershell
$raw = & node .claude/get-shit-done/bin/gsd-tools.js state load --raw
$data = $raw | ConvertFrom-Json
```

## Key/value parse

```powershell
$raw = & node .claude/get-shit-done/bin/gsd-tools.js state load --raw
$out = @{}
$raw -split "`n" | ForEach-Object {
  if ($_ -match '^(.*?)=(.*)$') { $out[$Matches[1]] = $Matches[2] }
}
```

## Syntax notes
- Replace jq with `ConvertFrom-Json`.
- Avoid bash-only heredocs and command substitution.
- Use quoted paths for PowerShell compatibility.
