import { useFocus, useInput } from 'ink';
import { type ScrollState } from './useScrollState.js';

export const useScroll = (horizontal: boolean, state: ScrollState) => {
  const focusState = useFocus();
  useInput(
    (_, key) => {
      if (horizontal) {
        if (key.leftArrow) {
          state.focusPreviousOption();
        }
        if (key.rightArrow) {
          state.focusNextOption();
        }
      } else {
        if (key.upArrow) {
          state.focusPreviousOption();
        }
        if (key.downArrow) {
          state.focusNextOption();
        }
      }
    },
    { isActive: focusState.isFocused }
  );
};
