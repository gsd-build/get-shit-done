---
title: First
title: Second
status: active
status: blocked
phase: 01
---

Body content for duplicate-keys fixture.

When the parser encounters a key twice in the same block, the test pins
what is currently observed (last-wins) so a silent semantics change
becomes a test failure rather than a quiet data shift.
