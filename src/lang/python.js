import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { execFile } from 'child_process';
import util from 'util';
import { createRun, discoverRun, measureTargets } from '../core/workflow.js';
import { performCleanup } from '../core/cleaner.js';
import { formatBytes } from '../utils/helpers.js';

const execPromise = util.promisify(execFile);

// generate a 'requirements.sweepr.txt' file from a venv. 
async function generateRequirements(venvPath) {
    const parentDir = path.dirname(venvPath);
    const outputPath = path.join(parentDir, 'requirements.sweepr.txt');
    
    // identifies the Python executable file within the venv
    const binDir = os.platform() === 'win32' ? 'Scripts' : 'bin';
    const exeName = os.platform() === 'win32' ? 'python.exe' : 'python';
    const pythonPath = path.join(venvPath, binDir, exeName);

    try {
        await fs.stat(pythonPath);
    } catch (e) {
        return false; 
    }

    try {
        const { stdout } = await execPromise(pythonPath, ['-m', 'pip', 'freeze']);
        
        const content = stdout.trim() || '# No packages found in venv';
        await fs.writeFile(outputPath, content);
        return true;
    } catch (err) {
        return false;
    }
}

export async function runPythonCleanup(options, sharedRun, discoveredTargets) {
  const run = sharedRun ?? createRun(options);
  const { days, scanPath, thresholdDate } = run;

  console.log('');
  console.log(chalk.bgYellow.black.bold(' PYTHON CLEANUP '));
  console.log(chalk.dim(`Path: ${scanPath}`));
  console.log(chalk.dim(`Inactivity Threshold: ${days} days (${thresholdDate.toLocaleDateString()})\n`));
  
  const discovery = discoveredTargets ? { targets: discoveredTargets } : await discoverRun(run, ['python']);
  const inactiveTargets = discovery.targets.filter(target => target.language === 'python' && target.mtime < thresholdDate);
  if (options.timings && discovery.elapsedMs != null) console.log('Timing: scan ' + (discovery.elapsedMs / 1000).toFixed(3) + 's');


  if (inactiveTargets.length === 0) {
    console.log(chalk.green('No inactive Python projects found.'));
    return;
  }

  console.log(chalk.green('Found ' + inactiveTargets.length + ' inactive Python environments.'));
  console.log(chalk.dim('Requirements will be exported after selection, immediately before cleanup. Environments whose export fails will be skipped.'));
  if (options.dryRun) console.log(chalk.dim('Dry run: requirements export is not attempted; cleanup eligibility is provisional.'));

  const sizeStarted = performance.now();
  const targetsWithSizes = await measureTargets(inactiveTargets, options, run.context);
  if (options.timings) console.log('Timing: preview sizes ' + ((performance.now() - sizeStarted) / 1000).toFixed(3) + 's');
  if (options.skipSize) console.log(chalk.dim('Preview sizes skipped. Only confirmed selections will be measured before cleanup.'));


  console.log(chalk.bold('\n📦 Projects eligible for cleanup:'));
  let totalSize = options.skipSize ? null : 0;
  targetsWithSizes.forEach(target => {
    if (totalSize !== null) totalSize += target.size;
    const sizeStr = chalk.yellow((target.size === null ? 'not measured' : formatBytes(target.size)).padStart(10));
    const dateStr = chalk.dim(target.mtime.toLocaleDateString());
    console.log(`   ${sizeStr}  ${chalk.white(target.parent)} ${chalk.dim('(Last active: ' + dateStr + ')')}`);
    console.log(chalk.dim(`               ↳ Requires successful requirements.sweepr.txt export before cleanup`));
  });
  console.log(chalk.dim('   ' + '─'.repeat(50)));
  console.log(`   ${chalk.green.bold((totalSize === null ? 'not measured' : formatBytes(totalSize)).padStart(10))}  ${chalk.bold('TOTAL DEPENDENCY DATA')}\n`);
  
  await performCleanup(targetsWithSizes, options, totalSize, target => generateRequirements(target.path), run.context.io);
}