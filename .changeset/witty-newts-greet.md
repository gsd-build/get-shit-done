---
type: Fixed
pr: 2992
---
/gsd-update queries wrong npm package names — moved package name into a deterministic check-latest-version.cjs script and updated the workflow to use ${GSD_DIR} from get_installed_version. See #2992.
