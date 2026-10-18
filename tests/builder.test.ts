import { describe, expect, it } from 'vitest';
import {
  Block,
  BroadcastRef,
  ErrorCode,
  Events,
  Id,
  Input,
  ListRef,
  Looks,
  Motion,
  ScratchProject,
  ScratchValidator,
  VariableRef,
  generateId
} from '../src/model';

describe('Id.generate', () => {
  it('returns strings of ~20 chars', () => {
    const id = Id.generate();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThanOrEqual(16);
  });

  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => generateId()));
    expect(ids.size).toBe(10_000);
  });
});

describe('Input encoding', () => {
  it('Input.number encodes numbers', () => {
    expect(Input.number(10).toSlot()).toEqual([1, [4, 10]]);
    expect(Input.number('42').toSlot()).toEqual([1, [4, '42']]);
  });

  it('Input.text encodes strings', () => {
    expect(Input.text('hello').toSlot()).toEqual([1, [10, 'hello']]);
  });

  it('Input.variable / list / broadcast encode refs', () => {
    expect(Input.variable(new VariableRef('score', 'var-id')).toSlot()).toEqual([1, [12, 'score', 'var-id']]);
    expect(Input.list(new ListRef('myList', 'list-id')).toSlot()).toEqual([1, [13, 'myList', 'list-id']]);
    expect(Input.broadcast(new BroadcastRef('start', 'bc-id')).toSlot()).toEqual([1, [11, 'start', 'bc-id']]);
    expect(Input.color('#ff0000').toSlot()).toEqual([1, [9, '#ff0000']]);
  });

  it('Input.block encodes nested blocks', () => {
    const child = Block.make('motion_xposition');
    const input = Input.block(child);
    expect(input.toSlot()).toEqual([2, child.id]);
    expect(input.childBlocks()).toEqual([child]);
  });

  it('Input.menu with a string encodes as a shadow menu', () => {
    const input = Input.menu('motion_glideto_menu', 'TO', '_random_');
    const slot = input.toSlot();
    expect(slot[0]).toBe(Input.SHADOW);
    expect(typeof slot[1]).toBe('string');
    expect(input.childBlocks()).toHaveLength(1);
  });

  it('Input.menu with a block encodes as block+shadow', () => {
    const reporter = Block.make('operator_join');
    const input = Input.menu('motion_glideto_menu', 'TO', reporter);
    const slot = input.toSlot();
    expect(slot[0]).toBe(Input.BLOCK_AND_SHADOW);
    expect(slot[1]).toBe(reporter.id);
    expect(typeof slot[2]).toBe('string');
    expect(slot[2]).not.toBe(reporter.id);
    expect(input.childBlocks()).toHaveLength(2);
  });

  it('Input.wrap normalizes loose values', () => {
    expect(Input.wrap(7).toSlot()).toEqual([1, [4, 7]]);
    expect(Input.wrap(1.5).toSlot()).toEqual([1, [4, 1.5]]);
    expect(Input.wrap('hi').toSlot()).toEqual([1, [10, 'hi']]);
    const child = Block.make('motion_xposition');
    expect(Input.wrap(child).toSlot()).toEqual([2, child.id]);
  });

  it('Input.wrap returns the same instance for an Input', () => {
    const input = Input.number(3);
    expect(Input.wrap(input)).toBe(input);
  });
});

