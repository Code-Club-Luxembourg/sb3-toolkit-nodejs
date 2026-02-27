import type { ScratchBlock, ScratchBlocks, ScratchTarget } from '../../types';
import {
  ErrorCode,
  type ErrorCode as ErrorCodeType,
  ValidationError,
  ValidationPath,
  type ValidationSeverity
} from '../errors';
import type { OpcodeRegistry } from '../opcodes';

function err(
  code: ErrorCodeType,
  path: string,
  targetIndex: number,
  blockId: string | null,
  message: string,
  severity: ValidationSeverity = 'error'
): ValidationError {
  return new ValidationError(code, new ValidationPath(path, targetIndex, blockId), message, severity);
}

export function validateBlocks(
  target: ScratchTarget,
  targetIndex: number,
  targetPath: string,
  registry: OpcodeRegistry,
  strictOpcodes: boolean,
  errors: ValidationError[]
): void {
  const blocks = target.blocks;
  const blockPath = `${targetPath}.blocks`;

  for (const [id, block] of Object.entries(blocks)) {
    if (block === null) continue;
    validateBlock(id, block, blocks, targetIndex, blockPath, registry, strictOpcodes, errors);
  }

  detectCycles(blocks, targetIndex, blockPath, errors);
}

function validateBlock(
  id: string,
  block: ScratchBlock,
  blocks: ScratchBlocks,
  targetIndex: number,
  blockPath: string,
  registry: OpcodeRegistry,
  strictOpcodes: boolean,
  errors: ValidationError[]
): void {
  const path = `${blockPath}.${id}`;

  if (typeof block.opcode !== 'string' || block.opcode.length === 0) {
    errors.push(err(ErrorCode.MISSING_FIELD, `${path}.opcode`, targetIndex, id, 'Block opcode must be a non-empty string'));
    return;
  }

  if (block.next !== null) {
    if (!(block.next in blocks)) {
      errors.push(
        err(
          ErrorCode.DANGLING_NEXT,
          `${path}.next`,
          targetIndex,
          id,
          `Block "${id}" has next "${block.next}" which does not exist`
        )
      );
    } else {
      const nextBlock = blocks[block.next];
      if (nextBlock !== null && nextBlock.parent !== id) {
        errors.push(
          err(
            ErrorCode.INCONSISTENT_NEXT_PARENT,
            `${path}.next`,
            targetIndex,
            id,
            `Block "${id}" has next "${block.next}" but that block's parent is "${String(nextBlock.parent)}" (expected "${id}")`
          )
        );
      }
    }
  }

  if (block.parent !== null && !(block.parent in blocks)) {
    errors.push(
      err(
        ErrorCode.DANGLING_PARENT,
        `${path}.parent`,
        targetIndex,
        id,
        `Block "${id}" has parent "${block.parent}" which does not exist`
      )
    );
  }

  if (block.topLevel && (block.x === undefined || block.y === undefined)) {
    errors.push(
      err(ErrorCode.TOPLEVEL_NO_COORDS, path, targetIndex, id, `Top-level block "${id}" is missing x/y coordinates`, 'warning')
    );
  }

  if (block.shadow && block.parent === null) {
    errors.push(err(ErrorCode.SHADOW_NO_PARENT, path, targetIndex, id, `Shadow block "${id}" has no parent`, 'warning'));
  }

  const spec = registry.get(block.opcode);
  if (!spec) {
    const severity: ValidationSeverity = strictOpcodes ? 'error' : 'warning';
    errors.push(err(ErrorCode.UNKNOWN_OPCODE, `${path}.opcode`, targetIndex, id, `Unknown opcode "${block.opcode}"`, severity));
    return;
  }

  if (block.opcode !== 'procedures_call') {
    for (const inputName of spec.requiredInputs) {
      if (!(inputName in block.inputs)) {
        errors.push(
          err(
            ErrorCode.MISSING_INPUT,
            `${path}.inputs.${inputName}`,
            targetIndex,
            id,
            `Block "${id}" (${block.opcode}) is missing required input "${inputName}"`
          )
        );
      }
    }
  }

  for (const fieldName of spec.requiredFields) {
    if (!(fieldName in block.fields)) {
      errors.push(
        err(
          ErrorCode.MISSING_FIELD_VALUE,
          `${path}.fields.${fieldName}`,
          targetIndex,
          id,
          `Block "${id}" (${block.opcode}) is missing required field "${fieldName}"`
        )
      );
    }
  }

  for (const [inputName, input] of Object.entries(block.inputs)) {
    if (!Array.isArray(input)) continue;
    const kind = input[0];
    const value = input[1];
    if ((kind === 2 || kind === 3) && typeof value === 'string' && !(value in blocks)) {
      errors.push(
        err(
          ErrorCode.DANGLING_INPUT_REF,
          `${path}.inputs.${inputName}`,
          targetIndex,
          id,
          `Block "${id}" input "${inputName}" references block "${value}" which does not exist`
        )
      );
    }
    const shadowId = input[2];
    if (kind === 3 && typeof shadowId === 'string' && !(shadowId in blocks)) {
      errors.push(
        err(
          ErrorCode.DANGLING_INPUT_REF,
          `${path}.inputs.${inputName}`,
          targetIndex,
          id,
          `Block "${id}" input "${inputName}" shadow references block "${shadowId}" which does not exist`
        )
      );
    }
  }
}

function detectCycles(blocks: ScratchBlocks, targetIndex: number, blockPath: string, errors: ValidationError[]): void {
  const visited = new Set<string>();
  const cyclesReported = new Set<string>();

  for (const [id, block] of Object.entries(blocks)) {
    if (block === null || visited.has(id)) continue;

    const chain: string[] = [];
    const chainIndex = new Map<string, number>();
    let current: string | null = id;

    while (current !== null) {
      const inIndex = chainIndex.get(current);
      if (inIndex !== undefined) {
        const cycle = chain.slice(inIndex);
        reportCycle(cycle, current, targetIndex, blockPath, cyclesReported, errors);
        break;
      }
      if (visited.has(current)) {
        break;
      }
      chainIndex.set(current, chain.length);
      chain.push(current);
      visited.add(current);

      const currentBlock: ScratchBlock | null | undefined = blocks[current];
      const nextValue: string | null = currentBlock?.next ?? null;
      current = typeof nextValue === 'string' && nextValue.length > 0 ? nextValue : null;
    }
  }
}

function reportCycle(
  cycle: readonly string[],
  closingId: string,
  targetIndex: number,
  blockPath: string,
  cyclesReported: Set<string>,
  errors: ValidationError[]
): void {
  const minId = [...cycle].sort()[0] ?? closingId;
  const signature = `${cycle.join('|')}|${minId}`;
  if (cyclesReported.has(signature)) return;
  cyclesReported.add(signature);

  const pathArrow = [...cycle, closingId].join(' → ');
  errors.push(
    new ValidationError(
      ErrorCode.BLOCK_CYCLE,
      new ValidationPath(blockPath, targetIndex),
      `Cycle detected in block next-chain: ${pathArrow}`
    )
  );
}
