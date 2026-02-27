import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Events, Key, Looks, Motion, ScratchProject } from '../src/model';

/**
 * The Builder navigation/edit API works against projects loaded from `.sb3`
 * because BlockRef operates on the raw blocks map by reference — there's no
 * object-tree reconstruction needed after `fromSb3File`.
 */
describe('round-trip via .sb3', () => {
  const tempFiles: string[] = [];

  afterEach(async () => {
    while (tempFiles.length > 0) {
      const f = tempFiles.pop()!;
      await fs.unlink(f).catch(() => undefined);
    }
  });

  async function tempPath(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scratch-tools-'));
    const file = path.join(dir, 'project.sb3');
    tempFiles.push(file);
    return file;
  }

  it('finds and rewrites scripts on a loaded project', async () => {
    const original = ScratchProject.create();
    const cat = original.addSprite('Cat');
    cat.addScript(
      Events.whenFlagClicked()
        .then(Motion.moveSteps(10))
        .then(Looks.say('hello'))
    );

    const file = await tempPath();
    await original.saveToSb3File(file);

    const loaded = await ScratchProject.fromSb3File(file);
    const loadedCat = loaded.sprite('Cat');

    for (const ref of loadedCat.findBlocks('motion_movesteps')) {
      const steps = ref.getInputLiteralValue('STEPS');
      expect(typeof steps).toBe('number');
      ref.input('STEPS', (steps as number) * 2);
    }

    // chain() walks the loaded script with no object-tree reconstruction.
    const hat = loadedCat.findScripts('event_whenflagclicked')[0];
    const opcodes = [...hat.chain()].map((r) => r.opcode());
    expect(opcodes).toEqual(['event_whenflagclicked', 'motion_movesteps', 'looks_say']);

    await loaded.saveToSb3File(file);
    const again = await ScratchProject.fromSb3File(file);
    const moves = again.sprite('Cat').findBlocks('motion_movesteps');
    expect(moves).toHaveLength(1);
    expect(moves[0].getInputLiteralValue('STEPS')).toBe(20);
  });

  it('findAllScripts on a loaded project covers stage + sprites', async () => {
    const project = ScratchProject.create();
    project.stage().addScript(Events.whenFlagClicked());
    project.addSprite('Cat').addScript(Events.whenKeyPressed(Key.Space));

    const file = await tempPath();
    await project.saveToSb3File(file);
    const loaded = await ScratchProject.fromSb3File(file);

    expect([...loaded.findAllScripts()]).toHaveLength(2);
  });

  it('removeScript on a loaded project drops the whole chain', async () => {
    const original = ScratchProject.create();
    const cat = original.addSprite('Cat');
    cat.addScript(Events.whenFlagClicked().then(Motion.moveSteps(5)));
    cat.addScript(Events.whenKeyPressed(Key.Space).then(Looks.say('hi')));

    const file = await tempPath();
    await original.saveToSb3File(file);
    const loaded = await ScratchProject.fromSb3File(file);
    const loadedCat = loaded.sprite('Cat');

    for (const script of loadedCat.findScripts('event_whenkeypressed')) {
      script.removeScript();
    }

    expect(loadedCat.findScripts()).toHaveLength(1);
    expect(loadedCat.findBlocks('looks_say')).toHaveLength(0);
  });
});
