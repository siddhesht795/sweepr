import path from 'path';
import { IGNORE_DIRS, CODE_EXTENSIONS, ACTIVITY_IGNORED_FILES } from '../constants.js';
import { createFileSystem, mapLimit } from '../utils/io.js';

const ENV_NAMES = new Set(['venv', '.venv', 'env', '.env']);
// An unreadable source tree must not be mistaken for an inactive project.
const UNKNOWN_ACTIVITY = () => new Date(8640000000000000);

export function createScanContext({ concurrency = 16, thresholdDate } = {}) {
  const io = createFileSystem(concurrency);
  const directories = new Map();
  const activities = new Map();
  const entries = dir => {
    if (!directories.has(dir)) directories.set(dir, io.readdir(dir));
    return directories.get(dir);
  };
  async function isEnvironment(dir) {
    const files = await entries(dir);
    return files.some(entry => entry.name === 'pyvenv.cfg' && entry.isFile());
  }
  function activity(dir) {
    if (!activities.has(dir)) activities.set(dir, calculateActivity(dir));
    return activities.get(dir);
  }
  async function calculateActivity(dir) {
    let latest = new Date(0);
    try {
      const files = await entries(dir);
      for (const entry of files) {
        const fullPath = path.join(dir, entry.name);
        let mtime;
        if (entry.isDirectory()) {
          if (IGNORE_DIRS.has(entry.name) || await isEnvironment(fullPath)) continue;
          mtime = await activity(fullPath);
        } else if (entry.isFile() && !ACTIVITY_IGNORED_FILES.has(entry.name) && CODE_EXTENSIONS.has(path.extname(entry.name))) {
          mtime = (await io.stat(fullPath)).mtime;
        }
        if (mtime && mtime > latest) latest = mtime;
        // The exact newest timestamp is needed only for inactive candidates.
        if (thresholdDate && latest >= thresholdDate) break;
      }
      return latest;
    } catch {
      return UNKNOWN_ACTIVITY();
    }
  }
  return { io, entries, activity, isEnvironment, thresholdDate };
}

// Discover both ecosystems in a single walk, then check each owning project once.
export async function discoverTargets(dir, { languages = ['node', 'python'], context = createScanContext() } = {}) {
  const targets = [];
  async function walk(current) {
    let entries;
    try { entries = await context.entries(current); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.name === 'node_modules') {
        if (languages.includes('node')) targets.push({ path: fullPath, parent: current, language: 'node' });
        continue;
      }
      if (IGNORE_DIRS.has(entry.name) && !ENV_NAMES.has(entry.name)) continue;
      try {
        if (await context.isEnvironment(fullPath)) {
          if (languages.includes('python')) targets.push({ path: fullPath, parent: current, language: 'python' });
          continue;
        }
      } catch { continue; }
      if (!IGNORE_DIRS.has(entry.name)) await walk(fullPath);
    }
  }
  await walk(dir);
  return mapLimit(targets, context.io.concurrency, async target => ({ ...target, mtime: await context.activity(target.parent) }));
}

// Retain the generic predicate API for integrations and existing callers.
export async function findTargets(dir, isTarget, { context = createScanContext() } = {}) {
  const targets = [];
  async function walk(current) {
    let entries;
    try { entries = await context.entries(current); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const fullPath = path.join(current, entry.name);
      if (await isTarget(fullPath, entry.name)) {
        targets.push({ path: fullPath, parent: current });
      } else if (!IGNORE_DIRS.has(entry.name)) {
        try {
          if (!(await context.isEnvironment(fullPath))) await walk(fullPath);
        } catch { /* An inaccessible subtree is not a cleanup candidate. */ }
      }
    }
  }
  await walk(dir);
  return mapLimit(targets, context.io.concurrency, async target => ({ ...target, mtime: await context.activity(target.parent) }));
}
