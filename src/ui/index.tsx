import React, { useState, useEffect, useMemo } from 'react';
import { Box, render, Text } from 'ink';
import { Spinner } from './components/Spinner.js';
import { Body } from './components/Body.js';
import readline from 'node:readline';
import { Worker } from 'node:worker_threads';
import { benches } from '../bench.js';
import { StatsMessage, WorkerData, WorkerOutMessage } from '../worker.js';
import {
  average,
  maxSorted,
  medianSorted,
  minSorted,
  sampleStandardDeviation,
} from 'simple-statistics';
import { Iterator } from 'iterator-js';
import { Table } from './components/Table.js';
import {
  ComplexityExpression,
  constant,
  stringify,
} from '../complexity/index.js';

const baseMeasure = { unit: 'ns', divisor: 0.001 };
const measures = [
  { unit: 'ms', divisor: 1 },
  { unit: 's', divisor: 1000 },
  { unit: 'm', divisor: 1000 * 60 },
  { unit: 'h', divisor: 1000 * 60 * 60 },
];

const formatDuration = (duration: number): string => {
  const measure =
    measures.toReversed().find((m) => duration >= m.divisor) ?? baseMeasure;

  return (duration / measure.divisor).toFixed(4) + measure.unit;
};

const percentile = (p: number, list: number[]): number => {
  const index = Math.max(0, Math.ceil(list.length * p) - 1);
  return list[index];
};

function binarySearch(stats: BenchState['stats'], duration: number): number {
  let left = 0;
  let right = stats.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (stats[mid].duration === duration) return mid;
    if (stats[mid].duration < duration) left = mid + 1;
    else right = mid - 1;
  }
  return left;
}

type Props = {
  workersCount: number;
  file: string;
};

type BenchStatus = 'pending' | 'running' | 'done' | 'failed';

type BenchState = {
  status: BenchStatus;
  stats: StatsMessage['measured'][];
  complexity: ComplexityExpression;
};
type BenchState2 = {
  name: string;
  status: BenchStatus;
  stats: { [K in keyof typeof _stats]: ReturnType<(typeof _stats)[K]> };
  complexity: ComplexityExpression;
};

const _stats = {
  ['avg']: (len: number, durations: number[]) => len > 0 && average(durations),
  ['med']: (len: number, durations: number[]) =>
    len > 0 && medianSorted(durations),
  ['st. dev.']: (len: number, durations: number[]) =>
    len > 2 && sampleStandardDeviation(durations),
  ['min']: (len: number, durations: number[]) =>
    len > 0 && minSorted(durations),
  ['p50']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.5, durations),
  ['p75']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.75, durations),
  ['p95']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.95, durations),
  ['p99']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.99, durations),
  ['p99.9']: (len: number, durations: number[]) =>
    len > 0 && percentile(0.999, durations),
  ['max']: (len: number, durations: number[]) =>
    len > 0 && maxSorted(durations),
};

const useBenches = (workersCount: number, file: string) => {
  const [benchesState, setBenchesState] = useState<Record<number, BenchState>>(
    Iterator.iter(benches)
      .map<[number, BenchState]>((bench) => [
        bench.id,
        { status: 'pending', stats: [], complexity: constant() },
      ])
      .toObject()
  );
  const tableData = useMemo(() => {
    return Iterator.iter(benches)
      .map((bench) => {
        const durations = benchesState[bench.id].stats.map(
          (stat) => stat.duration
        );
        const len = durations.length;
        const stats = Iterator.iterEntries(_stats)
          .mapValues((stat) => stat(len, durations))
          .toObject();
        return {
          id: bench.id,
          name: bench.name,
          status: benchesState[bench.id].status,
          stats,
          complexity: benchesState[bench.id].complexity,
        };
      })
      .map<[number, BenchState2]>((bench) => [bench.id, bench])
      .toObject();
  }, [benchesState]);
  const done = useMemo(() => {
    return Iterator.iter(benches).every(
      ({ id }) =>
        tableData[id].status === 'done' || tableData[id].status === 'failed'
    );
  }, [tableData]);
  const stats = useMemo(() => {
    return Iterator.iterValues(tableData)
      .map(({ name, status, stats: _stats, complexity }) => {
        const stats = Iterator.iterEntries(_stats)
          .map<[keyof typeof _stats, string]>(([name, value]) => [
            name,
            value !== false ? formatDuration(value) : '-',
          ])
          .toObject();
        return { name, status, stats, complexity };
      })
      .toArray();
  }, [tableData]);

  useEffect(() => {
    const benchesPerWorker = Math.ceil(benches.length / workersCount);
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
        const url = new URL('../worker.js', import.meta.url);
        return new Worker(url, { workerData });
      })
      .toArray();
    for (const worker of workers) {
      worker.on('message', (message: WorkerOutMessage) => {
        if (message.type === 'start') {
          const { benchId } = message;
          setBenchesState((state) => {
            return {
              ...state,
              [benchId]: { ...state[benchId], status: 'running' },
            };
          });
        }
        if (message.type === 'stats') {
          const { benchId, measured } = message;
          setBenchesState((state) => {
            const index = binarySearch(state[benchId].stats, measured.duration);
            const stats = Array.from(state[benchId].stats);
            stats.splice(index, 0, measured);
            return { ...state, [benchId]: { ...state[benchId], stats } };
          });
        }
        if (message.type === 'done') {
          const { benchId } = message;
          setBenchesState((state) => {
            return {
              ...state,
              [benchId]: { ...state[benchId], status: 'done' },
            };
          });
        }
        if (message.type === 'failed') {
          const { benchId } = message;
          setBenchesState((state) => {
            return {
              ...state,
              [benchId]: { ...state[benchId], status: 'failed' },
            };
          });
        }
      });
      worker.postMessage({ type: 'run' });
    }
    return () => {
      for (const worker of workers) {
        worker.terminate();
      }
    };
  }, []);

  return { done, stats };
};

const App = ({ workersCount, file }: Props) => {
  const { done, stats } = useBenches(workersCount, file);

  useEffect(() => {
    if (!done) return;
    process.exit(0);
  }, [done]);

  return (
    <Body>
      <Box flexDirection="column" flexShrink={0} paddingBottom={2}>
        <Text>
          Found {benches.length} benchmarks in {file}
        </Text>
        <Text>Running benchmarks with {workersCount} workers</Text>
      </Box>
      <Table
        data={stats}
        columns={[
          {
            name: 'Name',
            render(entry) {
              if (entry.status === 'pending')
                return (
                  <Text dimColor>
                    {'  '}
                    {entry.name}
                  </Text>
                );
              if (entry.status === 'done')
                return <Text color="green">✔ {entry.name}</Text>;
              if (entry.status === 'failed')
                return <Text color="red">✘ {entry.name}</Text>;
              return (
                <Text>
                  <Spinner /> {entry.name}
                </Text>
              );
            },
          },
          ...Iterator.iterKeys(stats[0].stats).map((name) => ({
            name,
            render(entry: (typeof stats)[0]) {
              return <Text>{entry.stats[name]}</Text>;
            },
          })),
          {
            name: 'complexity',
            render(entry) {
              return <Text>O({stringify(entry.complexity)})</Text>;
            },
          },
        ]}
        flexGrow={1}
        flexShrink={1}
        flexBasis="100%"
      />
    </Body>
  );
};

export const ui = (workersCount: number, file: string) => {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', (char, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
  });
  render(<App workersCount={workersCount} file={file} />);
};
