import { describe, expect, it, vi } from 'vitest';
import type { ScratchProjectData } from '../src/types';
import * as api from '../src/studio/api';
import {
  DownloadResult,
  JsonDownload,
  RawDownload,
  downloadProject,
  isProjectUpToDate,
  readStoredProjectMetadata,
  writeProject,
  writeProjectMetadata
} from '../src/studio/download';

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  return {
    ...actual,
    readFile: vi.fn(actual.readFile),
    writeFile: vi.fn(actual.writeFile),
    rename: vi.fn(actual.rename),
    unlink: vi.fn(actual.unlink)
  };
});

function createProjectData(): ScratchProjectData {
  return {
    targets: [
      {
        isStage: true,
        name: 'Stage',
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [
          {
            name: 'stage-costume',
            dataFormat: 'svg',
            assetId: 'stage-costume',
            md5ext: 'stage-costume.svg',
            rotationCenterX: 0,
            rotationCenterY: 0
          }
        ],
        sounds: [
          {
            name: 'stage-sound',
            dataFormat: 'wav',
            assetId: 'stage-sound',
            md5ext: 'stage-sound.wav',
            rate: 44100,
            sampleCount: 1
          }
        ],
        volume: 100
      }
    ],
    monitors: [],
    extensions: [],
    meta: {
      semver: '3.0.0',
      vm: '0.2.0'
    }
  };
}

function encodeJson(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value), 'utf-8');
}

describe('studio download helpers', () => {
  it('returns raw sb3 when project download is not json', async () => {
    const metaSpy = vi.spyOn(api, 'requestJson').mockResolvedValueOnce({ project_token: 'token' });
    const bytesSpy = vi
      .spyOn(api, 'requestBytes')
      .mockResolvedValueOnce(Buffer.from([0x50, 0x4b, 0x03, 0x04]));

    const result = await downloadProject(123, 0);

    expect(result).toBeInstanceOf(RawDownload);
    expect((result as RawDownload).sb3).toBeInstanceOf(Buffer);

    metaSpy.mockRestore();
    bytesSpy.mockRestore();
  });

  it('returns project json and assets when download is json', async () => {
    const project = createProjectData();
    const metaSpy = vi.spyOn(api, 'requestJson').mockResolvedValueOnce({ project_token: 'token' });
    const bytesSpy = vi.spyOn(api, 'requestBytes').mockResolvedValueOnce(encodeJson(project));
    const batchSpy = vi.spyOn(api, 'requestBytesBatch').mockResolvedValueOnce(
      new Map([
        ['https://assets.scratch.mit.edu/internalapi/asset/stage-costume.svg/get/', Buffer.from('costume')],
        ['https://assets.scratch.mit.edu/internalapi/asset/stage-sound.wav/get/', Buffer.from('sound')]
      ])
    );

    const result = await downloadProject(999, 0);

    expect(result).toBeInstanceOf(JsonDownload);
    if (result instanceof JsonDownload) {
      expect(result.project.targets.length).toBe(1);
      expect(result.assets.size).toBe(2);
    }

    metaSpy.mockRestore();
    bytesSpy.mockRestore();
    batchSpy.mockRestore();
  });

  it('writes raw sb3 directly when provided', async () => {
    const fs = await import('node:fs/promises');
    const writeSpy = vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const renameSpy = vi.mocked(fs.rename).mockResolvedValue(undefined);

    const output = await writeProject('/tmp', 1, DownloadResult.raw(Buffer.from('sb3')));

    expect(output).toContain('1.sb3');
    expect(writeSpy).toHaveBeenCalled();
    expect(renameSpy).toHaveBeenCalled();
  });

  it('reads stored project metadata when present', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValueOnce(
      JSON.stringify({
        historyModified: '2026-03-15T10:00:00Z',
        downloadedAt: '2026-03-15T10:05:00Z'
      })
    );

    const result = await readStoredProjectMetadata('/tmp', 7);

    expect(result).toEqual({
      historyModified: '2026-03-15T10:00:00Z',
      downloadedAt: '2026-03-15T10:05:00Z'
    });
  });

  it('writes project metadata sidecars from remote modified timestamps', async () => {
    const fs = await import('node:fs/promises');
    vi.mocked(fs.writeFile).mockClear();
    const writeSpy = vi.mocked(fs.writeFile).mockResolvedValue(undefined);
    const renameSpy = vi.mocked(fs.rename).mockResolvedValue(undefined);

    const output = await writeProjectMetadata('/tmp', 7, {
      project_token: 'token-1',
      history: { modified: '2026-03-15T10:00:00Z' }
    });

    expect(output).toContain('7.meta.json');
    expect(writeSpy).toHaveBeenCalled();
    const [, written] = writeSpy.mock.calls[0];
    expect(String(written)).toContain('"historyModified": "2026-03-15T10:00:00Z"');
    expect(String(written)).not.toContain('projectToken');
    expect(renameSpy).toHaveBeenCalled();
  });

  it('treats equal remote modified timestamps as up to date', () => {
    expect(
      isProjectUpToDate(
        { historyModified: '2026-03-15T10:00:00Z', downloadedAt: '2026-03-15T10:05:00Z' },
        { project_token: 'token-1', history: { modified: '2026-03-15T10:00:00Z' } }
      )
    ).toBe(true);
  });

  it('treats newer remote modified timestamps as changed', () => {
    expect(
      isProjectUpToDate(
        { historyModified: '2026-03-15T10:00:00Z', downloadedAt: '2026-03-15T10:05:00Z' },
        { project_token: 'token-1', history: { modified: '2026-03-15T10:06:00Z' } }
      )
    ).toBe(false);
  });

  it('ignores project_token rotation (tokens are not used as a freshness signal)', () => {
    expect(
      isProjectUpToDate(
        { historyModified: '2026-03-15T10:00:00Z', downloadedAt: '2026-03-15T10:05:00Z' },
        { project_token: 'token-2', history: { modified: '2026-03-15T10:00:00Z' } }
      )
    ).toBe(true);
  });

  it('treats missing remote modified timestamp as out-of-date', () => {
    expect(
      isProjectUpToDate(
        { historyModified: '2026-03-15T10:00:00Z', downloadedAt: '2026-03-15T10:05:00Z' },
        { project_token: 'token-1' }
      )
    ).toBe(false);
  });
});
