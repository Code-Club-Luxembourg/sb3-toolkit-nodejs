/** Options for the `looks_costumenumbername` / `looks_backdropnumbername` `NUMBER_NAME` field. */
export const NumberName = {
  Number: 'number',
  Name: 'name'
} as const;
export type NumberName = (typeof NumberName)[keyof typeof NumberName];
