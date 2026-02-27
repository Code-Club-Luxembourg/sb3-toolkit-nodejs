import { describe, expect, it } from 'vitest';
import {
  type BlockRef,
  Events,
  Key,
  Motion,
  ScratchProject,
  ScriptLocation,
  type Sprite,
  Stage
} from '../src/model';

function makeMixedSprite(): Sprite {
  const project = ScratchProject.create();
  const sprite = project.addSprite('Cat');
  sprite.addScript(Events.whenFlagClicked().then(Motion.moveSteps(10)));
  sprite.addScript(Events.whenKeyPressed(Key.Space));
  sprite.addScript(Events.whenKeyPressed(Key.Enter));
  sprite.addScript(Events.whenSpriteClicked());
  return sprite;
}

describe('findScripts filter overloads', () => {
  it('string opcode', () => {
    const sprite = makeMixedSprite();
    expect(sprite.findScripts('event_whenflagclicked')).toHaveLength(1);
    expect(sprite.findScripts('event_whenkeypressed')).toHaveLength(2);
  });

  it('array of opcodes', () => {
    const sprite = makeMixedSprite();
    const scripts = sprite.findScripts(['event_whenflagclicked', 'event_whenspriteclicked']);
    expect(scripts).toHaveLength(2);
  });

  it('predicate', () => {
    const sprite = makeMixedSprite();
    const spaceScripts = sprite.findScripts(
      (hat: BlockRef) =>
        hat.opcode() === 'event_whenkeypressed' && hat.getFieldValue('KEY_OPTION') === 'space'
    );
    expect(spaceScripts).toHaveLength(1);
  });
});

describe('ScratchProject.findAllScripts', () => {
  it('walks stage + every sprite', () => {
    const project = ScratchProject.create();
    project.stage().addScript(Events.whenFlagClicked());
    project.addSprite('Cat').addScript(Events.whenFlagClicked());
    project.addSprite('Dog').addScript(Events.whenKeyPressed(Key.Space));

    const locations = [...project.findAllScripts()];
    expect(locations).toHaveLength(3);

    const byName = new Map<string, string[]>();
    for (const loc of locations) {
      expect(loc).toBeInstanceOf(ScriptLocation);
      const list = byName.get(loc.target.name) ?? [];
      list.push(loc.script.opcode());
      byName.set(loc.target.name, list);
    }
    expect(byName.get('Stage')).toEqual(['event_whenflagclicked']);
    expect(byName.get('Cat')).toEqual(['event_whenflagclicked']);
    expect(byName.get('Dog')).toEqual(['event_whenkeypressed']);
  });

  it('accepts a filter', () => {
    const project = ScratchProject.create();
    project.stage().addScript(Events.whenFlagClicked());
    project.addSprite('Cat').addScript(Events.whenKeyPressed(Key.Space));
    project.addSprite('Dog').addScript(Events.whenFlagClicked());

    const flag = [...project.findAllScripts('event_whenflagclicked')];
    expect(flag).toHaveLength(2);
    for (const loc of flag) {
      expect(['Stage', 'Dog']).toContain(loc.target.name);
    }
  });

  it('stage scripts yield a Stage in ScriptLocation.target', () => {
    const project = ScratchProject.create();
    project.stage().addScript(Events.whenFlagClicked());
    const loc = [...project.findAllScripts()][0];
    expect(loc.target).toBeInstanceOf(Stage);
  });
});
