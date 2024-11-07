import assert from 'node:assert';
import {
  getEnvironmentData,
  parentPort,
  workerData,
} from 'node:worker_threads';
import { benches } from '../bench.js';
import fc from 'fast-check';
import { Iterator } from 'iterator-js';
import { ComplexityExpression } from '../complexity/index.js';
import { stats as _stats, binarySearch, Stats } from './index.js';
import { generation, init } from '../complexity/worker.js';
import fs from 'node:fs';

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
  | { type: 'complexity'; benchId: number; measured: ComplexityExpression }
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
const populationSize = getEnvironmentData('populationSize') as number;
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
const sizeDurations: Record<number, { duration: number; sizes: number[] }[]> =
  Iterator.iter(benches)
    // .filter((bench) => bench.type === 'complexityMeasurement')
    .map<[number, { duration: number; sizes: number[] }[]]>((bench) => [
      bench.id,
      [],
    ])
    .toObject();
const complexities: Record<number, ComplexityExpression[]> = Iterator.iter(
  benches
)
  // .filter((bench) => bench.type === 'complexityMeasurement')
  .map<[number, ComplexityExpression[]]>((bench) => [
    bench.id,
    'paramsCount' in bench ? init(bench.paramsCount, populationSize) : [],
  ])
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

function recomputeComplexity(
  duration: number,
  sizes: number[],
  benchId: number
): ComplexityExpression {
  const data = sizeDurations[benchId];
  data.push({ duration, sizes });
  complexities[benchId] = generation(
    data,
    complexities[benchId] ?? [],
    sizes.length,
    0.5,
    0.5
  );

  return complexities[benchId][0][0];
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
      const measureDuration = async (
        params?: any,
        updateIPS = true
      ): Promise<number> => {
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

        return duration;
      };
      const measure = async (
        params?: any,
        updateIPS = true
      ): Promise<Stats> => {
        return recomputeStats(
          benchId,
          await measureDuration(params, updateIPS)
        );
      };
      const measureSize = async (
        paramsCount: number
      ): Promise<ComplexityExpression> => {
        assert('genSamples' in bench);
        const _sizes = fc.sample(sizeArb(paramsCount), 1)[0];
        const params = bench.genSamples(..._sizes);
        try {
          const measured = await measureDuration(params, false);
          return recomputeComplexity(measured, _sizes, benchId);
        } catch (error) {
          throw { error, sizes: _sizes };
        }
      };

      emit({ type: 'start', benchId });

      try {
        if ('baseCase' in bench) {
          const paramsCount = bench.paramsCount;
          for (let i = 0; i < Math.max(iterations, complexityIterations); i++) {
            if (i < iterations) {
              const base = bench.baseCase();
              const measured = await measure(base);
              emit({ type: 'stats', benchId, measured });
            }
            if (i < complexityIterations) {
              const _iterationsPerSample = iterationsPerSample;
              iterationsPerSample = 1;
              const measured = await measureSize(paramsCount);
              iterationsPerSample = _iterationsPerSample;
              emit({ type: 'complexity', benchId, measured });
            }
          }
        } else {
          for (let i = 0; i < iterations; i++) {
            const measured = await measure();
            emit({ type: 'stats', benchId, measured });
          }
        }

        emit({ type: 'done', benchId });

        fs.writeFileSync(
          `./results/durations-${bench.name}-${benchId}.json`,
          JSON.stringify(durations[benchId])
        );
      } catch (error: any) {
        emit({ type: 'failed', benchId, ...error });
      }
    }
  }
});
