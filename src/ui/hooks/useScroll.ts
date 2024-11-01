import { useInput } from 'ink';
import { type ScrollState } from './useScrollState.js';

export const useScroll = (
  isActive: boolean,
  horizontal: boolean,
  state: ScrollState
) => {
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
    { isActive }
  );
};
