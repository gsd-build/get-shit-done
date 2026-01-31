# Fork Information

This repository is a community fork of [glittercowboy/get-shit-done](https://github.com/glittercowboy/get-shit-done), originally created by **TÂCHES** (Lex Christopherson).

## Fork Details

| Property | Original | Fork |
|----------|----------|------|
| Package | `get-shit-done-cc` | `get-shit-done-together` |
| CLI Command | `get-shit-done-cc` | `get-shit-done-together` |
| Repository | glittercowboy/get-shit-done | zpyoung/get-shit-done-together |
| Maintainer | TÂCHES | zpyoung |

## Attribution

This project stands on the shoulders of excellent work by TÂCHES. The core GSD system, meta-prompting architecture, and workflow design are all from the original project.

## Upstream Sync Strategy

This fork maintains compatibility with upstream while adding community enhancements.

### Adding Upstream Remote

```bash
git remote add upstream https://github.com/glittercowboy/get-shit-done.git
git fetch upstream
```

### Syncing Changes

```bash
# Fetch upstream changes
git fetch upstream

# Review what's new
git log HEAD..upstream/main --oneline

# Merge upstream (prefer rebase for clean history)
git rebase upstream/main
# OR
git merge upstream/main
```

### Conflict Resolution

When upstream changes conflict with fork customizations:
1. Fork customizations take precedence for branding (package name, URLs)
2. Upstream takes precedence for core functionality
3. Document any divergence in this file

## Fork Customizations

Changes made in this fork that differ from upstream:

1. **Package Identity**
   - Renamed for independent npm publication
   - Repository URLs point to fork

2. **Documentation**
   - URLs updated to fork repository
   - Dual attribution added

## Contributing

Contributions welcome! For changes that would benefit upstream:
1. Consider contributing to [the original project](https://github.com/glittercowboy/get-shit-done) first
2. Fork-specific changes go here

## License

MIT License - same as original. See [LICENSE](LICENSE) for full text.
