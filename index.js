#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import trash from 'trash';
import ora from 'ora';

// --- CONSTANTS ---
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
const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.sweeprrc');

// --- HELPER FUNCTIONS ---
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
        } catch (err) {}
      } 
      else if (!IGNORE_DIRS.has(entry.name)) {
        const nestedDirs = await findNodeModules(fullPath);
        results = results.concat(nestedDirs);
      }
    }
  }
  return results;
}

// --- CORE CLEANUP LOGIC ---
async function runNodeCleanup(options) {
  const days = parseInt(options.days, 10);
  const scanPath = path.resolve(options.path);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  console.log('');
  console.log(chalk.bgBlue.white.bold(' NODE.JS CLEANUP '));
  console.log(chalk.dim(`Path: ${scanPath}`));
  console.log(chalk.dim(`Inactivity Threshold: ${days} days (${thresholdDate.toLocaleDateString()})\n`));
  
  const scanSpinner = ora('Scanning for inactive projects...').start();
  const allTargets = await findNodeModules(scanPath);
  const targets = allTargets.filter(target => target.mtime < thresholdDate);

  if (targets.length === 0) {
    scanSpinner.succeed(chalk.green('Scan complete. No inactive projects found! 🎉'));
    return;
  }
  scanSpinner.succeed(chalk.green(`Scan complete. Found ${chalk.bold(targets.length)} inactive projects.`));

  const sizeSpinner = ora('Calculating potential space savings...').start();
  const targetsWithSizes = await Promise.all(
    targets.map(async (target) => {
      const size = await getDirectorySize(target.path);
      return { ...target, size };
    })
  );
  sizeSpinner.stop();

  console.log(chalk.bold('\n📦 Projects eligible for cleanup:'));
  let totalSize = 0;

  targetsWithSizes.forEach(target => {
    totalSize += target.size;
    const sizeStr = chalk.yellow(formatBytes(target.size).padStart(10));
    const dateStr = chalk.dim(target.mtime.toLocaleDateString());
    console.log(`   ${sizeStr}  ${chalk.white(target.parent)} ${chalk.dim('(Last active: ' + dateStr + ')')}`);
  });

  const totalSizeStr = formatBytes(totalSize);

  console.log(chalk.dim('   ' + '─'.repeat(50)));
  console.log(`   ${chalk.green.bold(totalSizeStr.padStart(10))}  ${chalk.bold('TOTAL RECLAIMABLE SPACE')}\n`);

  if (options.dryRun) {
    ora().info(chalk.blueBright('DRY RUN MODE: No files were deleted.\n'));
    return;
  }

  if (options.trash) {
    console.log(chalk.blue('ℹ️  Mode: Moving to system trash (safer)'));
  } else {
    console.log(chalk.red.bold('⚠️  Mode: PERMANENTLY DELETING'));
  }

  let successCount = 0;
  let failCount = 0;
  let totalBytesDeleted = 0;

  if (options.interactive && !options.yes) {
    console.log('');
    for (const target of targetsWithSizes) {
      console.log(chalk.dim('─'.repeat(process.stdout.columns || 50))); 
      console.log(`${chalk.bold(target.parent)}`);
      console.log(chalk.dim(`Path: ${target.path}`));
      console.log(`Size: ${chalk.yellow(formatBytes(target.size))}`);
      
      const { shouldDelete } = await inquirer.prompt([
        { type: 'confirm', name: 'shouldDelete', message: 'Clean this project?', default: false },
      ]);

      if (shouldDelete) {
        const delSpinner = ora('Cleaning...').start();
        try {
          if (options.trash) {
            await trash(target.path);
          } else {
            await fs.rm(target.path, { recursive: true, force: true });
          }
          delSpinner.succeed(chalk.green('Cleaned!'));
          successCount++;
          totalBytesDeleted += target.size;
        } catch (err) {
          delSpinner.fail(chalk.red(`Failed: ${err.message}`));
          failCount++;
        }
      } else {
        console.log(chalk.dim('Skipped.'));
      }
    }
  } else {
    let confirmed = options.yes;
    if (!confirmed) {
      console.log('');
      const { shouldDelete } = await inquirer.prompt([
        { 
          type: 'confirm', 
          name: 'shouldDelete', 
          message: chalk.bold(`Ready to clean ${targetsWithSizes.length} projects (${totalSizeStr})?`), 
          default: false 
        },
      ]);
      confirmed = shouldDelete;
    }

    if (confirmed) {
      const delSpinner = ora('Cleaning projects...').start();
      for (const target of targetsWithSizes) {
        try {
          if (options.trash) {
            await trash(target.path);
          } else {
            await fs.rm(target.path, { recursive: true, force: true });
          }
          successCount++;
          totalBytesDeleted += target.size;
        } catch (err) {
          delSpinner.clear();
          console.error(chalk.red(`\n❌ Failed to delete ${target.path}: ${err.message}`));
          delSpinner.render();
          failCount++;
        }
      }

      if (failCount === 0) {
        delSpinner.succeed(chalk.green('All projects cleaned successfully!'));
      } else {
        delSpinner.warn(chalk.yellow(`Finished, but ${failCount} projects failed.`));
      }
    } else {
      console.log(chalk.yellow('\nOperation cancelled. Stay messy! 😉'));
      return;
    }
  }

  if (successCount > 0) {
    console.log('\n' + chalk.bgGreen.black.bold(' SUMMARY '));
    console.log(`✅ Cleaned:   ${successCount} projects`);
    if (failCount > 0) console.log(`❌ Failed:    ${failCount} projects`);
    console.log(`🎉 Reclaimed: ${chalk.bold(formatBytes(totalBytesDeleted))} of disk space!\n`);
  }
}

