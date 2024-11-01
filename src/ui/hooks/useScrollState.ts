import assert from 'assert';
import { useReducer, type Reducer, useCallback } from 'react';

type Viewport = [start: number, end: number];
type State = {
  total: number;
  window: number;
  visible: Viewport;
  focused: number;
};

type Action =
  | { type: 'focus-next-option' }
  | { type: 'focus-previous-option' }
  | { type: 'reset'; state: State };

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

const bound = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

const reducer =
  (scrollPadding: number): Reducer<State, Action> =>
  (state, action) => {
    assert(state.total > 0);
    assert(state.window > 0);
    assert(scrollPadding >= 0);
    assert(state.window > scrollPadding * 2);
    assert(state.visible[0] >= 0);
    assert(state.visible[1] <= state.total);
    assert(state.visible[0] <= state.visible[1]);

    const padded: Viewport = [
      state.visible[0] + scrollPadding,
      state.visible[1] - scrollPadding,
    ];

    switch (action.type) {
      case 'focus-next-option': {
        const focused = clamp(state.focused + 1, 0, state.total - 1);
        if (bound(focused, padded[0], padded[1] - 1))
          return { ...state, focused };

        const moved: Viewport = [state.visible[0] + 1, state.visible[1] + 1];
        if (moved[1] > state.total) return { ...state, focused };

        return { ...state, focused, visible: moved };
      }

      case 'focus-previous-option': {
        const focused = clamp(state.focused - 1, 0, state.total - 1);
        if (bound(focused, padded[0], padded[1] - 1))
          return { ...state, focused };

        const moved: Viewport = [state.visible[0] - 1, state.visible[1] - 1];
        if (moved[0] < 0) return { ...state, focused };

        return { ...state, focused, visible: moved };
      }

      case 'reset': {
        return action.state;
      }
    }
  };

export type UseSelectStateProps = {
  window: number;
  total: number;
  scrollPadding?: number;
};

export type ScrollState = Pick<State, 'focused' | 'visible'> & {
  focusNextOption: () => void;
  focusPreviousOption: () => void;
};

const createDefaultState = ({
  window,
  total,
}: Pick<UseSelectStateProps, 'window' | 'total'>): State => {
  return {
    window,
    total,
    visible: [0, window],
    focused: 0,
  };
};

export const useSelectState = ({
  window,
  total,
  scrollPadding = 1,
}: UseSelectStateProps): ScrollState => {
  const [state, dispatch] = useReducer(
    reducer(scrollPadding),
    { window, total },
    createDefaultState
  );

  const focusNextOption = useCallback(() => {
    dispatch({ type: 'focus-next-option' });
  }, []);

  const focusPreviousOption = useCallback(() => {
    dispatch({ type: 'focus-previous-option' });
  }, []);

  return {
    visible: state.visible,
    focused: state.focused,
    focusNextOption,
    focusPreviousOption,
  };
};
