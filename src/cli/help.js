import chalk from 'chalk';

const PAD_WIDTH = 28;

function logItem(flags, description) {
    console.log(`  ${chalk.cyan(flags.padEnd(PAD_WIDTH))} ${description}`);
}

function logHeader(text) {
    console.log(chalk.bold.underline(`\n${text}`));
}

export function displayHelp() {
    console.log('');
    console.log(chalk.bold.bgCyan.black('  🧹 SWEEPR - CLI HELP  '));
    console.log(chalk.dim('  A smart tool to clean inactive dev dependencies.'));

    logHeader('USAGE');
    console.log(`  $ ${chalk.green('sweepr')} ${chalk.yellow('<command>')} ${chalk.cyan('[options]')}`);

    logHeader('COMMANDS');
    logItem('all (default)', 'Run cleanup for ALL supported languages.');
    logItem('node', 'Clean inactive Node.js projects (node_modules).');
    logItem('python', 'Clean inactive Python projects (venv).');
    logItem('config', 'Run the interactive configuration wizard.');
    logItem('stats', 'View total disk space reclaimed lifetime.');
    logItem('help', 'Show this help message.');

    logHeader('OPTIONS (Flags)');
    logItem('-d, --days <number>', 'Inactivity threshold in days (default: 30).');
    logItem('-p, --path <dir>', 'Root directory to scan (default: current).');
    logItem('-i, --interactive', 'Review and select specific folders to delete.');

    logHeader('SAFETY & MODES');
    logItem('--dry-run', 'Simulate deletion (no files touched).');
    logItem('--no-dry-run', 'Force actual deletion (overrides config).');
    logItem('--trash', 'Move to system trash instead of delete (safer).');
    logItem('--no-trash', 'Permanently delete files (faster, dangerous).');
    logItem('-y, --yes', 'Skip all confirmation prompts (for scripts).');

    logHeader('EXAMPLES');
    console.log(`  ${chalk.dim('# Preview what would be deleted in the current folder')}`);
    console.log(`  $ sweepr --dry-run`);

    console.log(`  ${chalk.dim('\n  # Interactively clean Node projects older than 90 days')}`);
    console.log(`  $ sweepr node --days 90 -i`);

    console.log(`  ${chalk.dim('\n  # Check how much space you have saved total')}`);
    console.log(`  $ sweepr stats`);

    console.log('');
}