async function runPythonCleanup(options) {
    ora().info(chalk.dim('Python cleanup is coming soon!'));
}

// --- CONFIGURATION LOGIC ---
async function loadGlobalConfig() {
  try {
    const configContent = await fs.readFile(GLOBAL_CONFIG_PATH, 'utf8');
    return JSON.parse(configContent);
  } catch (err) {
    return {};
  }
}

async function runConfigWizard() {
  console.clear(); 
  console.log(chalk.green.bold('\n🧹 Welcome to the sweepr configuration wizard!\n'));
  console.log(chalk.dim(`Settings will be saved to: ${GLOBAL_CONFIG_PATH}\n`));

  const currentConfig = await loadGlobalConfig();

  const questions = [
    {
      type: 'input',
      name: 'days',
      message: 'Default inactivity period (days):',
      default: currentConfig.days || 30,
      validate: (input) => !isNaN(parseInt(input, 10)) || 'Please enter a number',
    },
    {
      type: 'input',
      name: 'path',
      message: 'Default scan path (leave empty for current dir):',
      default: currentConfig.path || '',
    },
    {
        type: 'confirm',
        name: 'trash',
        message: 'Use system trash for deleted folders (safer)?',
        default: currentConfig.trash ?? true, 
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Always run in "dry run" mode by default?',
      default: currentConfig.dryRun || false,
    },
  ];

  const answers = await inquirer.prompt(questions);

  const newConfig = {
    ...currentConfig,
    days: parseInt(answers.days, 10),
    path: answers.path,
    trash: answers.trash,
    dryRun: answers.dryRun,
    yes: currentConfig.yes || false, 
  };

  try {
    await fs.writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    ora().succeed(chalk.green(`Configuration saved!`));
  } catch (err) {
    ora().fail(chalk.red(`Could not save config: ${err.message}`));
  }
}

async function doesConfigExist() {
  try {
    await fs.stat(GLOBAL_CONFIG_PATH);
    return true;
  } catch (err) { return false; }
}

function mergeOptions(programOpts, config) {
  return {
      ...programOpts,
      days: programOpts.days ?? config.days ?? '30',
      path: programOpts.path ?? config.path ?? process.cwd(),
      dryRun: programOpts.dryRun ?? config.dryRun ?? false,
      yes: programOpts.yes ?? config.yes ?? false,
      trash: programOpts.trash ?? config.trash ?? true,
  };
}

// --- MAIN ---
async function main() {
  let isFirstRun = false;
  try { isFirstRun = !(await doesConfigExist()); } catch (err) {}

  if (isFirstRun && !process.argv.includes('--help') && !process.argv.includes('-h') && process.argv[2] !== 'config') {
    await runConfigWizard();
    console.log(chalk.dim('----------------------------------------\n'));
  }
  
  const loadedConfig = await loadGlobalConfig();

  program
    .version('1.8.2')
    .description('A smart CLI tool to clean up inactive dev dependencies.')
    .option('-d, --days <number>', `Inactivity threshold in days [default: ${loadedConfig.days || 30}]`)
    .option('-p, --path <directory>', `Root path to scan [default: current dir]`)
    .option('--dry-run', 'Simulate deletion without actually deleting')
    .option('--no-dry-run', 'Disable dry-run mode')
    .option('-y, --yes', 'Skip confirmation prompts (DANGEROUS)')
    .option('--no-yes', 'Do NOT skip confirmation prompts')
    .option('--trash', 'Move to system trash (safer)')
    .option('--no-trash', 'Permanently delete files')
    .option('-i, --interactive', 'Ask for confirmation for each folder');

  program
    .command('config')
    .description('Run the configuration wizard')
    .action(runConfigWizard);

  program
    .command('node')
    .description('Clean up inactive Node.js projects')
    .action(async () => {
      await runNodeCleanup(mergeOptions(program.opts(), loadedConfig));
    });

  program
    .command('python')
    .description('Clean up inactive Python projects')
    .action(async () => {
      await runPythonCleanup(mergeOptions(program.opts(), loadedConfig));
    });

  program
    .command('all', { isDefault: true })
    .description('Run all cleanup operations')
    .action(async () => {
      const firstArg = process.argv[2];
      if (firstArg && !firstArg.startsWith('-') && firstArg !== 'all') {
         return;
      }
      console.log(chalk.bold('🧹 Starting sweepr full cleanup...\n'));
      await runNodeCleanup(mergeOptions(program.opts(), loadedConfig));
      await runPythonCleanup(mergeOptions(program.opts(), loadedConfig));
      console.log(chalk.bold('\n✨ Sweep complete!'));
    });
  
  await program.parseAsync(process.argv);
}

main().catch(err => {
  if (ora().isSpinning) {
      ora().fail(chalk.redBright(err.message));
  } else {
      console.error(chalk.redBright.bold(`An unexpected error occurred: ${err.message}`));
  }
  process.exit(1);
});