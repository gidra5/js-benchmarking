import { Box, BoxProps } from 'ink';
import { useWindowDimensions } from '../hooks/useWindowDimensions';
import React from 'react';

export function Body(props: BoxProps & { children?: React.ReactNode }) {
  const [width, height] = useWindowDimensions();

  return (
    <Box
      {...props}
      overflow="hidden"
      flexDirection="column"
      width={width}
      height={height}
    />
  );
}
