import chalk from 'chalk';
import { createRun, discoverRun, measureTargets } from '../core/workflow.js';
import { performCleanup } from '../core/cleaner.js';
import { formatBytes } from '../utils/helpers.js';


export async function runNodeCleanup(options, sharedRun, discoveredTargets) {
  const run = sharedRun ?? createRun(options);
  const { days, scanPath, thresholdDate } = run;

  console.log('');
  console.log(chalk.bgBlue.white.bold(' NODE.JS CLEANUP '));
  console.log(chalk.dim(`Path: ${scanPath}`));
  console.log(chalk.dim(`Inactivity Threshold: ${days} days (${thresholdDate.toLocaleDateString()})\n`));
  
  const discovery = discoveredTargets ? { targets: discoveredTargets } : await discoverRun(run, ['node']);
  const targets = discovery.targets.filter(target => target.language === 'node' && target.mtime < thresholdDate);



  if (targets.length === 0) {
    console.log(chalk.green('No inactive Node.js projects found.'));
    return;
  }
  console.log(chalk.green(`Found ${targets.length} inactive Node.js projects.`));

  const sizeStarted = performance.now();
  const targetsWithSizes = await measureTargets(targets, options, run.context);
  if (options.timings) console.log('Timing: preview sizes ' + ((performance.now() - sizeStarted) / 1000).toFixed(3) + 's');
  if (options.skipSize) console.log(chalk.dim('Preview sizes skipped. Only confirmed selections will be measured before cleanup.'));


  console.log(chalk.bold('\n📦 Projects eligible for cleanup:'));
  let totalSize = options.skipSize ? null : 0;
  targetsWithSizes.forEach(target => {
    if (totalSize !== null) totalSize += target.size;
    const sizeStr = chalk.yellow((target.size === null ? 'not measured' : formatBytes(target.size)).padStart(10));
    const dateStr = chalk.dim(target.mtime.toLocaleDateString());
    console.log(`   ${sizeStr}  ${chalk.white(target.parent)} ${chalk.dim('(Last active: ' + dateStr + ')')}`);
  });

  console.log(chalk.dim('   ' + '─'.repeat(50)));
  console.log(`   ${chalk.green.bold((totalSize === null ? 'not measured' : formatBytes(totalSize)).padStart(10))}  ${chalk.bold('TOTAL DEPENDENCY DATA')}\n`);

  const cleanup = await performCleanup(targetsWithSizes, options, totalSize, undefined, run.context.io);
  run.deletionElapsedMs += cleanup?.deleteMs ?? 0;
}