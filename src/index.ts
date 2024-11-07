import { program } from 'commander';
import { benches } from './bench.js';
import { ui } from './ui/index.js';
import { setEnvironmentData } from 'node:worker_threads';
import os from 'node:os';
import { resolve } from 'node:path';

program
  .argument('<bench-file>', 'Path to benchmark file')
  .option(
    '-w, --workers <number>',
    'Number of workers. Default is os.availableParallelism()'
  )
  .option('-i, --iterations <number>', 'iterations per benchmark', '3000')
  .option(
    '-ci, --complexity-iterations <number>',
    'iterations per benchmark for complexity measurement',
    '3000'
  )
  .option(
    '-ips, --iterations-per-sample <number>',
    'Initial iterations per sample',
    '1'
  )
  .option(
    '-tl, --target-latency <number>',
    'target latency for updates in ms. Used to adjust iterations per sample count',
    '16'
  )
  .description('Run benchmarks in given file')
  .action(async (file, options) => {
    const workersCount = Number(options.workers ?? os.availableParallelism());
    const iterations = Number(options.iterations);
    const complexityIterations = Number(options.complexityIterations);
    const iterationsPerSample = Number(options.iterationsPerSample);
    const targetLatency = Number(options.targetLatency);
    setEnvironmentData('iterations', iterations);
    setEnvironmentData('complexityIterations', complexityIterations);
    setEnvironmentData('iterationsPerSample', iterationsPerSample);
    setEnvironmentData('targetLatency', targetLatency);
    setEnvironmentData('populationSize', 10);
    const resolved = import.meta.resolve(file);

    await import(resolved);

    ui(Math.min(workersCount, benches.length), resolved);
  });

program.parse();
