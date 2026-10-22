# sweepr

[![npm version](https://img.shields.io/npm/v/sweepr.svg)](https://www.npmjs.com/package/sweepr)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**sweepr** is a smart, safety-first CLI tool that helps developers reclaim disk space by cleaning up **inactive project dependencies** such as `node_modules` and Python virtual environments — without risking active work.

Unlike manual deletion or naive cleanup scripts, `sweepr` determines *true project inactivity* by analyzing **actual code changes**, not folder timestamps.

## Features

- **Smart Inactivity Detection**  
  Determines inactivity based on last modification time of real code files (`.js`, `.ts`, `.py`, etc.)

- **Multi-Language Support**  
  - Node.js: `node_modules`  
  - Python: `venv`, `.venv`, `env`

- **Python Safety Net**  
  Automatically generates `requirements.sweepr.txt` before deleting a Python virtual environment

- **Soft Delete by Default**  
  Moves folders to system Trash / Recycle Bin for easy recovery

- **Interactive Mode**  
  Select exactly which projects to clean

- **Dry-Run Support**  
  Preview cleanup results without deleting anything

- **Lifetime Stats**  
  Tracks dependency data cleaned across all runs

- **Cross-Platform**  
  Works on macOS, Linux, and Windows

## Documentation

- **[Getting Started](docs/GETTING_STARTED.md)** — Installation and first cleanup
- **[CLI Reference](docs/CLI_REFERENCE.md)** — Commands and flags
- **[Configuration Guide](docs/CONFIGURATION.md)** — Global defaults and config file
- **[Safety & Design](docs/SAFETY_MODEL.md)** — How sweepr avoids deleting active projects
- **[Contributing](CONTRIBUTING.md)** — How to contribute

## Installation

### Global Installation (Recommended)

```bash
npm install -g sweepr
````

Verify installation:

```bash
sweepr --help
```

## Quick Start

### 1. Configure defaults (recommended)

```bash
sweepr config
```

Set:

* Inactivity threshold (days)
* Default scan path
* Trash vs permanent delete
* Dry-run preference

---

### 2. Preview cleanup (safe)

```bash
sweepr --dry-run
```

---

### 3. Interactive cleanup (best control)

```bash
sweepr -i
```

---

## Example Output

```bash
$ sweepr --days 60

✔ Scan complete. Found 2 inactive projects.

📦 Eligible for cleanup:
   234.5 MB  ~/Projects/old-blog
   412.0 MB  ~/Projects/archive/defunct-app
   ────────
   646.5 MB  TOTAL

ℹ️ Mode: Trash (safe)

? Proceed? Yes
✔ Cleanup complete!
```

---

## CLI Commands

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `sweepr`        | Scan all supported project types   |
| `sweepr node`   | Clean Node.js projects only        |
| `sweepr python` | Clean Python virtual environments  |
| `sweepr config` | Interactive configuration wizard   |
| `sweepr stats`  | Show lifetime dependency data cleaned |
| `sweepr help`   | Display full CLI help              |

---

## CLI Options

| Flag            | Alias | Description                        |
| --------------- | ----- | ---------------------------------- |
| `--days <n>`    | `-d`  | Inactivity threshold (default: 30) |
| `--path <dir>`  | `-p`  | Root directory to scan             |
| `--interactive` | `-i`  | Select projects manually           |
| `--dry-run`     |       | Preview without deleting           |
| `--trash`       |       | Move to system trash (default)     |
| `--no-trash`    |       | Permanently delete (dangerous)     |
| `--yes`         | `-y`  | Skip confirmation prompts          |

---

## Configuration

`sweepr` stores configuration in:

```bash
~/.sweeprrc
```

Example:

```json
{
  "days": 90,
  "path": "/Users/name/Projects",
  "trash": true,
  "dryRun": false
}
```

Flags always override config values.

---

## How Activity Is Determined

`sweepr`:

* Recursively scans project directories
* Ignores dependency and build folders (`node_modules`, `venv`, `dist`, `.git`, etc.)
* Considers only **real code files**
* Ignores changes to `README.md`, `.env`, and dependency lockfiles; code and other supported configuration files count as activity

This prevents false positives and accidental deletion of active projects.

---

## Tech Stack

* **Node.js**
* **Commander.js** — CLI framework
* **Inquirer.js** — Interactive prompts
* **Trash** — Cross-platform soft delete
* **Chalk & Ora** — Terminal UI
* **Vitest** — Safety-critical tests

---

## Testing

```bash
npm test
```

---

## Contributing

Contributions are welcome.

1. Fork the repo
2. Create a feature branch
3. Add tests for safety-critical logic
4. Submit a pull request

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for details.

---

## License

MIT License — see the [LICENSE](LICENSE) file.

---

## Author

**Siddhesh Todi**
GitHub: [https://github.com/siddhesht795](https://github.com/siddhesht795)
npm: [https://www.npmjs.com/package/sweepr](https://www.npmjs.com/package/sweepr)

---

## Links

* **npm Package:** [https://www.npmjs.com/package/sweepr](https://www.npmjs.com/package/sweepr)
* **GitHub Repository:** [https://github.com/siddhesht795/sweepr](https://github.com/siddhesht795/sweepr)
* **Documentation:** [https://github.com/siddhesht795/sweepr/tree/main/docs](https://github.com/siddhesht795/sweepr/tree/main/docs)
* **Issue Tracker:** [https://github.com/siddhesht795/sweepr/issues](https://github.com/siddhesht795/sweepr/issues)

---

Made with care for developers who value clean systems and safe tooling.


Cleanup reporting measures dependency data processed, not a measured change in free disk space. Trash mode reports **Moved to trash**; empty the Trash / Recycle Bin to free the storage. Permanent mode reports **Deleted**. Lifetime statistics show **dependency data cleaned**, including historical totals.

Python dry runs do not execute pip or write requirements files. Their size estimates are provisional: actual cleanup skips environments whose dependency export fails. Cancelled and unselected environments do not receive a requirements export. Explicit `--dry-run` also skips the first-run configuration wizard.


Performance options: `--skip-size` defers sizing until after selection, `--concurrency <1-128>` controls filesystem calls (default 16), and `--timings` reports stage durations. See [Performance controls](docs/PERFORMANCE.md).
