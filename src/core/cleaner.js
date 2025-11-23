import fs from 'fs/promises';
import trash from 'trash';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { formatBytes } from '../utils/helpers.js';
import { updateLifetimeSavings } from '../utils/config.js';

export async function performCleanup(targets, options, totalSize) {
  const totalSizeStr = formatBytes(totalSize);

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
  let targetsToClean = [];

  // --- NEW: "Select by ID" Interactive Mode ---
  if (options.interactive && !options.yes) {
    console.log(chalk.yellowBright.bold('\nSelect projects to clean:'));
    
    // 1. Print the numbered list
    targets.forEach((target, index) => {
      const num = chalk.cyanBright(`[${index + 1}]`);
      const sz = chalk.yellow(formatBytes(target.size));
      // Show relative path for brevity if possible, otherwise full path
      console.log(`${num} ${chalk.white(target.path)} (${sz})`);
    });

    console.log(''); // Spacer

    // 2. Ask for selection
    const { selection } = await inquirer.prompt([
      {
        type: 'input',
        name: 'selection',
        message: 'Enter numbers to delete (e.g., "1, 2, 5"), "all", or "none":',
      },
    ]);

    const input = selection.trim().toLowerCase();

    // Explicitly handle 'none', '0', or empty input as "delete nothing"
    if (!input || input === 'none' || input === '0') {
      console.log(chalk.yellow('No projects selected. Operation skipped.'));
      return;
    }

    // 3. Parse selection
    if (input === 'all') {
      targetsToClean = targets;
    } else {
      // Split by commas or spaces, parse integers, adjust for 0-based index
      const indices = input.split(/[\s,]+/)
        .map(num => parseInt(num, 10))
        .filter(num => !isNaN(num) && num > 0 && num <= targets.length) // Validate range
        .map(num => num - 1); // Convert 1-based input to 0-based array index

      // Remove duplicates using Set
      const uniqueIndices = [...new Set(indices)];
      
      targetsToClean = uniqueIndices.map(i => targets[i]);
    }

    if (targetsToClean.length === 0) {
      console.log(chalk.yellow('No valid projects selected.'));
      return;
    }

    console.log(chalk.dim(`\nSelected ${targetsToClean.length} projects...`));

  } else {
    // --- "All or Nothing" Mode (Default) ---
    let confirmed = options.yes;
    if (!confirmed) {
      console.log('');
      const { shouldDelete } = await inquirer.prompt([
        { 
          type: 'confirm', 
          name: 'shouldDelete', 
          message: chalk.bold(`Ready to clean ${targets.length} projects (${totalSizeStr})?`), 
          default: false 
        },
      ]);
      confirmed = shouldDelete;
    }

    if (confirmed) {
      targetsToClean = targets;
    } else {
      console.log(chalk.yellow('\nOperation cancelled. Stay messy! 😉'));
      return;
    }
  }

  // --- EXECUTE DELETION (Shared Logic) ---
  const delSpinner = ora(`Cleaning ${targetsToClean.length} projects...`).start();
  
  for (const target of targetsToClean) {
    try {
      if (options.trash) {
        await trash(target.path);
      } else {
        await fs.rm(target.path, { recursive: true, force: true });
      }
      
      successCount++;
      totalBytesDeleted += target.size;
      // Update spinner text optionally to show progress
      // delSpinner.text = `Cleaned: ${path.basename(target.parent)}`;
    } catch (err) {
      // Log error but keep going
      delSpinner.clear();
      console.error(chalk.red(`\n❌ Failed to delete ${target.path}: ${err.message}`));
      delSpinner.render();
      failCount++;
    }
  }

  if (failCount === 0) {
    delSpinner.succeed(chalk.green('Cleaned successfully!'));
  } else {
    delSpinner.warn(chalk.yellow(`Finished, but ${failCount} projects failed.`));
  }

  // --- Final Summary ---
  if (successCount > 0) {
    // Update lifetime stats
    const newLifetimeTotal = await updateLifetimeSavings(totalBytesDeleted);

    console.log('\n' + chalk.bgGreen.black.bold(' SUMMARY '));
    console.log(`✅ Cleaned:   ${successCount} projects`);
    if (failCount > 0) console.log(`❌ Failed:    ${failCount} projects`);
    console.log(`🎉 Reclaimed: ${chalk.bold(formatBytes(totalBytesDeleted))} of disk space!`);
    console.log(chalk.cyan(`📈 Lifetime reclaimed: ${chalk.bold(formatBytes(newLifetimeTotal))}\n`));
  }
}