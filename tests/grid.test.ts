import { describe, expect, it } from 'vitest';
import type { ScratchBlocks, ScratchProjectData, ScratchSprite, ScratchStage } from '../src/types';
import { ScratchAssetIndex, ScratchProject } from '../src/model';
import { makePositiveIntParser } from '../src/cli/parse';

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

function createBlocks(): ScratchBlocks {
  return {
    gotoxy: {
      opcode: 'motion_gotoxy',
      next: null,
      parent: null,
      inputs: {
        X: [1, [4, '0']],
        Y: [1, [4, '0']]
      },
      fields: {},
      shadow: false,
      topLevel: false
    },
    setx: {
      opcode: 'motion_setx',
      next: null,
      parent: null,
      inputs: {
        X: [1, [4, '10']]
      },
      fields: {},
      shadow: false,
      topLevel: false
    },
    sety: {
      opcode: 'motion_sety',
      next: null,
      parent: null,
      inputs: {
        Y: [1, [4, '5']]
      },
      fields: {},
      shadow: false,
      topLevel: false
    },
    glide: {
      opcode: 'motion_glidesecstoxy',
      next: null,
      parent: null,
      inputs: {
        SECS: [1, [4, 1]],
        X: [1, [4, 30]],
        Y: [1, [4, -10]]
      },
      fields: {},
      shadow: false,
      topLevel: false
    }
  };
}

function createSprite(name: string, layerOrder: number, costumeId: string, soundId: string): ScratchSprite {
  return {
    isStage: false,
    name,
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: createBlocks(),
    comments: {},
    currentCostume: 0,
    costumes: [createCostume(costumeId)],
    sounds: [createSound(soundId)],
    volume: 100,
    layerOrder,
    visible: true,
    x: 10,
    y: 20,
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

function createProject(name: string, costumeId: string, soundId: string): ScratchProject {
  const stage = createStage();
  const sprite = createSprite(name, 1, costumeId, soundId);
  const data = createProjectData([stage, sprite]);

  const assets = new ScratchAssetIndex();
  assets.add('stage-costume.svg', Buffer.from('stage-costume'));
  assets.add('stage-sound.wav', Buffer.from('stage-sound'));
  assets.add(`${costumeId}.svg`, Buffer.from(costumeId));
  assets.add(`${soundId}.wav`, Buffer.from(soundId));

  return new ScratchProject(data, assets);
}

describe('ScratchProject.gridProjects', () => {
  it('offsets sprite positions and absolute coordinate inputs', () => {
    const leftProject = createProject('Left', 'left-costume', 'left-sound');
    const rightProject = createProject('Right', 'right-costume', 'right-sound');

    const gridded = ScratchProject.gridProjects([leftProject, rightProject], { columns: 2 });

    const sprites = gridded.data.targets.filter(
      (target): target is ScratchSprite => !target.isStage
    );

    const left = sprites.find((sprite) => sprite.name === 'Left');
    const right = sprites.find((sprite) => sprite.name === 'Right');

    expect(left?.x).toBe(-230);
    expect(left?.y).toBe(20);
    expect(right?.x).toBe(250);
    expect(right?.y).toBe(20);

    const leftBlocks = left?.blocks ?? {};
    const rightBlocks = right?.blocks ?? {};

    expect(leftBlocks.gotoxy.inputs.X[1]).toEqual([4, -140]);
    expect(rightBlocks.gotoxy.inputs.X[1]).toEqual([4, 340]);
    expect(leftBlocks.gotoxy.inputs.Y[1]).toEqual([4, -50]);
    expect(rightBlocks.gotoxy.inputs.Y[1]).toEqual([4, -50]);
    expect(leftBlocks.setx.inputs.X[1]).toEqual([4, '-230']);
    expect(rightBlocks.setx.inputs.X[1]).toEqual([4, '250']);
    expect(leftBlocks.sety.inputs.Y[1]).toEqual([4, '5']);
    expect(rightBlocks.sety.inputs.Y[1]).toEqual([4, '5']);
    expect(leftBlocks.glide.inputs.X[1]).toEqual([4, -210]);
    expect(rightBlocks.glide.inputs.X[1]).toEqual([4, 270]);
    expect(leftBlocks.glide.inputs.Y[1]).toEqual([4, -10]);
    expect(rightBlocks.glide.inputs.Y[1]).toEqual([4, -10]);
  });

  it('reports grid size in pixels', () => {
    expect(ScratchProject.gridPixelSize(2, 3)).toEqual({ width: 960, height: 1080 });
  });

  it('rejects invalid row counts', () => {
    const project = createProject('Only', 'only-costume', 'only-sound');

    expect(() => ScratchProject.gridProjects([project], { columns: 2, rows: Number.NaN })).toThrow(
      'Grid rows must be a positive number'
    );
  });

  it('rejects non-numeric CLI values for rows', () => {
    const parseRows = makePositiveIntParser('Grid rows');

    expect(() => parseRows('nope')).toThrow('Grid rows must be a positive integer.');
  });
});
