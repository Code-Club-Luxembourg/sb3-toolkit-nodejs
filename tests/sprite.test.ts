import { describe, expect, it } from 'vitest';
import {
  Block,
  Motion,
  RotationStyle,
  ScratchProject,
  type Sprite
} from '../src/model';

function makeSprite(): Sprite {
  return ScratchProject.create().addSprite('Cat');
}

describe('Sprite', () => {
  it('findBlocks returns matching blocks', () => {
    const sprite = makeSprite();
    sprite.addScript(
      Block.make('event_whenflagclicked')
        .then(Block.make('motion_movesteps').input('STEPS', 10))
        .then(Block.make('motion_movesteps').input('STEPS', 5))
    );
    expect(sprite.findBlocks('motion_movesteps')).toHaveLength(2);
  });

  it('findScripts returns only top-level', () => {
    const sprite = makeSprite();
    sprite.addScript(Block.make('event_whenflagclicked').then(Block.make('motion_movesteps').input('STEPS', 10)));
    sprite.addScript(Block.make('event_whenkeypressed').field('KEY_OPTION', 'space'));
    expect(sprite.findScripts()).toHaveLength(2);
  });

  it('findScripts filters by hat opcode', () => {
    const sprite = makeSprite();
    sprite.addScript(Block.make('event_whenflagclicked').then(Block.make('motion_movesteps').input('STEPS', 10)));
    sprite.addScript(Block.make('event_whenkeypressed').field('KEY_OPTION', 'space'));
    const scripts = sprite.findScripts('event_whenflagclicked');
    expect(scripts).toHaveLength(1);
    expect(scripts[0].opcode()).toBe('event_whenflagclicked');
  });

  it('block() returns a ref', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    sprite.addScript(hat);
    expect(sprite.block(hat.id).opcode()).toBe('event_whenflagclicked');
  });

  it('block() throws for missing block', () => {
    expect(() => makeSprite().block('nonexistent')).toThrow();
  });

  it('input() mutates the block in place', () => {
    const sprite = makeSprite();
    const move = Block.make('motion_movesteps').input('STEPS', 10);
    sprite.addScript(Block.make('event_whenflagclicked').then(move));
    sprite.block(move.id).input('STEPS', 99);
    expect(sprite.data().blocks[move.id]?.inputs.STEPS).toEqual([1, [4, 99]]);
  });

  it('field() mutates the field in place', () => {
    const sprite = makeSprite();
    const stop = Block.make('control_stop').field('STOP_OPTION', 'all');
    sprite.addScript(Block.make('event_whenflagclicked').then(stop));
    sprite.block(stop.id).field('STOP_OPTION', 'this script');
    expect(sprite.data().blocks[stop.id]?.fields.STOP_OPTION).toEqual(['this script', null]);
  });

  it('insertAfter relinks the chain', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const moveA = Block.make('motion_movesteps').input('STEPS', 10);
    const moveB = Block.make('motion_movesteps').input('STEPS', 20);
    hat.then(moveA);
    sprite.addScript(hat);
    sprite.block(hat.id).insertAfter(moveB);

    const blocks = sprite.data().blocks;
    expect(blocks[hat.id]?.next).toBe(moveB.id);
    expect(blocks[moveB.id]?.next).toBe(moveA.id);
    expect(blocks[moveA.id]?.parent).toBe(moveB.id);
  });

  it('delete removes block and relinks chain', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const moveA = Block.make('motion_movesteps').input('STEPS', 10);
    const moveB = Block.make('motion_movesteps').input('STEPS', 20);
    hat.then(moveA).then(moveB);
    sprite.addScript(hat);
    sprite.block(moveA.id).delete();

    const blocks = sprite.data().blocks;
    expect(blocks[hat.id]?.next).toBe(moveB.id);
    expect(blocks[moveB.id]?.parent).toBe(hat.id);
    expect(moveA.id in blocks).toBe(false);
  });

  it('input() overwrite frees previous nested blocks', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const move = Block.make('motion_movesteps');
    const reporter = Block.make('operator_add')
      .input('NUM1', 1)
      .input('NUM2', Block.make('operator_multiply').input('NUM1', 2).input('NUM2', 3));
    move.input('STEPS', reporter);
    hat.then(move);
    sprite.addScript(hat);

    expect(sprite.data().blocks[reporter.id]).toBeDefined();
    sprite.block(move.id).input('STEPS', 7);
    expect(sprite.data().blocks[reporter.id]).toBeUndefined();
    expect(sprite.data().blocks[move.id]?.inputs.STEPS).toEqual([1, [4, 7]]);
  });

  it('delete frees nested input subtree', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const reporter = Block.make('operator_add').input('NUM1', 1).input('NUM2', 2);
    const move = Block.make('motion_movesteps').input('STEPS', reporter);
    hat.then(move);
    sprite.addScript(hat);

    expect(sprite.data().blocks[reporter.id]).toBeDefined();

    sprite.block(move.id).delete();
    expect(sprite.data().blocks[move.id]).toBeUndefined();
    expect(sprite.data().blocks[reporter.id]).toBeUndefined();
  });

  it('delete frees substack blocks', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const body = Block.make('motion_movesteps').input('STEPS', 10);
    const loop = Block.make('control_forever').input('SUBSTACK', body);
    hat.then(loop);
    sprite.addScript(hat);

    expect(sprite.data().blocks[body.id]).toBeDefined();

    sprite.block(loop.id).delete();
    expect(sprite.data().blocks[loop.id]).toBeUndefined();
    expect(sprite.data().blocks[body.id]).toBeUndefined();
  });

  it('delete head of script promotes next to top-level', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const move = Block.make('motion_movesteps').input('STEPS', 10);
    hat.then(move);
    sprite.addScript(hat, 12, 34);

    sprite.block(hat.id).delete();
    const blocks = sprite.data().blocks;
    expect(blocks[hat.id]).toBeUndefined();
    expect(blocks[move.id]?.topLevel).toBe(true);
    expect(blocks[move.id]?.parent).toBeNull();
    expect(blocks[move.id]?.x).toBe(12);
    expect(blocks[move.id]?.y).toBe(34);
  });

  it('typed accessors read inputs and fields', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const move = Block.make('motion_movesteps').input('STEPS', 17);
    const stop = Block.make('control_stop').field('STOP_OPTION', 'all');
    hat.then(move).then(stop);
    sprite.addScript(hat);

    const moveRef = sprite.block(move.id);
    expect(moveRef.opcode()).toBe('motion_movesteps');
    expect(moveRef.getInputSlot('STEPS')).toEqual([1, [4, 17]]);
    expect(moveRef.getInputLiteralValue('STEPS')).toBe(17);
    expect(moveRef.getInputSlot('DOES_NOT_EXIST')).toBeNull();
    expect(moveRef.getInputLiteralValue('DOES_NOT_EXIST')).toBeNull();

    const stopRef = sprite.block(stop.id);
    expect(stopRef.getField('STOP_OPTION')).toEqual(['all', null]);
    expect(stopRef.getFieldValue('STOP_OPTION')).toBe('all');
    expect(stopRef.getFieldValue('NOT_SET')).toBeNull();
  });

  it('input literal value is null for a block reference', () => {
    const sprite = makeSprite();
    const hat = Block.make('event_whenflagclicked');
    const reporter = Block.make('motion_xposition');
    const move = Block.make('motion_movesteps').input('STEPS', reporter);
    hat.then(move);
    sprite.addScript(hat);

    const ref = sprite.block(move.id);
    const slot = ref.getInputSlot('STEPS');
    expect(slot).not.toBeNull();
    expect(slot![0]).toBe(2);
    expect(ref.getInputLiteralValue('STEPS')).toBeNull();
  });

  it('setters mutate the sprite target', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addCostume('extra', Buffer.from('<svg/>'));

    cat
      .setCurrentCostume(1)
      .setPosition(40, -10)
      .setSize(75)
      .setDirection(45)
      .setVisible(false)
      .setDraggable(true)
      .setRotationStyle(RotationStyle.LeftRight)
      .setVolume(80);

    const data = cat.data();
    expect(data.currentCostume).toBe(1);
    expect(data.x).toBe(40);
    expect(data.y).toBe(-10);
    expect(data.size).toBe(75);
    expect(data.direction).toBe(45);
    expect(data.visible).toBe(false);
    expect(data.draggable).toBe(true);
    expect(data.rotationStyle).toBe('left-right');
    expect(data.volume).toBe(80);
  });

  it('setCurrentCostume rejects out-of-range', () => {
    expect(() => makeSprite().setCurrentCostume(5)).toThrow();
  });

  it('addVariable returns a ref and stores the variable', () => {
    const sprite = makeSprite();
    const ref = sprite.addVariable('score', 0);
    expect(ref.name).toBe('score');
    expect(sprite.data().variables[ref.id]).toEqual(['score', 0]);
  });

  it('addList returns a ref and stores the list', () => {
    const sprite = makeSprite();
    const ref = sprite.addList('items');
    expect(ref.name).toBe('items');
    expect(sprite.data().lists[ref.id]).toEqual(['items', []]);
  });
});

describe('Motion factory', () => {
  it('produces correct opcodes', () => {
    const m = Motion.moveSteps(10);
    const blocks = m.toBlocks();
    expect(blocks[m.id]?.opcode).toBe('motion_movesteps');
    expect(blocks[m.id]?.inputs.STEPS).toEqual([1, [4, 10]]);
  });
});
