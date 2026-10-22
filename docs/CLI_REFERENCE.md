# CLI Reference

This document lists all commands and flags supported by **sweepr**.

> **Note:**
> If installed globally, use `sweepr`.
> If installed locally, use `npx sweepr` instead.

---

## Base Command

```bash
sweepr [command] [options]
```

or, for local installs:

```bash
npx sweepr [command] [options]
```

Running without a command scans **all supported project types**.

---

## Commands

| Command         | Description                             |
| --------------- | --------------------------------------- |
| `sweepr`        | Scan all supported project types        |
| `sweepr node`   | Scan Node.js projects only              |
| `sweepr python` | Scan Python virtual environments only   |
| `sweepr config` | Launch interactive configuration wizard |
| `sweepr stats`  | Show lifetime dependency data cleaned      |
| `sweepr help`   | Display help information                |

---

## Global Options

These options apply to all commands.

| Option          | Alias | Description                                |
| --------------- | ----- | ------------------------------------------ |
| `--days <n>`    | `-d`  | Inactivity threshold in days               |
| `--path <dir>`  | `-p`  | Root directory to scan                     |
| `--interactive` | `-i`  | Select projects manually                   |
| `--dry-run`     |       | Simulate cleanup without deleting anything |
| `--trash`       |       | Move files to system trash (default)       |
| `--no-trash`    |       | Permanently delete files (**dangerous**)   |
| `--yes`         | `-y`  | Skip all confirmation prompts              |

---

## Examples

### Scan current directory

```bash
sweepr
```

or:

```bash
npx sweepr
```

---

### Scan a specific path

```bash
sweepr --path ~/Projects
```

---

### Clean Node.js projects only (interactive)

```bash
sweepr node -i
```

---

### Preview cleanup without deleting (recommended)

```bash
sweepr --dry-run
```

---

### Force cleanup without prompts (use carefully)

```bash
sweepr --yes --no-trash
```

> ⚠️ **Warning:** This permanently deletes files without confirmation.

---

## Flag Precedence

Flags are resolved in the following priority order:

1. **CLI flags**
2. **Config file** (`~/.sweeprrc`)
3. **Built-in defaults**

CLI flags always override saved configuration values.


Cleanup reporting measures dependency data processed, not a measured change in free disk space. Trash mode reports **Moved to trash**; empty the Trash / Recycle Bin to free the storage. Permanent mode reports **Deleted**. Lifetime statistics show **dependency data cleaned**, including historical totals.

Python dry runs do not execute pip or write requirements files. Their size estimates are provisional: actual cleanup skips environments whose dependency export fails. Cancelled and unselected environments do not receive a requirements export. Explicit `--dry-run` also skips the first-run configuration wizard.


Performance options: `--skip-size` defers sizing until after selection, `--concurrency <1-128>` controls filesystem calls (default 16), and `--timings` reports stage durations. See [Performance controls](PERFORMANCE.md).
