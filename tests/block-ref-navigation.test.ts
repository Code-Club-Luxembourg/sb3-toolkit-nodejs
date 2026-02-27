import { describe, expect, it } from 'vitest';
import {
  Block,
  type BlockRef,
  Control,
  Events,
  Key,
  Looks,
  Motion,
  Operators,
  ScratchProject,
  type Sprite
} from '../src/model';

function spriteWithChain(): { sprite: Sprite; hat: Block; a: Block; b: Block; c: Block } {
  const project = ScratchProject.create();
  const sprite = project.addSprite('Cat');
  const hat = Events.whenFlagClicked();
  const a = Motion.moveSteps(10);
  const b = Motion.moveSteps(20);
  const c = Looks.say('done');
  hat.then(a).then(b).then(c);
  sprite.addScript(hat);
  return { sprite, hat, a, b, c };
}

describe('BlockRef navigation', () => {
  it('next() walks the chain', () => {
    const { sprite, hat, a } = spriteWithChain();
    const ref = sprite.block(hat.id).next();
    expect(ref).not.toBeNull();
    expect(ref!.id).toBe(a.id);
  });

  it('next() returns null for the tail', () => {
    const { sprite, c } = spriteWithChain();
    expect(sprite.block(c.id).next()).toBeNull();
  });

  it('parent() returns chain predecessor', () => {
    const { sprite, hat, a } = spriteWithChain();
    const parent = sprite.block(a.id).parent();
    expect(parent).not.toBeNull();
    expect(parent!.id).toBe(hat.id);
  });

  it('previous() returns chain predecessor and null for hat', () => {
    const { sprite, hat, a, b } = spriteWithChain();
    const prev = sprite.block(b.id).previous();
    expect(prev).not.toBeNull();
    expect(prev!.id).toBe(a.id);
    expect(sprite.block(hat.id).previous()).toBeNull();
  });

  it('previous() returns null for input children', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const reporter = Block.make('motion_xposition');
    const move = Motion.moveSteps(reporter);
    sprite.addScript(Events.whenFlagClicked().then(move));
    const reporterRef = sprite.block(reporter.id);
    expect(reporterRef.parent()).not.toBeNull();
    expect(reporterRef.previous()).toBeNull();
  });

  it('getInputBlock() reaches reporters and substack heads', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const body = Motion.moveSteps(10);
    const reporter = Block.make('motion_xposition');
    const forever = Control.forever([body]);
    const movement = Block.make('motion_movesteps').input('STEPS', reporter);
    sprite.addScript(Events.whenFlagClicked().then(movement).then(forever));

    const reporterRef = sprite.block(movement.id).getInputBlock('STEPS');
    expect(reporterRef).not.toBeNull();
    expect(reporterRef!.id).toBe(reporter.id);

    const bodyRef = sprite.block(forever.id).getInputBlock('SUBSTACK');
    expect(bodyRef).not.toBeNull();
    expect(bodyRef!.id).toBe(body.id);

    expect(sprite.block(movement.id).getInputBlock('NOPE')).toBeNull();
  });
});

describe('BlockRef iteration', () => {
  it('chain() yields every statement', () => {
    const { sprite, hat, a, b, c } = spriteWithChain();
    const ids = [...sprite.block(hat.id).chain()].map((r: BlockRef) => r.id);
    expect(ids).toEqual([hat.id, a.id, b.id, c.id]);
  });

  it('chain() starting mid-script begins there', () => {
    const { sprite, b, c } = spriteWithChain();
    const ids = [...sprite.block(b.id).chain()].map((r: BlockRef) => r.id);
    expect(ids).toEqual([b.id, c.id]);
  });

  it('substack() yields body blocks', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const b1 = Motion.moveSteps(1);
    const b2 = Motion.moveSteps(2);
    const loop = Control.forever([b1, b2]);
    sprite.addScript(Events.whenFlagClicked().then(loop));
    const ids = [...sprite.block(loop.id).substack()].map((r: BlockRef) => r.id);
    expect(ids).toEqual([b1.id, b2.id]);
  });

  it('substack() yields nothing for an empty slot', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const hat = Events.whenFlagClicked();
    sprite.addScript(hat);
    expect([...sprite.block(hat.id).substack()]).toHaveLength(0);
  });

  it('descendants() covers chain, reporters, and substacks', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const reporter = Operators.add(1, 2);
    const body = Motion.moveSteps(reporter);
    const loop = Control.repeat(3, [body]);
    const tail = Looks.say('done');
    const hat = Events.whenFlagClicked().then(loop).then(tail);
    sprite.addScript(hat);

    const ids = [...sprite.block(hat.id).descendants()].map((r: BlockRef) => r.id);
    expect(ids).toContain(hat.id);
    expect(ids).toContain(loop.id);
    expect(ids).toContain(body.id);
    expect(ids).toContain(reporter.id);
    expect(ids).toContain(tail.id);
  });
});

