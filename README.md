# 🧹 sweepr

A smart CLI tool that cleans up old `node_modules` folders from projects you're not actively working on.

## The Problem

If you're a Node.js developer, your hard drive is likely littered with `node_modules` folders. Each one can consume hundreds of megabytes (or even gigabytes!) of space.

Deleting them manually is risky—what if you're still working on that project?

## The Solution

**sweepr** solves this by intelligently scanning for **"inactive"** projects.

It's smart: "inactivity" isn't just the folder's last-opened date. `sweepr` scans your project and finds the "last modified" time of your **actual code files** (like `.js`, `.ts`, `.json`).

If you haven't changed any *code* in a project for a set amount of time (e.g., 30 days), it's considered "inactive," and its `node_modules` folder becomes a target for deletion.

## Demo

Here's how it works. It finds old projects, shows you how much space you'll save, and asks for confirmation.

```bash
$ sweepr --dry-run --days 60
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
````

-----

## ✨ Features

  - **Smart Activity Scan:** Checks code file timestamps (`.js`, `.ts`, etc.), not just `README.md` or `.env` files.
  - **Storage Calculation:** Scans the size of each `node_modules` folder and shows you the total space you'll reclaim.
  - **Safe by Default:** Always asks for confirmation before deleting anything.
  - **Dry Run Mode:** Includes a `--dry-run` flag to see what would be deleted, with zero risk.
  - **Interactive Mode:** Use the `-i` flag to approve or deny the deletion of *each folder* one by one.
  - **Recursive:** Scans all sub-folders to find every project, no matter how deeply nested.

-----

## 🚀 Installation & Usage

### Local Development (Right Now)

To use your tool on your own machine, you don't install it, you "link" it.

1.  Navigate to your `sweepr` project directory.
2.  Run this command once:
    ```bash
    npm link
    ```
3.  You can now run the `sweepr` command from anywhere in your terminal\!

### Global Installation (After Publishing to NPM)

Once you publish this to NPM, anyone can install it with:

```bash
npm install -g sweepr
```

### Usage

You can run the `sweepr` command from any directory.

#### 1\. See what it *would* delete (Safe Mode)

This is the recommended first command. It shows you what it will find and how much space you'll save, with zero risk.

```bash
sweepr --dry-run
```

#### 2\. Run Interactively (Recommended)

This is the safest way to delete. It will scan, then ask you "yes/no" for *each project* it finds.

```bash
sweepr -i
```

#### 3\. Run and confirm "All or Nothing"

This will scan (using the default 30 days) and then ask you *once* to delete everything it found.

```bash
sweepr
```

#### 4\. Delete without confirmation (⚠️ Use with caution\!)

The `-y` flag skips all prompts and deletes everything it finds.

```bash
sweepr --days 90 -y
```

-----

## ⚙️ Configuration (CLI Options)

| Flag | Alias | Description | Default |
| :--- | :--- | :--- | :--- |
| **`--days <number>`** | `-d` | The number of days of inactivity to check for. | `30` |
| **`--path <directory>`**| `-p` | The root directory to start scanning from. | Current directory |
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