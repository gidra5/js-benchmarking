import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Box, DOMElement, measureElement, Spacer, Text } from 'ink';

type Props = {
  height?: number;
  color?: string;
  progress: number;
  message?: string;
};

/**
 * Spinner.
 */
export function Progress({ height, color, progress, message = '' }: Props) {
  const boxRef = useRef<DOMElement>(null);
  const [_width, setWidth] = useState(0);
  const width = _width - 2;
  const progressWidth = Math.round(progress * width);
  const restFillWidth = Math.max(progressWidth - message.length, 0);
  const invertedTextWidth = Math.min(progressWidth, message.length);
  const invertedText = message.slice(0, invertedTextWidth);
  const notInvertedText = message.slice(invertedTextWidth);

  useLayoutEffect(() => {
    if (!boxRef.current) return;
    setWidth(measureElement(boxRef.current).width);
  }, []);

  return (
    <Box ref={boxRef} width="100%" height={height}>
      <Text>[</Text>
      <Text inverse wrap="truncate">
        {invertedText}
      </Text>
      <Text wrap="truncate">{notInvertedText}</Text>
      <Text color={color}>{'█'.repeat(restFillWidth)}</Text>
      <Spacer />
      <Text>]</Text>
    </Box>
  );
}
