import type { ScratchBlocks } from '../../types';
import type { ScratchProject } from '../../scratch/project';
import { ErrorCode, ValidationError, ValidationPath } from '../errors';
import type { Rule } from './rule';

/**
 * Flag blocks that are present in the blocks map but unreachable from any
 * top-level (hat) block — i.e. they would never execute. These usually appear
 * after manual edits or partial deletions.
 *
 * Reported as warnings because they don't break parsing.
 */
export class OrphanedBlocksRule implements Rule {
  *validate(project: ScratchProject): Iterable<ValidationError> {
    const targets = project.data.targets;
    for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
      const target = targets[targetIndex];
      const blocks = target.blocks;
      const reachable = reachableFromHats(blocks);
      for (const [id, block] of Object.entries(blocks)) {
        if (!block || reachable.has(id)) continue;
        yield new ValidationError(
          ErrorCode.ORPHANED_BLOCK,
          new ValidationPath(`targets[${targetIndex}].blocks.${id}`, targetIndex, id),
          `Block "${id}" (${block.opcode}) is unreachable from any top-level script`,
          'warning'
        );
      }
    }
  }
}

function reachableFromHats(blocks: ScratchBlocks): Set<string> {
  const reachable = new Set<string>();
  for (const [id, block] of Object.entries(blocks)) {
    if (block?.topLevel) {
      markReachable(blocks, id, reachable);
    }
  }
  return reachable;
}

function markReachable(blocks: ScratchBlocks, id: string, reachable: Set<string>): void {
  if (reachable.has(id)) return;
  const block = blocks[id];
  if (!block) return;
  reachable.add(id);

  for (const slot of Object.values(block.inputs)) {
    if (!Array.isArray(slot)) continue;
    if (typeof slot[1] === 'string') markReachable(blocks, slot[1], reachable);
    if (typeof slot[2] === 'string') markReachable(blocks, slot[2], reachable);
  }
  if (typeof block.next === 'string') {
    markReachable(blocks, block.next, reachable);
  }
}
