#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// --- (Constants unchanged) ---
const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.json', 'package.json', 'package-lock.json',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.py', '.java', '.go', '.cs', '.rs', '.php', '.rb',
  '.sh', '.bash',
  '.xml', '.yml', '.yaml'
]);
const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  'coverage', '.cache', 'public', 'vendor'
]);

// --- (Helper functions unchanged) ---
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function getDirectorySize(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    return 0;
  }
  const sizePromises = entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        return await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        return stats.size;
      }
    } catch (err) {
      return 0;
    }
    return 0;
  });
  const sizes = await Promise.all(sizePromises);
  return sizes.reduce((acc, size) => acc + size, 0);
}

async function getProjectLastActivity(dir) {
  let latestMtime = new Date(0);
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EACCES') {
      console.error(chalk.red(`Could not scan ${dir}: ${err.message}`));
    }
    return latestMtime;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name)) {
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

async function findNodeModules(dir) {
  let results = [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== 'EPERM' && err.code !== 'EACCES') {
      console.error(chalk.red(`Could not scan ${dir}: ${err.message}`));
    }
    return [];
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') {
        const parentDir = path.dirname(fullPath);
        try {
          const lastActivityTime = await getProjectLastActivity(parentDir);
          results.push({
            path: fullPath,
            mtime: lastActivityTime,
            parent: parentDir
          });
        } catch (err) {
          console.error(chalk.red(`Could not scan project ${parentDir}: ${err.message}`));
        }
      } 
      else if (!IGNORE_DIRS.has(entry.name)) {
        const nestedDirs = await findNodeModules(fullPath);
        results = results.concat(nestedDirs);
      }
    }
  }
  return results;
}


