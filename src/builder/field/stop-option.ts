/** Options for the `control_stop` block's `STOP_OPTION` field. */
export const StopOption = {
  All: 'all',
  ThisScript: 'this script',
  OtherScriptsInSprite: 'other scripts in sprite'
} as const;
export type StopOption = (typeof StopOption)[keyof typeof StopOption];
