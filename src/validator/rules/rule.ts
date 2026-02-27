import type { ScratchProject } from '../../scratch/project';
import type { ValidationError } from '../errors';

/**
 * A user-supplied validation rule, plugged into `ScratchValidator` via
 * `ScratchValidator.withRule()`.
 *
 * Rules return `ValidationError`s instead of writing into an out-parameter so
 * they compose cleanly with generators and `map`/`filter`.
 *
 * The built-in rules don't implement this interface because they take extra
 * per-target context the validator threads in directly; this contract exists
 * for external rules that consume the whole project.
 */
export interface Rule {
  validate(project: ScratchProject): Iterable<ValidationError>;
}
