import { beforeEach, describe, expect, it, vi } from 'vitest';
import { packProject } from '../src/cli/packager/pack';
import { parsePositiveInt } from '../src/cli/parse';

let lastPackager: { options: Record<string, unknown> } | null = null;

vi.mock('../src/cli/packager/loader', () => {
  class Packager {
    options: Record<string, unknown> = {};
    project: unknown;

    constructor() {
      lastPackager = this;
    }

    async package(): Promise<{ type: string; data: Uint8Array }> {
      return { type: 'text/html', data: new Uint8Array([1, 2, 3]) };
    }
  }

  return {
    loadPackager: () => ({
      Packager,
      loadProject: async () => ({})
    })
  };
});

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn()
}));

describe('packProject', () => {
  beforeEach(async () => {
    lastPackager = null;
    vi.clearAllMocks();
    const fs = await import('node:fs/promises');
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from('sb3'));
    vi.mocked(fs.writeFile).mockResolvedValue(undefined);
  });

  it('writes checksum file and embeds countdown js when enabled', async () => {
    await packProject({
      projectPath: '/tmp/in.sb3',
      outputPath: '/tmp/out.html',
      stageWidth: 480,
      stageHeight: 360,
      autoplay: false,
      countdownSeconds: 5
    });

    const fs = await import('node:fs/promises');
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      '/tmp/out.html.sha256',
      expect.any(String),
      'utf8'
    );
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      '/tmp/out.html',
      expect.any(Uint8Array)
    );

    expect(lastPackager?.options.custom).toBeTruthy();
    const custom = lastPackager?.options.custom as { js?: string } | undefined;
    expect(custom?.js).toContain('out.html.sha256');
  });

  it('writes only the output when countdown is disabled', async () => {
    await packProject({
      projectPath: '/tmp/in.sb3',
      outputPath: '/tmp/out.html',
      stageWidth: 480,
      stageHeight: 360,
      autoplay: true
    });

    const fs = await import('node:fs/promises');
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fs.writeFile)).toHaveBeenCalledWith(
      '/tmp/out.html',
      expect.any(Uint8Array)
    );
  });

  it('rejects non-numeric CLI values for stage width', () => {
    expect(() => parsePositiveInt('bad', 'Stage width')).toThrow(
      'Stage width must be a positive integer.'
    );
  });
});
