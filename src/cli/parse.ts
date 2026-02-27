/**
 * Parse a positive integer or throw with a labeled error message.
 */
export function parsePositiveInt(value: string, label: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

/**
 * Create a CLI parser that enforces a positive integer.
 */
export function makePositiveIntParser(label: string): (value: string) => number {
  return (value: string) => parsePositiveInt(value, label);
}

/**
 * Parse a non-negative number or throw with a labeled error message.
 */
export function parseNonNegativeNumber(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number.`);
  }
  return parsed;
}

/**
 * Parse an integer in a closed range or throw with a labeled error message.
 */
export function parseIntInRange(value: string, label: string, min: number, max: number): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }
  return parsed;
}

export function makeNonNegativeNumberParser(label: string): (value: string) => number {
  return (value: string) => parseNonNegativeNumber(value, label);
}

export function makeIntRangeParser(label: string, min: number, max: number): (value: string) => number {
  return (value: string) => parseIntInRange(value, label, min, max);
}