// --- (Cleanup functions unchanged) ---
async function runNodeCleanup(options) {
  const days = parseInt(options.days, 10);
  const scanPath = path.resolve(options.path);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  console.log(chalk.bgWhite.black.bold('\n--- Running Node.js Cleanup ---'));
  console.log(chalk.blueBright(`Scanning for projects in: ${scanPath}`));
  console.log(chalk.blueBright(`Finding projects inactive for ${days} days (last code change before ${thresholdDate.toLocaleDateString()})...`));
  
  const allTargets = await findNodeModules(scanPath);
  const targets = allTargets.filter(target => target.mtime < thresholdDate);

  if (targets.length === 0) {
    console.log(chalk.greenBright('✨ All clean! No inactive Node.js projects found.'));
    return;
  }

  console.log(chalk.yellowBright('\nCalculating sizes... This may take a moment.'));
  const targetsWithSizes = await Promise.all(
    targets.map(async (target) => {
      const size = await getDirectorySize(target.path);
      return { ...target, size };
    })
  );

  let totalSize = 0;
  console.log(chalk.yellowBright.bold(`\nFound ${targetsWithSizes.length} inactive Node.js projects:`));
  targetsWithSizes.forEach(target => {
    totalSize += target.size;
    const formattedSize = formatBytes(target.size);
    console.log(`- Project: ${chalk.bold.whiteBright(target.parent)}`);
    console.log(`  (Last code change: ${target.mtime.toLocaleDateString()}) -> ${chalk.redBright.bold(target.path)} (${chalk.yellowBright(formattedSize)})`);
  });

  if (options.dryRun) {
    console.log(chalk.bgCyan.black.bold('\n[DRY RUN] No folders will be deleted.'));
    console.log(chalk.yellowBright(`Total space that would be reclaimed: ${chalk.greenBright.bold(formatBytes(totalSize))}`));
    return;
  }

  let successCount = 0;
  let failCount = 0;
  let totalBytesDeleted = 0;
  let operationCancelled = false;

  if (options.interactive && !options.yes) {
    console.log(chalk.yellowBright.bold('\nStarting interactive deletion...'));
    for (const target of targetsWithSizes) {
      console.log(chalk.whiteBright(`\nProject: ${chalk.bold(target.parent)}`));
      console.log(`  (Last code change: ${target.mtime.toLocaleDateString()}) -> ${chalk.redBright(target.path)} (${chalk.yellowBright(formatBytes(target.size))})`);
      
      const { shouldDelete } = await inquirer.prompt([
        { type: 'confirm', name: 'shouldDelete', message: 'Delete this node_modules folder?', default: false },
      ]);

      if (shouldDelete) {
        try {
          await fs.rm(target.path, { recursive: true, force: true });
          console.log(chalk.green.dim(`Deleted: ${target.path}`));
          successCount++;
          totalBytesDeleted += target.size;
        } catch (err) {
          console.error(chalk.redBright(`Failed to delete ${target.path}: ${err.message}`));
          failCount++;
        }
      } else {
        console.log(chalk.yellowBright.dim('Skipped.'));
      }
    }
  
  } else {
    console.log(chalk.yellowBright(`\nTotal space to be reclaimed: ${chalk.greenBright.bold(formatBytes(totalSize))}`));
    
    let confirmed = options.yes;
    if (!confirmed) {
      const { shouldDelete } = await inquirer.prompt([
        { type: 'confirm', name: 'shouldDelete', message: chalk.yellowBright(`Are you sure you want to delete the node_modules from all ${targetsWithSizes.length} projects?`), default: false },
      ]);
      confirmed = shouldDelete;
    }

    if (confirmed) {
      console.log(chalk.redBright.bold('\nDeleting all folders...'));
      for (const target of targetsWithSizes) {
        try {
          await fs.rm(target.path, { recursive: true, force: true });
          console.log(chalk.green.dim(`Deleted: ${target.path}`));
          successCount++;
          totalBytesDeleted += target.size;
        } catch (err) {
          console.error(chalk.redBright(`Failed to delete ${target.path}: ${err.message}`));
          failCount++;
        }
      }
    } else {
      operationCancelled = true;
    }
  }

  if (operationCancelled) {
    console.log(chalk.yellowBright('\nOperation cancelled. No folders were deleted.'));
  } else {
    if (successCount > 0) {
      console.log(chalk.greenBright(`\nNode.js Summary: Successfully deleted ${successCount} folders and reclaimed ${chalk.bold(formatBytes(totalBytesDeleted))}.`));
    } else if (failCount === 0) {
      console.log(chalk.yellowBright('\nNo Node.js folders were deleted.'));
    }
    if (failCount > 0) {
      console.log(chalk.redBright(`Failed to delete ${failCount} Node.js folders.`));
    }
  }
}

async function runPythonCleanup(options) {
  console.log(chalk.bgWhite.black.bold('\n--- Running Python Cleanup ---'));
  console.log(chalk.yellowBright('Python cleanup feature is not yet implemented. Coming soon!'));
}

// --- Config functions ---
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.sweeprrc');

