## Installation

### Global install (recommended)

Installing globally allows you to run `sweepr` directly from anywhere in your terminal.

```bash
npm install -g sweepr
```

Verify installation:

```bash
sweepr --help
```

If the command is not found, ensure your global npm bin directory is in your `PATH`.

---

### Local install (alternative)

If you install `sweepr` **locally** (without `-g`), the binary will not be available globally. In this case, you must use `npx` to run it.

```bash
npm install sweepr
```

Run using:

```bash
npx sweepr --help
```

> **Recommendation:** Global installation is preferred for regular use. Local installation with `npx` is useful for one-off runs or CI scripts.

---

## First-Time Setup (Recommended)

Before running cleanup, configure default preferences:

```bash
sweepr config
```

If installed locally:

```bash
npx sweepr config
```

You will be guided through:

* Default scan directory
* Inactivity threshold (days)
* Trash vs permanent delete
* Dry-run preference

These settings are saved globally.

---

## Safe First Run

Always start with a dry run:

```bash
sweepr --dry-run
```

or, for local installs:

```bash
npx sweepr --dry-run
```

This shows:

* Which projects are considered inactive
* How much disk space can be reclaimed
* No files are deleted

---

## Interactive Cleanup (Best Practice)

```bash
sweepr -i
```

or:

```bash
npx sweepr -i
```

This allows you to:

* Review detected projects
* Select exactly what to clean
* Confirm before deletion

---

## Typical Workflow

1. Configure defaults (`sweepr config`)
2. Preview (`--dry-run`)
3. Clean interactively (`-i`)
4. Check reclaimed space (`sweepr stats`)

---

## Supported Project Types

* **Node.js:** `node_modules`
* **Python:** virtual environments detected via `pyvenv.cfg`

---

## Next Steps

* Read the **CLI Reference** for advanced flags
* Review the **Safety Model** to understand how sweepr avoids deleting active projects

