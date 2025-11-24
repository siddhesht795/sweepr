import fs from 'fs/promises';
import path from 'path';
import { IGNORE_DIRS, CODE_EXTENSIONS } from '../constants.js';
import { isVenv } from '../utils/helpers.js';

//function to check the last activity / modified date of the project directory
async function getProjectLastActivity(dir) {
  let latestMtime = new Date(0);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return latestMtime;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      //don't scan ignored dirs OR venvs(to avoid false positives)
      if (!IGNORE_DIRS.has(entry.name) && !(await isVenv(fullPath))) {
        const nestedMtime = await getProjectLastActivity(fullPath);
        if (nestedMtime > latestMtime) {
          latestMtime = nestedMtime;
        }
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (CODE_EXTENSIONS.has(ext)) {
        try {
          const stats = await fs.stat(fullPath);
          if (stats.mtime > latestMtime) {
            latestMtime = stats.mtime;
          }
        } catch (err) {}
      }
    }
  }
  return latestMtime;
}

//function to find the target directories
export async function findTargets(dir, isTarget) {
  let results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return [];
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // use the predicate(isTarget function) function for structural / name check
      if (await isTarget(fullPath, entry.name)) {
        const parentDir = path.dirname(fullPath);
        try {
          const lastActivityTime = await getProjectLastActivity(parentDir);
          results.push({
            path: fullPath,
            mtime: lastActivityTime,
            parent: parentDir
          });
        } catch (err) {}
      } 
      else if (!IGNORE_DIRS.has(entry.name)) {
        const nestedDirs = await findTargets(fullPath, isTarget);
        results = results.concat(nestedDirs);
      }
    }
  }
  return results;
}