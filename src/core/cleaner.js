import fs from 'fs/promises';
import trash from 'trash';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { createFileSystem } from '../utils/io.js';
import { formatBytes, getDirectorySize } from '../utils/helpers.js';
import { updateLifetimeSavings } from '../utils/config.js';

export async function performCleanup(targets, options, totalSize, beforeCleanup, io = createFileSystem()) {
  const totalSizeStr = totalSize === null ? null : formatBytes(totalSize);

  if (options.dryRun) {
    ora().info(chalk.blueBright('DRY RUN MODE: No project files were changed.\n'));
    return;
  }

  if (options.trash) {
    console.log(chalk.blue('ℹ️  Mode: Moving to system trash (safer)'));
  } else {
    console.log(chalk.red.bold('⚠️  Mode: PERMANENTLY DELETING'));
  }

  let successCount = 0;
  let failCount = 0;
  let skippedCount = 0;
  let prepareMs = 0;
  let sizeMs = 0;
  let deleteMs = 0;
  let totalBytesDeleted = 0;
  let targetsToClean = [];

  //"Select by ID" interactive Mode (-i)
  if (options.interactive && !options.yes) {
    console.log(chalk.yellowBright.bold('\nSelect projects to clean:'));
    
    //1. print the numbered/indexed list
    targets.forEach((target, index) => {
      const num = chalk.cyanBright(`[${index + 1}]`);
      const sz = chalk.yellow(target.size == null ? 'size not measured' : formatBytes(target.size));
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
          message: chalk.bold(`Ready to clean ${targets.length} projects ${totalSizeStr === null ? '' : '(' + totalSizeStr + ')'}?`), 
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
      // Prepare only confirmed selections, immediately before deleting each target.
      const prepareStart = performance.now();
      const ready = !beforeCleanup || await beforeCleanup(target);
      prepareMs += performance.now() - prepareStart;
      if (!ready) {
        skippedCount++;
        delSpinner.clear();
        console.log(chalk.yellow('Skipped ' + target.path + ': could not generate requirements.sweepr.txt.'));
        delSpinner.render();
        continue;
      }
      if (target.size == null) {
        const sizeStart = performance.now();
        target.size = await getDirectorySize(target.path, io);
        sizeMs += performance.now() - sizeStart;
      }
      const deleteStart = performance.now();
      try {
        if (options.trash) {
          await trash(target.path);
        } else {
          await fs.rm(target.path, { recursive: true, force: true });
        }
      } finally {
        deleteMs += performance.now() - deleteStart;
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

  if (failCount === 0 && skippedCount === 0) {
    delSpinner.succeed(chalk.green('Cleaned successfully!'));
  } else {
    delSpinner.warn(chalk.yellow(`Finished, but ${failCount} failed, ${skippedCount} skipped.`));
  }

  if (options.timings) console.log('Timing: preparation ' + (prepareMs / 1000).toFixed(3) + 's; selected sizes ' + (sizeMs / 1000).toFixed(3) + 's; deletion ' + (deleteMs / 1000).toFixed(3) + 's');

  if (successCount > 0) {
    //update lifetime stats
    const newLifetimeTotal = await updateLifetimeSavings(totalBytesDeleted);

    console.log('\n' + chalk.bgGreen.black.bold(' SUMMARY '));
    console.log(`✅ Cleaned:   ${successCount} projects`);
    if (failCount > 0) console.log(`❌ Failed:    ${failCount} projects`);
    console.log(`${options.trash ? 'Moved to trash' : 'Deleted'}: ${chalk.bold(formatBytes(totalBytesDeleted))}`);
    if (options.trash) console.log(chalk.dim('Empty your system trash / Recycle Bin to free the storage.'));
    console.log(chalk.cyan(`📈 Lifetime dependency data cleaned: ${chalk.bold(formatBytes(newLifetimeTotal))}\n`));
  }
}