describe('BlockRef edits', () => {
  it('insertBefore on a top-level block promotes the new head', () => {
    const { sprite, hat } = spriteWithChain();
    const newHat = Events.whenKeyPressed(Key.Space);
    sprite.block(hat.id).insertBefore(newHat);

    const blocks = sprite.data().blocks;
    expect(blocks[newHat.id]!.topLevel).toBe(true);
    expect(blocks[newHat.id]!.x).toBe(0);
    expect(blocks[newHat.id]!.y).toBe(0);
    expect(blocks[newHat.id]!.next).toBe(hat.id);
    expect(blocks[hat.id]!.topLevel).toBe(false);
    expect(blocks[hat.id]!.parent).toBe(newHat.id);
    expect(blocks[hat.id]!.x).toBeUndefined();
    expect(blocks[hat.id]!.y).toBeUndefined();
  });

  it('insertBefore mid-chain re-links parent.next', () => {
    const { sprite, a, b } = spriteWithChain();
    const inserted = Motion.moveSteps(99);
    sprite.block(b.id).insertBefore(inserted);

    const blocks = sprite.data().blocks;
    expect(blocks[a.id]!.next).toBe(inserted.id);
    expect(blocks[inserted.id]!.parent).toBe(a.id);
    expect(blocks[inserted.id]!.next).toBe(b.id);
    expect(blocks[b.id]!.parent).toBe(inserted.id);
  });

  it('replace preserves parent and next', () => {
    const { sprite, hat, a, b } = spriteWithChain();
    const replacement = Looks.say('changed');
    sprite.block(a.id).replace(replacement);

    const blocks = sprite.data().blocks;
    expect(blocks[a.id]).toBeUndefined();
    expect(blocks[hat.id]!.next).toBe(replacement.id);
    expect(blocks[replacement.id]!.parent).toBe(hat.id);
    expect(blocks[replacement.id]!.next).toBe(b.id);
    expect(blocks[b.id]!.parent).toBe(replacement.id);
  });

  it('replace on top-level preserves coords', () => {
    const project = ScratchProject.create();
    const sprite = project.addSprite('Cat');
    const hat = Events.whenFlagClicked();
    sprite.addScript(hat, 100, 200);
    const newHat = Events.whenKeyPressed(Key.Space);
    sprite.block(hat.id).replace(newHat);

    const blocks = sprite.data().blocks;
    expect(blocks[hat.id]).toBeUndefined();
    expect(blocks[newHat.id]!.topLevel).toBe(true);
    expect(blocks[newHat.id]!.x).toBe(100);
    expect(blocks[newHat.id]!.y).toBe(200);
  });

  it('removeScript on hat drops the whole chain', () => {
    const { sprite, hat, a, b, c } = spriteWithChain();
    sprite.block(hat.id).removeScript();
    const blocks = sprite.data().blocks;
    expect(blocks[hat.id]).toBeUndefined();
    expect(blocks[a.id]).toBeUndefined();
    expect(blocks[b.id]).toBeUndefined();
    expect(blocks[c.id]).toBeUndefined();
  });

  it('removeScript on mid-block truncates the script after the predecessor', () => {
    const { sprite, hat, a, b, c } = spriteWithChain();
    sprite.block(b.id).removeScript();
    const blocks = sprite.data().blocks;
    expect(blocks[hat.id]).toBeDefined();
    expect(blocks[a.id]).toBeDefined();
    expect(blocks[b.id]).toBeUndefined();
    expect(blocks[c.id]).toBeUndefined();
    expect(blocks[a.id]!.next).toBeNull();
  });
});
