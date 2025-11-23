import path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { findTargets } from '../core/scanner.js';
import { performCleanup } from '../core/cleaner.js';
import { getDirectorySize, formatBytes } from '../utils/helpers.js';

const isNodeModules = (dirPath, dirName) => dirName === 'node_modules';

export async function runNodeCleanup(options) {
  const days = parseInt(options.days, 10);
  const scanPath = path.resolve(options.path);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  console.log('');
  console.log(chalk.bgBlue.white.bold(' NODE.JS CLEANUP '));
  console.log(chalk.dim(`Path: ${scanPath}`));
  console.log(chalk.dim(`Inactivity Threshold: ${days} days (${thresholdDate.toLocaleDateString()})\n`));
  
  const scanSpinner = ora('Scanning for inactive projects...').start();
  const allTargets = await findTargets(scanPath, isNodeModules);
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

  console.log(chalk.dim('   ' + '─'.repeat(50)));
  console.log(`   ${chalk.green.bold(formatBytes(totalSize).padStart(10))}  ${chalk.bold('TOTAL RECLAIMABLE SPACE')}\n`);

  await performCleanup(targetsWithSizes, options, totalSize);
}