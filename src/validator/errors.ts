export type ValidationSeverity = 'error' | 'warning';

/**
 * Machine-readable validation error codes.
 *
 * The string value of each entry is the stable identifier consumers should
 * compare against. The companion `ErrorCode` type narrows `ValidationError.code`
 * to one of these strings, so `match` / `switch` statements stay exhaustive.
 */
export const ErrorCode = {
  MISSING_FIELD: 'MISSING_FIELD',
  WRONG_TYPE: 'WRONG_TYPE',
  MISSING_STAGE: 'MISSING_STAGE',
  DUPLICATE_STAGE: 'DUPLICATE_STAGE',
  UNKNOWN_OPCODE: 'UNKNOWN_OPCODE',
  MISSING_INPUT: 'MISSING_INPUT',
  MISSING_FIELD_VALUE: 'MISSING_FIELD_VALUE',
  DANGLING_NEXT: 'DANGLING_NEXT',
  DANGLING_INPUT_REF: 'DANGLING_INPUT_REF',
  DANGLING_PARENT: 'DANGLING_PARENT',
  INCONSISTENT_NEXT_PARENT: 'INCONSISTENT_NEXT_PARENT',
  BLOCK_CYCLE: 'BLOCK_CYCLE',
  MISSING_ASSET: 'MISSING_ASSET',
  DANGLING_VARIABLE_REF: 'DANGLING_VARIABLE_REF',
  DANGLING_LIST_REF: 'DANGLING_LIST_REF',
  TOPLEVEL_NO_COORDS: 'TOPLEVEL_NO_COORDS',
  SHADOW_NO_PARENT: 'SHADOW_NO_PARENT',
  ORPHANED_BLOCK: 'ORPHANED_BLOCK',
  UNUSED_VARIABLE: 'UNUSED_VARIABLE',
  UNUSED_LIST: 'UNUSED_LIST'
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * The location of a validation finding within a project.
 *
 * `path` is the dot/bracket notation used for human display (e.g.
 * `"targets[1].blocks.abc.inputs.STEPS"`). The structured fields let consumers
 * filter findings without parsing the path string:
 *
 *  - `targetIndex` — which target the finding belongs to (null for
 *    project-level paths such as `meta.semver` or `targets`).
 *  - `blockId` — which block, when the finding is inside a block.
 *
 * `toString()` returns `path`, so existing template-literal formatting keeps
 * working.
 */
export class ValidationPath {
  constructor(
    public readonly path: string,
    public readonly targetIndex: number | null = null,
    public readonly blockId: string | null = null
  ) {}

  toString(): string {
    return this.path;
  }
}

/**
 * A single validation finding produced by one of the rules.
 *
 * The path arrives as either a raw dot-notation string or a `ValidationPath`;
 * a string is auto-wrapped with `targetIndex` and `blockId` left null.
 */
export class ValidationError {
  readonly code: ErrorCode;
  readonly path: ValidationPath;
  readonly message: string;
  readonly severity: ValidationSeverity;

  constructor(
    code: ErrorCode,
    path: string | ValidationPath,
    message: string,
    severity: ValidationSeverity = 'error'
  ) {
    this.code = code;
    this.path = path instanceof ValidationPath ? path : new ValidationPath(path);
    this.message = message;
    this.severity = severity;
  }
}

/** The outcome of validating a project. */
export class ValidationResult {
  constructor(
    public readonly isValid: boolean,
    public readonly errors: readonly ValidationError[]
  ) {}

  /** Build a result, deriving validity from the absence of error-severity findings. */
  static fromErrors(errors: readonly ValidationError[]): ValidationResult {
    const isValid = errors.every((e) => e.severity !== 'error');
    return new ValidationResult(isValid, errors);
  }
}

/** Construct a `ValidationError` — kept for parity with the prior helper API. */
export function makeError(
  code: ErrorCode,
  path: string | ValidationPath,
  message: string,
  severity: ValidationSeverity = 'error'
): ValidationError {
  return new ValidationError(code, path, message, severity);
}

/** Build a result from a list of findings. */
export function makeResult(errors: readonly ValidationError[]): ValidationResult {
  return ValidationResult.fromErrors(errors);
}
