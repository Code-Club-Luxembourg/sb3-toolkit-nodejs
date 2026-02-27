import { describe, expect, it } from 'vitest';
import {
  Events,
  Looks,
  Motion,
  Operators,
  Procedure,
  ScratchProject,
  ScratchValidator
} from '../src/model';

describe('Procedure', () => {
  it('proccode for argless procedure', () => {
    expect(Procedure.define('greet').proccode()).toBe('greet');
  });

  it('proccode for typed args', () => {
    const proc = Procedure.define('doThing', [
      Procedure.stringArg('count'),
      Procedure.booleanArg('flag')
    ]);
    expect(proc.proccode()).toBe('doThing %s %b');
  });

  it('rejects duplicate arg names', () => {
    expect(() =>
      Procedure.define('p', [Procedure.stringArg('a'), Procedure.stringArg('a')])
    ).toThrow();
  });

  it('definition block carries mutation', () => {
    const proc = Procedure.define('p', [Procedure.stringArg('n')], { warp: true });
    const blocks = proc.definition().toBlocks();

    let defBlock: unknown;
    let protoBlock: { mutation?: Record<string, string>; shadow?: boolean } | null = null;
    for (const block of Object.values(blocks)) {
      if (block?.opcode === 'procedures_definition') defBlock = block;
      if (block?.opcode === 'procedures_prototype') protoBlock = block;
    }
    expect(defBlock).toBeDefined();
    expect(protoBlock).not.toBeNull();
    expect(protoBlock!.shadow).toBe(true);
    expect(protoBlock!.mutation!.proccode).toBe('p %s');
    expect(protoBlock!.mutation!.warp).toBe('true');
  });

  it('arg reporter has field VALUE', () => {
    const proc = Procedure.define('p', [Procedure.stringArg('count')]);
    const reporter = proc.arg('count');
    const blocks = reporter.toBlocks();
    const r = blocks[reporter.id]!;
    expect(r.opcode).toBe('argument_reporter_string_number');
    expect(r.fields.VALUE).toEqual(['count', null]);
  });

  it('boolean arg reporter has boolean opcode', () => {
    const proc = Procedure.define('p', [Procedure.booleanArg('flag')]);
    const reporter = proc.arg('flag');
    expect(reporter.toBlocks()[reporter.id]!.opcode).toBe('argument_reporter_boolean');
  });

  it('call block uses arg ids as slot keys', () => {
    const proc = Procedure.define('p', [
      Procedure.stringArg('count'),
      Procedure.booleanArg('flag')
    ]);
    const cond = Operators.equals(1, 1);
    const call = proc.call(42, cond);
    const callBlock = call.toBlocks()[call.id]!;
    const argIds = JSON.parse(callBlock.mutation!.argumentids as string) as string[];
    expect(argIds).toHaveLength(2);
    expect(callBlock.inputs[argIds[0]]).toEqual([1, [4, 42]]);
    expect((callBlock.inputs[argIds[1]] as unknown as unknown[])[0]).toBe(2); // NO_SHADOW
  });

  it('call rejects bool value for string arg', () => {
    const proc = Procedure.define('p', [Procedure.stringArg('n')]);
    expect(() => proc.call(true)).toThrow();
  });

  it('call rejects non-Block for boolean arg', () => {
    const proc = Procedure.define('p', [Procedure.booleanArg('flag')]);
    expect(() => proc.call('not a block')).toThrow();
  });

  it('call rejects wrong arg count', () => {
    const proc = Procedure.define('p', [Procedure.stringArg('a'), Procedure.stringArg('b')]);
    expect(() => proc.call('only-one')).toThrow();
  });

  it('end-to-end procedure builds a valid project', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');

    const proc = Procedure.define('move-and-say', [Procedure.stringArg('msg')]);

    cat.addScript(
      proc.definition().then(Motion.moveSteps(10)).then(Looks.say(proc.arg('msg')))
    );
    cat.addScript(Events.whenFlagClicked().then(proc.call('hi')));

    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(true);
  });
});
