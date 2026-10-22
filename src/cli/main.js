import { createRequire } from 'node:module';
import { program, InvalidArgumentError } from 'commander';
import chalk from 'chalk';
import { createRun, discoverRun, displayRunTimings } from '../core/workflow.js';
import { loadGlobalConfig, doesConfigExist, mergeOptions } from '../utils/config.js';
import { runConfigWizard } from './wizard.js';
import { runNodeCleanup } from '../lang/node.js';
import { runPythonCleanup } from '../lang/python.js';
import { formatBytes } from '../utils/helpers.js';
import { displayHelp } from './help.js'; // --- NEW IMPORT ---

const { version } = createRequire(import.meta.url)('../../package.json');

export async function main() {
  let isFirstRun = false;
  try { isFirstRun = !(await doesConfigExist()); } catch (err) { }

  if (isFirstRun && !process.argv.includes('--help') && !process.argv.includes('-h') && !process.argv.includes('--version') && !process.argv.includes('-V') && !process.argv.includes('--dry-run') && process.argv[2] !== 'help' && process.argv[2] !== 'config') {
    await runConfigWizard();
    console.log(chalk.dim('----------------------------------------\n'));
  }

  const loadedConfig = await loadGlobalConfig();

  program
    .version(version)
    .description('A smart CLI tool to clean up inactive dev dependencies.') 
    .option('-d, --days <number>', `Inactivity threshold in days [default: ${loadedConfig.days || 30}]`)
    .option('-p, --path <directory>', `Root path to scan [default: current dir]`)
    .option('--skip-size', 'Skip preview sizes; measure only confirmed selections')
    .option('--timings', 'Show time spent scanning, sizing, preparing, and deleting')
    .option('--concurrency <number>', 'Maximum concurrent filesystem calls (1-128)', value => {
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 128) throw new InvalidArgumentError('Use an integer between 1 and 128.');
      return parsed;
    })
    .option('--dry-run', 'Simulate deletion without actually deleting')
    .option('--no-dry-run', 'Disable dry-run mode')
    .option('-y, --yes', 'Skip normal cleanup prompts (failed Python exports still require confirmation)')
    .option('--no-yes', 'Do NOT skip confirmation prompts')
    .option('--trash', 'Move to system trash (safer)')
    .option('--no-trash', 'Permanently delete files')
    .option('-i, --interactive', 'Ask for confirmation for each folder');

  program
    .command('help')
    .description('Show the custom help menu')
    .action(() => {
      displayHelp();
    });

  program.command('config')
    .description('Run the configuration wizard')
    .action(runConfigWizard);

  program.command('stats')
    .description('Show lifetime dependency data cleaned')
    .action(async () => {
      const config = await loadGlobalConfig();
      const total = config.totalCleanedBytes ?? config.totalReclaimedBytes ?? 0;
      console.log('');
      console.log(chalk.bgCyan.black.bold(' SWEEPR STATS '));
      console.log(`📈 Lifetime dependency data cleaned: ${chalk.green.bold(formatBytes(total))}\n`);
    });

  program.command('node')
    .description('Clean up inactive Node.js projects')
    .action(async () => {
      const opts = mergeOptions(program.opts(), loadedConfig);
      const run = createRun(opts);
      await runNodeCleanup(opts, run);
      displayRunTimings(run, opts);
    });

  program.command('python')
    .description('Clean up inactive Python projects')
    .action(async () => {
      const opts = mergeOptions(program.opts(), loadedConfig);
      const run = createRun(opts);
      await runPythonCleanup(opts, run);
      displayRunTimings(run, opts);
    });

  program.command('all', { isDefault: true })
    .description('Run all cleanup operations')
    .action(async () => {
      const firstArg = process.argv[2];

      // if the user types 'sweepr help' or 'sweepr --help' then don't run 'all'
      if (firstArg === 'help' || firstArg === '--help' || firstArg === '-h') {
        return;
      }

      if (firstArg && !firstArg.startsWith('-') && firstArg !== 'all') {
        displayHelp();
        return;
      }

      console.log(chalk.bold('🧹 Starting sweepr full cleanup...'));
      const opts = mergeOptions(program.opts(), loadedConfig);
      const run = createRun(opts);
      const discovery = await discoverRun(run, ['node', 'python']);

      await runNodeCleanup(opts, run, discovery.targets);
      await runPythonCleanup(opts, run, discovery.targets);
      console.log(chalk.bold('\n✨ Sweep complete!'));
      displayRunTimings(run, opts);
    });

  // to override default help behavior to show our custom screen
  program.on('--help', () => {
    displayHelp();
  });

  await program.parseAsync(process.argv);
}