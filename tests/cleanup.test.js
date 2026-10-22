import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const mocks = vi.hoisted(() => ({
  freeze: vi.fn(), trash: vi.fn(), prompt: vi.fn(), stats: vi.fn(),
}));
vi.mock('child_process', () => {
  const execFile = () => {};
  execFile[Symbol.for('nodejs.util.promisify.custom')] = mocks.freeze;
  return { execFile };
});
vi.mock('trash', () => ({ default: mocks.trash }));
vi.mock('inquirer', () => ({ default: { prompt: mocks.prompt } }));
vi.mock('../src/utils/config.js', () => ({ updateLifetimeSavings: mocks.stats }));
import { runPythonCleanup } from '../src/lang/python.js';
import { findTargets } from '../src/core/scanner.js';

let root;
let env;
let receipt;
let output;
const options = extra => ({ path: root, days: 30, yes: true, trash: true, ...extra });

beforeEach(async () => {
  vi.clearAllMocks();
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sweepr-regression-'));
  env = path.join(root, 'project', 'custom-env');
  receipt = path.join(root, 'project', 'requirements.sweepr.txt');
  const bin = path.join(env, os.platform() === 'win32' ? 'Scripts' : 'bin');
  await fs.mkdir(bin, { recursive: true });
  await fs.writeFile(path.join(env, 'pyvenv.cfg'), 'home = test');
  await fs.writeFile(path.join(bin, os.platform() === 'win32' ? 'python.exe' : 'python'), 'fixture');
  const source = path.join(root, 'project', 'app.py');
  await fs.writeFile(source, 'print("hello")');
  await fs.utimes(source, new Date('2020-01-01'), new Date('2020-01-01'));
  mocks.freeze.mockResolvedValue({ stdout: 'example==1.2.3\n' });
  mocks.trash.mockResolvedValue();
  mocks.stats.mockResolvedValue(100);
  output = vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  // Delete only the unique fixture directory created by this test.
  await fs.rm(root, { recursive: true, force: true });
});