describe('Block', () => {
  it('Block.make creates a block with the correct opcode', () => {
    const b = Block.make('event_whenflagclicked');
    const blocks = b.toBlocks(10, 20);
    const entry = blocks[b.id];
    expect(entry?.opcode).toBe('event_whenflagclicked');
    expect(entry?.topLevel).toBe(true);
    expect(entry?.x).toBe(10);
    expect(entry?.y).toBe(20);
    expect(entry?.next).toBeNull();
    expect(entry?.parent).toBeNull();
  });

  it('encodes a number input as a shadow input', () => {
    const b = Block.make('motion_movesteps').input('STEPS', 10);
    const blocks = b.toBlocks();
    expect(blocks[b.id]?.inputs.STEPS).toEqual([1, [4, 10]]);
  });

  it('encodes a string input as a shadow input', () => {
    const b = Block.make('looks_say').input('MESSAGE', 'Hello!');
    const blocks = b.toBlocks();
    expect(blocks[b.id]?.inputs.MESSAGE).toEqual([1, [10, 'Hello!']]);
  });

  it('encodes a Block input as a no-shadow block reference', () => {
    const inner = Block.make('motion_xposition');
    const outer = Block.make('looks_say').input('MESSAGE', inner);
    const blocks = outer.toBlocks();
    expect(blocks[outer.id]?.inputs.MESSAGE).toEqual([2, inner.id]);
    expect(blocks[inner.id]?.parent).toBe(outer.id);
  });

  it('encodes typed Input value objects', () => {
    const b = Block.make('data_setvariableto').input('VALUE', Input.variable(new VariableRef('score', 'var-id')));
    const blocks = b.toBlocks();
    expect(blocks[b.id]?.inputs.VALUE).toEqual([1, [12, 'score', 'var-id']]);
  });

  it('encodes string fields', () => {
    const b = Block.make('data_setvariableto').input('VALUE', 0).field('VARIABLE', 'score', 'var-id');
    const blocks = b.toBlocks();
    expect(blocks[b.id]?.fields.VARIABLE).toEqual(['score', 'var-id']);
  });

  it('encodes string field shorthand (no ID)', () => {
    const b = Block.make('control_stop').field('STOP_OPTION', 'all');
    const blocks = b.toBlocks();
    expect(blocks[b.id]?.fields.STOP_OPTION).toEqual(['all', null]);
  });

  it('then() returns the root block', () => {
    const hat = Block.make('event_whenflagclicked');
    const move = Block.make('motion_movesteps').input('STEPS', 10);
    expect(hat.then(move)).toBe(hat);
  });

  it('andThen() returns the appended block', () => {
    const hat = Events.whenFlagClicked();
    const move = Motion.moveSteps(10);
    expect(hat.andThen(move)).toBe(move);
  });

  it('andThen() walks forward on each call', () => {
    const hat = Events.whenFlagClicked();
    const a = Motion.moveSteps(1);
    const b = Motion.moveSteps(2);
    const c = Looks.say('done');

    hat.andThen(a).andThen(b).andThen(c);

    const blocks = hat.toBlocks();
    expect(blocks[hat.id]?.next).toBe(a.id);
    expect(blocks[a.id]?.next).toBe(b.id);
    expect(blocks[b.id]?.next).toBe(c.id);
    expect(blocks[c.id]?.next).toBeNull();
  });

  it('then() chains three blocks anchored on root', () => {
    const a = Block.make('event_whenflagclicked');
    const b = Block.make('motion_movesteps').input('STEPS', 5);
    const c = Block.make('motion_movesteps').input('STEPS', 5);
    a.then(b).then(c);
    const blocks = a.toBlocks();
    expect(Object.keys(blocks)).toHaveLength(3);
    expect(blocks[a.id]?.next).toBe(b.id);
    expect(blocks[b.id]?.next).toBe(c.id);
    expect(blocks[a.id]?.parent).toBeNull();
    expect(blocks[b.id]?.parent).toBe(a.id);
    expect(blocks[c.id]?.parent).toBe(b.id);
    expect(blocks[c.id]?.next).toBeNull();
  });
});

describe('Events.whenSpriteClicked', () => {
  // Scratch 3 silently drops scripts whose hat opcode it does not know.
  it('uses the opcode Scratch recognises', () => {
    const hat = Events.whenSpriteClicked();
    expect(hat.toBlocks()[hat.id]?.opcode).toBe('event_whenthisspriteclicked');
  });

  it('is known to the validator', () => {
    const project = ScratchProject.create();
    project.addSprite('Cat').addScript(Events.whenSpriteClicked().then(Looks.say('hi')));
    const result = ScratchValidator.validate(project);
    expect(result.errors.filter((e) => e.code === ErrorCode.UNKNOWN_OPCODE)).toEqual([]);
    expect(result.isValid).toBe(true);
  });
});

describe('ScratchProject', () => {
  it('create produces a valid project', () => {
    const project = ScratchProject.create();
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(true);
  });

  it('create has a stage and no sprites', () => {
    const project = ScratchProject.create();
    expect(project.listSprites()).toHaveLength(0);
    expect(() => project.getStage()).not.toThrow();
  });

  it('addSprite adds a sprite with the given name', () => {
    const project = ScratchProject.create();
    project.addSprite('Cat');
    expect(project.listSprites()).toHaveLength(1);
    expect(project.listSprites()[0].name).toBe('Cat');
  });

  it('addSprite increments layerOrder', () => {
    const project = ScratchProject.create();
    project.addSprite('Cat');
    project.addSprite('Dog');
    const byName: Record<string, number> = {};
    for (const s of project.listSprites()) byName[s.name] = s.layerOrder;
    expect(byName.Cat).toBe(1);
    expect(byName.Dog).toBe(2);
  });

  it('sprite() throws for unknown name', () => {
    expect(() => ScratchProject.create().sprite('Nonexistent')).toThrow();
  });

  it('sprite can add scripts', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addScript(Block.make('event_whenflagclicked').then(Block.make('motion_movesteps').input('STEPS', 10)));
    const sprite = project.listSprites()[0];
    const blockCount = Object.values(sprite.blocks).filter(Boolean).length;
    expect(blockCount).toBe(2);
  });

  it('project built with builder passes validation', () => {
    const project = ScratchProject.create();
    project
      .addSprite('Cat')
      .addScript(
        Block.make('event_whenflagclicked')
          .then(Block.make('motion_movesteps').input('STEPS', 10))
          .then(Block.make('looks_say').input('MESSAGE', 'Hello!'))
      );
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(true);
  });
});
