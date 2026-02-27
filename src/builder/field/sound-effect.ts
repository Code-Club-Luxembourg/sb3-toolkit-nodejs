/** Options for the `sound_changeeffectby` / `sound_seteffectto` `EFFECT` field. */
export const SoundEffect = {
  Pitch: 'PITCH',
  Pan: 'PAN'
} as const;
export type SoundEffect = (typeof SoundEffect)[keyof typeof SoundEffect];
