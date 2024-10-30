import React, { useState, useEffect } from 'react';
import { Box, render, Spacer, Static, Text } from 'ink';
import { Spinner } from './components/Spinner';
import { Body } from './components/Body';
import { useWindowDimensions } from './hooks/useWindowDimensions';
import { Progress } from './components/Progress';
import readline from 'node:readline';

const Counter = () => {
  const [tests, setTests] = useState<
    Array<{
      id: number;
      title: string;
    }>
  >([]);
  const total = 17;
  const progress = tests.length / total;
  const progressPercent = Math.round(100 * progress);

  useEffect(() => {
    let completedTests = 0;
    let timer: NodeJS.Timeout | undefined;

    const run = () => {
      if (completedTests++ < total) {
        // console.log('run', completedTests);

        setTests((previousTests) => [
          ...previousTests,
          {
            id: previousTests.length,
            title: `Test #${previousTests.length + 1}`,
          },
        ]);

        timer = setTimeout(run, 500);
      } else {
        process.exit(0);
      }
    };

    run();

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <Body>
      <Box marginTop={1}>
        <Text dimColor>1</Text>
        <Spacer />
        <Text dimColor>2</Text>
      </Box>
      <Box>
        <Spinner />
        <Progress
          progress={progress}
          message={`Running tests... ${progressPercent}%`}
        />
      </Box>
      <Spacer />
      <Box marginTop={1}>
        <Text dimColor>3</Text>
        <Spacer />
        <Text dimColor>Completed tests: {tests.length}</Text>
      </Box>
    </Body>
  );
};

export const ui = () => {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  readline.emitKeypressEvents(process.stdin);
  process.stdin.on('keypress', (char, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit(0);
    }
  });
  render(<Counter />);
};
