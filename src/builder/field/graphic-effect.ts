/** Options for the `looks_changeeffectby` / `looks_seteffectto` `EFFECT` field. */
export const GraphicEffect = {
  Color: 'COLOR',
  Fisheye: 'FISHEYE',
  Whirl: 'WHIRL',
  Pixelate: 'PIXELATE',
  Mosaic: 'MOSAIC',
  Brightness: 'BRIGHTNESS',
  Ghost: 'GHOST'
} as const;
export type GraphicEffect = (typeof GraphicEffect)[keyof typeof GraphicEffect];
