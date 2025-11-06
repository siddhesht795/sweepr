#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

// --- NEW ---
// A whitelist of file extensions that count as "code".
// We will ONLY check the 'mtime' of files matching this list.
// Using a Set provides a very fast lookup (O(1)).
const CODE_EXTENSIONS = new Set([
  // JavaScript
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  // Configs that are code
  '.json', 'package.json', 'package-lock.json',
  // HTML/CSS
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  // Other common languages
  '.py', '.java', '.go', '.cs', '.rs', '.php', '.rb',
  // Shell scripts
  '.sh', '.bash',
  // Data/Markup
  '.xml', '.yml', '.yaml'
]);

// Directories to ignore entirely
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.cache',
  'public',
  'vendor'
]);

/**
 * Recursively scans a project to find the newest 'mtime'
 * of any file that matches our CODE_EXTENSIONS whitelist.
 */
async function getProjectLastActivity(dir) {
  let latestMtime = new Date(0); // Start with the earliest possible date
  let entries;

  try {
    // Read all entries in the directory
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    // If we can't read/stat the dir, return the earliest date
    if (err.code !== 'EPERM' && err.code !== 'EACCES') {
      console.error(chalk.red(`Could not scan ${dir}: ${err.message}`));
    }
    return latestMtime;
  }

  // Loop through all files and subdirectories
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // If it's a directory, and NOT in our ignore list...
      if (!IGNORE_DIRS.has(entry.name)) {
        // ...recurse into it.
        const nestedMtime = await getProjectLastActivity(fullPath);
        if (nestedMtime > latestMtime) {
          latestMtime = nestedMtime;
        }
      }
    } else if (entry.isFile()) {
      // If it's a file, get its extension
      const ext = path.extname(entry.name);

      // ONLY check the timestamp if the extension is in our whitelist
      if (CODE_EXTENSIONS.has(ext)) {
        try {
          const stats = await fs.stat(fullPath);
          if (stats.mtime > latestMtime) {
            latestMtime = stats.mtime;
          }
        } catch (err) {
          // Ignore stat errors for single files
        }
      }
    }
  }
  
  // Return the newest timestamp we found
  return latestMtime;
}


/**
 * Recursively finds target directories (like node_modules).
 */
async function findTargetDirectories(dir) {
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
          // This function now uses our new, smarter logic
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
      // Recurse, but make sure we don't scan ignored dirs
      else if (!IGNORE_DIRS.has(entry.name)) {
        const nestedDirs = await findTargetDirectories(fullPath);
        results = results.concat(nestedDirs);
      }
    }
  }
  return results;
}

// ... (The 'main' function is exactly the same as before) ...
// ... (It doesn't need to change, as it just uses the 'mtime' ...
// ...  that our smart function provides) ...

/**
 * Main function to run the CLI tool.
 */
async function main() {
  // 1. Define the command
  program
    .version('1.0.0')
    .description('Finds and deletes node_modules from inactive projects.')
    .option('-d, --days <number>', 'The number of days of project inactivity', '30')
    .option('-p, --path <directory>', 'The root directory to start scanning from', process.cwd())
    .option('--dry-run', 'List folders to be deleted without actually deleting them')
    .option('-y, --yes', 'Skip the confirmation prompt (DANGEROUS)')
    .parse(process.argv);

  // 2. Store options
  const options = program.opts();
  const days = parseInt(options.days, 10);
  const scanPath = path.resolve(options.path);
  
  // 3. Calculate cutoff date
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  console.log(chalk.cyan(`Scanning for projects in: ${scanPath}`));
  console.log(chalk.cyan(`Finding projects inactive for ${days} days (last code change before ${thresholdDate.toLocaleDateString()})...`));
  
  // 4. Find all target directories
  const allTargets = await findTargetDirectories(scanPath);
  
  // 5. Filter for the old ones
  const targets = allTargets.filter(target => target.mtime < thresholdDate);

  // 6. Handle "nothing found"
  if (targets.length === 0) {
    console.log(chalk.green('\n✨ All clean! No inactive projects found.'));
    return;
  }

  // 7. Display what was found
  console.log(chalk.yellow(`\nFound ${targets.length} inactive projects containing node_modules:`));
  targets.forEach(target => {
    console.log(`- Project: ${chalk.bold(target.parent)}`);
    console.log(`  (Last code change: ${target.mtime.toLocaleDateString()}) -> ${chalk.red(target.path)}`);
  });

  // 8. Handle Dry Run
  if (options.dryRun) {
    console.log(chalk.blue('\n[DRY RUN] No folders will be deleted.'));
    return;
  }

  // 9. Get Confirmation
  let confirmed = options.yes;
  if (!confirmed) {
    const { shouldDelete } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'shouldDelete',
        message: `Are you sure you want to delete the node_modules from these ${targets.length} projects?`,
        default: false,
      },
    ]);
    confirmed = shouldDelete;
  }

  // 10. Delete (if confirmed)
  if (confirmed) {
    console.log(chalk.red('\nDeleting folders...'));
    let successCount = 0;
    let failCount = 0;

    for (const target of targets) {
      try {
        await fs.rm(target.path, { recursive: true, force: true });
        console.log(chalk.green(`Deleted: ${target.path}`));
        successCount++;
      } catch (err) {
        console.error(chalk.red(`Failed to delete ${target.path}: ${err.message}`));
        failCount++;
      }
    }

    console.log(chalk.green(`\nDone. Successfully deleted ${successCount} folders.`));
    if (failCount > 0) {
      console.log(chalk.red(`Failed to delete ${failCount} folders.`));
    }
  } else {
    console.log(chalk.yellow('\nOperation cancelled. No folders were deleted.'));
  }
}

main().catch(err => {
  console.error(chalk.red(`An unexpected error occurred: ${err.message}`));
  process.exit(1);
});