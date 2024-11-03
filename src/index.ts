import { program } from 'commander';
import { benches } from './bench.js';
import { ui } from './ui/index.js';
import { setEnvironmentData } from 'node:worker_threads';
import os from 'node:os';

program
  .argument('<bench-file>', 'Path to benchmark file')
  .option('-w, --workers <number>', 'Number of workers')
  .option('-i, --iterations <number>', 'iterations per benchmark', '3000')
  .option(
    '-ips, --iterations-per-sample <number>',
    'iterations per sample',
    '1'
  )
  .description('Run benchmarks in given file')
  .action(async (file, options) => {
    const workersCount = Number(options.workers ?? os.availableParallelism());
    const iterations = Number(options.iterations);
    const iterationsPerSample = Number(options.iterationsPerSample);
    setEnvironmentData('iterations', iterations);
    setEnvironmentData('iterationsPerSample', iterationsPerSample);

    await import(file);

    ui(Math.min(workersCount, benches.length), file);
  });

program.parse();
