import assert from 'node:assert';
import {
  getEnvironmentData,
  parentPort,
  workerData,
} from 'node:worker_threads';
import { benches } from './bench.js';
import fc from 'fast-check';
import { Iterator } from 'iterator-js';
import { ComplexityExpression, constant } from './complexity/index.js';
import { stats as _stats, binarySearch, Stats } from './runner/index.js';

assert(parentPort, 'must run in worker');

export type WorkerData = {
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

const { file, benchIds } = workerData as WorkerData;
const _iterations = getEnvironmentData('iterations') as number;
const _complexityIterations = getEnvironmentData(
  'complexityIterations'
) as number;
const _iterationsPerSample = getEnvironmentData(
  'iterationsPerSample'
) as number;
const targetLatency = getEnvironmentData('targetLatency') as number;
await import(file);
const workerBenches = benches.filter((b) => benchIds.includes(b.id));
const emit = (message: WorkerOutMessage) => {
  assert(parentPort);
  parentPort.postMessage(message);
};

const durations: Record<number, number[]> = Iterator.iter(benches)
  .map<[number, number[]]>((bench) => [bench.id, []])
  .toObject();
const avgs: Record<number, number> = Iterator.iter(benches)
  // .filter((bench) => bench.type === 'pureMeasurement')
  .map<[number, number]>((bench) => [bench.id, 0])
  .toObject();
const avgSquares: Record<number, number> = Iterator.iter(benches)
  // .filter((bench) => bench.type === 'pureMeasurement')
  .map<[number, number]>((bench) => [bench.id, 0])
  .toObject();
const sizes: Record<number, number[][]> = Iterator.iter(benches)
  // .filter((bench) => bench.type === 'complexityMeasurement')
  .map<[number, number[][]]>((bench) => [bench.id, []])
  .toObject();
const complexities: Record<number, ComplexityExpression> = Iterator.iter(
  benches
)
  // .filter((bench) => bench.type === 'complexityMeasurement')
  .map<[number, ComplexityExpression]>((bench) => [bench.id, constant()])
  .toObject();
// const errors: Record<number, { error: any; sizes: number[] }> = {};

function recomputeStats(benchId: number, duration: number) {
  const _durations = durations[benchId];
  const index = binarySearch(_durations, duration);
  _durations.splice(index, 0, duration);
  const len = _durations.length;
  avgs[benchId] += (duration - avgs[benchId]) / len;
  avgSquares[benchId] += (duration * duration - avgSquares[benchId]) / len;
  const avg = avgs[benchId];
  const _avgSquares = avgSquares[benchId];
  const stats = Iterator.iterEntries(_stats)
    .mapValues((stat) => stat(len, _durations, avg, _avgSquares))
    .toObject();
  return stats;
}
const sizeArb = (paramsCount: number) =>
  fc.tuple(...Iterator.repeat(fc.nat()).take(paramsCount));

parentPort.on('message', async (message) => {
  assert(parentPort);

  if (message.type === 'run') {
    for (const bench of workerBenches) {
      const {
        id: benchId,
        bench: benchFn,
        iterations = _iterations,
        complexityIterations = _complexityIterations,
      } = bench;
      let iterationsPerSample =
        bench.iterationsPerSample ?? _iterationsPerSample;
      const measure = async (
        params?: any,
        updateIPS = true
      ): Promise<Stats> => {
        const start = performance.now();
        for (let i = 0; i < iterationsPerSample; i++) {
          await benchFn(params);
        }
        const end = performance.now();
        const timePerSample = end - start;
        const duration = timePerSample / iterationsPerSample;

        if (
          updateIPS &&
          timePerSample < targetLatency &&
          !bench.iterationsPerSample
        ) {
          iterationsPerSample = Math.ceil(targetLatency / duration);
        }

        return recomputeStats(benchId, duration);
      };
      const measureSize = async (_sizes: number[]): Promise<Stats> => {
        assert('genSamples' in bench);
        const params = bench.genSamples(..._sizes);
        try {
          const measured = await measure(params, false);
          // sizes[benchId].push(_sizes);
          return measured;
        } catch (error) {
          throw { error, sizes: _sizes };
        }
      };

      emit({ type: 'start', benchId });

      try {
        if ('baseCase' in bench) {
          // const paramsCount = bench.paramsCount;
          for (let i = 0; i < iterations; i++) {
            const base = bench.baseCase();
            const measured = await measure(base);
            emit({ type: 'stats', benchId, measured });
          }

          // iterationsPerSample = 1;
          // for (let i = 0; i < complexityIterations; i++) {
          //   const sizes = Iterator.repeat(1000).take(paramsCount).toArray();
          //   // const sizes = fc.sample(sizeArb(paramsCount), 1)[0];
          //   const measured = await measureSize(sizes);
          //   emit({ type: 'stats', benchId, measured });
          // }
        } else {
          for (let i = 0; i < iterations; i++) {
            const measured = await measure();
            emit({ type: 'stats', benchId, measured });
          }
        }

        emit({ type: 'done', benchId });
      } catch (error: any) {
        emit({ type: 'failed', benchId, ...error });
      }
    }
  }
});
