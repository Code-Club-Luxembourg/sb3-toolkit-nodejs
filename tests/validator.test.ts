import { describe, expect, it } from 'vitest';
import type { ScratchBlocks, ScratchProjectData, ScratchSprite, ScratchStage } from '../src/types';
import { ScratchAssetIndex, ScratchProject, ScratchValidator, ErrorCode } from '../src/model';

function createCostume(id: string) {
  return {
    name: `costume-${id}`,
    dataFormat: 'svg',
    assetId: id,
    md5ext: `${id}.svg`,
    rotationCenterX: 0,
    rotationCenterY: 0
  };
}

function createStage(): ScratchStage {
  return {
    isStage: true,
    name: 'Stage',
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: 0,
    costumes: [createCostume('stage-bg')],
    sounds: [],
    volume: 100
  };
}

function createSprite(name: string): ScratchSprite {
  return {
    isStage: false,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: 0,
    costumes: [createCostume(`${name}-costume`)],
    sounds: [],
    volume: 100,
    layerOrder: 1,
    visible: true,
    x: 0,
    y: 0,
    size: 100,
    direction: 90,
    draggable: false,
    rotationStyle: 'all around'
  };
}

function createProjectData(targets: Array<ScratchStage | ScratchSprite>): ScratchProjectData {
  return {
    targets,
    monitors: [],
    extensions: [],
    meta: { semver: '3.0.0', vm: '0.2.0' }
  };
}

function makeProject(targets: Array<ScratchStage | ScratchSprite>): ScratchProject {
  const assets = new ScratchAssetIndex();
  for (const t of targets) {
    for (const c of t.costumes) {
      assets.add(c.md5ext, Buffer.from(''));
    }
  }
  return new ScratchProject(createProjectData(targets), assets);
}

describe('ScratchValidator — structural validation', () => {
  it('passes a minimal valid project', () => {
    const result = ScratchValidator.validate(makeProject([createStage()]));
    expect(result.isValid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('reports MISSING_STAGE when no stage exists', () => {
    const sprite = createSprite('Cat');
    const project = new ScratchProject(createProjectData([sprite]), new ScratchAssetIndex());
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.MISSING_STAGE)).toBe(true);
  });

  it('reports DUPLICATE_STAGE when two stages exist', () => {
    const project = makeProject([createStage(), createStage()]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.DUPLICATE_STAGE)).toBe(true);
  });

  it('reports WRONG_TYPE for invalid rotationStyle', () => {
    const sprite = createSprite('Cat');
    (sprite as unknown as Record<string, unknown>)['rotationStyle'] = 'spin';
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.WRONG_TYPE && String(e.path).includes('rotationStyle'))).toBe(true);
  });

  it('reports MISSING_FIELD for missing costume assetId', () => {
    const stage = createStage();
    (stage.costumes[0] as unknown as Record<string, unknown>)['assetId'] = undefined;
    const project = makeProject([stage]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.MISSING_FIELD && String(e.path).includes('assetId'))).toBe(true);
  });

  it.each([
    ['sampleCount', Number.NaN],
    ['sampleCount', null],
    ['sampleCount', 12.5],
    ['rate', 22_050.5],
    ['rate', -1]
  ])('reports sound %s = %s as WRONG_TYPE or MISSING_FIELD', (field, value) => {
    const stage = createStage();
    const sound: Record<string, unknown> = {
      name: 'laugh',
      dataFormat: 'wav',
      assetId: 'snd',
      md5ext: 'snd.wav',
      rate: 22_050,
      sampleCount: 1000
    };
    sound[field] = value;
    stage.sounds.push(sound as unknown as ScratchStage['sounds'][number]);
    const project = makeProject([stage]);
    project.assets.add('snd.wav', Buffer.from(''));
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(
      result.errors.some(
        (e) => (e.code === ErrorCode.WRONG_TYPE || e.code === ErrorCode.MISSING_FIELD) && String(e.path).endsWith(`.${field}`)
      )
    ).toBe(true);
  });

  it('returns isValid false only when an error-severity issue exists', () => {
    // Unknown opcode is a warning by default → isValid should still be true
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'custom_unknown_opcode',
      next: null,
      parent: null,
      inputs: {},
      fields: {},
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.errors.some((e) => e.code === ErrorCode.UNKNOWN_OPCODE && e.severity === 'warning')).toBe(true);
    expect(result.isValid).toBe(true);
  });
});

