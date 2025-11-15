import path from 'path';
import os from 'os';

export const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
  '.json', 'package.json', 'package-lock.json',
  '.html', '.htm', '.css', '.scss', '.sass', '.less',
  '.py', '.java', '.go', '.cs', '.rs', '.php', '.rb',
  '.sh', '.bash',
  '.xml', '.yml', '.yaml'
]);

export const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build',
  'coverage', '.cache', 'public', 'vendor',
  'venv', '.venv', '__pycache__', 'env' // Added common Python ones too for future use
]);

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.sweeprrc');