async function loadGlobalConfig() {
  try {
    const configContent = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (err) {
    return {};
  }
}

async function runConfigWizard() {
  console.log(chalk.green.bold('Welcome to the sweepr configuration wizard!'));
  console.log('This will set the default values for your global config file.');

  const currentConfig = await loadGlobalConfig();

  const questions = [
    {
      type: 'input',
      name: 'days',
      message: 'Default inactivity period (in days):',
      default: currentConfig.days || 30,
      validate: (input) => {
        const num = parseInt(input, 10);
        if (isNaN(num) || num < 0) {
          return 'Please enter a valid number of days.';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'path',
      message: 'Default scan path (leave blank to scan the current directory):',
      default: currentConfig.path || '',
    },
    // --- NEW SAFETY QUESTIONS ---
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Always run in --dry-run mode by default (recommended)?',
      default: currentConfig.dryRun || false,
    },
    {
      type: 'confirm',
      name: 'yes',
      message: chalk.red('WARNING: Skip all confirmation prompts by default (-y)?'),
      default: currentConfig.yes || false,
      // Only ask this if they DIDN'T just say yes to dry-run mode
      when: (answers) => !answers.dryRun,
    },
  ];

  const answers = await inquirer.prompt(questions);

  const newConfig = {
    ...currentConfig,
    days: parseInt(answers.days, 10),
    path: answers.path,
    // Save new safety settings
    dryRun: answers.dryRun,
    yes: answers.yes || false, 
  };

  try {
    const configString = JSON.stringify(newConfig, null, 2);
    await fs.writeFile(GLOBAL_CONFIG_PATH, configString);
    console.log(chalk.greenBright(`\n✅ Success! Configuration saved to ${GLOBAL_CONFIG_PATH}`));
  } catch (err) {
    console.error(chalk.redBright(`\n❌ Error: Could not save config file to ${GLOBAL_CONFIG_PATH}`));
    console.error(err.message);
  }
}

async function doesConfigExist() {
  try {
    await fs.stat(GLOBAL_CONFIG_PATH);
    return true;
  } catch (err) {
    if (err.code === 'ENOENT') return false;
    throw err;
  }
}

/**
 * Main function to run the CLI tool.
 */
async function main() {
  
  // 1. First-run check
  let isFirstRun = false;
  try {
    isFirstRun = !(await doesConfigExist());
  } catch (err) {
    console.error(chalk.red('Could not check for config file:'), err.message);
  }

  const command = process.argv[2];
  const isHelp = process.argv.includes('--help') || process.argv.includes('-h');

  if (isFirstRun && command !== 'config' && !isHelp) {
    console.log(chalk.green.bold('Welcome to sweepr! 🧹'));
    console.log("It looks like this is your first time. Let's set up your global defaults.");
    await runConfigWizard();
    console.log(chalk.cyan('Defaults saved! Proceeding with your command...\n'));
  }
  
  // 2. Load config
  const loadedConfig = await loadGlobalConfig();

  // 3. Define options with new defaults
  program
    .version('1.6.0')
    .description('A smart CLI tool to clean up inactive dev dependencies.')
    .option('-d, --days <number>', 
            'The number of days of project inactivity', 
            (loadedConfig.days !== null && loadedConfig.days !== undefined) ? String(loadedConfig.days) : '30')
    .option('-p, --path <directory>', 
            'The root directory to start scanning from', 
            loadedConfig.path || process.cwd())
    // --- NEW DEFAULTS HERE ---
    .option('--dry-run', 
            'List folders to be deleted without actually deleting them',
            loadedConfig.dryRun || false)
    .option('-y, --yes', 
            'Skip all confirmation prompts (DANGEROUS)',
            loadedConfig.yes || false)
    // -------------------------
    .option('-i, --interactive', 'Interactively ask for each folder to be deleted');

  program
    .command('config')
    .description('Run an interactive wizard to set your global default values')
    .action(runConfigWizard);

  program
    .command('node')
    .description('Clean up inactive Node.js (node_modules) projects')
    .action(async () => {
      const options = program.opts();
      await runNodeCleanup(options);
    });

  program
    .command('python')
    .description('Clean up inactive Python (venv, __pycache__) projects')
    .action(async () => {
      const options = program.opts();
      await runPythonCleanup(options);
    });

  program
    .command('all', { isDefault: true })
    .description('Run all available cleanup operations (Node, Python, etc.)')
    .action(async () => {
      const options = program.opts();
      const firstArg = process.argv[2];
      if (firstArg && firstArg !== 'all' && !firstArg.startsWith('-')) {
        // intended sub-command
      } else {
        console.log(chalk.green.bold('Running all cleanup operations...'));
        await runNodeCleanup(options);
        await runPythonCleanup(options);
        console.log(chalk.green.bold('\nAll cleanup operations complete.'));
      }
    });
  
  await program.parseAsync(process.argv);
}

main().catch(err => {
  console.error(chalk.redBright.bold(`An unexpected error occurred: ${err.message}`));
  process.exit(1);
});