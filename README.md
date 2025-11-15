# 🧹 sweepr

![sweepr Logo Placeholder](./src/logo/sweepr_logo_NoBG_2.png)

A smart, safe CLI tool that cleans up old dependencies and cache from projects you're not actively working on.

## The Problem

If you're a developer, your hard drive is likely littered with `node_modules` folders, Python `venv`s, and `__pycache__` directories. Each one can consume hundreds of megabytes (or even gigabytes!) of space.

Deleting them manually is risky—what if you're still working on that project?

## The Solution

**sweepr** solves this by intelligently scanning for **"inactive"** projects.

It's smart: "inactivity" isn't just the folder's last-opened date. `sweepr` scans your project and finds the "last modified" time of your **actual code files** (like `.js`, `.ts`, `.json`, `.py`).

If you haven't changed any *code* in a project for a set amount of time (e.g., 30 days), it's considered "inactive," and its dependencies become targets for cleanup.

## Demo

```bash
$ sweepr --days 60

 NODE.JS CLEANUP
Path: /home/siddhesh/Projects
Inactivity Threshold: 60 days (09/09/2025)

✔ Scan complete. Found 2 inactive projects.
✔ Calculating potential space savings...

📦 Projects eligible for cleanup:
   234.5 MB  /home/siddhesh/Projects/old-blog (Last active: 07/15/2025)
   412.0 MB  /home/siddhesh/Projects/archive/defunct-startup (Last active: 01/02/2025)
   ────────
   646.5 MB  TOTAL RECLAIMABLE SPACE

ℹ️  Mode: Moving to system trash (safer)

? Ready to clean 2 projects (646.5 MB)? Yes
✔ All projects cleaned successfully!

 SUMMARY
✅ Cleaned:   2 projects
🎉 Reclaimed: 646.5 MB of disk space!
📈 Lifetime reclaimed: 1.2 GB
````

## ✨ Features

  * **Multi-Language Support:** Cleans up Node.js (`node_modules`) and Python (`venv`).
  * **Smart Activity Scan:** Checks code file timestamps, not just `README.md` or `.env` files.
  * **Python `venv` Safety:** Automatically generates `requirements.sweepr.txt` for inactive `venv`s before deletion, ensuring you can rebuild your environment.
  * **Structural `venv` Detection:** Identifies Python virtual environments by their internal structure (`pyvenv.cfg`), regardless of their folder name.
  * **Lifetime Savings Tracking:** Run `sweepr stats` to see a running total of all the disk space you've reclaimed\!
  * **Soft Delete (Safer):** Moves folders to your system Trash/Recycle Bin by default, so you can undo mistakes.
  * **Modern UI:** Beautiful terminal output with spinners, colors, and clear summaries.
  * **Configurable Defaults:** Run `sweepr config` to set your preferred inactivity period, path, and safety settings.
  * **Interactive Mode:** Use `-i` to approve or deny each folder one by one.
  * **Dry Run Mode:** Use `--dry-run` to see exactly what would happen without touching a single file.

## 🚀 Installation & Usage

### Local Development (Right Now)

1.  Navigate to your `sweepr` project directory.
2.  Run `npm link` (you only need to do this once).
3.  You can now run the `sweepr` command from anywhere in your terminal\!

### Global Installation (After Publishing to NPM)

Once you publish this to NPM, anyone can install it with:

```bash
npm install -g sweepr
```

### Usage

Run `sweepr` commands from any directory.

#### 1\. Set your defaults (Recommended first step)

Run the interactive wizard to set your preferred defaults (like `90` days, or enabling permanent deletion).

```bash
sweepr config
```

#### 2\. See what it *would* delete (Safe Mode)

This is the recommended first command. It will use your saved defaults.

```bash
sweepr --dry-run
```

#### 3\. Clean *only* Node.js projects

```bash
sweepr node
```

#### 4\. Clean *only* Python projects

This will scan for inactive Python virtual environments (`venv`s) and, before deleting, will attempt to generate a `requirements.sweepr.txt` file in the project's root for safe rebuilding.

```bash
sweepr python
```

#### 5\. Run Interactively (Safest way to delete)

This will scan, then ask you "yes/no" for *each project* it finds.

```bash
sweepr -i
```

#### 6\. Force permanent deletion (⚠️ Dangerous\!)

Override the "trash" default and permanently delete files.

```bash
sweepr --no-trash
```

#### 7\. Check your lifetime savings

See how much disk space you've reclaimed since you started using `sweepr`\!

```bash
sweepr stats
```

## ⚙️ Configuration (CLI Options)

Flags always override your saved config.

| Flag | Alias | Description | Default |
| ----- | ----- | ----- | ----- |
| **`--days <number>`** | `-d` | The number of days of inactivity to check for. | `30` (or as set by `config`) |
| **`--path <directory>`** | `-p` | The root directory to start scanning from. | Current directory (or as set by `config`) |
| **`--trash`** |  | Move deleted folders to the system trash (safer). | `true` (or as set by `config`) |
| **`--no-trash`** |  | **Permanently** delete folders (dangerous). |  |
| **`--dry-run`** |  | List projects to be cleaned without deleting. | `false` (or as set by `config`) |
| **`--yes`** | `-y` | Skip all confirmation prompts. | `false` |
| **`--interactive`** | `-i` | Ask for confirmation for each folder one-by-one. | `false` |

## 💡 How "Activity" is Measured

This tool is smart about what it considers "activity."

  * It recursively scans every file and folder in your project **except** for directories like `.git`, `dist`, `build`, `node_modules`, `venv`, `__pycache__`, and other dependency/cache folders.
  * It **only** checks the "last modified" time of files with "code" extensions (e.g., `.js`, `.mjs`, `.ts`, `.tsx`, `.json`, `.css`, `.html`, `.py`, etc.).
  * This means changing a `README.md`, `.env`, or `.gitignore` file **will not** mark your project as "active." This is intentional, as you haven't changed the *code*.

You can customize the list of extensions and ignored directories by editing the `CODE_EXTENSIONS` and `IGNORE_DIRS` sets in `src/constants.js`.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](https://www.google.com/search?q=LICENSE) file for details.