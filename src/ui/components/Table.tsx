import { Box, BoxProps, Text } from 'ink';
import React, { ReactNode } from 'react';

type TableColumn<T> = {
  name: string;
  primary?: boolean;
  render: (data: T) => ReactNode;
};

type TableProps<T> = {
  data: T[];
  columns: TableColumn<T>[];
  getId?: (data: T) => string;
} & Omit<BoxProps, 'flexDirection'>;

export function Table<T>({ getId, data, columns, ...props }: TableProps<T>) {
  return (
    <Box flexDirection="row" {...props}>
      {columns.map((column, i) => {
        return (
          <Box
            key={i}
            overflow="hidden"
            flexDirection="column"
            marginX={1}
            height="100%"
            {...(column.primary
              ? {
                  flexGrow: 1,
                  flexShrink: 0,
                }
              : {})}
          >
            <Text>{column.name}</Text>
            <Box
              overflow="hidden"
              flexDirection="column"
              flexBasis="100%"
              flexGrow={1}
              flexShrink={1}
            >
              {data.map((data, i) => {
                return (
                  <Box
                    key={`${getId?.(data) ?? i}-${column.name}`}
                    height={1}
                    overflow="hidden"
                  >
                    {column.render(data)}
                  </Box>
                );
              })}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
