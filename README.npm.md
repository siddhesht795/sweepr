# sweepr

**A smart CLI tool to clean up inactive dev dependencies (`node_modules`, `venv`) and reclaim disk space.**

Unlike a simple delete script, `sweepr` intelligently detects inactivity based on code file timestamps, respects safety checks (like generating `requirements.txt` for Python), and supports soft deletion to the system trash.

## 🚀 Installation

```bash
npm install -g sweepr
```

## 📖 Usage

Run `sweepr` commands from any directory.

### Quick Start

Clean all supported project types in the current directory (interactive mode is safer):

```bash
sweepr -i
```

### Commands

| Command | Description |
| --- | --- |
| `sweepr` | Run scan for all languages (Node & Python) using defaults. |
| `sweepr node` | Scan and clean **only** Node.js `node_modules`. |
| `sweepr python` | Scan and clean **only** Python `venv`s (with auto-receipt generation). |
| `sweepr config` | Run the interactive wizard to set global defaults (path, days, etc.). |
| `sweepr stats` | Show total lifetime disk space reclaimed. |
| `sweepr help` | Show the full help menu. |

### Options (Flags)

| Flag | Alias | Description |
| --- | --- | --- |
| `--days <n>` | `-d` | Inactivity threshold in days (Default: 30). |
| `--path <dir>` | `-p` | Root directory to scan (Default: current dir). |
| `--interactive` | `-i` | **Recommended:** Show a list and ask to select folders to clean. |
| `--dry-run` |  | Simulate deletion without touching files. |
| `--trash` |  | Move to system trash (Default: true). |
| `--no-trash` |  | **Dangerous:** Permanently delete files. |
| `--yes` | `-y` | Skip all confirmation prompts (Useful for scripts). |

## ⚙️ Configuration

You can set your preferences globally so you don't have to type flags every time.

Run the wizard:

```bash
sweepr config
```

Or manually edit `~/.sweeprrc`:

```json
{
  "days": 90,
  "path": "/Users/name/Projects",
  "trash": true,
  "dryRun": false
}
```

## 💡 Supported Project Types

* **Node.js:** Looks for `node_modules`.
* **Python:** Looks for folders containing `pyvenv.cfg` (standard venvs).
* *Safety Feature:* Automatically runs `pip freeze > requirements.sweepr.txt` before deletion.

## 📄 License
MIT License

Copyright (c) 2025 Siddhesh Todi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.