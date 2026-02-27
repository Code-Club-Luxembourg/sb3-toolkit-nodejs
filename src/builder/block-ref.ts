import type { ScratchBlock, ScratchBlocks, ScratchField } from '../types';
import type { Block } from './block';
import { Input } from './input';

/**
 * A reference to a single block within a live blocks map, for in-place edits.
 *
 * Works equally on freshly built projects and on projects loaded from `.sb3`,
 * because both expose the same flat `blocks` map; this class just walks and
 * mutates that map by reference.
 */
export class BlockRef {
  constructor(
    private readonly blocks: ScratchBlocks,
    public readonly id: string
  ) {}

  /**
   * Return the referenced block, throwing if it is missing or null.
   */
  data(): ScratchBlock {
    const block = this.blocks[this.id];
    if (!block) {
      throw new Error(`Block "${this.id}" not found or is null`);
    }
    return block;
  }

  /** The block's opcode. */
  opcode(): string {
    return this.data().opcode;
  }

  /**
   * The raw input slot tuple at `name` (e.g. `[1, [4, 10]]`, `[2, "blockId"]`,
   * `[3, "blockId", "shadowId"]`), or `null` when the input is absent.
   */
  getInputSlot(name: string): readonly unknown[] | null {
    const slot = this.data().inputs[name];
    if (!Array.isArray(slot)) return null;
    return slot;
  }

  /**
   * The literal value at input `name` (e.g. `10` for `[1, [4, 10]]`). Returns
   * `null` when the input is absent or carries a block reference rather than
   * a literal — use {@link getInputSlot} for the raw encoding.
   */
  getInputLiteralValue(name: string): string | number | null {
    const slot = this.getInputSlot(name);
    if (!slot) return null;
    const payload: unknown = slot[1];
    if (!Array.isArray(payload)) return null;
    const value: unknown = payload[1];
    if (typeof value !== 'string' && typeof value !== 'number') return null;
    return value;
  }

  /**
   * The raw `[value, id]` field tuple at `name`, or `null` when absent.
   */
  getField(name: string): ScratchField | null {
    const field = this.data().fields[name];
    if (!Array.isArray(field)) return null;
    return field;
  }

  /**
   * Just the string value of a field (the dropdown selection); `null` when
   * the field is absent or its value is not a string.
   */
  getFieldValue(name: string): string | null {
    const field = this.getField(name);
    if (!field || typeof field[0] !== 'string') return null;
    return field[0];
  }

  /**
   * Set an input. Plain number/string values and {@link Block} reporters are
   * wrapped automatically. If the slot previously held nested blocks, those
   * blocks and their descendants are removed from the map.
   *
   * Passing `null` is a no-op.
   */
  input(name: string, value: Input | Block | number | string | null): this {
    if (value === null) return this;

    const existing = this.data().inputs[name] as unknown;
    if (Array.isArray(existing)) {
      for (const oldChildId of this.referencedBlockIds(existing)) {
        this.removeSubtree(oldChildId);
      }
    }

    const input = Input.wrap(value);

    for (const child of input.childBlocks()) {
      const subBlocks = child.toBlocks(0, 0);
      const subRoot = subBlocks[child.id];
      if (subRoot) {
        subRoot.topLevel = false;
        subRoot.parent = this.id;
      }
      for (const [subId, sub] of Object.entries(subBlocks)) {
        this.blocks[subId] = sub;
      }
    }

    this.data().inputs[name] = input.toSlot();
    return this;
  }

  /**
   * Set a field. The optional id is used by fields that reference an entity.
   */
  field(name: string, value: string, id: string | null = null): this {
    this.data().fields[name] = [value, id];
    return this;
  }

  /**
   * The block this one chains to via `next`, or `null` when this is the tail.
   */
  next(): BlockRef | null {
    const nextId = this.data().next;
    if (typeof nextId !== 'string' || !this.blocks[nextId]) return null;
    return new BlockRef(this.blocks, nextId);
  }

  /**
   * The block this one is attached to. For chain blocks this is the previous
   * statement; for blocks that live inside an input slot (reporters, substack
   * heads) it is the containing block. Use {@link previous} when you only
   * want chain predecessors.
   */
  parent(): BlockRef | null {
    const parentId = this.data().parent;
    if (typeof parentId !== 'string' || !this.blocks[parentId]) return null;
    return new BlockRef(this.blocks, parentId);
  }

  /**
   * The predecessor in the chain — the block whose `next` points to this one.
   * Returns `null` for hats and for blocks that live inside an input slot
   * (their `parent` is the containing block, not a chain predecessor).
   */
  previous(): BlockRef | null {
    const parent = this.parent();
    if (parent === null) return null;
    if (parent.data().next !== this.id) return null;
    return parent;
  }

