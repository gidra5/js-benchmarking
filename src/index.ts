import { program } from 'commander';
import { benches } from './bench';
import { ui } from './ui';
import { Worker } from 'node:worker_threads';
import { Iterator } from 'iterator-js';

program
  .argument('<bench-file>', 'Path to benchmark file')
  .option('-w, --workers <number>', 'Number of workers')
  .option('--interval <number>', 'Interval between resource usage samples')
  .description('Run benchmarks in given file')
  .action(async (file, options) => {
    await import(file);
    console.log(`Found ${benches.length} benchmarks in ${file}`);

    const workersCount = options.workers || 1;
    console.log(`Running benchmarks with ${workersCount} workers`);

    const interval = options.interval || 100;
    const workers = Iterator.natural(workersCount)
      .map(() => new Worker('./worker.js'))
      .toArray();

    workers.forEach((worker, id) => {
      worker.postMessage({ type: 'init', id });
    });

    const chunks = Iterator.natural(benches.length).chunks(workersCount);

    for (const chunk of chunks) {
      chunk.forEach((i, workerIndex) => {
        workers[workerIndex].postMessage({ type: 'run', file, i });
      });
    }

    ui();
  });

program.parse();
