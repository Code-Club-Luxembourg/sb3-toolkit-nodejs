import type { ScratchBlock, ScratchBlocks, ScratchField, ScratchInput, ScratchMutation } from '../types';
import { Id } from './ids';
import { Input } from './input';

/** Value accepted by `Block.input()` — wrapped automatically into an `Input`. */
export type RawInputValue = Input | Block | number | string | null;

/**
 * A fluent builder for a single Scratch block and its chained successors.
 *
 * Create with {@link Block.make} (or a typed factory under `builder/blocks/*`),
 * configure with the fluent {@link input}, {@link field} and {@link mutation}
 * methods, and append successors with {@link then}.
 */
export class Block {
  readonly id: string;

  private readonly _opcode: string;
  private readonly _inputs = new Map<string, Input>();
  private readonly _fields: Record<string, ScratchField> = {};
  private _mutation: ScratchMutation | undefined = undefined;
  private _next: Block | null = null;
  private _parentId: string | null = null;
  private _shadow = false;

  private constructor(opcode: string) {
    this.id = Id.generate();
    this._opcode = opcode;
  }

  /** Create a block for the given opcode. */
  static make(opcode: string): Block {
    return new Block(opcode);
  }

  /**
   * Mark this block as a shadow. Used internally to flag dropdown menu blocks;
   * user code rarely needs to call this.
   *
   * @internal
   */
  asShadow(): this {
    this._shadow = true;
    return this;
  }

  /**
   * Chain a list of blocks via {@link then} and return the head, or `null`
   * when the list is empty. Used to turn a variadic body into a single
   * substack.
   */
  static stack(blocks: readonly Block[]): Block | null {
    if (blocks.length === 0) return null;
    const head = blocks[0];
    for (let i = 1; i < blocks.length; i += 1) {
      head.then(blocks[i]);
    }
    return head;
  }

  /**
   * Set an input. Plain number/string values and {@link Block} reporters are
   * wrapped automatically; pass an {@link Input} for a specific encoding.
   */
  input(name: string, value: RawInputValue): this {
    if (value === null) return this;
    this._inputs.set(name, Input.wrap(value));
    return this;
  }

  /**
   * Set a field. The optional id is used by fields that reference an entity
   * (e.g. a variable's id).
   */
  field(name: string, value: string, id: string | null = null): this {
    this._fields[name] = [value, id];
    return this;
  }

  /** Attach a procedure/control mutation to this block. */
  mutation(mutation: ScratchMutation): this {
    this._mutation = mutation;
    return this;
  }

  /**
   * Append a block at the end of this chain and return the root, so
   * `root.then(a).then(b)` keeps anchoring on the root.
   */
  then(block: Block): this {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let tail: Block = this;
    while (tail._next !== null) {
      tail = tail._next;
    }
    tail._next = block;
    block._parentId = tail.id;
    return this;
  }

  /**
   * Append a block at the end of this chain and return the appended block, so
   * `root.andThen(a).andThen(b)` walks forward. Use this when you need a
   * reference to a deep block; call `Sprite.addScript()` with the *original*
   * root.
   */
  andThen(block: Block): Block {
    this.then(block);
    return block;
  }

  /**
   * The id of this block's predecessor in the chain. Null for the root.
   */
  get parentId(): string | null {
    return this._parentId;
  }

  get opcode(): string {
    return this._opcode;
  }

  /**
   * Flatten this script into a blocks map. The root block is marked
   * `topLevel = true` at the given coordinates.
   */
  toBlocks(x = 0, y = 0): ScratchBlocks {
    const result: ScratchBlocks = {};
    this.collectInto(result, null, true, x, y);
    return result;
  }

  private collectInto(
    blocks: ScratchBlocks,
    parentId: string | null,
    isTopLevel: boolean,
    x: number,
    y: number
  ): void {
    const encodedInputs: Record<string, ScratchInput> = {};
    for (const [name, input] of this._inputs) {
      encodedInputs[name] = input.toSlot();
    }

    const block: ScratchBlock = {
      opcode: this._opcode,
      next: this._next ? this._next.id : null,
      parent: parentId,
      inputs: encodedInputs,
      fields: { ...this._fields },
      shadow: this._shadow,
      topLevel: isTopLevel
    };

    if (isTopLevel) {
      block.x = x;
      block.y = y;
    }

    if (this._mutation) {
      block.mutation = this._mutation;
    }

    blocks[this.id] = block;

    for (const input of this._inputs.values()) {
      for (const child of input.childBlocks()) {
        child.collectInto(blocks, this.id, false, 0, 0);
      }
    }

    if (this._next) {
      this._next.collectInto(blocks, this.id, false, 0, 0);
    }
  }
}
