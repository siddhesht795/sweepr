import fs from 'fs/promises';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { GLOBAL_CONFIG_PATH } from '../constants.js';
import { loadGlobalConfig } from '../utils/config.js';

export async function runConfigWizard() {
  console.clear(); 
  console.log(chalk.green.bold('\n🧹 Welcome to the sweepr configuration wizard!\n'));
  console.log(chalk.dim(`Settings will be saved to: ${GLOBAL_CONFIG_PATH}\n`));

  const currentConfig = await loadGlobalConfig();

  const questions = [
    {
      type: 'input',
      name: 'days',
      message: 'Default inactivity period (days):',
      default: currentConfig.days || 30,
      validate: (input) => !isNaN(parseInt(input, 10)) || 'Please enter a number',
    },
    {
      type: 'input',
      name: 'path',
      message: 'Default scan path (leave empty for current dir):',
      default: currentConfig.path || '',
    },
    {
        type: 'confirm',
        name: 'trash',
        message: 'Use system trash for deleted folders (safer)?',
        default: currentConfig.trash ?? true, 
    },
    {
      type: 'confirm',
      name: 'dryRun',
      message: 'Always run in "dry run" mode by default?',
      default: currentConfig.dryRun || false,
    },
  ];

  const answers = await inquirer.prompt(questions);

  const newConfig = {
    ...currentConfig,
    days: parseInt(answers.days, 10),
    path: answers.path,
    trash: answers.trash,
    dryRun: answers.dryRun,
    yes: currentConfig.yes || false, 
  };

  try {
    await fs.writeFile(GLOBAL_CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    ora().succeed(chalk.green(`Configuration saved!`));
  } catch (err) {
    ora().fail(chalk.red(`Could not save config: ${err.message}`));
  }
}