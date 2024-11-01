import { program } from 'commander';
import { benches } from './bench.js';
import { ui } from './ui/index.js';
import { setEnvironmentData, Worker } from 'node:worker_threads';
import { Iterator } from 'iterator-js';
import { WorkerData } from './worker';

program
  .argument('<bench-file>', 'Path to benchmark file')
  .option('-w, --workers <number>', 'Number of workers', '1')
  .option('-i, --iterations <number>', 'iterations per benchmark', '3000')
  .option(
    '-ips, --iterations-per-sample <number>',
    'iterations per sample',
    '1'
  )
  .description('Run benchmarks in given file')
  .action(async (file, options) => {
    const workersCount = Number(options.workers);
    const iterations = Number(options.iterations);
    const iterationsPerSample = Number(options.iterationsPerSample);
    setEnvironmentData('iterations', iterations);
    setEnvironmentData('iterationsPerSample', iterationsPerSample);

    await import(file);
    const benchesPerWorker = Math.ceil(benches.length / workersCount);

    // console.log('start');

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
      // .inspect((w) => {
      //   w.postMessage({ type: 'run' });
      //   w.on('message', (message) => {
      //     console.log(message);
      //   });
      // })
      .toArray();

    ui(workers, file);
  });

program.parse();
