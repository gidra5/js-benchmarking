import { program } from 'commander';
import { benches } from './bench.js';
import { ui } from './ui/index.js';
import { setEnvironmentData, Worker } from 'node:worker_threads';
import { Iterator } from 'iterator-js';
import { WorkerData } from './worker';

program
  .argument('<bench-file>', 'Path to benchmark file')
  .option('-w, --workers <number>', 'Number of workers', '1')
  .option('--iterations <number>', 'iterations per sample', '1000')
  .description('Run benchmarks in given file')
  .action(async (file, options) => {
    const workersCount = Number(options.workers);
    const iterations = Number(options.iterations);
    setEnvironmentData('iterations', iterations);

    await import(file);
    const benchesPerWorker = Math.ceil(benches.length / workersCount);

    console.log('start');

    const workers = Iterator.natural(workersCount)
      .map<[number, number[]]>((i) => {
        const workerBenches = Iterator.natural(benchesPerWorker)
          .map((j) => i + j * workersCount)
          .filter((j) => j < benches.length)
          .map((j) => benches[j].id)
          .toArray();
        return [i, workerBenches];
      })
      .map(([id, benchIds]) => {
        const workerData: WorkerData = { id, file, benchIds };
        const url = new URL('./worker.js', import.meta.url);
        return new Worker(url, { workerData });
      })
      .toArray();

    ui(workers, file);
  });

program.parse();
