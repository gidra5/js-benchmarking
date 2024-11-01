import React, { useState, useEffect, useMemo } from 'react';
import { Box, render, Text } from 'ink';
import { Spinner } from './components/Spinner.js';
import { Body } from './components/Body.js';
import readline from 'node:readline';
import type { Worker } from 'node:worker_threads';
import { benches } from '../bench.js';
import { StatsMessage, WorkerOutMessage } from '../worker.js';
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
  workers: Worker[];
  file: string;
};

type BenchStatus = 'pending' | 'running' | 'done' | 'failed';

type BenchState = {
  status: BenchStatus;
  stats: StatsMessage['measured'][];
  complexity: ComplexityExpression;
};

const App = ({ workers, file }: Props) => {
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
      .map((bench) => ({
        name: bench.name,
        status: benchesState[bench.id].status,
        stats: benchesState[bench.id].stats,
        durations: benchesState[bench.id].stats.map((stat) => stat.duration),
        complexity: benchesState[bench.id].complexity,
      }))
      .toArray();
  }, [benchesState]);
  const done = useMemo(() => {
    return Iterator.iterValues(benchesState).every(
      ({ status }) => status === 'done' || status === 'failed'
    );
  }, [benchesState]);

  useEffect(() => {
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
        worker.removeAllListeners('message');
        worker.postMessage({ type: 'abort' });
      }
    };
  }, []);

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
        <Text>Running benchmarks with {workers.length} workers</Text>
      </Box>
      <Table
        data={tableData}
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
          ...[
            { name: 'avg', get: average },
            { name: 'med', get: medianSorted },
            { name: 'st. dev.', get: sampleStandardDeviation },
            { name: 'min', get: minSorted },
            { name: 'max', get: maxSorted },
            { name: 'p50', get: (stats) => percentile(0.5, stats) },
            { name: 'p75', get: (stats) => percentile(0.75, stats) },
            { name: 'p95', get: (stats) => percentile(0.95, stats) },
            { name: 'p99', get: (stats) => percentile(0.99, stats) },
            { name: 'p99.9', get: (stats) => percentile(0.999, stats) },
          ].map(({ name, get }) => ({
            name,
            render(entry: (typeof tableData)[0]) {
              if (entry.stats.length < 2) return <Text dimColor>-</Text>;

              const stat = get(entry.durations);
              return <Text>{formatDuration(stat)}</Text>;
            },
          })),
          {
            name: 'complexity',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;

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

export const ui = (workers: Worker[], file: string) => {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', (char, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
  });
  render(<App workers={workers} file={file} />);
};