describe('Python cleanup safeguards', () => {
  it('dry run neither executes Python nor writes or overwrites a receipt', async () => {
    await fs.writeFile(receipt, 'existing receipt');
    await runPythonCleanup(options({ dryRun: true }));
    expect(mocks.freeze).not.toHaveBeenCalled();
    expect(await fs.readFile(receipt, 'utf8')).toBe('existing receipt');
    expect(mocks.trash).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
    await fs.stat(env);
  });

  it('cancelling confirmation leaves no receipt and preserves the environment', async () => {
    mocks.prompt.mockResolvedValue({ shouldDelete: false });
    await runPythonCleanup(options({ yes: false }));
    expect(mocks.freeze).not.toHaveBeenCalled();
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(mocks.trash).not.toHaveBeenCalled();
    await fs.stat(env);
  });

  it('selecting none does not prepare any environments', async () => {
    mocks.prompt.mockResolvedValue({ selection: 'none' });
    await runPythonCleanup(options({ yes: false, interactive: true }));
    expect(mocks.freeze).not.toHaveBeenCalled();
    expect(mocks.trash).not.toHaveBeenCalled();
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('exports only the selected environment, before moving it to trash', async () => {
    const secondEnv = path.join(root, 'second-project', 'another-env');
    await fs.mkdir(secondEnv, { recursive: true });
    await fs.writeFile(path.join(secondEnv, 'pyvenv.cfg'), 'fixture');
    mocks.prompt.mockResolvedValue({ selection: '1' });
    mocks.trash.mockImplementation(async target => {
      expect(target).toBe(env);
      expect(await fs.readFile(receipt, 'utf8')).toBe('example==1.2.3');
    });
    await runPythonCleanup(options({ yes: false, interactive: true }));
    expect(mocks.freeze).toHaveBeenCalledTimes(1);
    expect(mocks.freeze).toHaveBeenCalledWith(expect.stringContaining('python'), ['-m', 'pip', 'freeze']);
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
    await expect(fs.stat(path.join(root, 'second-project', 'requirements.sweepr.txt'))).rejects.toMatchObject({ code: 'ENOENT' });
    expect(output.mock.calls.flat().join('\n')).toContain('Moved to trash:');
    expect(output.mock.calls.flat().join('\n')).toContain('Recycle Bin');
  });

  it('failed dependency export prevents deletion and stats updates', async () => {
    mocks.freeze.mockRejectedValue(new Error('pip failed'));
    await runPythonCleanup(options());
    expect(mocks.trash).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
    await fs.stat(env);
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('failed receipt writing prevents deletion', async () => {
    await fs.mkdir(receipt);
    await runPythonCleanup(options());
    expect(mocks.trash).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
    await fs.stat(env);
  });

  it('permanent cleanup deletes the fixture environment but preserves source and receipt', async () => {
    await runPythonCleanup(options({ trash: false }));
    await expect(fs.stat(env)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(receipt, 'utf8')).toBe('example==1.2.3');
    await fs.stat(path.join(root, 'project', 'app.py'));
    expect(mocks.stats).toHaveBeenCalledOnce();
    expect(output.mock.calls.flat().join('\n')).toContain('Deleted:');
  });
});

it('ignores fresh lockfiles but still counts package.json as project activity', async () => {
  const project = path.join(root, 'project');
  await fs.mkdir(path.join(project, 'node_modules'));
  await fs.writeFile(path.join(project, 'package-lock.json'), '{}');
  await fs.writeFile(path.join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9');
  await fs.writeFile(path.join(project, 'Pipfile.lock'), '{}');
  const detect = (p, name) => name === 'node_modules';
  const before = await findTargets(root, detect);
  expect(before[0].mtime).toEqual(new Date('2020-01-01'));
  await fs.writeFile(path.join(project, 'package.json'), '{}');
  const after = await findTargets(root, detect);
  expect(after[0].mtime.getTime()).toBeGreaterThan(new Date('2020-01-01').getTime());
});

it('skip-size dry run does not walk dependency contents for sizes', async () => {
  const dependencies = path.join(env, 'installed-packages');
  await fs.mkdir(dependencies);
  await fs.writeFile(path.join(dependencies, 'package.py'), 'fixture');
  const read = vi.spyOn(fs, 'readdir');
  await runPythonCleanup(options({ dryRun: true, skipSize: true }));
  expect(read.mock.calls.some(([p]) => p === dependencies)).toBe(false);
  expect(mocks.freeze).not.toHaveBeenCalled();
  expect(mocks.trash).not.toHaveBeenCalled();
  expect(mocks.stats).not.toHaveBeenCalled();
  await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
});

it('skip-size cancellation avoids both sizing dependencies and exporting receipts', async () => {
  const dependencies = path.join(env, 'installed-packages');
  await fs.mkdir(dependencies);
  mocks.prompt.mockResolvedValue({ shouldDelete: false });
  const read = vi.spyOn(fs, 'readdir');
  await runPythonCleanup(options({ yes: false, skipSize: true }));
  expect(read.mock.calls.some(([p]) => p === dependencies)).toBe(false);
  expect(mocks.freeze).not.toHaveBeenCalled();
  expect(mocks.trash).not.toHaveBeenCalled();
});

it('skip-size measures selected dependencies before deletion and records their bytes', async () => {
  const { getDirectorySize } = await import('../src/utils/helpers.js');
  const expectedBytes = await getDirectorySize(env);
  const second = path.join(root, 'second-project', 'another-env');
  const unselectedContents = path.join(second, 'installed-packages');
  await fs.mkdir(unselectedContents, { recursive: true });
  await fs.writeFile(path.join(second, 'pyvenv.cfg'), 'fixture');
  const read = vi.spyOn(fs, 'readdir');
  mocks.prompt.mockResolvedValue({ selection: '1' });
  await runPythonCleanup(options({ yes: false, interactive: true, skipSize: true }));
  expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
  expect(mocks.stats).toHaveBeenCalledExactlyOnceWith(expectedBytes);
  expect(read.mock.calls.some(([p]) => p === unselectedContents)).toBe(false);
});
