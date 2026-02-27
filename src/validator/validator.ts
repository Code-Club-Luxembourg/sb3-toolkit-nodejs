import type { ScratchAssetIndex } from '../scratch/asset-index';
import type { ScratchProject } from '../scratch/project';
import type { ScratchStage } from '../types';
import type { ValidationError} from './errors';
import { ValidationResult } from './errors';
import { DEFAULT_OPCODE_REGISTRY, type OpcodeRegistry } from './opcodes';
import { validateAssets } from './rules/assets';
import { validateBlocks } from './rules/blocks';
import type { Rule } from './rules/rule';
import { validateStructure } from './rules/structure';
import { validateVariableRefs } from './rules/variables';

export interface ValidatorOptions {
  assets?: ScratchAssetIndex;
  strictOpcodes?: boolean;
  registry?: OpcodeRegistry;
  /** Extra user-supplied rules, appended after the built-ins. */
  rules?: readonly Rule[];
}

/**
 * Validates a `ScratchProject` and returns structured findings.
 */
export class ScratchValidator {
  private readonly assets: ScratchAssetIndex | undefined;
  private readonly strictOpcodes: boolean;
  private readonly registry: OpcodeRegistry;
  private readonly customRules: readonly Rule[];

  constructor(options: ValidatorOptions = {}) {
    this.assets = options.assets;
    this.strictOpcodes = options.strictOpcodes ?? false;
    this.registry = options.registry ?? DEFAULT_OPCODE_REGISTRY;
    this.customRules = options.rules ?? [];
  }

  /**
   * Return a new validator with `rule` appended to the rule chain. Built-in
   * rules always run first; user rules run after and see the same project
   * state.
   */
  withRule(rule: Rule): ScratchValidator {
    return new ScratchValidator({
      assets: this.assets,
      strictOpcodes: this.strictOpcodes,
      registry: this.registry,
      rules: [...this.customRules, rule]
    });
  }

  /** Run every rule against `project` and return the aggregated findings. */
  run(project: ScratchProject): ValidationResult {
    const errors: ValidationError[] = [];
    const data = project.data;

    validateStructure(data, errors);

    const stage = data.targets.find((t): t is ScratchStage => t.isStage);

    for (let i = 0; i < data.targets.length; i += 1) {
      const target = data.targets[i];
      const targetPath = `targets[${i}]`;

      validateBlocks(target, i, targetPath, this.registry, this.strictOpcodes, errors);

      if (this.assets) {
        validateAssets(target, i, targetPath, this.assets, errors);
      }

      if (stage) {
        validateVariableRefs(target, i, targetPath, stage, errors);
      }
    }

    for (const rule of this.customRules) {
      for (const error of rule.validate(project)) {
        errors.push(error);
      }
    }

    return ValidationResult.fromErrors(errors);
  }

  /** Alias for {@link run}, kept for source compatibility. */
  validate(project: ScratchProject): ValidationResult {
    return this.run(project);
  }

  static validate(project: ScratchProject, options?: ValidatorOptions): ValidationResult {
    return new ScratchValidator(options).run(project);
  }
}
