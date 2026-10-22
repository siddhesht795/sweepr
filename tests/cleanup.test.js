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
import { createRun } from '../src/core/workflow.js';

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

// Make the interactive/noninteractive boundary deterministic even when npm test
// itself is launched from a terminal. Each test restores the original stream state.
const originalInputTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');
const originalOutputTTY = Object.getOwnPropertyDescriptor(process.stdout, 'isTTY');
function setTerminal(value) {
  Object.defineProperty(process.stdin, 'isTTY', { value, configurable: true });
  Object.defineProperty(process.stdout, 'isTTY', { value, configurable: true });
}
beforeEach(() => {
  setTerminal(false);
  mocks.prompt.mockReset();
});
afterEach(() => {
  if (originalInputTTY) Object.defineProperty(process.stdin, 'isTTY', originalInputTTY);
  else delete process.stdin.isTTY;
  if (originalOutputTTY) Object.defineProperty(process.stdout, 'isTTY', originalOutputTTY);
  else delete process.stdout.isTTY;
});

describe('Explicit cleanup without a Python package receipt', () => {
  it('accepts a separate default-No confirmation even when --yes skips normal prompts', async () => {
    setTerminal(true);
    mocks.freeze.mockRejectedValue(new Error('pip unavailable'));
    mocks.prompt.mockResolvedValue({ cleanWithoutReceipt: true });
    await runPythonCleanup(options());
    expect(mocks.prompt).toHaveBeenCalledOnce();
    expect(mocks.prompt.mock.calls[0][0][0]).toMatchObject({ type: 'confirm', name: 'cleanWithoutReceipt', default: false });
    expect(mocks.prompt.mock.calls[0][0][0].message).toContain('Recycle Bin / Trash');
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
    expect(mocks.stats).toHaveBeenCalledOnce();
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.stat(path.join(root, 'project', 'app.py'));
    expect(output.mock.calls.flat().join('\n')).toContain('Cleaned without a saved package list: 1');
    expect(output.mock.calls.flat().join('\n')).toContain(env);
  });

  it('keeps the environment when the extra confirmation is declined', async () => {
    setTerminal(true);
    mocks.freeze.mockRejectedValue(new Error('pip unavailable'));
    mocks.prompt.mockResolvedValue({ cleanWithoutReceipt: false });
    await runPythonCleanup(options());
    expect(mocks.prompt).toHaveBeenCalledOnce();
    expect(mocks.trash).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
    await fs.stat(env);
  });

  it('unattended --yes skips failed exports without prompting or deleting', async () => {
    mocks.freeze.mockRejectedValue(new Error('pip unavailable'));
    await runPythonCleanup(options({ yes: true }));
    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(mocks.trash).not.toHaveBeenCalled();
    expect(mocks.stats).not.toHaveBeenCalled();
    await fs.stat(env);
  });

  it('dry run in an interactive terminal never asks to bypass export', async () => {
    setTerminal(true);
    mocks.freeze.mockRejectedValue(new Error('pip unavailable'));
    await runPythonCleanup(options({ dryRun: true, skipSize: true }));
    expect(mocks.freeze).not.toHaveBeenCalled();
    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(mocks.trash).not.toHaveBeenCalled();
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('cancelling normal confirmation never offers cleanup without a receipt', async () => {
    setTerminal(true);
    mocks.prompt.mockResolvedValue({ shouldDelete: false });
    await runPythonCleanup(options({ yes: false }));
    expect(mocks.prompt).toHaveBeenCalledOnce();
    expect(mocks.prompt.mock.calls[0][0][0].name).toBe('shouldDelete');
    expect(mocks.freeze).not.toHaveBeenCalled();
    expect(mocks.trash).not.toHaveBeenCalled();
  });

  it('offers the extra confirmation only for an interactively selected target', async () => {
    setTerminal(true);
    const second = path.join(root, 'second-project', 'another-env');
    await fs.mkdir(second, { recursive: true });
    await fs.writeFile(path.join(second, 'pyvenv.cfg'), 'fixture');
    mocks.prompt.mockResolvedValueOnce({ selection: '2' }).mockResolvedValueOnce({ cleanWithoutReceipt: true });
    await runPythonCleanup(options({ yes: false, interactive: true, skipSize: true }));
    expect(mocks.prompt).toHaveBeenCalledTimes(2);
    expect(mocks.freeze).not.toHaveBeenCalled(); // Selected fixture has no interpreter.
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(second);
    expect(output.mock.calls.flat().join('\n')).toContain('Could not save a package list for: ' + second);
    await fs.stat(env);
  });

  it('permanent mode explicitly confirms permanent deletion without a receipt', async () => {
    setTerminal(true);
    mocks.freeze.mockRejectedValue(new Error('pip unavailable'));
    mocks.prompt.mockResolvedValue({ cleanWithoutReceipt: true });
    await runPythonCleanup(options({ trash: false, skipSize: true }));
    expect(mocks.prompt.mock.calls[0][0][0].message).toContain('PERMANENTLY DELETE');
    await expect(fs.stat(env)).rejects.toMatchObject({ code: 'ENOENT' });
    await fs.stat(path.join(root, 'project', 'app.py'));
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(mocks.trash).not.toHaveBeenCalled();
    expect(mocks.stats).toHaveBeenCalledOnce();
  });

  it('can confirm cleanup after a receipt write failure', async () => {
    setTerminal(true);
    await fs.mkdir(receipt);
    mocks.prompt.mockResolvedValue({ cleanWithoutReceipt: true });
    await runPythonCleanup(options());
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
    expect(mocks.stats).toHaveBeenCalledOnce();
    expect((await fs.stat(receipt)).isDirectory()).toBe(true);
  });

  it('can confirm cleanup when the environment interpreter is missing', async () => {
    setTerminal(true);
    const binary = path.join(env, os.platform() === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    await fs.unlink(binary);
    mocks.prompt.mockResolvedValue({ cleanWithoutReceipt: true });
    await runPythonCleanup(options());
    expect(mocks.freeze).not.toHaveBeenCalled();
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
    await expect(fs.stat(receipt)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not ask for an override when dependency export succeeds', async () => {
    setTerminal(true);
    await runPythonCleanup(options());
    expect(mocks.prompt).not.toHaveBeenCalled();
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
    expect(output.mock.calls.flat().join('\n')).not.toContain('Cleaned without a saved package list:');
  });

  it('a prompt cancellation error keeps remaining targets and records earlier success', async () => {
    setTerminal(true);
    for (const name of ['second-project', 'third-project']) {
      const other = path.join(root, name, 'another-env');
      await fs.mkdir(other, { recursive: true });
      await fs.writeFile(path.join(other, 'pyvenv.cfg'), 'fixture');
    }
    mocks.freeze.mockRejectedValue(new Error('pip unavailable'));
    const cancelled = new Error('User cancelled');
    cancelled.name = 'ExitPromptError';
    mocks.prompt.mockResolvedValueOnce({ cleanWithoutReceipt: true }).mockRejectedValueOnce(cancelled);
    await runPythonCleanup(options());
    expect(mocks.prompt).toHaveBeenCalledTimes(2);
    expect(mocks.trash).toHaveBeenCalledExactlyOnceWith(env);
    expect(mocks.stats).toHaveBeenCalledOnce();
    await fs.stat(path.join(root, 'second-project', 'another-env'));
    await fs.stat(path.join(root, 'third-project', 'another-env'));
  });
});

it('accumulates deletion duration across cleanup phases without counting Python exports', async () => {
  const run = createRun(options());
  let clock = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
  mocks.freeze.mockImplementation(async () => {
    clock += 500;
    return { stdout: 'example==1.2.3' };
  });
  mocks.trash.mockImplementation(async () => { clock += 50; });
  await runPythonCleanup(options(), run);
  expect(run.deletionElapsedMs).toBe(50);
  await runPythonCleanup(options(), run);
  expect(run.deletionElapsedMs).toBe(100);
  expect(mocks.freeze).toHaveBeenCalledTimes(2);
  expect(mocks.trash).toHaveBeenCalledTimes(2);
});
