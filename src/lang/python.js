import chalk from 'chalk';
import ora from 'ora';

export async function runPythonCleanup(options) {
  console.log('');
  console.log(chalk.bgYellow.black.bold(' PYTHON CLEANUP '));
  ora().info(chalk.yellow('Python cleanup feature is coming soon!'));
  // In the future, this will look almost identical to lang/node.js
  // but will use const PYTHON_TARGETS = new Set(['venv', '.venv', '__pycache__']);
}