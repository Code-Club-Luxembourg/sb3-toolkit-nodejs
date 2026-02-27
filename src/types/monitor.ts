/**
 * Monitor entry shown on the Scratch stage.
 */
export interface ScratchMonitor {
  id: string;
  mode: 'default' | 'large' | 'slider' | 'list';
  opcode: string;
  params: Record<string, string>;
  spriteName: string | null;
  value: unknown;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  visible: boolean;
  sliderMin?: number;
  sliderMax?: number;
  isDiscrete?: boolean;
}
