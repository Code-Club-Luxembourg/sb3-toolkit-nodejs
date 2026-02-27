/**
 * Map of comment IDs to comment objects.
 */
export type ScratchComments = Record<string, ScratchComment>;

/**
 * A comment attached to a block or script.
 */
export interface ScratchComment {
  blockId: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  text: string;
}
