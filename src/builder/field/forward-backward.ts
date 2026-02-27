/** Options for the `looks_goforwardbackwardlayers` block's `FORWARD_BACKWARD` field. */
export const ForwardBackward = {
  Forward: 'forward',
  Backward: 'backward'
} as const;
export type ForwardBackward = (typeof ForwardBackward)[keyof typeof ForwardBackward];
