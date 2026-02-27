import { describe, expect, it } from 'vitest';
import { Data, ErrorCode, Events, Motion, ScratchProject, ScratchValidator } from '../src/model';
import { OrphanedBlocksRule } from '../src/validator/rules/orphaned-blocks';
import { UnusedVariablesRule } from '../src/validator/rules/unused-variables';

describe('OrphanedBlocksRule', () => {
  it('reports orphan blocks as warnings', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addScript(Events.whenFlagClicked().then(Motion.moveSteps(10)));

    // Inject an unreachable block directly into the live target.
    const spriteData = project.data.targets.find((t) => !t.isStage)!;
    spriteData.blocks['orphan-id'] = {
      opcode: 'motion_movesteps',
      next: null,
      parent: null,
      inputs: { STEPS: [1, [4, 5]] },
      fields: {},
      shadow: false,
      topLevel: false
    };

    const validator = new ScratchValidator().withRule(new OrphanedBlocksRule());
    const errors = validator.run(project).errors;
    const orphans = errors.filter((e) => e.code === ErrorCode.ORPHANED_BLOCK);
    expect(orphans).toHaveLength(1);
    expect(orphans[0].path.blockId).toBe('orphan-id');
    expect(orphans[0].severity).toBe('warning');
  });

  it('clean project has no orphans', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addScript(Events.whenFlagClicked().then(Motion.moveSteps(10)));

    const validator = new ScratchValidator().withRule(new OrphanedBlocksRule());
    const orphans = validator.run(project).errors.filter((e) => e.code === ErrorCode.ORPHANED_BLOCK);
    expect(orphans).toEqual([]);
  });
});

describe('UnusedVariablesRule', () => {
  it('reports unused variable', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addVariable('unused', 0);
    cat.addScript(Events.whenFlagClicked());

    const validator = new ScratchValidator().withRule(new UnusedVariablesRule());
    const unused = validator.run(project).errors.filter((e) => e.code === ErrorCode.UNUSED_VARIABLE);
    expect(unused).toHaveLength(1);
  });

  it('used variable is not reported', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    const score = cat.addVariable('score', 0);
    cat.addScript(Events.whenFlagClicked().then(Data.setVariableTo(5, score)));

    const validator = new ScratchValidator().withRule(new UnusedVariablesRule());
    const unused = validator.run(project).errors.filter((e) => e.code === ErrorCode.UNUSED_VARIABLE);
    expect(unused).toEqual([]);
  });

  it('reports unused list', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addList('inventory');
    cat.addScript(Events.whenFlagClicked());

    const validator = new ScratchValidator().withRule(new UnusedVariablesRule());
    const unused = validator.run(project).errors.filter((e) => e.code === ErrorCode.UNUSED_LIST);
    expect(unused).toHaveLength(1);
  });

  it('stage variable referenced from sprite counts as used', () => {
    const project = ScratchProject.create();
    const score = project.addVariable('score', 0);
    const cat = project.addSprite('Cat');
    cat.addScript(Events.whenFlagClicked().then(Data.setVariableTo(5, score)));

    const validator = new ScratchValidator().withRule(new UnusedVariablesRule());
    const unused = validator.run(project).errors.filter((e) => e.code === ErrorCode.UNUSED_VARIABLE);
    expect(unused).toEqual([]);
  });
});
