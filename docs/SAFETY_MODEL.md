# Safety Model

`sweepr` is designed to be **safe by default**. This document explains how it minimizes the risk of deleting active or important projects.

> **Command usage note**
>
> * Global install: use `sweepr`
> * Local install: use `npx sweepr`

All safety guarantees apply in both cases.

---

## Core Safety Principles

`sweepr` is built around the following principles:

1. **Never rely on folder timestamps alone**
2. **Never permanently delete by default**
3. **Always preserve rebuild paths**
4. **Prefer explicit user confirmation over automation**

These principles guide every cleanup decision.

---

## How Inactivity Is Determined

`sweepr` determines project inactivity using **real source activity**, not superficial signals.

It:

* Recursively scans project directories
* Ignores dependency and generated folders:

  * `node_modules`
  * Python virtual environments
  * `.git`
  * `dist`, `build`, `__pycache__`
* Tracks last-modified timestamps of **actual code and configuration files**
* Uses the **most recent code change** as the activity signal

### Files Considered for Activity

Typical examples:

* `.js`, `.ts`, `.jsx`, `.tsx`
* `.py`
* `.json`, `.yaml`, `.yml`
* `.go`, `.rs`, `.java`, etc.

### Files Ignored for Activity Detection

These do **not** count as project activity:

* `README.md`
* `.env`
* Lock files (`package-lock.json`, `poetry.lock`, etc.)
* Dependency folders
* Generated artifacts

This prevents false positives caused by installs, builds, or documentation edits.

---

## Python Virtual Environment Safety

Before removing a Python virtual environment, `sweepr` ensures it can be recreated.

Process:

1. Executes `pip freeze`

2. Saves the output as:

   ```
   requirements.sweepr.txt
   ```

3. Writes the file to the project root

This guarantees reproducibility even after cleanup.

---

## Deletion Strategy

### Default (Safe)

* Projects are moved to the **system Trash / Recycle Bin**
* Nothing is permanently deleted

### Optional (Dangerous)

Permanent deletion requires **explicit intent**:

```bash
sweepr --no-trash
```

or:

```bash
npx sweepr --no-trash
```

This bypasses system recovery and should be used with caution.

---

## Dry-Run Mode

Dry-run mode is strongly recommended, especially for first-time users.

It:

* Performs a full scan
* Calculates reclaimable disk space
* Deletes nothing

```bash
sweepr --dry-run
```

or:

```bash
npx sweepr --dry-run
```

---

## Interactive Mode Safety

Interactive mode (`-i`) adds an additional safety layer:

* Displays detected projects
* Allows manual selection
* Requires confirmation before cleanup

```bash
sweepr -i
```

---

## User Responsibility

`sweepr` provides:

* Conservative defaults
* Transparent previews
* Explicit confirmations

However, **final responsibility always lies with the user**, particularly when using:

* `--yes`
* `--no-trash`

Always review output carefully before confirming destructive actions.

---

If you want, next I can:

* Cross-link this with **CLI Reference flags**
* Add a **“Why sweepr won’t delete X” FAQ**
* Generate a **Security & Trust** section for your GitHub README
