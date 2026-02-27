/**
 * Map of variable IDs to variable tuples.
 */
export type ScratchVariables = Record<string, ScratchVariable>;
/**
 * Variable tuple: [name, value].
 */
export type ScratchVariable = [string, number | string | boolean];

/**
 * Map of list IDs to list tuples.
 */
export type ScratchLists = Record<string, ScratchList>;
/**
 * List tuple: [name, values].
 */
export type ScratchList = [string, Array<number | string | boolean>];
