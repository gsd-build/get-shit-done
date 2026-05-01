---
type: Fixed
pr: 2997
---
SDK config-set/config-get and init responses no longer echo plaintext API keys. New sdk/src/query/secrets.ts ports SECRET_CONFIG_KEYS masking from CJS; init bundles only mask string values to preserve the boolean availability-flag contract. See #2997.
