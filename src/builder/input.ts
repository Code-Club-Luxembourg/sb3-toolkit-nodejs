import { Block } from './block';
import type { BroadcastRef, ListRef, VariableRef } from './refs';

/** Input slot kind 1: a shadow value (literal, reporter, or shadow menu). */
export const INPUT_SHADOW = 1;
/** Input slot kind 2: a block reference with no shadow. */
export const INPUT_NO_SHADOW = 2;
/** Input slot kind 3: a block reference with a fallback shadow underneath. */
export const INPUT_BLOCK_AND_SHADOW = 3;

/**
 * The inner tuple a literal or reporter input carries (kind + value, plus an
 * optional id for variable/list/broadcast references).
 */
export type InputTuple =
  | [number, string | number]
  | [number, string | number, string];

/**
 * Encoded shape of a block-input slot:
 *  - `[1, tuple]` for a literal/reporter
 *  - `[1, shadowId]` for a shadow menu
 *  - `[2, blockId]` for a nested block alone
 *  - `[3, blockId, shadowId]` for a nested block over a shadow menu
 */
export type InputSlot =
  | [1, InputTuple | string]
  | [2, string]
  | [3, string, string];

/**
 * A typed value for a block input slot. Wraps Scratch's internal tuple encoding
 * so callers never build raw arrays themselves.
 */
export class Input {
  static readonly SHADOW = INPUT_SHADOW;
  static readonly NO_SHADOW = INPUT_NO_SHADOW;
  static readonly BLOCK_AND_SHADOW = INPUT_BLOCK_AND_SHADOW;

  private constructor(
    private readonly tuple: InputTuple | null,
    private readonly block: Block | null,
    private readonly shadow: Block | null
  ) {}

  /** Number literal: encodes as `[4, value]`. */
  static number(value: number | string): Input {
    return new Input([4, value], null, null);
  }

  /** String literal: encodes as `[10, value]`. */
  static text(value: string): Input {
    return new Input([10, value], null, null);
  }

  /** Variable reporter: encodes as `[12, name, id]`. */
  static variable(ref: VariableRef): Input {
    return new Input([12, ref.name, ref.id], null, null);
  }

  /** List reporter: encodes as `[13, name, id]`. */
  static list(ref: ListRef): Input {
    return new Input([13, ref.name, ref.id], null, null);
  }

  /** Broadcast reference: encodes as `[11, name, id]`. */
  static broadcast(ref: BroadcastRef): Input {
    return new Input([11, ref.name, ref.id], null, null);
  }

  /** Color value: encodes as `[9, value]`. */
  static color(value: string): Input {
    return new Input([9, value], null, null);
  }

  /** A nested block used as a reporter or substack. */
  static block(block: Block): Input {
    return new Input(null, block, null);
  }

  /**
   * A dropdown menu input.
   *
   * A string value builds the shadow menu block (carrying the selection in its
   * field) and references it directly. A {@link Block} value references the
   * block as the primary value and keeps an empty shadow menu underneath so
   * the slot round-trips correctly when the reporter is detached in the editor.
   */
  static menu(menuOpcode: string, fieldName: string, value: string | Block, shadowDefault = ''): Input {
    if (value instanceof Block) {
      const shadow = Block.make(menuOpcode).field(fieldName, shadowDefault).asShadow();
      return new Input(null, value, shadow);
    }
    const shadow = Block.make(menuOpcode).field(fieldName, value).asShadow();
    return new Input(null, null, shadow);
  }

  /**
   * Normalize a loose value into an `Input`. An `Input` passes through; a
   * `Block` becomes a block input; an int/float becomes a number literal; a
   * string becomes a text literal.
   */
  static wrap(value: Input | Block | number | string): Input {
    if (value instanceof Input) {
      return value;
    }
    if (value instanceof Block) {
      return Input.block(value);
    }
    if (typeof value === 'string') {
      return Input.text(value);
    }
    return Input.number(value);
  }

  /**
   * The nested blocks this input references (primary value, optional shadow),
   * in declaration order, so the flattener can collect them.
   */
  childBlocks(): Block[] {
    const children: Block[] = [];
    if (this.block) children.push(this.block);
    if (this.shadow) children.push(this.shadow);
    return children;
  }

  /** Encode this input as a block-input slot. */
  toSlot(): InputSlot {
    if (this.block && this.shadow) {
      return [INPUT_BLOCK_AND_SHADOW, this.block.id, this.shadow.id];
    }
    if (this.block) {
      return [INPUT_NO_SHADOW, this.block.id];
    }
    if (this.shadow) {
      return [INPUT_SHADOW, this.shadow.id];
    }
    if (!this.tuple) {
      throw new Error('Input has no payload');
    }
    return [INPUT_SHADOW, this.tuple];
  }
}
