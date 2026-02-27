/**
 * Options for the `event_whenkeypressed` and `sensing_keyoptions` `KEY_OPTION`
 * field. Values match Scratch's runtime exactly.
 */
export const Key = {
  Any: 'any',
  Space: 'space',
  Enter: 'enter',
  LeftArrow: 'left arrow',
  RightArrow: 'right arrow',
  UpArrow: 'up arrow',
  DownArrow: 'down arrow',

  A: 'a',
  B: 'b',
  C: 'c',
  D: 'd',
  E: 'e',
  F: 'f',
  G: 'g',
  H: 'h',
  I: 'i',
  J: 'j',
  K: 'k',
  L: 'l',
  M: 'm',
  N: 'n',
  O: 'o',
  P: 'p',
  Q: 'q',
  R: 'r',
  S: 's',
  T: 't',
  U: 'u',
  V: 'v',
  W: 'w',
  X: 'x',
  Y: 'y',
  Z: 'z',

  Digit0: '0',
  Digit1: '1',
  Digit2: '2',
  Digit3: '3',
  Digit4: '4',
  Digit5: '5',
  Digit6: '6',
  Digit7: '7',
  Digit8: '8',
  Digit9: '9'
} as const;
export type Key = (typeof Key)[keyof typeof Key];
