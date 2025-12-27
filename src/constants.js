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
  // Development & Build
  'node_modules', '.git', 'dist', 'build',
  'coverage', '.cache', 'public', 'vendor',
  'venv', '.venv', 'env', '.env', '__pycache__',
  '.pytest_cache', '.mypy_cache',

  // Package Managers & Configs
  '.npm',          
  '.nvm',
  '.yarn',
  '.pnpm-store',
  '.local',
  '.config',
  '.cargo',
  '.rustup',

  // IDEs
  '.vscode', '.vscode-insiders', '.idea', '.vscode-server',

  // Windows System
  'AppData', '$Recycle.Bin', 'System Volume Information',
  'Program Files', 'Program Files (x86)', 'Windows', 'Recovery', 'Config.Msi',

  // macOS System
  '.Trash', '.Trashes', 'Library', 'Applications',

  // Linux System
  'proc', 'sys', 'dev', 'var', 'tmp', 'usr', 'bin', 'sbin', 'etc', 'snap', 'boot', 'lib', 'lib64', 'opt', 'srv', 'run'
]);

export const GLOBAL_CONFIG_PATH = path.join(os.homedir(), '.sweeprrc');