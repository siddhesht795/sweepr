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

  //"Select by ID" interactive Mode (-i)
  if (options.interactive && !options.yes) {
    console.log(chalk.yellowBright.bold('\nSelect projects to clean:'));
    
    //1. print the numbered/indexed list
    targets.forEach((target, index) => {
      const num = chalk.cyanBright(`[${index + 1}]`);
      const sz = chalk.yellow(formatBytes(target.size));
      // Show relative path for brevity if possible, otherwise full path
      console.log(`${num} ${chalk.white(target.path)} (${sz})`);
    });

    console.log('');

    //2.ask for selection of directories
    const { selection } = await inquirer.prompt([
      {
        type: 'input',
        name: 'selection',
        message: 'Enter numbers to delete (e.g., "1, 2, 5"), "all", or "none":',
      },
    ]);

    const input = selection.trim().toLowerCase();

    //to handle 'none', '0' or empty input as "no deletions"
    if (!input || input === 'none' || input === '0') {
      console.log(chalk.yellow('No projects selected. Operation skipped.'));
      return;
    }

    //3.parse the selections
    if (input === 'all') {
      targetsToClean = targets;
    } else {
      //split by commas or spaces, parse integers, adjust for 0-based index
      const indices = input.split(/[\s,]+/)
        .map(num => parseInt(num, 10))
        .filter(num => !isNaN(num) && num > 0 && num <= targets.length)
        .map(num => num - 1);

      //remove any duplicates using Set
      const uniqueIndices = [...new Set(indices)];
      
      targetsToClean = uniqueIndices.map(i => targets[i]);
    }

    if (targetsToClean.length === 0) {
      console.log(chalk.yellow('No valid projects selected.'));
      return;
    }

    console.log(chalk.dim(`\nSelected ${targetsToClean.length} projects...`));

  } else {
    //"All or Nothing" Mode(default)
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

  //execute the deletion process
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
    } catch (err) {
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

  if (successCount > 0) {
    //update lifetime stats
    const newLifetimeTotal = await updateLifetimeSavings(totalBytesDeleted);

    console.log('\n' + chalk.bgGreen.black.bold(' SUMMARY '));
    console.log(`✅ Cleaned:   ${successCount} projects`);
    if (failCount > 0) console.log(`❌ Failed:    ${failCount} projects`);
    console.log(`🎉 Reclaimed: ${chalk.bold(formatBytes(totalBytesDeleted))} of disk space!`);
    console.log(chalk.cyan(`📈 Lifetime reclaimed: ${chalk.bold(formatBytes(newLifetimeTotal))}\n`));
  }
}