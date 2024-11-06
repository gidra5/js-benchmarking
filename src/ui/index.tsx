import React, { useState, useEffect, useMemo } from 'react';
import { Box, render, Text } from 'ink';
import { Spinner } from './components/Spinner.js';
import { Body } from './components/Body.js';
import readline from 'node:readline';
import { Worker } from 'node:worker_threads';
import { benches } from '../bench.js';
import { type WorkerData, type WorkerOutMessage } from '../worker.js';
import { Iterator } from 'iterator-js';
import { Table } from './components/Table.js';
import {
  ComplexityExpression,
  constant,
  stringify,
} from '../complexity/index.js';
import { stats as _stats, Stats } from '../runner/index.js';

const baseMeasure = { unit: 'ns', divisor: 0.001 };
const measures = [
  { unit: 'ps', divisor: 0.000001 },
  baseMeasure,
  { unit: 'ms', divisor: 1 },
  { unit: 's', divisor: 1000 },
  { unit: 'm', divisor: 1000 * 60 },
  { unit: 'h', divisor: 1000 * 60 * 60 },
];

const formatDuration = (duration: number): string => {
  const measure =
    measures.toReversed().find((m) => Math.abs(duration) >= m.divisor) ??
    baseMeasure;

  return (duration / measure.divisor).toFixed(4) + measure.unit;
};

type Props = {
  workersCount: number;
  file: string;
};

type BenchStatus = 'pending' | 'running' | 'done' | 'failed';

type BenchState = {
  name: string;
  status: BenchStatus;
  stats: Stats;
  complexity: ComplexityExpression;
};

const useBenches = (workersCount: number, file: string) => {
  const [benchesState, setBenchesState] = useState(
    Iterator.iter(benches)
      .map<[number, BenchState]>((bench) => [
        bench.id,
        {
          id: bench.id,
          status: 'pending',
          name: bench.name,
          stats: Iterator.iterEntries(_stats)
            .mapValues(() => false)
            .toObject(),
          complexity: constant(),
        },
      ])
      .toObject()
  );
  const done = useMemo(() => {
    return Iterator.iter(benches).every(
      ({ id }) =>
        benchesState[id].status === 'done' ||
        benchesState[id].status === 'failed'
    );
  }, [benchesState]);
  const stats = useMemo(() => {
    return Iterator.iterValues(benchesState)
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
  }, [benchesState]);

  useEffect(() => {
    const benchesPerWorker = Math.ceil(benches.length / workersCount);
    const workers = Iterator.natural(workersCount)
      .map((i) => {
        const workerBenches = Iterator.natural(benchesPerWorker)
          .map((j) => i + j * workersCount)
          .filter((j) => j < benches.length)
          .map((j) => benches[j].id)
          .toArray();
        return workerBenches;
      })
      .map((benchIds) => {
        const workerData: WorkerData = { file, benchIds };
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
          const stats = measured;
          setBenchesState((state) => {
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
          ...Iterator.iterKeys(_stats).map((name) => ({
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

  // const benchesPerWorker = Math.ceil(benches.length / workersCount);
  // const workers = Iterator.natural(workersCount)
  //   .map((i) => {
  //     const workerBenches = Iterator.natural(benchesPerWorker)
  //       .map((j) => i + j * workersCount)
  //       .filter((j) => j < benches.length)
  //       .map((j) => benches[j].id)
  //       .toArray();
  //     return workerBenches;
  //   })
  //   .map((benchIds) => {
  //     const workerData: WorkerData = { file, benchIds };
  //     const url = new URL('../worker.js', import.meta.url);
  //     return new Worker(url, { workerData });
  //   })
  //   .toArray();
  // for (const worker of workers) {
  //   // worker.on('message', (message: WorkerOutMessage) => {
  //   // });
  //   worker.postMessage({ type: 'run' });
  // }

  render(<App workersCount={workersCount} file={file} />);
};
