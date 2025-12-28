# Configuration Guide

`sweepr` supports **global configuration** so you do not need to repeat common flags on every run.

> **Note:**
>
> * If installed globally, use `sweepr`
> * If installed locally, use `npx sweepr`

---

## Config File Location

`sweepr` stores its global configuration at:

```bash
~/.sweeprrc
```

This file is automatically created by running:

```bash
sweepr config
```

or, for local installs:

```bash
npx sweepr config
```

---

## Example Configuration

```json
{
  "days": 60,
  "path": "/Users/name/Projects",
  "trash": true,
  "dryRun": false
}
```

---

## Configuration Options

| Key      | Type    | Description                              |
| -------- | ------- | ---------------------------------------- |
| `days`   | number  | Inactivity threshold in days             |
| `path`   | string  | Default root directory to scan           |
| `trash`  | boolean | Move files to system trash (recommended) |
| `dryRun` | boolean | Enable dry-run mode by default           |

---

## How Configuration Is Used

When `sweepr` runs, it resolves settings in the following order:

1. **CLI flags**
2. **Global config file (`~/.sweeprrc`)**
3. **Built-in defaults**

This ensures that one-off commands can always override saved preferences.

---

## Overriding Config Values

CLI flags override config values **only for that run**.

Example:

```bash
sweepr --days 120
```

or:

```bash
npx sweepr --days 120
```

This overrides the `days` setting temporarily without modifying the config file.

---

## Editing Configuration Manually

You may edit `~/.sweeprrc` directly using any text editor:

```bash
nano ~/.sweeprrc
```

Changes take effect immediately on the next run.

---

## Reset Configuration

To reset all saved preferences:

1. Delete the config file:

   ```bash
   rm ~/.sweeprrc
   ```

2. Re-run the configuration wizard:

   ```bash
   sweepr config
   ```

   or:

   ```bash
   npx sweepr config
   ```