describe('ScratchValidator — block graph validation', () => {
  it('reports DANGLING_NEXT when next references a non-existent block', () => {
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'motion_movesteps',
      next: 'nonexistent',
      parent: null,
      inputs: { STEPS: [1, [4, 10]] },
      fields: {},
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.DANGLING_NEXT)).toBe(true);
  });

  it('reports INCONSISTENT_NEXT_PARENT when next/parent pointers disagree', () => {
    const sprite = createSprite('Cat');
    sprite.blocks = {
      a: { opcode: 'event_whenflagclicked', next: 'b', parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 0, y: 0 },
      b: { opcode: 'motion_movesteps', next: null, parent: 'WRONG', inputs: { STEPS: [1, [4, 10]] }, fields: {}, shadow: false, topLevel: false }
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.INCONSISTENT_NEXT_PARENT)).toBe(true);
  });

  it('reports BLOCK_CYCLE when a cycle exists in the next chain', () => {
    const sprite = createSprite('Cat');
    sprite.blocks = {
      a: { opcode: 'event_whenflagclicked', next: 'b', parent: null, inputs: {}, fields: {}, shadow: false, topLevel: true, x: 0, y: 0 },
      b: { opcode: 'motion_movesteps', next: 'a', parent: 'a', inputs: { STEPS: [1, [4, 10]] }, fields: {}, shadow: false, topLevel: false }
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.BLOCK_CYCLE)).toBe(true);
  });

  it('skips null block entries without error', () => {
    const sprite = createSprite('Cat');
    (sprite.blocks as ScratchBlocks)['dangling'] = null;
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(true);
  });

  it('reports UNKNOWN_OPCODE as error in strict mode', () => {
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'totally_fake',
      next: null,
      parent: null,
      inputs: {},
      fields: {},
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project, { strictOpcodes: true });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.UNKNOWN_OPCODE && e.severity === 'error')).toBe(true);
  });

  it('reports MISSING_INPUT for known opcode missing required input', () => {
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'motion_movesteps',
      next: null,
      parent: null,
      inputs: {}, // STEPS is missing
      fields: {},
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.MISSING_INPUT && String(e.path).includes('STEPS'))).toBe(true);
  });

  it('emits TOPLEVEL_NO_COORDS warning for topLevel block without x/y', () => {
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'event_whenflagclicked',
      next: null,
      parent: null,
      inputs: {},
      fields: {},
      shadow: false,
      topLevel: true
      // no x/y
    };
    const project = makeProject([createStage(), sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.errors.some((e) => e.code === ErrorCode.TOPLEVEL_NO_COORDS && e.severity === 'warning')).toBe(true);
    expect(result.isValid).toBe(true);
  });
});

describe('ScratchValidator — asset validation', () => {
  it('reports MISSING_ASSET when costume md5ext not in asset index', () => {
    const stage = createStage();
    const emptyAssets = new ScratchAssetIndex(); // no assets added
    const project = new ScratchProject(createProjectData([stage]), emptyAssets);
    const result = ScratchValidator.validate(project, { assets: emptyAssets });
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.MISSING_ASSET)).toBe(true);
  });

  it('skips asset checks when assets option is not provided', () => {
    const stage = createStage();
    const emptyAssets = new ScratchAssetIndex();
    const project = new ScratchProject(createProjectData([stage]), emptyAssets);
    const result = ScratchValidator.validate(project); // no assets option
    expect(result.errors.filter((e) => e.code === ErrorCode.MISSING_ASSET)).toHaveLength(0);
  });
});

describe('ScratchValidator — variable reference validation', () => {
  it('reports DANGLING_VARIABLE_REF for undefined variable ID', () => {
    const stage = createStage();
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'data_setvariableto',
      next: null,
      parent: null,
      inputs: { VALUE: [1, [10, '0']] },
      fields: { VARIABLE: ['myVar', 'nonexistent-id'] },
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };
    const project = makeProject([stage, sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.code === ErrorCode.DANGLING_VARIABLE_REF)).toBe(true);
  });

  it('accepts variable defined on stage from sprite block', () => {
    const stage = createStage();
    stage.variables['stage-var-id'] = ['score', 0];
    const sprite = createSprite('Cat');
    sprite.blocks['abc'] = {
      opcode: 'data_setvariableto',
      next: null,
      parent: null,
      inputs: { VALUE: [1, [10, '5']] },
      fields: { VARIABLE: ['score', 'stage-var-id'] },
      shadow: false,
      topLevel: true,
      x: 0,
      y: 0
    };
    const project = makeProject([stage, sprite]);
    const result = ScratchValidator.validate(project);
    expect(result.errors.filter((e) => e.code === ErrorCode.DANGLING_VARIABLE_REF)).toHaveLength(0);
  });
});
