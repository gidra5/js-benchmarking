import assert from 'node:assert';
import {
  getEnvironmentData,
  parentPort,
  workerData,
} from 'node:worker_threads';
import { benches } from './bench.js';
import fc from 'fast-check';
import { Iterator } from 'iterator-js';

assert(parentPort, 'must run in worker');

export type WorkerData = {
  id: number;
  file: string;
  benchIds: number[];
};
export type StatsMessage = {
  type: 'stats';
  benchId: number;
  measured: Stats;
};
type Stats = {
  duration: number;
  sizes: number[];
};
type Params = { sizes: number[]; params: any };

const { id, file, benchIds } = workerData as WorkerData;
const iterations = getEnvironmentData('iterations') as number;
await import(file);
const workerBenches = benches.filter((b) => benchIds.includes(b.id));

parentPort.on('message', async (message) => {
  assert(parentPort, 'must run in worker');
  if (message.type === 'run') {
    for (const bench of workerBenches) {
      const { id: benchId, bench: benchFn, paramsCount = 0 } = bench;
      const arb = fc.tuple(
        ...Iterator.natural(paramsCount).map(() => fc.integer())
      );
      const getParams = (sizes: number[]): Params | undefined => {
        if (bench.genSamples) return bench.genSamples(...sizes);
      };
      const measure = async (): Promise<Stats> => {
        const sizes = fc.sample(arb, 1)[0];
        const params = getParams(sizes);
        const start = performance.now();
        await benchFn(params);
        const end = performance.now();
        return { duration: end - start, sizes };
      };

      parentPort.postMessage({ type: 'start', benchId });

      for (let i = 0; i < iterations; i++) {
        const measured = await measure();
        parentPort.postMessage({ type: 'stats', benchId, measured });
      }

      parentPort.postMessage({ type: 'done', benchId });
    }
  }
  if (message.type === 'abort') {
    parentPort.postMessage({ type: 'stats', id, file, benchIds });
    parentPort.close();
  }
});
