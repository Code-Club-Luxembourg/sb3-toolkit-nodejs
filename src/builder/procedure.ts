import { Block } from './block';
import { Id } from './ids';
import type { Input } from './input';

/** Argument kind: `string_number` ("%s") or `boolean` ("%b") in proccode. */
export type ProcedureArgKind = 'string_number' | 'boolean';

export interface ProcedureArg {
  name: string;
  kind: ProcedureArgKind;
}

/**
 * A typed helper for building Scratch custom blocks (procedures).
 *
 * A procedure spans three kinds of blocks on the sb3 wire:
 *
 * - `procedures_definition` — the hat block of the procedure body.
 * - `procedures_prototype` — a shadow under the definition that carries the
 *   procedure signature (proccode, argument ids/names/defaults, warp).
 * - `argument_reporter_string_number` / `argument_reporter_boolean` — reporters
 *   used inside the body to read the procedure's arguments.
 *
 * `Procedure` hides those details: define once, then call `definition()` for
 * the hat, `arg(name)` for argument reporters to use in the body, and
 * `call(...values)` to invoke the procedure from anywhere.
 */
export class Procedure {
  private readonly proccodeStr: string;
  private readonly argIds = new Map<string, string>();
  private readonly argKinds = new Map<string, ProcedureArgKind>();

  private constructor(
    public readonly name: string,
    args: readonly ProcedureArg[],
    private readonly warp: boolean
  ) {
    const seen = new Set<string>();
    let proccode = name;
    for (const arg of args) {
      if (seen.has(arg.name)) {
        throw new Error(`Duplicate procedure argument name: ${arg.name}`);
      }
      seen.add(arg.name);
      this.argIds.set(arg.name, Id.generate());
      this.argKinds.set(arg.name, arg.kind);
      proccode += arg.kind === 'boolean' ? ' %b' : ' %s';
    }
    this.proccodeStr = proccode;
  }

  /** Helper that produces a string/number argument descriptor. */
  static stringArg(name: string): ProcedureArg {
    return { name, kind: 'string_number' };
  }

  /** Helper that produces a boolean argument descriptor. */
  static booleanArg(name: string): ProcedureArg {
    return { name, kind: 'boolean' };
  }

  /** Define a new procedure with its argument list and warp flag. */
  static define(
    name: string,
    args: readonly ProcedureArg[] = [],
    options: { warp?: boolean } = {}
  ): Procedure {
    return new Procedure(name, args, options.warp ?? false);
  }

  /** The procedure's on-wire signature, e.g. `doThing %s %b`. */
  proccode(): string {
    return this.proccodeStr;
  }

  /**
   * Build the `procedures_definition` hat. Returns the hat with the prototype
   * already attached as its `custom_block` input. Chain the body with `then()`
   * and call `Sprite.addScript()` as usual.
   */
  definition(): Block {
    const argIds = [...this.argIds.values()];
    const argNames = [...this.argIds.keys()];
    const argDefaults = argNames.map((n) =>
      this.argKinds.get(n) === 'boolean' ? 'false' : ''
    );

    const prototype = Block.make('procedures_prototype').asShadow().mutation({
      tagName: 'mutation',
      children: [],
      proccode: this.proccodeStr,
      argumentids: JSON.stringify(argIds),
      argumentnames: JSON.stringify(argNames),
      argumentdefaults: JSON.stringify(argDefaults),
      warp: this.warp ? 'true' : 'false'
    });

    // One shadow reporter per argument, slot-keyed by the arg id.
    for (const [argName, argId] of this.argIds) {
      const opcode =
        this.argKinds.get(argName) === 'boolean'
          ? 'argument_reporter_boolean'
          : 'argument_reporter_string_number';
      const shadow = Block.make(opcode).asShadow().field('VALUE', argName);
      prototype.input(argId, shadow);
    }

    return Block.make('procedures_definition').input('custom_block', prototype);
  }

  /**
   * Build an argument reporter block to read this argument inside the body.
   * Each call returns a fresh `Block` so the same arg can appear in multiple
   * places.
   */
  arg(name: string): Block {
    const kind = this.argKinds.get(name);
    if (!kind) {
      throw new Error(`Procedure "${this.name}" has no argument named "${name}"`);
    }
    const opcode =
      kind === 'boolean' ? 'argument_reporter_boolean' : 'argument_reporter_string_number';
    return Block.make(opcode).field('VALUE', name);
  }

  /**
   * Build a `procedures_call` block. Values are supplied in declaration order;
   * `string_number` args accept the usual number/string/Block/Input and
   * `boolean` args require a `Block`.
   */
  call(...values: ReadonlyArray<number | string | boolean | Block | Input>): Block {
    const argNames = [...this.argIds.keys()];
    if (values.length !== argNames.length) {
      throw new Error(
        `Procedure "${this.name}" expects ${argNames.length} argument(s), got ${values.length}`
      );
    }

    const call = Block.make('procedures_call').mutation({
      tagName: 'mutation',
      children: [],
      proccode: this.proccodeStr,
      argumentids: JSON.stringify([...this.argIds.values()]),
      warp: this.warp ? 'true' : 'false'
    });

    for (let i = 0; i < argNames.length; i += 1) {
      const argName = argNames[i];
      const argId = this.argIds.get(argName);
      const kind = this.argKinds.get(argName);
      if (argId === undefined || kind === undefined) {
        throw new Error(`Procedure "${this.name}" argument "${argName}" lost its id (internal error)`);
      }
      const value = values[i];
      if (kind === 'boolean') {
        if (!(value instanceof Block)) {
          throw new Error(
            `Procedure "${this.name}" boolean argument "${argName}" requires a Block`
          );
        }
        call.input(argId, value);
      } else {
        if (typeof value === 'boolean') {
          throw new Error(
            `Procedure "${this.name}" string/number argument "${argName}" cannot be a bool`
          );
        }
        call.input(argId, value);
      }
    }

    return call;
  }
}
