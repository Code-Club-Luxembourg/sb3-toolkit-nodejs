/** Options for the `motion_setrotationstyle` block's `STYLE` field. */
export const RotationStyle = {
  AllAround: 'all around',
  LeftRight: 'left-right',
  DontRotate: "don't rotate"
} as const;
export type RotationStyle = (typeof RotationStyle)[keyof typeof RotationStyle];
