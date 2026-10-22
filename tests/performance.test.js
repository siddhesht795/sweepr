import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createScanContext, discoverTargets } from '../src/core/scanner.js';
import { createFileSystem, mapLimit } from '../src/utils/io.js';
import { getDirectorySize } from '../src/utils/helpers.js';
import { measureTargets } from '../src/core/workflow.js';

let root;
let project;
const old = new Date('2020-01-01');
const cutoff = new Date('2025-01-01');
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'sweepr-performance-'));
  project = path.join(root, 'project');
  await fs.mkdir(path.join(project, 'node_modules'), { recursive: true });
  await fs.writeFile(path.join(project, 'app.js'), 'old code');
  await fs.utimes(path.join(project, 'app.js'), old, old);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
async function addEnv(name, parent = project) {
  const env = path.join(parent, name);
  await fs.mkdir(env, { recursive: true });
  await fs.writeFile(path.join(env, 'pyvenv.cfg'), 'fixture');
  return env;
}

it('discovers both ecosystems without exploring node_modules or ignored builds', async () => {
  const env = await addEnv('unusual-name');
  await addEnv('fake-env', path.join(project, 'node_modules'));
  await addEnv('hidden-env', path.join(project, 'build'));
  const read = vi.spyOn(fs, 'readdir');
  const targets = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(targets.map(t => t.path).sort()).toEqual([path.join(project, 'node_modules'), env].sort());
  expect(read.mock.calls.some(([p]) => p.includes('node_modules'))).toBe(false);
  expect(read.mock.calls.some(([p]) => p.includes(path.join(project, 'build')))).toBe(false);
});

it('shares each project activity check and directory listing across multiple targets', async () => {
  await addEnv('env-one');
  await addEnv('env-two');
  const stat = vi.spyOn(fs, 'stat');
  const read = vi.spyOn(fs, 'readdir');
  const targets = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(targets).toHaveLength(3);
  expect(targets.every(t => +t.mtime === +old)).toBe(true);
  expect(stat.mock.calls.filter(([p]) => p === path.join(project, 'app.js'))).toHaveLength(1);
  expect(read.mock.calls.filter(([p]) => p === project)).toHaveLength(1);
});

it('stops activity metadata checks after a recent source file proves activity', async () => {
  await fs.writeFile(path.join(project, '00-active.js'), 'new code');
  for (let i = 0; i < 12; i++) await fs.writeFile(path.join(project, `z-${i}.js`), 'new code');
  const stat = vi.spyOn(fs, 'stat');
  const targets = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(targets[0].mtime >= cutoff).toBe(true);
  expect(stat.mock.calls).toHaveLength(1);
});

it('still discovers inactive nested projects when the outer project is active', async () => {
  await fs.writeFile(path.join(project, '00-active.js'), 'new code');
  const nested = path.join(project, 'nested');
  await fs.mkdir(path.join(nested, 'node_modules'), { recursive: true });
  await fs.writeFile(path.join(nested, 'app.js'), 'old code');
  await fs.utimes(path.join(nested, 'app.js'), old, old);
  const targets = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(targets.filter(t => t.mtime < cutoff).map(t => t.parent)).toEqual([nested]);
});

it('does not treat unreadable source directories as inactive', async () => {
  const blocked = path.join(project, 'source');
  await fs.mkdir(blocked);
  const originalRead = fs.readdir.bind(fs);
  vi.spyOn(fs, 'readdir').mockImplementation((p, ...args) => {
    if (p === blocked) return Promise.reject(new Error('EACCES'));
    return originalRead(p, ...args);
  });
  const targets = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(targets[0].mtime >= cutoff).toBe(true);
});

it('uses fresh activity information on the next run', async () => {
  const first = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(first[0].mtime < cutoff).toBe(true);
  await fs.writeFile(path.join(project, 'app.js'), 'new code');
  const second = await discoverTargets(root, { context: createScanContext({ thresholdDate: cutoff }) });
  expect(second[0].mtime >= cutoff).toBe(true);
});

it('bounds filesystem concurrency across several size walks and keeps exact byte totals', async () => {
  const targets = [];
  for (let i = 0; i < 4; i++) {
    const folder = path.join(project, 'node_modules', `pkg-${i}`);
    await fs.mkdir(folder);
    for (let j = 0; j < 10; j++) await fs.writeFile(path.join(folder, `${j}.txt`), '1234567890');
    targets.push(folder);
  }
  let active = 0;
  let peak = 0;
  for (const operation of ['stat', 'readdir']) {
    const original = fs[operation].bind(fs);
    vi.spyOn(fs, operation).mockImplementation(async (...args) => {
      active++;
      peak = Math.max(peak, active);
      try {
        await new Promise(resolve => setTimeout(resolve, 1));
        return await original(...args);
      } finally { active--; }
    });
  }
  const io = createFileSystem(3);
  const sizes = await mapLimit(targets, 4, dir => getDirectorySize(dir, io));
  expect(sizes).toEqual([100, 100, 100, 100]);
  expect(peak).toBeLessThanOrEqual(3);
  expect(peak).toBeGreaterThan(1);
});

it('skip-size preview does no size traversal and marks sizes as unknown', async () => {
  const context = createScanContext();
  const read = vi.spyOn(context.io, 'readdir');
  const targets = [{ path: path.join(project, 'node_modules') }];
  expect(await measureTargets(targets, { skipSize: true }, context)).toEqual([{ ...targets[0], size: null }]);
  expect(read).not.toHaveBeenCalled();
});

it.each([0, -1, 129, 1.5, NaN])('rejects invalid filesystem concurrency %s', value => {
  expect(() => createFileSystem(value)).toThrow('Concurrency');
});
