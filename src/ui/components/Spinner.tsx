import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import spinners from 'cli-spinners';
import type { SpinnerName } from 'cli-spinners';

type Props = {
  /**
   * Type of a spinner.
   * See [cli-spinners](https://github.com/sindresorhus/cli-spinners) for available spinners.
   *
   * @default dots
   */
  type?: SpinnerName;
};

/**
 * Spinner.
 */
export function Spinner({ type = 'dots' }: Props) {
  const [frame, setFrame] = useState(0);
  const spinner = spinners[type];

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((frame) => (frame + 1) % spinner.frames.length);
    }, spinner.interval);

    return () => {
      clearInterval(timer);
    };
  }, [spinner]);

  return <Text>{spinner.frames[frame]}</Text>;
}
