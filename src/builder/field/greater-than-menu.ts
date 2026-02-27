/** Options for the `event_whengreaterthan` block's `WHENGREATERTHANMENU` field. */
export const GreaterThanMenu = {
  Loudness: 'LOUDNESS',
  Timer: 'TIMER'
} as const;
export type GreaterThanMenu = (typeof GreaterThanMenu)[keyof typeof GreaterThanMenu];
