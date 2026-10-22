import fs from 'fs/promises';
import { GLOBAL_CONFIG_PATH } from '../constants.js';

export async function loadGlobalConfig() {
  try {
    const configContent = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (err) {
    console.log('\n💡 Tip: If installed globally (-g), run "sweepr". If local, use "npx sweepr".');
    return {};
  }
}

// function to save updated config
export async function saveGlobalConfig(newConfig) {
  const configString = JSON.stringify(newConfig, null, 2);
  await fs.writeFile(GLOBAL_CONFIG_PATH, configString);
}

// Preserve legacy totals when migrating to the accurate cleaned-data metric.
export async function updateLifetimeSavings(bytesCleaned) {
  const config = await loadGlobalConfig();
  const currentTotal = config.totalCleanedBytes ?? config.totalReclaimedBytes ?? 0;
  
  config.totalCleanedBytes = currentTotal + bytesCleaned;
  delete config.totalReclaimedBytes;
  
  await saveGlobalConfig(config);
  return config.totalCleanedBytes;
}

//function to check if a config file already exists or not
export async function doesConfigExist() {
  try {
    await fs.stat(GLOBAL_CONFIG_PATH);
    return true;
  } catch (err) { return false; }
}

//Update the config data
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