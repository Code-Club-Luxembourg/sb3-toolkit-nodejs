/** Options for the `sensing_current` block's `CURRENTMENU` field. */
export const CurrentMenu = {
  Year: 'YEAR',
  Month: 'MONTH',
  Date: 'DATE',
  DayOfWeek: 'DAYOFWEEK',
  Hour: 'HOUR',
  Minute: 'MINUTE',
  Second: 'SECOND'
} as const;
export type CurrentMenu = (typeof CurrentMenu)[keyof typeof CurrentMenu];
