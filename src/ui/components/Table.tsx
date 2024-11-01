import { Box, BoxProps, Text, useFocus } from 'ink';
import React, { ReactNode, useMemo } from 'react';
import { useScroll } from '../hooks/useScroll.js';
import { useSelectState } from '../hooks/useScrollState.js';

type TableColumn<T> = {
  name: string;
  render: (data: T) => ReactNode;
};

type TableProps<T> = {
  data: T[];
  columns: TableColumn<T>[];
  getId?: (data: T) => string;
} & Omit<BoxProps, 'flexDirection'>;

const getColor = (
  entryFocused: boolean,
  columnFocused: boolean
): string | undefined =>
  columnFocused && entryFocused
    ? '#555'
    : columnFocused || entryFocused
    ? // ? '#333'
      undefined
    : undefined;

export function Table<T>({ getId, data, columns, ...props }: TableProps<T>) {
  const focus = useFocus({ autoFocus: true });
  const isFocused = focus.isFocused;
  const primaryColumn = columns[0];
  const columnsScrollState = useSelectState({
    window: 4,
    total: columns.length - 1,
  });
  const entriesScrollState = useSelectState({ window: 4, total: data.length });
  const columnsVisible = useMemo(
    () => columns.slice(1).slice(...columnsScrollState.visible),
    [columnsScrollState.visible]
  );
  const entriesVisible = useMemo(
    () => data.slice(...entriesScrollState.visible),
    [entriesScrollState.visible, data]
  );

  useScroll(isFocused, true, columnsScrollState);
  useScroll(isFocused, false, entriesScrollState);

  return (
    <Box flexDirection="row" {...props}>
      <Box overflow="hidden" flexDirection="column" marginX={1} height="100%">
        <Text>{primaryColumn.name}</Text>
        <Box
          overflow="hidden"
          flexDirection="column"
          flexBasis="100%"
          flexGrow={1}
          flexShrink={1}
        >
          {entriesVisible.map((data, _i) => {
            const i = _i + entriesScrollState.visible[0];
            const entryFocused = i === entriesScrollState.focused;
            const bg = getColor(entryFocused, false);
            return (
              <Box
                key={`${getId?.(data) ?? i}-${primaryColumn.name}`}
                height={1}
                overflow="hidden"
              >
                <Text backgroundColor={bg}>{primaryColumn.render(data)}</Text>
              </Box>
            );
          })}
        </Box>
      </Box>
      {columnsVisible.map((column, _i) => {
        const i = _i + columnsScrollState.visible[0];
        const columnFocused = i === columnsScrollState.focused;
        return (
          <Box
            key={i}
            overflow="hidden"
            flexDirection="column"
            marginX={1}
            height="100%"
          >
            <Text backgroundColor={getColor(false, columnFocused)}>
              {column.name}
            </Text>
            <Box
              overflow="hidden"
              flexDirection="column"
              flexBasis="100%"
              flexGrow={1}
              flexShrink={1}
            >
              {entriesVisible.map((data, _i) => {
                const i = _i + entriesScrollState.visible[0];
                const entryFocused = i === entriesScrollState.focused;
                const bg = getColor(entryFocused, columnFocused);
                return (
                  <Box
                    key={`${getId?.(data) ?? i}-${column.name}`}
                    height={1}
                    overflow="hidden"
                  >
                    <Text backgroundColor={bg}>{column.render(data)}</Text>
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
