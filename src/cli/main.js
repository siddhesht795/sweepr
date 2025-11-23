import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { loadGlobalConfig, doesConfigExist, mergeOptions } from '../utils/config.js';
import { runConfigWizard } from './wizard.js';
import { runNodeCleanup } from '../lang/node.js';
import { runPythonCleanup } from '../lang/python.js';
import { formatBytes } from '../utils/helpers.js'; // Needed for stats command

export async function main() {
  let isFirstRun = false;
  try { isFirstRun = !(await doesConfigExist()); } catch (err) {}

  if (isFirstRun && !process.argv.includes('--help') && !process.argv.includes('-h') && process.argv[2] !== 'config') {
    await runConfigWizard();
    console.log(chalk.dim('----------------------------------------\n'));
  }
  
  const loadedConfig = await loadGlobalConfig();

  program
    .version('1.9.0')
    .description('A smart CLI tool to clean up inactive dev dependencies.')
    .option('-d, --days <number>', `Inactivity threshold in days [default: ${loadedConfig.days || 30}]`)
    .option('-p, --path <directory>', `Root path to scan [default: current dir]`)
    .option('--dry-run', 'Simulate deletion without actually deleting')
    .option('--no-dry-run', 'Disable dry-run mode')
    .option('-y, --yes', 'Skip confirmation prompts (DANGEROUS)')
    .option('--no-yes', 'Do NOT skip confirmation prompts')
    .option('--trash', 'Move to system trash (safer)')
    .option('--no-trash', 'Permanently delete files')
    .option('-i, --interactive', 'Ask for confirmation for each folder');

  program.command('config')
    .description('Run the configuration wizard')
    .action(runConfigWizard);

  // --- NEW STATS COMMAND ---
  program.command('stats')
    .description('Show lifetime space savings')
    .action(async () => {
        const config = await loadGlobalConfig();
        const total = config.totalReclaimedBytes || 0;
        console.log('');
        console.log(chalk.bgCyan.black.bold(' SWEEPR STATS '));
        console.log(`📈 Lifetime space reclaimed: ${chalk.green.bold(formatBytes(total))}\n`);
    });

  program.command('node')
    .description('Clean up inactive Node.js projects')
    .action(async () => {
      await runNodeCleanup(mergeOptions(program.opts(), loadedConfig));
    });

  program.command('python')
    .description('Clean up inactive Python projects')
    .action(async () => {
      await runPythonCleanup(mergeOptions(program.opts(), loadedConfig));
    });

  program.command('all', { isDefault: true })
    .description('Run all cleanup operations')
    .action(async () => {
      const firstArg = process.argv[2];
      if (firstArg && !firstArg.startsWith('-') && firstArg !== 'all') {
         return;
      }
      console.log(chalk.bold('🧹 Starting sweepr full cleanup...'));
      const opts = mergeOptions(program.opts(), loadedConfig);
      await runNodeCleanup(opts);
      await runPythonCleanup(opts);
      console.log(chalk.bold('\n✨ Sweep complete!'));
    });
  
  await program.parseAsync(process.argv);
}