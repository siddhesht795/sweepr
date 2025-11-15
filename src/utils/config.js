import fs from 'fs/promises';
import { GLOBAL_CONFIG_PATH } from '../constants.js';

export async function loadGlobalConfig() {
  try {
    const configContent = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (err) {
    return {};
  }
}

export async function doesConfigExist() {
  try {
    await fs.stat(GLOBAL_CONFIG_PATH);
    return true;
  } catch (err) { return false; }
}

export function mergeOptions(programOpts, config) {
  return {
      ...programOpts,
      days: programOpts.days ?? config.days ?? '30',
      path: programOpts.path ?? config.path ?? process.cwd(),
      dryRun: programOpts.dryRun ?? config.dryRun ?? false,
      yes: programOpts.yes ?? config.yes ?? false,
      trash: programOpts.trash ?? config.trash ?? true,
  };
}