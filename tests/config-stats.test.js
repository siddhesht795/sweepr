import { beforeEach, expect, it, vi } from 'vitest';
import fs from 'fs/promises';
import { updateLifetimeSavings } from '../src/utils/config.js';
vi.mock('fs/promises');
beforeEach(() => vi.clearAllMocks());

it('migrates historical cleanup totals without losing their value', async () => {
  fs.readFile.mockResolvedValue(JSON.stringify({ days: 60, totalReclaimedBytes: 100 }));
  fs.writeFile.mockResolvedValue();
  expect(await updateLifetimeSavings(25)).toBe(125);
  const saved = JSON.parse(fs.writeFile.mock.calls[0][1]);
  expect(saved).toEqual({ days: 60, totalCleanedBytes: 125 });
});

it('uses the new total when both old and new keys exist', async () => {
  fs.readFile.mockResolvedValue(JSON.stringify({ totalCleanedBytes: 0, totalReclaimedBytes: 100 }));
  fs.writeFile.mockResolvedValue();
  expect(await updateLifetimeSavings(25)).toBe(25);
});
