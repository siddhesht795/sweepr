import { afterEach, beforeEach, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const repo = fileURLToPath(new URL('../', import.meta.url));
let home;
beforeEach(async () => {
  home = await fs.mkdtemp(path.join(os.tmpdir(), 'sweepr-cli-'));
});
afterEach(async () => {
  await fs.rm(home, { recursive: true, force: true });
});
function run(entry, args) {
  const result = spawnSync(process.execPath, [path.join(repo, entry), ...args], {
    cwd: repo,
    env: { ...process.env, USERPROFILE: home, HOME: home, NO_COLOR: '1' },
    encoding: 'utf8', timeout: 15000,
  });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

it('both executable entry points use the package version without first-run setup', async () => {
  const pkg = JSON.parse(await fs.readFile(path.join(repo, 'package.json'), 'utf8'));
  for (const entry of ['index.js', 'bin/sweepr.js']) {
    expect(run(entry, ['--version']).trim()).toMatch(new RegExp(pkg.version.replaceAll('.', '\\.') + '$'));
  }
  expect(await fs.readdir(home)).toEqual([]);
});

it('first-run Python dry run creates neither global config nor project receipts', async () => {
  const project = path.join(home, 'project');
  const venv = path.join(project, 'custom-env');
  await fs.mkdir(venv, { recursive: true });
  await fs.writeFile(path.join(venv, 'pyvenv.cfg'), 'home = fixture');
  const source = path.join(project, 'app.py');
  await fs.writeFile(source, 'print("hello")');
  await fs.utimes(source, new Date('2020-01-01'), new Date('2020-01-01'));
  const output = run('bin/sweepr.js', ['python', '--dry-run', '--path', home]);
  expect(output).toContain('Dry run: requirements export is not attempted');
  expect(output).not.toContain('configuration wizard');
  expect(await fs.readdir(home)).toEqual(['project']);
  expect((await fs.readdir(project)).sort()).toEqual(['app.py', 'custom-env']);
  expect(await fs.readFile(source, 'utf8')).toBe('print("hello")');
  await fs.stat(venv);
});

it('default cleanup shares one scan and supports skip-size and timing flags', async () => {
  const project = path.join(home, 'project');
  await fs.mkdir(path.join(project, 'node_modules'), { recursive: true });
  await fs.mkdir(path.join(project, '.venv'));
  await fs.writeFile(path.join(project, '.venv', 'pyvenv.cfg'), 'fixture');
  await fs.writeFile(path.join(project, 'app.js'), 'old source');
  await fs.utimes(path.join(project, 'app.js'), new Date('2020-01-01'), new Date('2020-01-01'));
  const output = run('bin/sweepr.js', ['--dry-run', '--skip-size', '--timings', '--concurrency', '2', '--path', home]);
  expect(output.match(/Timing: shared scan/g)).toHaveLength(1);
  expect(output).toContain('NODE.JS CLEANUP');
  expect(output).toContain('PYTHON CLEANUP');
  expect(output).toContain('not measured');
  expect(output).not.toContain('NaN');
  expect(await fs.readdir(home)).toEqual(['project']);
  await expect(fs.stat(path.join(project, 'requirements.sweepr.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
});

it('rejects invalid concurrency before starting a scan', () => {
  const result = spawnSync(process.execPath, [path.join(repo, 'bin/sweepr.js'), '--dry-run', '--concurrency', '0'], {
    cwd: repo, env: { ...process.env, HOME: home, USERPROFILE: home }, encoding: 'utf8', timeout: 15000,
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('integer between 1 and 128');
  expect(result.stdout).not.toContain('Starting sweepr');
});
