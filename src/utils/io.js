import fs from 'fs/promises';

export async function mapLimit(items, concurrency, visit) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await visit(items[index], index);
    }
  }));
  return results;
}

// One queue per cleanup run, shared by discovery, activity checks, and sizing.
// Only individual filesystem calls occupy a slot; recursive walks never hold one.
export function createFileSystem(concurrency = 16) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 128) {
    throw new Error('Concurrency must be an integer between 1 and 128.');
  }
  let active = 0;
  const pending = [];
  function drain() {
    while (active < concurrency && pending.length) {
      const { task, resolve, reject } = pending.shift();
      active++;
      Promise.resolve().then(task).then(resolve, reject).finally(() => {
        active--;
        drain();
      });
    }
  }
  const run = task => new Promise((resolve, reject) => {
    pending.push({ task, resolve, reject });
    drain();
  });
  return {
    concurrency,
    readdir: dir => run(() => fs.readdir(dir, { withFileTypes: true })),
    stat: file => run(() => fs.stat(file)),
  };
}