  /**
   * The block referenced by input `name`, or `null` when the slot is absent
   * or carries only a literal value. Works for both nested reporters and
   * substack roots (kinds 2 + 3, plus shadow-menu refs in kind 1).
   */
  getInputBlock(name: string): BlockRef | null {
    const slot = this.data().inputs[name];
    if (!Array.isArray(slot)) return null;
    const id: unknown = slot[1];
    if (typeof id !== 'string' || !this.blocks[id]) return null;
    return new BlockRef(this.blocks, id);
  }

  /**
   * Walk this block and every successor via `next`, yielding each as a
   * `BlockRef`. Safe to break out of mid-walk; the iterator is lazy.
   */
  *chain(): Generator<BlockRef> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let cur: BlockRef | null = this;
    while (cur !== null) {
      yield cur;
      cur = cur.next();
    }
  }

  /**
   * Walk the chain of blocks rooted at the substack input `name`. Yields
   * nothing when the input is empty or absent (e.g. an empty `if` body).
   */
  *substack(name = 'SUBSTACK'): Generator<BlockRef> {
    const head = this.getInputBlock(name);
    if (head === null) return;
    yield* head.chain();
  }

  /**
   * Depth-first walk of every block reachable from this one: this block, then
   * each input-referenced block's subtree (reporters and substack heads),
   * then the next block's subtree. Calling this on a hat yields the entire
   * script.
   */
  *descendants(): Generator<BlockRef> {
    yield this;
    for (const slot of Object.values(this.data().inputs)) {
      if (!Array.isArray(slot)) continue;
      for (const childId of this.referencedBlockIds(slot)) {
        if (this.blocks[childId]) {
          yield* new BlockRef(this.blocks, childId).descendants();
        }
      }
    }
    const next = this.next();
    if (next !== null) yield* next.descendants();
  }

  /**
   * Insert a block immediately after this one in the next-chain:
   * `this → newBlock(chain) → old-next`.
   */
  insertAfter(newBlock: Block): void {
    const oldNextId = this.data().next;

    const newBlocks = newBlock.toBlocks(0, 0);
    const newRoot = newBlocks[newBlock.id];
    if (newRoot) {
      newRoot.topLevel = false;
      newRoot.parent = this.id;
    }

    let tailId = newBlock.id;
    for (;;) {
      const tail = newBlocks[tailId];
      if (tail?.next == null) break;
      tailId = tail.next;
    }

    for (const [id, block] of Object.entries(newBlocks)) {
      this.blocks[id] = block;
    }

    const tail = this.blocks[tailId];
    if (tail) tail.next = oldNextId;
    if (oldNextId) {
      const oldNext = this.blocks[oldNextId];
      if (oldNext) oldNext.parent = tailId;
    }

    this.data().next = newBlock.id;
  }

  /**
   * Remove this block from the next-chain and the blocks map.
   *
   * Blocks reachable through this block's inputs (nested reporters and
   * substacks) are removed too; the `next` chain is re-parented onto this
   * block's parent (or promoted to top-level if this block was a hat).
   */
  delete(): void {
    const block = this.data();
    const parentId = block.parent;
    const nextId = block.next;

    if (block.topLevel) {
      if (nextId) {
        const next = this.blocks[nextId];
        if (next) {
          next.topLevel = true;
          next.parent = null;
          if (block.x !== undefined) next.x = block.x;
          if (block.y !== undefined) next.y = block.y;
        }
      }
    } else {
      if (parentId) {
        const parent = this.blocks[parentId];
        if (parent?.next === this.id) {
          parent.next = nextId;
        }
      }
      if (nextId) {
        const next = this.blocks[nextId];
        if (next) next.parent = parentId;
      }
    }

    for (const slot of Object.values(block.inputs)) {
      if (!Array.isArray(slot)) continue;
      for (const childId of this.referencedBlockIds(slot)) {
        this.removeSubtree(childId);
      }
    }

    Reflect.deleteProperty(this.blocks, this.id);
  }

  /**
   * Insert a chain *before* this block: `[...newBlock chain] → this`.
   *
   * If this block is top-level, the inserted chain's head becomes the new
   * top-level hat at the same x/y and this block is demoted to mid-chain.
   * Otherwise the inserted head takes this block's previous slot (chain
   * predecessor's `next`, or the input slot of a parent reporter/substack).
   */
  insertBefore(newBlock: Block): void {
    const thisBlock = this.data();
    const parentId = thisBlock.parent;
    const isTopLevel = thisBlock.topLevel;
    const x = thisBlock.x;
    const y = thisBlock.y;

    const newBlocks = newBlock.toBlocks(0, 0);
    let tailId = newBlock.id;
    for (;;) {
      const tail = newBlocks[tailId];
      if (tail?.next == null) break;
      tailId = tail.next;
    }
    const tail = newBlocks[tailId];
    const head = newBlocks[newBlock.id];
    if (!tail || !head) {
      throw new Error('toBlocks() did not populate the chain root or tail');
    }
    tail.next = this.id;

    if (isTopLevel) {
      head.topLevel = true;
      head.parent = null;
      if (x !== undefined) head.x = x;
      if (y !== undefined) head.y = y;
      // Demote this block.
      thisBlock.topLevel = false;
      Reflect.deleteProperty(thisBlock, 'x');
      Reflect.deleteProperty(thisBlock, 'y');
    } else {
      head.topLevel = false;
      head.parent = parentId;
      if (parentId !== null) {
        const parent = this.blocks[parentId];
        if (parent) {
          if (parent.next === this.id) {
            parent.next = newBlock.id;
          }
          for (const [slotName, slot] of Object.entries(parent.inputs)) {
            if (!Array.isArray(slot)) continue;
            let modified = false;
            if (slot[1] === this.id) {
              slot[1] = newBlock.id;
              modified = true;
            }
            if (slot[2] === this.id) {
              slot[2] = newBlock.id;
              modified = true;
            }
            if (modified) {
              parent.inputs[slotName] = slot;
            }
          }
        }
      }
    }

    thisBlock.parent = tailId;

    for (const [id, block] of Object.entries(newBlocks)) {
      this.blocks[id] = block;
    }
  }

  /**
   * Swap this block out for a new one (chain). Preserves `parent`, `next`,
   * top-level status, and coordinates. Blocks reachable through this block's
   * inputs are removed; the `next` tail is preserved and re-parented onto the
   * inserted chain's tail.
   */
  replace(newBlock: Block): void {
    const thisBlock = this.data();
    const oldNextId = thisBlock.next;
    const oldParentId = thisBlock.parent;
    const isTopLevel = thisBlock.topLevel;
    const x = thisBlock.x;
    const y = thisBlock.y;

    const newBlocks = newBlock.toBlocks(0, 0);
    const newRootId = newBlock.id;
    let tailId = newRootId;
    for (;;) {
      const tail = newBlocks[tailId];
      if (tail?.next == null) break;
      tailId = tail.next;
    }

    const newRoot = newBlocks[newRootId];
    const tail = newBlocks[tailId];
    if (!newRoot || !tail) {
      throw new Error('toBlocks() did not populate the chain root or tail');
    }
    if (isTopLevel) {
      newRoot.topLevel = true;
      newRoot.parent = null;
      if (x !== undefined) newRoot.x = x;
      if (y !== undefined) newRoot.y = y;
    } else {
      newRoot.topLevel = false;
      newRoot.parent = oldParentId;
    }
    tail.next = oldNextId;

    if (!isTopLevel && oldParentId !== null) {
      const parent = this.blocks[oldParentId];
      if (parent) {
        if (parent.next === this.id) {
          parent.next = newRootId;
        }
        for (const [slotName, slot] of Object.entries(parent.inputs)) {
          if (!Array.isArray(slot)) continue;
          let modified = false;
          if (slot[1] === this.id) {
            slot[1] = newRootId;
            modified = true;
          }
          if (slot[2] === this.id) {
            slot[2] = newRootId;
            modified = true;
          }
          if (modified) {
            parent.inputs[slotName] = slot;
          }
        }
      }
    }

    if (oldNextId !== null) {
      const oldNext = this.blocks[oldNextId];
      if (oldNext) oldNext.parent = tailId;
    }

    for (const slot of Object.values(thisBlock.inputs)) {
      if (!Array.isArray(slot)) continue;
      for (const childId of this.referencedBlockIds(slot)) {
        this.removeSubtree(childId);
      }
    }
    Reflect.deleteProperty(this.blocks, this.id);

    for (const [id, block] of Object.entries(newBlocks)) {
      this.blocks[id] = block;
    }
  }

  /**
   * Remove this block and the *entire* chain reachable from it: every `next`
   * block onwards, and every nested input/substack subtree. Useful when
   * called on a hat to delete a whole script; on a mid-chain block, the
   * chain up to (but not including) this one is preserved.
   */
  removeScript(): void {
    const block = this.data();
    const parentId = block.parent;

    if (!block.topLevel && parentId !== null) {
      const parent = this.blocks[parentId];
      if (parent) {
        if (parent.next === this.id) {
          parent.next = null;
        }
        for (const [slotName, slot] of Object.entries(parent.inputs)) {
          if (!Array.isArray(slot)) continue;
          if (slot[1] === this.id) {
            Reflect.deleteProperty(parent.inputs, slotName);
          }
        }
      }
    }

    this.removeSubtree(this.id);
  }

  private referencedBlockIds(slot: readonly unknown[]): string[] {
    const ids: string[] = [];
    if (typeof slot[1] === 'string') ids.push(slot[1]);
    if (typeof slot[2] === 'string') ids.push(slot[2]);
    return ids;
  }

  private removeSubtree(id: string): void {
    const block = this.blocks[id];
    Reflect.deleteProperty(this.blocks, id);
    if (!block) return;

    for (const slot of Object.values(block.inputs)) {
      if (!Array.isArray(slot)) continue;
      for (const childId of this.referencedBlockIds(slot)) {
        this.removeSubtree(childId);
      }
    }

    if (typeof block.next === 'string') {
      this.removeSubtree(block.next);
    }
  }
}
