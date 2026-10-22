# Performance controls

Sweepr discovers Node.js dependencies and Python environments in one shared scan when running the default command. It reuses directory listings and project activity results only within the current run. Source changes are checked afresh on every subsequent run.

Activity checking stops once a recent code/configuration file proves a project is active. This shortcut does not stop discovery of nested projects. Inactive candidates still receive their newest source timestamp. Inaccessible source trees are treated conservatively and excluded from inactive cleanup candidates.

Filesystem calls share a concurrency limit (16 by default). This applies across discovery, source metadata checks, and size calculations. Larger limits are not automatically faster; benchmark the actual disk before tuning.

## Faster previews

```powershell
node bin/sweepr.js --path "D:\Siddhesh\Projects" --dry-run --skip-size --timings
```

- `--skip-size` skips byte totals before selection. During actual cleanup, only confirmed selections are measured, preserving summary and lifetime byte totals. Dry runs and cancellations do not perform the deferred size traversal.
- `--concurrency <number>` sets a limit from 1 through 128. Default: 16.
- `--timings` prints scan, preview-size, preparation, deferred-size, and deletion durations as applicable. Prompt time is excluded from cleanup-stage timings.

Default behavior still includes size estimates before selection. Python dependency export still happens only for confirmed selections and must succeed before deletion. Trash remains the default, and `--dry-run` changes no project files.

## Boundaries

Exact byte totals require walking dependency files. Limiting concurrency controls filesystem pressure but cannot eliminate that work. Python export and operating-system trash operations can still dominate actual cleanup. There is no persistent scan cache and no added language support.
