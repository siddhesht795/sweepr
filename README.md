# 🧹 sweepr

A smart CLI tool that cleans up old dependencies and cache from projects you're not actively working on.

## The Problem

If you're a developer, your hard drive is likely littered with `node_modules` folders, Python `venv`s, and `__pycache__` directories. Each one can consume hundreds of megabytes (or even gigabytes!) of space.

Deleting them manually is risky—what if you're still working on that project?

## The Solution

**sweepr** solves this by intelligently scanning for **"inactive"** projects.

It's smart: "inactivity" isn't just the folder's last-opened date. `sweepr` scans your project and finds the "last modified" time of your **actual code files** (like `.js`, `.ts`, `.json`, `.py`).

If you haven't changed any *code* in a project for a set amount of time (e.g., 30 days), it's considered "inactive," and its dependencies become targets for deletion.

## Demo

```bash
$ sweepr --dry-run --days 60
Running all cleanup operations...

--- Running Node.js Cleanup ---
Scanning for projects in: /home/siddhesh/Projects
Finding projects inactive for 60 days (last code change before 9/8/2025)...
Calculating sizes... This may take a moment.

Found 2 inactive projects containing node_modules:
- Project: /home/siddhesh/Projects/old-blog
  (Last code change: 7/15/2025) -> .../old-blog/node_modules (234.5 MB)
- Project: /home/siddhesh/Projects/archive/defunct-startup
  (Last code change: 1/2/2025) -> .../defunct-startup/node_modules (412.0 MB)
[DRY RUN] No folders will be deleted.
Total space that would be reclaimed: 646.5 MB

--- Running Python Cleanup ---
Python cleanup feature is not yet implemented. Coming soon!

All cleanup operations complete.
````

-----

## ✨ Features

  - **Multi-Language Support:** Cleans up Node.js (`node_modules`) and (soon) Python (`venv`, `__pycache__`).
  - **Smart Activity Scan:** Checks code file timestamps, not just `README.md` or `.env` files.
  - **Storage Calculation:** Scans the size of each dependency folder and shows you the total space you'll reclaim.
  - **Configurable Defaults:** Run `sweepr config` to set your default inactivity period and scan path.
  - **Dry Run Mode:** Includes a `--dry-run` flag to see what would be deleted, with zero risk.
  - **Interactive Mode:** Use the `-i` flag to approve or deny the deletion of *each folder* one by one.
  - **Recursive:** Scans all sub-folders to find every project, no matter how deeply nested.

-----

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

Run the interactive wizard to set your preferred defaults (like `90` days).

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

#### 4\. Run Interactively (Safest way to delete)

This will scan, then ask you "yes/no" for *each project* it finds.

```bash
sweepr -i
```

#### 5\. Delete without confirmation (⚠️ Use with caution\!)

The `-y` flag skips all prompts and deletes everything it finds.

```bash
sweepr --days 90 -y
```

-----

## ⚙️ Configuration (CLI Options)

Flags always override your saved config.

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| **`--days <number>`** | `-d` | The number of days of inactivity to check for. | `30` (or as set by `sweepr config`) |
| **`--path <directory>`**| `-p` | The root directory to start scanning from. | Current directory (or as set by `sweepr config`) |
| **`--dry-run`** | | List projects to be cleaned without deleting. | `false` |
| **`--yes`** | `-y` | Skip all confirmation prompts. | `false` |
| **`--interactive`** | `-i` | Ask for confirmation for each folder one-by-one. | `false` |

-----

## 💡 How "Activity" is Measured

This tool is smart about what it considers "activity."

  - It recursively scans every file and folder in your project **except** for directories like `.git`, `dist`, `build`, and (of course) `node_modules`.
  - It **only** checks the "last modified" time of files with "code" extensions (e.g., `.js`, `.mjs`, `.ts`, `.tsx`, `.json`, `.css`, `.html`, `.py`, etc.).
  - This means changing a `README.md`, `.env`, or `.gitignore` file **will not** mark your project as "active." This is intentional, as you haven't changed the *code*.

You can customize the list of extensions and ignored directories by editing the `CODE_EXTENSIONS` and `IGNORE_DIRS` sets at the top of `index.js`.
