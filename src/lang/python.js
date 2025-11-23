import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { exec } from 'child_process';
import util from 'util';
import { findTargets } from '../core/scanner.js';
import { performCleanup } from '../core/cleaner.js';
import { getDirectorySize, formatBytes, isVenv } from '../utils/helpers.js';

const execPromise = util.promisify(exec);

/**
 * Tries to generate a 'requirements.sweepr.txt' file from a venv.
 * @param {string} venvPath Path to the venv directory
 * @returns {Promise<boolean>} True on success, false on failure
 */
async function generateRequirements(venvPath) {
    const parentDir = path.dirname(venvPath);
    const outputPath = path.join(parentDir, 'requirements.sweepr.txt');
    
    // 1. Identify the Python executable within the venv
    // Windows: venv/Scripts/python.exe
    // POSIX: venv/bin/python
    const binDir = os.platform() === 'win32' ? 'Scripts' : 'bin';
    const exeName = os.platform() === 'win32' ? 'python.exe' : 'python';
    const pythonPath = path.join(venvPath, binDir, exeName);

    // 2. Verify python exists (sanity check)
    try {
        await fs.stat(pythonPath);
    } catch (e) {
        // Python executable not found, likely a broken venv
        return false; 
    }

    // 3. Run 'pip freeze' via the venv's python executable
    // We use '-m pip' to ensure we use the pip installed in that environment.
    // We capture stdout directly instead of using '>' redirection for better cross-platform safety.
    try {
        const { stdout } = await execPromise(`"${pythonPath}" -m pip freeze`);
        
        // 4. Write the output to the file using Node.js fs
        // Default to a comment if stdout is empty (empty venv)
        const content = stdout.trim() || '# No packages found in venv';
        await fs.writeFile(outputPath, content);
        return true;
    } catch (err) {
        return false;
    }
}

export async function runPythonCleanup(options) {
  const days = parseInt(options.days, 10);
  const scanPath = path.resolve(options.path);
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);

  console.log('');
  console.log(chalk.bgYellow.black.bold(' PYTHON CLEANUP '));
  console.log(chalk.dim(`Path: ${scanPath}`));
  console.log(chalk.dim(`Inactivity Threshold: ${days} days (${thresholdDate.toLocaleDateString()})\n`));
  
  // 1. Scan for all venvs structurally (looking for pyvenv.cfg)
  const scanSpinner = ora('Scanning for Python virtual environments...').start();
  
  // We pass the isVenv check directly as the target finder
  const allTargets = await findTargets(scanPath, isVenv);
  
  const inactiveTargets = allTargets.filter(target => target.mtime < thresholdDate);

  if (inactiveTargets.length === 0) {
    scanSpinner.succeed(chalk.green('Scan complete. No inactive Python projects found! 🐍'));
    return;
  }

  // 2. Generate Requirements (Safety Check)
  scanSpinner.text = `Found ${inactiveTargets.length} inactive envs. Generating requirements files...`;
  
  // --- OPTIMIZATION: Run in parallel using Promise.all ---
  // This processes all venvs simultaneously instead of waiting for one to finish before starting the next.
  const results = await Promise.all(inactiveTargets.map(async (target) => {
      const success = await generateRequirements(target.path);
      return { target, success };
  }));

  const safeTargets = results.filter(r => r.success).map(r => r.target);
  const unsafeTargets = results.filter(r => !r.success).map(r => r.target);

  if (safeTargets.length === 0) {
    scanSpinner.warn(chalk.yellow(`Scan complete. Found ${unsafeTargets.length} inactive projects, but skipped all.`));
    console.log(chalk.dim('Reason: Could not generate requirements.sweepr.txt (broken venv or no pip).'));
    return;
  }
  
  scanSpinner.succeed(chalk.green(`Scan complete. Prepared ${chalk.bold(safeTargets.length)} projects for cleaning.`));

  if (unsafeTargets.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Skipped ${unsafeTargets.length} projects (failed to generate receipts):`));
    unsafeTargets.forEach(t => console.log(chalk.dim(`   - ${t.parent}`)));
  }

  // 3. Calculate Sizes
  const sizeSpinner = ora('Calculating potential space savings...').start();
  const targetsWithSizes = await Promise.all(
    safeTargets.map(async (target) => {
      const size = await getDirectorySize(target.path);
      return { ...target, size };
    })
  );
  sizeSpinner.stop();

  // 4. Display List
  console.log(chalk.bold('\n📦 Projects eligible for cleanup:'));
  let totalSize = 0;
  targetsWithSizes.forEach(target => {
    totalSize += target.size;
    const sizeStr = chalk.yellow(formatBytes(target.size).padStart(10));
    const dateStr = chalk.dim(target.mtime.toLocaleDateString());
    console.log(`   ${sizeStr}  ${chalk.white(target.parent)} ${chalk.dim('(Last active: ' + dateStr + ')')}`);
    console.log(chalk.dim(`               ↳ Generated requirements.sweepr.txt`));
  });
  console.log(chalk.dim('   ' + '─'.repeat(50)));
  console.log(`   ${chalk.green.bold(formatBytes(totalSize).padStart(10))}  ${chalk.bold('TOTAL RECLAIMABLE SPACE')}\n`);
  
  // 5. Perform Cleanup
  await performCleanup(targetsWithSizes, options, totalSize);
}