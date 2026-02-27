import { describe, expect, it } from 'vitest';
import { Events, Looks, ScratchProject, Stage } from '../src/model';

describe('Stage', () => {
  it('project.stage() returns a live Stage', () => {
    const project = ScratchProject.create();
    const stage = project.stage();
    expect(stage).toBeInstanceOf(Stage);
    expect(stage.name).toBe('Stage');
  });

  it('addScript adds top-level scripts to the stage', () => {
    const project = ScratchProject.create();
    const stage = project.stage();
    const hat = Events.whenFlagClicked().then(Looks.switchBackdropTo('next backdrop'));
    stage.addScript(hat);

    const blocks = stage.data().blocks;
    expect(blocks[hat.id]).toBeDefined();
    expect(blocks[hat.id]!.topLevel).toBe(true);
  });

  it('findScripts on the stage returns its hats', () => {
    const project = ScratchProject.create();
    const stage = project.stage();
    stage.addScript(Events.whenFlagClicked());
    stage.addScript(Events.whenBackdropSwitchesTo('backdrop1'));

    expect(stage.findScripts()).toHaveLength(2);
    expect(stage.findScripts('event_whenflagclicked')).toHaveLength(1);
  });

  it('addBackdrop + setCurrentBackdrop on Stage', () => {
    const project = ScratchProject.create();
    const stage = project.stage();
    const idx = stage.addBackdrop('extra', Buffer.from('<svg/>'));
    stage.setCurrentBackdrop(idx);
    expect(stage.data().currentCostume).toBe(idx);
  });

  it('setCurrentBackdrop throws when out of range', () => {
    const project = ScratchProject.create();
    expect(() => project.stage().setCurrentBackdrop(99)).toThrow();
  });

  it('addVariable on Stage is global', () => {
    const project = ScratchProject.create();
    const stage = project.stage();
    const ref = stage.addVariable('score', 0);
    expect(project.getStage().variables[ref.id]).toEqual(['score', 0]);
  });
});
