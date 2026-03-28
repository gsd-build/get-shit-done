---
phase: '01-test'
plan: '01'
type: execute
wave: 1
depends_on: []
files_modified:
  - output.txt
autonomous: true
requirements:
  - TEST-01
must_haves:
  truths:
    - output.txt exists with expected content
  artifacts:
    - output.txt
  key_links: []
---

<objective>
Create a simple output file to prove the SDK can execute a plan end-to-end.
</objective>

<tasks>
<task type="auto">
<name>Create output file</name>
<files>output.txt</files>
<action>Create output.txt with content 'hello from gsd-sdk'</action>
<verify>test -f output.txt</verify>
<done>output.txt exists with expected content</done>
</task>
</tasks>
