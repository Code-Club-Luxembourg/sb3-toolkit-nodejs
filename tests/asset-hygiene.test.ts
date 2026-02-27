import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Events, ScratchProject } from '../src/model';

describe('asset hygiene', () => {
  const tempPaths: string[] = [];

  afterEach(async () => {
    while (tempPaths.length > 0) {
      const f = tempPaths.pop()!;
      await fs.unlink(f).catch(() => undefined);
    }
  });

  async function tempPath(suffix = '.sb3'): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scratch-tools-'));
    const file = path.join(dir, `out${suffix}`);
    tempPaths.push(file);
    return file;
  }

  it('trimAssets removes unreferenced entries', () => {
    const project = ScratchProject.create();
    project.addSprite('Cat');
    project.assets.add('orphan.svg', Buffer.from('<svg/>'));

    const before = project.assets.size;
    const removed = project.trimAssets();
    expect(removed).toEqual(['orphan.svg']);
    expect(project.assets.has('orphan.svg')).toBe(false);
    expect(project.assets.size).toBe(before - 1);
  });

  it('trimAssets keeps referenced entries', () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addCostume('extra', Buffer.from('<svg viewBox="0 0 1 1"/>'));
    const before = project.assets.size;
    expect(project.trimAssets()).toEqual([]);
    expect(project.assets.size).toBe(before);
  });

  it('extract + import sprite round-trip', async () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addScript(Events.whenFlagClicked());
    cat.addCostume('extra', Buffer.from('<svg viewBox="0 0 1 1"/>'));

    const spritePath = await tempPath('.sprite3');
    await project.extractSprite('Cat', spritePath);

    const target = ScratchProject.create();
    const imported = await target.importSprite(spritePath);
    expect(imported.name).toBe('Cat');

    const costumes = imported.data().costumes;
    const extra = costumes.find((c) => c.name === 'extra');
    expect(extra).toBeDefined();
    expect(target.assets.has(extra!.md5ext)).toBe(true);
  });

  it('import renames on collision', async () => {
    const project = ScratchProject.create();
    project.addSprite('Cat');
    project.addSprite('Cat (2)');

    const source = ScratchProject.create();
    source.addSprite('Cat');
    const spritePath = await tempPath('.sprite3');
    await source.extractSprite('Cat', spritePath);

    const imported = await project.importSprite(spritePath);
    expect(imported.name).toBe('Cat (3)');
  });

  it('extract missing sprite throws', async () => {
    const project = ScratchProject.create();
    await expect(project.extractSprite('Nonexistent', await tempPath('.sprite3'))).rejects.toThrow();
  });

  it('optimizeAssets runs callback on every entry', async () => {
    const project = ScratchProject.create();
    project.addSprite('Cat');
    const seen: string[] = [];
    const remap = await project.optimizeAssets((md5ext, data) => {
      seen.push(md5ext);
      return data; // identity: no remap
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(remap.size).toBe(0);
  });

  it('optimizeAssets rehashes changed bytes and updates references', async () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    const oldMd5ext = cat.data().costumes[0].md5ext;

    const remap = await project.optimizeAssets(() => Buffer.from('<svg viewBox="0 0 1 1"/>'));

    expect(remap.has(oldMd5ext)).toBe(true);
    const newMd5ext = remap.get(oldMd5ext)!;
    expect(newMd5ext).not.toBe(oldMd5ext);
    expect(newMd5ext.endsWith('.svg')).toBe(true);

    expect(project.assets.has(newMd5ext)).toBe(true);
    expect(project.assets.has(oldMd5ext)).toBe(false);

    for (const target of project.data.targets) {
      for (const costume of target.costumes) {
        expect(costume.md5ext).toBe(newMd5ext);
        expect(costume.assetId).toBe(newMd5ext.slice(0, -4));
      }
    }
  });

  it('optimizeAssets skips identity returns', async () => {
    const project = ScratchProject.create();
    project.addSprite('Cat');
    const remap = await project.optimizeAssets((_md5ext, data) => data);
    expect(remap.size).toBe(0);
  });

  it('optimizeAssets collapses identical outputs to one entry', async () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addCostume('extra', Buffer.from('<svg/>'));
    expect(project.assets.size).toBeGreaterThanOrEqual(2);

    await project.optimizeAssets(() => Buffer.from('<svg viewBox="0 0 1 1"/>'));
    expect(project.assets.size).toBe(1);
  });

  it('optimizeAssets preserves the file extension', async () => {
    const project = ScratchProject.create();
    const cat = project.addSprite('Cat');
    cat.addCostume('pngOne', Buffer.from('pngbytes'), 'png');

    const pngKey = [...project.assets.entries()].map(([k]) => k).find((k) => k.endsWith('.png'))!;
    expect(pngKey).toBeDefined();

    const remap = await project.optimizeAssets((md5ext, data) =>
      md5ext.endsWith('.png') ? Buffer.from('newpng') : data
    );
    expect(remap.get(pngKey)?.endsWith('.png')).toBe(true);
  });
});
