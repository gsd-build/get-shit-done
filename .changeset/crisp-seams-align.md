---
type: Changed
pr: 3419
---
SDK query compatibility now routes `write-profile` default path and query CLI fallback/error imports through explicit package-seam adapters, reducing install-layout coupling outside `sdk-package-compatibility`.
