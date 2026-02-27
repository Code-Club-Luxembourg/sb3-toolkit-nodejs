import { describe, expect, it } from 'vitest';
import type { ScratchProjectData, ScratchSprite, ScratchStage } from '../src/types';
import { ScratchAssetIndex, ScratchProject } from '../src/model';

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

function createSound(id: string) {
  return {
    name: `sound-${id}`,
    dataFormat: 'wav',
    assetId: id,
    md5ext: `${id}.wav`,
    rate: 44100,
    sampleCount: 1000
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
    costumes: [createCostume('stage-costume')],
    sounds: [createSound('stage-sound')],
    volume: 100
  };
}

function createSprite(name: string, layerOrder: number, costumeId: string, soundId: string): ScratchSprite {
  return {
    isStage: false,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: {},
    comments: {},
    currentCostume: 0,
    costumes: [createCostume(costumeId)],
    sounds: [createSound(soundId)],
    volume: 100,
    layerOrder,
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
    meta: {
      semver: '3.0.0',
      vm: '0.2.0'
    }
  };
}

describe('ScratchProject.mergeSprites', () => {
  it('merges sprites, renames collisions, and normalizes layer order', () => {
    const baseStage = createStage();
    const baseSprite = createSprite('Cat', 5, 'base-costume', 'base-sound');
    const baseData = createProjectData([baseStage, baseSprite]);

    const baseAssets = new ScratchAssetIndex();
    baseAssets.add('stage-costume.svg', Buffer.from('stage-costume'));
    baseAssets.add('stage-sound.wav', Buffer.from('stage-sound'));
    baseAssets.add('base-costume.svg', Buffer.from('base-costume'));
    baseAssets.add('base-sound.wav', Buffer.from('base-sound'));

    const baseProject = new ScratchProject(baseData, baseAssets);

    const sourceSprite = createSprite('Cat', 2, 'source-costume', 'source-sound');
    const sourceData = createProjectData([createStage(), sourceSprite]);
    const sourceAssets = new ScratchAssetIndex();
    sourceAssets.add('source-costume.svg', Buffer.from('source-costume'));
    sourceAssets.add('source-sound.wav', Buffer.from('source-sound'));
    const sourceProject = new ScratchProject(sourceData, sourceAssets);

    const merged = ScratchProject.mergeSprites(baseProject, [sourceProject]);

    const mergedSpriteNames = merged.data.targets
      .filter((target): target is ScratchSprite => !target.isStage)
      .map((target) => target.name);

    expect(mergedSpriteNames).toEqual(['Cat', 'Cat (2)']);

    const mergedStage = merged.data.targets.find((target): target is ScratchStage => target.isStage);
    expect(mergedStage?.layerOrder).toBe(0);

    const mergedSprites = merged.data.targets.filter(
      (target): target is ScratchSprite => !target.isStage
    );
    const layerByName = new Map(mergedSprites.map((sprite) => [sprite.name, sprite.layerOrder]));
    expect(layerByName.get('Cat (2)')).toBe(1);
    expect(layerByName.get('Cat')).toBe(2);

    expect(merged.assets.has('source-costume.svg')).toBe(true);
    expect(merged.assets.has('source-sound.wav')).toBe(true);
  });

  it('tolerates null blocks when applying grid offsets', () => {
    const baseStage = createStage();
    const baseSprite = createSprite('Cat', 1, 'base-costume', 'base-sound');
    const baseData = createProjectData([baseStage, baseSprite]);

    const baseAssets = new ScratchAssetIndex();
    baseAssets.add('stage-costume.svg', Buffer.from('stage-costume'));
    baseAssets.add('stage-sound.wav', Buffer.from('stage-sound'));
    baseAssets.add('base-costume.svg', Buffer.from('base-costume'));
    baseAssets.add('base-sound.wav', Buffer.from('base-sound'));
    const baseProject = new ScratchProject(baseData, baseAssets);

    const sourceSprite = createSprite('Dog', 1, 'source-costume', 'source-sound');
    sourceSprite.blocks = {
      root: {
        opcode: 'motion_gotoxy',
        next: null,
        parent: null,
        inputs: {
          X: [1, 10],
          Y: [1, -20]
        },
        fields: {},
        shadow: false,
        topLevel: true
      },
      dangling: null
    };
    const sourceData = createProjectData([createStage(), sourceSprite]);
    const sourceAssets = new ScratchAssetIndex();
    sourceAssets.add('source-costume.svg', Buffer.from('source-costume'));
    sourceAssets.add('source-sound.wav', Buffer.from('source-sound'));
    const sourceProject = new ScratchProject(sourceData, sourceAssets);

    const grid = ScratchProject.gridProjects([baseProject, sourceProject], { columns: 2 });
    const mergedSprite = grid.listSprites().find((sprite) => sprite.name === 'Dog');
    expect(mergedSprite?.blocks.root.inputs.X[1]).toBe(250);
    expect(mergedSprite?.blocks.root.inputs.Y[1]).toBe(-20);
  });

  it('preserves layer ordering based on original layerOrder values', () => {
    const stage = createStage();
    const front = createSprite('Front', 2, 'front-costume', 'front-sound');
    const back = createSprite('Back', 1, 'back-costume', 'back-sound');
    const baseData = createProjectData([stage, front, back]);

    const baseAssets = new ScratchAssetIndex();
    baseAssets.add('stage-costume.svg', Buffer.from('stage-costume'));
    baseAssets.add('stage-sound.wav', Buffer.from('stage-sound'));
    baseAssets.add('front-costume.svg', Buffer.from('front-costume'));
    baseAssets.add('front-sound.wav', Buffer.from('front-sound'));
    baseAssets.add('back-costume.svg', Buffer.from('back-costume'));
    baseAssets.add('back-sound.wav', Buffer.from('back-sound'));

    const baseProject = new ScratchProject(baseData, baseAssets);
    const merged = ScratchProject.mergeSprites(baseProject, []);

    const byName = new Map(
      merged.data.targets
        .filter((target): target is ScratchSprite => !target.isStage)
        .map((sprite) => [sprite.name, sprite.layerOrder])
    );

    expect(byName.get('Back')).toBe(1);
    expect(byName.get('Front')).toBe(2);
  });

  it('keeps a stable order when sprites share the same layerOrder', () => {
    const stage = createStage();
    const first = createSprite('First', 1, 'first-costume', 'first-sound');
    const second = createSprite('Second', 1, 'second-costume', 'second-sound');
    const baseData = createProjectData([stage, first, second]);

    const baseAssets = new ScratchAssetIndex();
    baseAssets.add('stage-costume.svg', Buffer.from('stage-costume'));
    baseAssets.add('stage-sound.wav', Buffer.from('stage-sound'));
    baseAssets.add('first-costume.svg', Buffer.from('first-costume'));
    baseAssets.add('first-sound.wav', Buffer.from('first-sound'));
    baseAssets.add('second-costume.svg', Buffer.from('second-costume'));
    baseAssets.add('second-sound.wav', Buffer.from('second-sound'));

    const baseProject = new ScratchProject(baseData, baseAssets);
    const merged = ScratchProject.mergeSprites(baseProject, []);

    const byName = new Map(
      merged.data.targets
        .filter((target): target is ScratchSprite => !target.isStage)
        .map((sprite) => [sprite.name, sprite.layerOrder])
    );

    expect(byName.get('First')).toBe(1);
    expect(byName.get('Second')).toBe(2);
  });
});
