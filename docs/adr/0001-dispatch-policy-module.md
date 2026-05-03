# Dispatch policy module as single seam for query execution outcomes

We decided to centralize query dispatch outcomes in one Dispatch Policy Module that returns a structured union result (`ok` success or failure with typed `kind`, `details`, and final `exit_code`) instead of mixing throws and ad-hoc error mapping across CLI and SDK paths. This keeps fallback policy, timeout classification, and exit mapping in one place for better locality, prevents drift between native and fallback behavior, and makes callers thin adapters over a stable interface.
