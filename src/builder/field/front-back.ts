/** Options for the `looks_gotofrontback` block's `FRONT_BACK` field. */
export const FrontBack = {
  Front: 'front',
  Back: 'back'
} as const;
export type FrontBack = (typeof FrontBack)[keyof typeof FrontBack];
