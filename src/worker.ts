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
export type WorkerInMessage = { type: 'run' } | { type: 'abort' };
export type WorkerOutMessage =
  | { type: 'stats'; benchId: number; measured: Stats }
  | { type: 'failed'; benchId: number; error: any; sizes: number[] }
  | { type: 'done'; benchId: number }
  | { type: 'start'; benchId: number };
type Stats = {
  duration: number;
  sizes: number[];
};
type Params = { sizes: number[]; params: any };

const { id, file, benchIds } = workerData as WorkerData;
const iterations = getEnvironmentData('iterations') as number;
const iterationsPerSample = getEnvironmentData('iterationsPerSample') as number;
// const iterations = 1;
await import(file);
const workerBenches = benches.filter((b) => benchIds.includes(b.id));
const emit = (message: WorkerOutMessage) => {
  assert(parentPort, 'must run in worker');
  parentPort.postMessage(message);
};

parentPort.on('message', async (message) => {
  assert(parentPort, 'must run in worker');
  if (message.type === 'run') {
    for (const bench of workerBenches) {
      const { id: benchId, bench: benchFn, paramsCount = 0 } = bench;
      // const arb = fc.tuple(
      //   ...Iterator.natural(paramsCount).map(() => fc.integer())
      // );
      const getParams = (sizes: number[]): Params | undefined => {
        if (bench.genSamples) return bench.genSamples(...sizes);
      };
      const measure = async (): Promise<Stats> => {
        // const sizes = fc.sample(arb, 1)[0];
        const sizes = Iterator.repeat(1000).take(paramsCount).toArray();
        const params = getParams(sizes);
        try {
          const start = performance.now();
          for (let i = 0; i < iterationsPerSample; i++) {
            await benchFn(params);
          }
          const end = performance.now();
          return { duration: (end - start) / iterationsPerSample, sizes };
        } catch (error) {
          throw { error, sizes };
        }
      };

      emit({ type: 'start', benchId });

      try {
        for (let i = 0; i < iterations; i++) {
          const measured = await measure();
          emit({ type: 'stats', benchId, measured });
        }
        emit({ type: 'done', benchId });
      } catch (error: any) {
        emit({ type: 'failed', benchId, ...error });
      }
    }
  }
  if (message.type === 'abort') {
    parentPort.postMessage({ type: 'stats', id, file, benchIds });
    parentPort.close();
  }
});
