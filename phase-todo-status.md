| Phase | Item | Status | Evidence |
|---|---|---|---|
| 13 | Production-safe Socket.IO endpoint resolution (no localhost in UI config) | Fixed | Production network traffic uses `https://api.labs.aversoft.net/socket.io/...`; no localhost fallback observed. |
| 13 | WS URL derives per environment | Fixed | Plan/Verify/Discuss all connect via configured API host in production, not hardcoded localhost. |
| 13 | Reconnect behavior after endpoint fix | Improved / mostly fixed | Real-time connections establish reliably in production; no CORS rejection observed in latest live checks. |
| 14 | Frontend/backend API+WS base URL contract in prod | Fixed | API and Socket traffic both resolve to `api.labs.aversoft.net` through production UI flows. |
| 14 | Health check for real-time channel handshake | Partially addressed | Runtime handshake succeeds in live checks; explicit `/socket/room` health contract endpoint still not independently validated as a dedicated probe. |
| 14 | Auth/project APIs + socket namespace same-origin or proper CORS | Fixed | Auth + project APIs succeed and Socket.IO polling/connection requests return 200 from production origin. |
| 15 | Actionable error affordances on dashboard/execute cards | Fixed | Recovery CTAs and next-step guidance are visible and actionable in Execute/verification flows. |
| 15 | Clear navigation gating for unavailable features | Fixed | Plan/Verify/Discuss routes are live and interactive in production project navigation. |
| 15 | Mobile touch target minimums | Mostly fixed | Spot checks on production controls show 44px-high targets on key dashboard filters/navigation actions. |
| 15 | Login form semantics (name, autocomplete attrs) | Fixed | Login inputs now expose `name="username"`, `name="password"`, `autocomplete="username"`, `autocomplete="current-password"`. |
| 16 | Deploy/enable `/projects/:id/discuss` in production | Fixed | Route loads in production and renders Discuss UI without 404. |
| 16 | Replace “Coming soon” only when Discuss is live; otherwise hide | Fixed | Discuss now appears as active route/action since feature is live. |
| 16 | Validate Discuss E2E (streaming/preview/locks/persistence) | Mostly fixed | Streaming and context preview validated manually in production; lock-state/persistence depth remains only partially exercised manually. |
| 17 | Execute-phase goals in production | Mostly fixed | Recovery UX and guidance present; execution UI is stable in production, with behavior dependent on available runnable plan files. |
