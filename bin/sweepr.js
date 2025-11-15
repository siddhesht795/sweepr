#!/usr/bin/env node

import chalk from 'chalk';
import ora from 'ora';
import { main } from '../src/cli/main.js';

main().catch(err => {
  if (ora().isSpinning) {
      ora().fail(chalk.redBright(err.message));
  } else {
      console.error(chalk.redBright.bold(`An unexpected error occurred: ${err.message}`));
  }
  process.exit(1);
});