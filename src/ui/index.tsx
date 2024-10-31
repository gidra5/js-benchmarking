import React, { useState, useEffect } from 'react';
import { Box, render, Spacer, Static, Text } from 'ink';
import { Spinner } from './components/Spinner.js';
import { Body } from './components/Body.js';
import { Progress } from './components/Progress.js';
import readline from 'node:readline';
import type { Worker } from 'node:worker_threads';
import { benches } from '../bench.js';
import { StatsMessage } from '../worker.js';
import {
  average,
  max,
  min,
  quantile,
  standardDeviation,
} from 'simple-statistics';

type Props = {
  workers: Worker[];
  file: string;
};

const Counter = ({ workers, file }: Props) => {
  const [benchesPending, setPending] = useState<number[]>(
    benches.map((b) => b.id)
  );
  const [benchesRunning, setRunning] = useState<number[]>([]);
  const [benchesDone, setDone] = useState<number[]>([]);
  const [stats, setStats] = useState<StatsMessage[]>([]);

  useEffect(() => {
    for (const worker of workers) {
      worker.on('message', (message) => {
        // console.log(message);
        if (message.type === 'start') {
          const { benchId } = message;
          setPending((pending) => pending.filter((id) => id !== benchId));
          setRunning((running) => [...running, benchId]);
        }
        if (message.type === 'stats') {
          setStats((stats) => [...stats, message]);
        }
        if (message.type === 'done') {
          const { benchId } = message;
          setRunning((running) => running.filter((id) => id !== benchId));
          setDone((done) => [...done, benchId]);
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
    if (benchesDone.length !== benches.length) return;
    process.exit(0);
  }, [benchesDone]);

  return (
    <Body>
      <Box flexDirection="column" flexShrink={0}>
        <Text>
          Found {benches.length} benchmarks in {file}
        </Text>
        <Text>Running benchmarks with {workers.length} workers</Text>
      </Box>
      <Box
        flexDirection="row"
        paddingTop={2}
        flexGrow={1}
        flexShrink={1}
        flexBasis="100%"
      >
        <Box overflow="hidden" flexDirection="column">
          <Text>Pending</Text>
          <Box
            overflow="hidden"
            flexDirection="column"
            flexBasis="100%"
            flexGrow={1}
            flexShrink={1}
          >
            {benchesPending.map((benchId) => {
              const bench = benches[benchId];
              return (
                <Box key={benchId} minHeight={1}>
                  <Text dimColor>{bench.name}</Text>
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box paddingLeft={1} overflow="hidden" flexDirection="column">
          <Text>Running</Text>
          <Box
            overflow="hidden"
            flexDirection="column"
            flexBasis="100%"
            flexGrow={1}
            flexShrink={1}
          >
            {benchesRunning.map((benchId) => {
              const bench = benches[benchId];
              const benchStats = stats
                .filter((s) => s.benchId === benchId)
                .map((s) => s.measured.duration);
              if (benchStats.length === 0) {
                return (
                  <Box key={benchId} minHeight={1}>
                    <Spinner />
                    <Text> {bench.name}</Text>
                  </Box>
                );
              }
              return (
                <Box key={benchId} minHeight={1}>
                  <Spinner />
                  <Text>
                    {' '}
                    {bench.name} avg: {average(benchStats)}
                    std: {standardDeviation(benchStats)}
                    min: {min(benchStats)}
                    max: {max(benchStats)}
                    p99: {quantile(benchStats, 0.99)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
        <Box paddingLeft={1} overflow="hidden" flexDirection="column">
          <Text>Done</Text>
          <Box
            overflow="hidden"
            flexDirection="column"
            flexBasis="100%"
            flexGrow={1}
            flexShrink={1}
          >
            {benchesDone.map((benchId) => {
              const bench = benches[benchId];
              const benchStats = stats
                .filter((s) => s.benchId === benchId)
                .map((s) => s.measured.duration);
              return (
                <Box key={benchId} minHeight={1}>
                  <Text color="green">
                    ✔ {bench.name} avg: {average(benchStats)}
                    std: {standardDeviation(benchStats)}
                    min: {min(benchStats)}
                    max: {max(benchStats)}
                    p99: {quantile(benchStats, 0.99)}
                  </Text>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>
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
  render(<Counter workers={workers} file={file} />);
};
