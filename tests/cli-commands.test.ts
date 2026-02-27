import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/model', () => ({
  resolvePaths: vi.fn(async (paths: readonly string[]) => paths.map((p) => `/abs/${p}`)),
  ScratchProject: {
    fromSb3File: vi.fn(async () => ({})),
    mergeSprites: vi.fn(() => ({ saveToSb3File: vi.fn().mockResolvedValue(undefined) })),
    gridProjects: vi.fn(() => ({ saveToSb3File: vi.fn().mockResolvedValue(undefined) })),
    gridPixelSize: vi.fn(() => ({ width: 960, height: 720 }))
  }
}));

vi.mock('../src/cli/io', () => ({
  loadProjects: vi.fn(async () => [{}, {}])
}));

vi.mock('../src/cli/packager/pack', () => ({
  packProject: vi.fn(async () => {})
}));

vi.mock('../src/studio/download', () => ({
  iterStudioProjects: vi.fn(async function* () {
    yield { id: 123, title: 'Test' };
  }),
  downloadAndSaveProject: vi.fn(async () => 'downloaded')
}));

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined)
}));

let createProgram: typeof import('../src/cli/index').createProgram;
let model: typeof import('../src/model');
let io: typeof import('../src/cli/io');
let pack: typeof import('../src/cli/packager/pack');
let studio: typeof import('../src/studio/download');

describe('CLI command wiring', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    ({ createProgram } = await import('../src/cli/index'));
    model = await import('../src/model');
    io = await import('../src/cli/io');
    pack = await import('../src/cli/packager/pack');
    studio = await import('../src/studio/download');
  });

  it('runs merge command and writes output', async () => {
    const program = createProgram();

    await program.parseAsync([
      'node',
      'cli',
      'merge',
      'base.sb3',
      'source.sb3',
      '-o',
      'out.sb3'
    ]);

    expect(model.resolvePaths).toHaveBeenCalledWith(['base.sb3', 'source.sb3']);
    expect(vi.mocked(model.ScratchProject.fromSb3File)).toHaveBeenCalledWith('/abs/base.sb3');
    expect(io.loadProjects).toHaveBeenCalledWith(['/abs/source.sb3']);
    expect(vi.mocked(model.ScratchProject.mergeSprites)).toHaveBeenCalled();
    const merged = vi.mocked(model.ScratchProject.mergeSprites).mock.results[0]?.value as {
      saveToSb3File: (value: string) => Promise<void>;
    };
    expect(merged.saveToSb3File).toHaveBeenCalledWith(path.resolve('out.sb3'));
  });

  it('runs grid command and writes output', async () => {
    const program = createProgram();

    await program.parseAsync([
      'node',
      'cli',
      'grid',
      'a.sb3',
      'b.sb3',
      '--columns',
      '2',
      '-o',
      'out.sb3'
    ]);

    expect(model.resolvePaths).toHaveBeenCalledWith(['a.sb3', 'b.sb3']);
    expect(io.loadProjects).toHaveBeenCalled();
    expect(vi.mocked(model.ScratchProject.gridProjects)).toHaveBeenCalled();
    const gridded = vi.mocked(model.ScratchProject.gridProjects).mock.results[0]?.value as {
      saveToSb3File: (value: string) => Promise<void>;
    };
    expect(gridded.saveToSb3File).toHaveBeenCalledWith(path.resolve('out.sb3'));
  });

  it('runs pack command and passes parsed options', async () => {
    const program = createProgram();

    await program.parseAsync([
      'node',
      'cli',
      'pack',
      'in.sb3',
      '-o',
      'out.html',
      '--stage-width',
      '480',
      '--stage-height',
      '360',
      '--autoplay'
    ]);

    expect(model.resolvePaths).toHaveBeenCalledWith(['in.sb3']);
    expect(pack.packProject).toHaveBeenCalledWith(
      expect.objectContaining({
        projectPath: '/abs/in.sb3',
        outputPath: path.resolve('out.html'),
        stageWidth: 480,
        stageHeight: 360,
        autoplay: true
      })
    );
  });

  it('runs studio-download command and writes output', async () => {
    const program = createProgram();

    await program.parseAsync([
      'node',
      'cli',
      'studio-download',
      '999',
      '--no-skip-existing',
      '--max-projects',
      '1',
      '--delay',
      '0'
    ]);

    expect(studio.iterStudioProjects).toHaveBeenCalled();
    expect(studio.downloadAndSaveProject).toHaveBeenCalledWith(
      path.resolve('studio_downloads'),
      123,
      0,
      false
    );
  });

  it('runs project-download command and writes output', async () => {
    const program = createProgram();

    await program.parseAsync([
      'node',
      'cli',
      'project-download',
      '123',
      '--no-skip-existing',
      '--delay',
      '0'
    ]);

    expect(studio.downloadAndSaveProject).toHaveBeenCalledWith(
      path.resolve('project_downloads'),
      123,
      0,
      false
    );
  });
});
