import path from 'path';
import ora from 'ora';
import { createScanContext, discoverTargets } from './scanner.js';
import { mapLimit } from '../utils/io.js';
import { getDirectorySize } from '../utils/helpers.js';

export function createRun(options) {
  const days = Number(options.days ?? 30);
  if (!Number.isInteger(days) || days < 0) throw new Error('Days must be a non-negative integer.');
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - days);
  return {
    deletionElapsedMs: 0,
    days, thresholdDate, scanPath: path.resolve(options.path ?? process.cwd()),
    context: createScanContext({ thresholdDate, concurrency: options.concurrency ?? 16 }),
  };
}

export async function discoverRun(run, languages) {
  const spinner = ora('Scanning projects...').start();
  const start = performance.now();
  try {
    const targets = await discoverTargets(run.scanPath, { languages, context: run.context });
    const elapsedMs = performance.now() - start;
    run.scanElapsedMs = elapsedMs;
    spinner.succeed(`Scan complete. Found ${targets.length} dependency folders.`);
    return { targets, elapsedMs };
  } catch (error) {
    spinner.fail('Scan failed.');
    throw error;
  }
}

export function displayRunTimings(run, options) {
  if (run.scanElapsedMs == null) return;
  console.log(`\nScan time: ${(run.scanElapsedMs / 1000).toFixed(3)}s`);
  console.log(`Deletion time: ${(run.deletionElapsedMs / 1000).toFixed(3)}s${options.dryRun ? " (dry run)" : ""}`);
}

export async function measureTargets(targets, options, context) {
  if (options.skipSize) return targets.map(target => ({ ...target, size: null }));
  const spinner = ora('Calculating dependency sizes...').start();
  try {
    return await mapLimit(targets, context.io.concurrency, async target => ({
      ...target, size: await getDirectorySize(target.path, context.io),
    }));
  } finally { spinner.stop(); }
}
