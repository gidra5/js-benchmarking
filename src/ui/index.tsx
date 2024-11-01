import React, { useState, useEffect, useMemo } from 'react';
import { Box, render, Spacer, Static, Text } from 'ink';
import { Spinner } from './components/Spinner.js';
import { Body } from './components/Body.js';
import { Progress } from './components/Progress.js';
import readline from 'node:readline';
import type { Worker } from 'node:worker_threads';
import { benches } from '../bench.js';
import { StatsMessage, WorkerOutMessage } from '../worker.js';
import {
  average,
  max,
  min,
  quantile,
  standardDeviation,
} from 'simple-statistics';
import { Iterator } from 'iterator-js';
import { Table } from './components/Table.js';

type Props = {
  workers: Worker[];
  file: string;
};

type BenchStatus = 'pending' | 'running' | 'done' | 'failed';

type BenchState = {
  status: BenchStatus;
  stats: StatsMessage['measured'][];
};

const App = ({ workers, file }: Props) => {
  const [benchesState, setBenchesState] = useState<Record<number, BenchState>>(
    Iterator.iter(benches)
      .map<[number, BenchState]>((bench) => [
        bench.id,
        { status: 'pending', stats: [] },
      ])
      .toObject()
  );
  const tableData = useMemo(() => {
    return Iterator.iter(benches)
      .map((bench) => ({
        name: bench.name,
        status: benchesState[bench.id].status,
        stats: benchesState[bench.id].stats,
      }))
      .toArray();
  }, [benchesState]);
  const done = useMemo(() => {
    return Iterator.iterValues(benchesState).every(
      ({ status }) => status === 'done' || status === 'failed'
    );
  }, [benchesState]);

  // console.log(tableData.map(({ name, status }) => ({ name, status })));

  useEffect(() => {
    for (const worker of workers) {
      worker.on('message', (message: WorkerOutMessage) => {
        // console.log(message);

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
            return {
              ...state,
              [benchId]: {
                ...state[benchId],
                stats: [...state[benchId].stats, measured],
              },
            };
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
            primary: true,
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
                <>
                  <Spinner />
                  <Text> {entry.name}</Text>
                </>
              );
            },
          },
          {
            name: 'avg',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {average(entry.stats.map((stats) => stats.duration))}
                </Text>
              );
            },
          },
          {
            name: 'st. dev.',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {standardDeviation(
                    entry.stats.map((stats) => stats.duration)
                  )}
                </Text>
              );
            },
          },
          {
            name: 'min',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>{min(entry.stats.map((stats) => stats.duration))}</Text>
              );
            },
          },
          {
            name: 'max',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>{max(entry.stats.map((stats) => stats.duration))}</Text>
              );
            },
          },
          {
            name: 'p50',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {quantile(
                    entry.stats.map((stats) => stats.duration),
                    0.5
                  )}
                </Text>
              );
            },
          },
          {
            name: 'p75',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {quantile(
                    entry.stats.map((stats) => stats.duration),
                    0.75
                  )}
                </Text>
              );
            },
          },
          {
            name: 'p95',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {quantile(
                    entry.stats.map((stats) => stats.duration),
                    0.95
                  )}
                </Text>
              );
            },
          },
          {
            name: 'p99',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {quantile(
                    entry.stats.map((stats) => stats.duration),
                    0.99
                  )}
                </Text>
              );
            },
          },
          {
            name: 'p99.9',
            render(entry) {
              if (entry.stats.length === 0) return <Text dimColor>-</Text>;
              return (
                <Text>
                  {quantile(
                    entry.stats.map((stats) => stats.duration),
                    0.999
                  )}
                </Text>
              );
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
