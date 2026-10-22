import { createFileSystem, mapLimit } from './io.js';
import fs from 'fs/promises';
import path from 'path';

//function to get the bytes in correct format
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

//function to get the size of the directory
export async function getDirectorySize(dir, io = createFileSystem()) {
  let entries;
  try { entries = await io.readdir(dir); } catch { return 0; }
  const sizes = await mapLimit(entries, io.concurrency, async entry => {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) return await getDirectorySize(fullPath, io);
      if (entry.isFile()) return (await io.stat(fullPath)).size;
    } catch { /* Preserve the existing best-effort size estimate. */ }
    return 0;
  });
  return sizes.reduce((total, size) => total + size, 0);
}

//function to check if a directory is a Python venv or not by looking for 'pyvenv.cfg'.
export async function isVenv(dirPath) {
    const configPath = path.join(dirPath, 'pyvenv.cfg');
    try {
        await fs.stat(configPath);
        return true;
    } catch (err) {
        return false;
    }
}