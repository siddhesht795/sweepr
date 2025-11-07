#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';

// --- (Constants: CODE_EXTENSIONS and IGNORE_DIRS) ---
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

// --- HELPER FUNCTIONS ---

/**
 * Formats bytes into a human-readable string (KB, MB, GB, etc.)
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Recursively calculates the total size of a directory.
 */
async function getDirectorySize(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    // If we can't read a dir (e.g., permissions), assume 0 size
    return 0;
  }

  // Use Promise.all to calculate sizes of all entries in parallel
  const sizePromises = entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        // Recurse into subdirectories
        return await getDirectorySize(fullPath);
      } else if (entry.isFile()) {
        // Get file stats
        const stats = await fs.stat(fullPath);
        return stats.size;
      }
    } catch (err) {
      // Skip broken symlinks or permission-denied files
      return 0;
    }
    return 0;
  });

  // Wait for all calculations and sum them up
  const sizes = await Promise.all(sizePromises);
  return sizes.reduce((acc, size) => acc + size, 0);
}

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
    .option('-i, --interactive', 'Interactively ask for each folder to be deleted') // NEW OPTION
    .parse(process.argv);

  // 2. Store options
  const options = program.opts();
  const days = parseInt(options.days, 10);
  const scanPath = path.resolve(options.path);
  
  // 3. Calculate cutoff date
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  // --- STYLING UPDATES ---
  console.log(chalk.blueBright(`Scanning for projects in: ${scanPath}`));
  console.log(chalk.blueBright(`Finding projects inactive for ${days} days (last code change before ${thresholdDate.toLocaleDateString()})...`));
  
  // 4. Find all target directories
  const allTargets = await findTargetDirectories(scanPath);
  
  // 5. Filter for the old ones
  const targets = allTargets.filter(target => target.mtime < thresholdDate);

  // 6. Handle "nothing found"
  if (targets.length === 0) {
    console.log(chalk.greenBright('\n✨ All clean! No inactive projects found.'));
    return;
  }

  // 7. Calculate sizes and Display what was found
  console.log(chalk.yellowBright('\nCalculating sizes... This may take a moment.'));

  const targetsWithSizes = await Promise.all(
    targets.map(async (target) => {
      const size = await getDirectorySize(target.path);
      return { ...target, size };
    })
  );

  let totalSize = 0;
  console.log(chalk.yellowBright.bold(`\nFound ${targetsWithSizes.length} inactive projects containing node_modules:`));
  
  targetsWithSizes.forEach(target => {
    totalSize += target.size;
    const formattedSize = formatBytes(target.size);
    console.log(`- Project: ${chalk.bold.whiteBright(target.parent)}`);
    console.log(`  (Last code change: ${target.mtime.toLocaleDateString()}) -> ${chalk.redBright.bold(target.path)} (${chalk.yellowBright(formattedSize)})`);
  });

  // 8. Handle Dry Run
  if (options.dryRun) {
    console.log(chalk.bgCyan.black.bold('\n[DRY RUN] No folders will be deleted.'));
    console.log(chalk.yellowBright(`Total space that would be reclaimed: ${chalk.greenBright.bold(formatBytes(totalSize))}`));
    return;
  }

  // --- MODIFIED SECTION (9, 10, 11) ---

  let successCount = 0;
  let failCount = 0;
  let totalBytesDeleted = 0;
  let operationCancelled = false; // Flag to track if user cancelled the "all" prompt

  // 9. Get Confirmation (Interactive or All-at-Once)
  if (options.interactive && !options.yes) {
    // --- INTERACTIVE MODE ---
    console.log(chalk.yellowBright.bold('\nStarting interactive deletion...'));

    for (const target of targetsWithSizes) {
      console.log(chalk.whiteBright(`\nProject: ${chalk.bold(target.parent)}`));
      console.log(`  (Last code change: ${target.mtime.toLocaleDateString()}) -> ${chalk.redBright(target.path)} (${chalk.yellowBright(formatBytes(target.size))})`);
      
      const { shouldDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldDelete',
          message: 'Delete this node_modules folder?',
          default: false,
        },
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
    // --- "ALL OR NOTHING" MODE (DEFAULT) ---
    console.log(chalk.yellowBright(`\nTotal space to be reclaimed: ${chalk.greenBright.bold(formatBytes(totalSize))}`));
    
    let confirmed = options.yes;
    if (!confirmed) {
      const { shouldDelete } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'shouldDelete',
          message: chalk.yellowBright(`Are you sure you want to delete the node_modules from all ${targetsWithSizes.length} projects?`),
          default: false,
        },
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

  // 10. Final Summary
  if (operationCancelled) {
    console.log(chalk.yellowBright('\nOperation cancelled. No folders were deleted.'));
  } else {
    // Show summary only if the operation wasn't cancelled
    if (successCount > 0) {
      console.log(chalk.greenBright(`\nDone. Successfully deleted ${successCount} folders and reclaimed ${chalk.bold(formatBytes(totalBytesDeleted))}.`));
    } else if (failCount === 0) {
      // This handles the case where --interactive was used and the user skipped everything
      console.log(chalk.yellowBright('\nNo folders were deleted.'));
    }
    
    if (failCount > 0) {
      console.log(chalk.redBright(`Failed to delete ${failCount} folders.`));
    }
  }
}

// --- (Main call is unchanged) ---
main().catch(err => {
  console.error(chalk.redBright.bold(`An unexpected error occurred: ${err.message}`));
  process.exit(1);
});