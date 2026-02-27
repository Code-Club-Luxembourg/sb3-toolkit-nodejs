/**
 * Map of block IDs to block definitions.
 */
export type ScratchBlocks = Record<string, ScratchBlock | null>;

/**
 * A single Scratch block with inputs, fields, and connection metadata.
 */
export interface ScratchBlock {
  opcode: string;
  next: string | null;
  parent: string | null;
  inputs: Record<string, ScratchInput>;
  fields: Record<string, ScratchField>;
  shadow: boolean;
  topLevel: boolean;
  x?: number;
  y?: number;
  mutation?: ScratchMutation;
}

/**
 * Tuple describing a block input (kind + value + optional metadata).
 */
export type ScratchInput = [
  number,
  ScratchInputValue,
  (string | null)?
];

/**
 * Allowed input value representations used by Scratch blocks.
 */
export type ScratchInputValue =
  | string
  | number
  | [number, string | number]
  | [number, string | number, string | number]
  | null;

/**
 * A block field value and its optional ID.
 */
export type ScratchField = [
  string | number,
  string | null
];

/**
 * Mutation metadata used by certain Scratch blocks.
 */
export interface ScratchMutation {
  tagName?: string;
  children?: unknown[];
  proccode?: string;
  argumentids?: string;
  argumentnames?: string;
  argumentdefaults?: string;
  warp?: string;
  returns?: string;
  edited?: string;
  optype?: string;
  color?: string;
}
