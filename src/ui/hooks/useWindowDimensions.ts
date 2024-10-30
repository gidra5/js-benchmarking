import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

const getDim = (stdout: NodeJS.WriteStream): [number, number] => [
  stdout.columns,
  stdout.rows - 1,
];
export function useWindowDimensions() {
  const { stdout } = useStdout();
  const [dimensions, setDimensions] = useState(getDim(stdout));

  useEffect(() => {
    const handler = () => setDimensions(getDim(stdout));
    stdout.on('resize', handler);
    return () => {
      stdout.off('resize', handler);
    };
  }, [stdout]);

  return dimensions;
}
