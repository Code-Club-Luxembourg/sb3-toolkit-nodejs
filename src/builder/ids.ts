import { randomInt } from 'node:crypto';

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Generate a random ~20 character block/variable identifier.
 */
export function generateId(): string {
  let id = '';
  for (let i = 0; i < 20; i += 1) {
    id += ALPHABET[randomInt(36)];
  }
  return id;
}

/**
 * Generator namespace for block, variable, and list ids.
 */
export const Id = {
  generate: generateId
};
