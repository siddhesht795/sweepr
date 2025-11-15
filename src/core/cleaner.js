import fs from 'fs/promises';
import trash from 'trash';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { formatBytes } from '../utils/helpers.js';

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
  let operationCancelled = false;

  if (options.interactive && !options.yes) {
    console.log('');
    for (const target of targets) {
      console.log(chalk.dim('─'.repeat(50))); 
      console.log(`${chalk.bold(target.parent)}`);
      console.log(chalk.dim(`Path: ${target.path}`));
      console.log(`Size: ${chalk.yellow(formatBytes(target.size))}`);
      
      const { shouldDelete } = await inquirer.prompt([
        { type: 'confirm', name: 'shouldDelete', message: 'Clean this project?', default: false },
      ]);

      if (shouldDelete) {
        const delSpinner = ora('Cleaning...').start();
        try {
          if (options.trash) await trash(target.path);
          else await fs.rm(target.path, { recursive: true, force: true });
          
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
    // All-at-once mode
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
      const delSpinner = ora('Cleaning projects...').start();
      for (const target of targets) {
        try {
          if (options.trash) await trash(target.path);
          else await fs.rm(target.path, { recursive: true, force: true });
          
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