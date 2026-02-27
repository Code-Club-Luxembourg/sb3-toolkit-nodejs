import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import JSZip from 'jszip';
import { Id } from '../builder/ids';
import { BroadcastRef, ListRef, VariableRef } from '../builder/refs';
import { ScriptLocation } from '../builder/script-location';
import type { ScriptFilter } from '../builder/scriptable';
import { Sprite } from '../builder/sprite';
import { Stage } from '../builder/stage';
import type {
  ScratchBlocks,
  ScratchCostume,
  ScratchInput,
  ScratchInputValue,
  ScratchProjectData,
  ScratchProjectMeta,
  ScratchSound,
  ScratchSprite,
  ScratchStage,
  ScratchTarget
} from '../types';
import { ScratchAssetIndex } from './asset-index';

const BLANK_COSTUME_SVG_TEXT =
  '<svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="-0.5 -0.5 1 1"></svg>';
/** Bytes of an empty 1x1 SVG, reused as a placeholder for missing assets. */
export const BLANK_COSTUME_SVG = Buffer.from(BLANK_COSTUME_SVG_TEXT);
const BLANK_COSTUME_MD5 = createHash('md5').update(BLANK_COSTUME_SVG).digest('hex');
const BLANK_COSTUME_MD5EXT = `${BLANK_COSTUME_MD5}.svg`;

export type CostumeDataFormat = 'svg' | 'png';

export interface SpriteOptions {
  x?: number;
  y?: number;
  size?: number;
  direction?: number;
  visible?: boolean;
  rotationStyle?: 'all around' | 'left-right' | "don't rotate";
  draggable?: boolean;
}

/**
 * Represents a Scratch project (parsed `project.json` plus its asset buffers).
 *
 * Project data is held as a nested structure mirroring the on-disk
 * `project.json`, so load/modify/save round-trips faithfully.
 */
export class ScratchProject {
  private static readonly STAGE_WIDTH = 480;
  private static readonly STAGE_HEIGHT = 360;
  private static readonly ABSOLUTE_COORD_INPUTS: Partial<
    Record<
      string,
      {
        x?: string;
        y?: string;
        xArrayAdjust?: number;
        yArrayAdjust?: number;
        coerceNumber?: boolean;
      }
    >
  > = {
    motion_gotoxy: { x: 'X', y: 'Y', xArrayAdjust: 100, yArrayAdjust: -50, coerceNumber: true },
    motion_glideto: { x: 'X', y: 'Y' },
    motion_glidesecstoxy: { x: 'X', y: 'Y' },
    motion_setx: { x: 'X' },
    motion_sety: { y: 'Y' }
  };

  /** Create a project from parsed `project.json` data and an asset index. */
  constructor(
    public readonly data: ScratchProjectData,
    public readonly assets: ScratchAssetIndex
  ) {}

  /** Load a `.sb3` file from disk into a `ScratchProject`. */
  static async fromSb3File(filePath: string): Promise<ScratchProject> {
    const zip = await JSZip.loadAsync(await fs.readFile(filePath));
    const projectEntry = zip.file('project.json');
    if (!projectEntry) {
      throw new Error(`Missing project.json in ${filePath}`);
    }

    const projectText = await projectEntry.async('text');
    const data = ScratchProject.parseProjectData(projectText);

    const assets = new ScratchAssetIndex();
    const assetFiles = Object.values(zip.files).filter((file) => !file.dir && file.name !== 'project.json');
    for (const file of assetFiles) {
      const buffer = await file.async('nodebuffer');
      assets.add(file.name, buffer);
    }

    return new ScratchProject(data, assets);
  }

  /** Create a new empty project containing only a blank stage. */
  static create(meta: Partial<ScratchProjectMeta> = {}): ScratchProject {
    const assets = new ScratchAssetIndex();
    assets.add(BLANK_COSTUME_MD5EXT, BLANK_COSTUME_SVG);

    const stage: ScratchStage = {
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
          name: 'backdrop1',
          dataFormat: 'svg',
          assetId: BLANK_COSTUME_MD5,
          md5ext: BLANK_COSTUME_MD5EXT,
          rotationCenterX: 240,
          rotationCenterY: 180
        }
      ],
      sounds: [],
      volume: 100,
      layerOrder: 0
    };

    const data: ScratchProjectData = {
      targets: [stage],
      monitors: [],
      extensions: [],
      meta: {
        semver: '3.0.0',
        vm: '0.2.0',
        ...meta
      }
    };

    return new ScratchProject(data, assets);
  }

  /**
   * Add a new sprite with a blank costume. Returns a `Sprite` for further work.
   */
  addSprite(name: string, options: SpriteOptions = {}): Sprite {
    const layerOrder = this.listSprites().length + 1;

    if (!this.assets.has(BLANK_COSTUME_MD5EXT)) {
      this.assets.add(BLANK_COSTUME_MD5EXT, BLANK_COSTUME_SVG);
    }

    const sprite: ScratchSprite = {
      isStage: false,
      name,
      variables: {},
      lists: {},
      broadcasts: {},
      blocks: {},
      comments: {},
      currentCostume: 0,
      costumes: [
        {
          name: 'costume1',
          dataFormat: 'svg',
          assetId: BLANK_COSTUME_MD5,
          md5ext: BLANK_COSTUME_MD5EXT,
          rotationCenterX: 0,
          rotationCenterY: 0
        }
      ],
      sounds: [],
      volume: 100,
      layerOrder,
      visible: options.visible ?? true,
      x: options.x ?? 0,
      y: options.y ?? 0,
      size: options.size ?? 100,
      direction: options.direction ?? 90,
      draggable: options.draggable ?? false,
      rotationStyle: options.rotationStyle ?? 'all around'
    };

    this.data.targets.push(sprite);
    return new Sprite(sprite, this.assets);
  }

  /**
   * Get a `Sprite` for an existing sprite by name. Throws if not found.
   */
  sprite(name: string): Sprite {
    const found = this.listSprites().find((s) => s.name === name);
    if (!found) {
      throw new Error(`Sprite "${name}" not found in project`);
    }
    return new Sprite(found, this.assets);
  }

  /**
   * Get a `Stage` for adding stage-level scripts, backdrops, variables, and
   * lists. The wrapper mutates the same target as `getStage()`.
   */
  stage(): Stage {
    return new Stage(this.getStage(), this.assets);
  }

  /**
   * Iterate every top-level script across the stage and every sprite,
   * yielding `ScriptLocation` tuples of `(target, script)`. `filter` has the
   * same shape as `Scriptable.findScripts()`.
   */
  *findAllScripts(filter?: ScriptFilter): Generator<ScriptLocation> {
    const stage = this.stage();
    for (const script of stage.findScripts(filter)) {
      yield new ScriptLocation(stage, script);
    }
    for (const spriteData of this.listSprites()) {
      const sprite = new Sprite(spriteData, this.assets);
      for (const script of sprite.findScripts(filter)) {
        yield new ScriptLocation(sprite, script);
      }
    }
  }

  /** Set the active backdrop on the stage by its index. */
  setCurrentBackdrop(index: number): this {
    const stage = this.getStage();
    const count = stage.costumes.length;
    if (index < 0 || index >= count) {
      throw new Error(`Backdrop index ${index} is out of range (0..${count - 1})`);
    }
    stage.currentCostume = index;
    return this;
  }

  /** Add a backdrop to the stage from raw image data and return its index. */
  addBackdrop(name: string, data: Buffer, dataFormat: CostumeDataFormat = 'svg'): number {
    const assetId = createHash('md5').update(data).digest('hex');
    const md5ext = `${assetId}.${dataFormat}`;
    this.assets.add(md5ext, data);
    const stage = this.getStage();
    stage.costumes.push({
      name,
      dataFormat,
      assetId,
      md5ext,
      rotationCenterX: 240,
      rotationCenterY: 180
    });
    return stage.costumes.length - 1;
  }

  /** Add a global (stage-level) variable and return a `VariableRef`. */
  addVariable(name: string, initialValue: string | number | boolean = ''): VariableRef {
    const id = Id.generate();
    this.getStage().variables[id] = [name, initialValue];
    return new VariableRef(name, id);
  }

  /** Add a global (stage-level) list and return a `ListRef`. */
  addList(name: string): ListRef {
    const id = Id.generate();
    this.getStage().lists[id] = [name, []];
    return new ListRef(name, id);
  }

  /** Add a broadcast on the stage and return a `BroadcastRef`. */
  addBroadcast(name: string): BroadcastRef {
    const id = Id.generate();
    this.getStage().broadcasts[id] = name;
    return new BroadcastRef(name, id);
  }

  /** Find an existing broadcast by display name, or undefined. */
  findBroadcast(name: string): BroadcastRef | undefined {
    const broadcasts = this.getStage().broadcasts;
    for (const [id, bcastName] of Object.entries(broadcasts)) {
      if (bcastName === name) return new BroadcastRef(name, id);
    }
    return undefined;
  }

  /** List all sprite targets in the project. */
  listSprites(): ScratchSprite[] {
    return this.data.targets.filter((target): target is ScratchSprite => !target.isStage);
  }

  /** Return the stage target, throwing if none exists. */
  getStage(): ScratchStage {
    const stage = this.data.targets.find((target): target is ScratchStage => target.isStage);
    if (!stage) {
      throw new Error('Project has no stage target');
    }
    return stage;
  }

  /** Merge sprites from source projects into a base project. */
  static mergeSprites(
    base: Readonly<ScratchProject>,
    sources: ReadonlyArray<Readonly<ScratchProject>>,
    options?: Readonly<{
      spriteNames?: readonly string[];
      renameStrategy?: (name: string, existing: ReadonlySet<string>) => string;
    }>
  ): ScratchProject {
    const { mergedData, mergedAssets, existingNames } = ScratchProject.initMergedProject(base);
    const rename = options?.renameStrategy ?? ((name: string, existing: ReadonlySet<string>): string => ScratchProject.defaultRenameStrategy(name, existing));
    const filterNames = options?.spriteNames ? new Set(options.spriteNames) : null;

    for (const source of sources) {
      for (const sprite of source.listSprites()) {
        if (filterNames && !filterNames.has(sprite.name)) {
          continue;
        }

        const cloned = structuredClone(sprite);
        if (existingNames.has(cloned.name)) {
          cloned.name = rename(cloned.name, existingNames);
        }
        existingNames.add(cloned.name);

        mergedData.targets.push(cloned);
        ScratchProject.collectAssetsFromTarget(cloned, source, mergedAssets);
      }
    }

    ScratchProject.normalizeLayerOrder(mergedData);

    return new ScratchProject(mergedData, mergedAssets);
  }

  /** Combine projects by placing each project into a grid position. */
  static gridProjects(
    projects: ReadonlyArray<Readonly<ScratchProject>>,
    options: Readonly<{
      columns: number;
      rows?: number;
    }>
  ): ScratchProject {
    if (projects.length === 0) {
      throw new Error('At least one project is required');
    }
    if (!Number.isFinite(options.columns) || options.columns <= 0) {
      throw new Error('Grid columns must be a positive number');
    }

    const columns = Math.floor(options.columns);
    const rows = options.rows !== undefined ? Math.floor(options.rows) : Math.ceil(projects.length / columns);
    if (!Number.isFinite(rows) || rows <= 0) {
      throw new Error('Grid rows must be a positive number');
    }
    if (rows * columns < projects.length) {
      throw new Error('Grid is too small for the number of projects');
    }

    const base = projects[0];
    const { mergedData, mergedAssets, existingNames } = ScratchProject.initMergedProject(base);

    ScratchProject.applyGridOffset(mergedData, ScratchProject.gridOffset(0, columns, rows));

    for (let index = 1; index < projects.length; index += 1) {
      const source = projects[index];
      const offset = ScratchProject.gridOffset(index, columns, rows);

      for (const sprite of source.listSprites()) {
        const cloned = structuredClone(sprite);
        if (existingNames.has(cloned.name)) {
          cloned.name = ScratchProject.defaultRenameStrategy(cloned.name, existingNames);
        }
        existingNames.add(cloned.name);
        ScratchProject.applyOffsetToTarget(cloned, offset.x, offset.y);
        mergedData.targets.push(cloned);
        ScratchProject.collectAssetsFromTarget(cloned, source, mergedAssets);
      }
    }

    ScratchProject.normalizeLayerOrder(mergedData);

    return new ScratchProject(mergedData, mergedAssets);
  }

  /** Compute the total pixel dimensions for a project grid. */
  static gridPixelSize(columns: number, rows: number): { width: number; height: number } {
    return {
      width: columns * ScratchProject.STAGE_WIDTH,
      height: rows * ScratchProject.STAGE_HEIGHT
    };
  }

  /** Serialize the project and assets into a `.sb3` file. */
  async saveToSb3File(filePath: string): Promise<void> {
    const zip = new JSZip();
    zip.file('project.json', JSON.stringify(this.data));

    for (const [md5ext, buffer] of this.assets.entries()) {
      zip.file(md5ext, buffer);
    }

    const outBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.writeFile(filePath, outBuffer);
  }

  /**
   * Run an optimizer over every asset and propagate the resulting hash
   * changes through `project.json`.
   *
   * The callback receives the current md5ext and bytes; whatever it returns
   * becomes the new bytes. When the bytes change, the asset's md5 is
   * recomputed, the file extension is preserved, the asset index is
   * rewritten under the new md5ext, and every costume/sound on every target
   * that referenced the old md5ext is updated (both `md5ext` and `assetId`).
   *
   * Returns a `Map<oldMd5ext, newMd5ext>` of the entries that changed (empty
   * when every asset was returned unchanged).
   *
   * Optimizers MUST preserve the file extension. Changing the format
   * (svg → png) is a conversion, not an optimization, and is out of scope.
   */
  async optimizeAssets(
    callback: (md5ext: string, data: Buffer) => Buffer | Promise<Buffer>
  ): Promise<Map<string, string>> {
    const remap = new Map<string, string>();
    const newBytesByOld = new Map<string, Buffer>();

    for (const [oldMd5ext, oldBytes] of [...this.assets.entries()]) {
      const next = await callback(oldMd5ext, oldBytes);
      if (next === oldBytes || next.equals(oldBytes)) continue;

      const newMd5 = createHash('md5').update(next).digest('hex');
      const extension = extensionOf(oldMd5ext);
      const newMd5ext = extension ? `${newMd5}.${extension}` : newMd5;
      if (newMd5ext === oldMd5ext) continue;

      remap.set(oldMd5ext, newMd5ext);
      newBytesByOld.set(oldMd5ext, next);
    }

    if (remap.size === 0) return remap;

    // Rewrite the asset index: drop the old entries first so two assets
    // optimizing to the same bytes collapse to a single entry.
    for (const oldMd5ext of remap.keys()) {
      this.assets.remove(oldMd5ext);
    }
    for (const [oldMd5ext, newMd5ext] of remap) {
      if (this.assets.has(newMd5ext)) continue;
      const bytes = newBytesByOld.get(oldMd5ext);
      if (bytes) this.assets.add(newMd5ext, bytes);
    }

    // Update references in every target's costumes + sounds.
    for (const target of this.data.targets) {
      for (const asset of [...target.costumes, ...target.sounds]) {
        const newMd5ext = remap.get(asset.md5ext);
        if (newMd5ext !== undefined) {
          asset.md5ext = newMd5ext;
          asset.assetId = stripExtension(newMd5ext);
        }
      }
    }

    return remap;
  }

  /**
   * Remove asset entries that no costume/sound references. Returns the list
   * of md5ext keys that were dropped.
   */
  trimAssets(): string[] {
    const referenced = new Set<string>();
    for (const target of this.data.targets) {
      for (const c of target.costumes) referenced.add(c.md5ext);
      for (const s of target.sounds) referenced.add(s.md5ext);
    }
    const removed: string[] = [];
    for (const [md5ext] of [...this.assets.entries()]) {
      if (!referenced.has(md5ext)) {
        this.assets.remove(md5ext);
        removed.push(md5ext);
      }
    }
    return removed;
  }

  /**
   * Extract a single sprite into a standalone `.sprite3` archive. Only
   * costumes and sounds the sprite references are bundled.
   */
  async extractSprite(name: string, filePath: string): Promise<void> {
    const sprite = this.listSprites().find((s) => s.name === name);
    if (!sprite) {
      throw new Error(`Sprite "${name}" not found in project`);
    }

    const zip = new JSZip();
    zip.file('sprite.json', JSON.stringify(sprite));
    for (const asset of [...sprite.costumes, ...sprite.sounds]) {
      const data = this.assets.get(asset.md5ext);
      if (data) zip.file(asset.md5ext, data);
    }

    const outBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    await fs.writeFile(filePath, outBuffer);
  }

  /**
   * Add a sprite from a `.sprite3` archive into this project. Returns the new
   * `Sprite` wrapper for further work. Bundled assets are added to the
   * project's asset index; name collisions get " (n)" appended.
   */
  async importSprite(filePath: string): Promise<Sprite> {
    const zip = await JSZip.loadAsync(await fs.readFile(filePath));
    const entry = zip.file('sprite.json');
    if (!entry) {
      throw new Error(`Missing sprite.json in ${filePath}`);
    }
    const spriteText = await entry.async('text');
    const sprite = JSON.parse(spriteText) as ScratchSprite;

    const existingNames = new Set(this.data.targets.map((t) => t.name));
    if (existingNames.has(sprite.name)) {
      sprite.name = ScratchProject.defaultRenameStrategy(sprite.name, existingNames);
    }
    sprite.isStage = false;
    sprite.layerOrder = this.listSprites().length + 1;

    for (const file of Object.values(zip.files)) {
      if (file.dir || file.name === 'sprite.json') continue;
      if (!this.assets.has(file.name)) {
        const buf = await file.async('nodebuffer');
        this.assets.add(file.name, buf);
      }
    }

    this.data.targets.push(sprite);
    return new Sprite(sprite, this.assets);
  }

  private static initMergedProject(base: Readonly<ScratchProject>): {
    mergedData: ScratchProjectData;
    mergedAssets: ScratchAssetIndex;
    existingNames: Set<string>;
  } {
    const mergedData = ScratchProject.cloneProjectData(base.data);
    const mergedAssets = new ScratchAssetIndex();

    for (const [md5ext, buffer] of base.assets.entries()) {
      mergedAssets.add(md5ext, buffer);
    }

    const existingNames = new Set(mergedData.targets.map((t) => t.name));

    return { mergedData, mergedAssets, existingNames };
  }

  private static collectAssetsFromTarget(
    target: Readonly<ScratchTarget>,
    source: Readonly<ScratchProject>,
    mergedAssets: Readonly<ScratchAssetIndex>
  ): void {
    const assetRefs: Array<ScratchCostume | ScratchSound> = [...target.costumes, ...target.sounds];

    for (const asset of assetRefs) {
      const md5ext = asset.md5ext;
      if (!mergedAssets.has(md5ext)) {
        const data = ScratchProject.lookupAssetData(md5ext, source);
        mergedAssets.add(md5ext, data);
      }
    }
  }

  private static lookupAssetData(md5ext: string, source: Readonly<ScratchProject>): Buffer {
    const found = source.assets.get(md5ext);
    if (!found) {
      throw new Error(`Missing asset ${md5ext} in source project`);
    }
    return found;
  }

  private static normalizeLayerOrder(data: ScratchProjectData): void {
    const stage = data.targets.find((t): t is ScratchStage => t.isStage);
    const sprites = data.targets
      .map((target, index) => ({ target, index }))
      .filter((entry): entry is { target: ScratchSprite; index: number } => !entry.target.isStage)
      .sort((a, b) => {
        if (a.target.layerOrder === b.target.layerOrder) {
          return a.index - b.index;
        }
        return a.target.layerOrder - b.target.layerOrder;
      })
      .map((entry) => entry.target);

    let order = 1;
    for (const sprite of sprites) {
      sprite.layerOrder = order;
      order += 1;
    }

    if (stage) {
      stage.layerOrder = 0;
    }
  }

  private static gridOffset(index: number, columns: number, rows: number): { x: number; y: number } {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = (column - (columns - 1) / 2) * ScratchProject.STAGE_WIDTH;
    const y = ((rows - 1) / 2 - row) * ScratchProject.STAGE_HEIGHT;
    return { x, y };
  }

  private static applyGridOffset(data: ScratchProjectData, offset: { x: number; y: number }): void {
    for (const target of data.targets) {
      ScratchProject.applyOffsetToTarget(target, offset.x, offset.y);
    }
  }

  private static applyOffsetToTarget(target: ScratchTarget, dx: number, dy: number): void {
    if (!target.isStage) {
      target.x += dx;
      target.y += dy;
    }
    ScratchProject.applyOffsetToBlocks(target.blocks, dx, dy);
  }

  private static applyOffsetToBlocks(blocks: ScratchBlocks, dx: number, dy: number): void {
    for (const block of Object.values(blocks)) {
      if (!block) continue;
      const mapping = ScratchProject.ABSOLUTE_COORD_INPUTS[block.opcode];
      if (!mapping) continue;

      if (mapping.x) {
        ScratchProject.applyOffsetToInput(block.inputs[mapping.x], dx, {
          arrayAdjust: mapping.xArrayAdjust,
          coerceNumber: mapping.coerceNumber
        });
      }
      if (mapping.y) {
        ScratchProject.applyOffsetToInput(block.inputs[mapping.y], dy, {
          arrayAdjust: mapping.yArrayAdjust,
          coerceNumber: mapping.coerceNumber
        });
      }
    }
  }

  private static applyOffsetToInput(
    input: ScratchInput | undefined,
    delta: number,
    options?: { arrayAdjust?: number; coerceNumber?: boolean }
  ): void {
    if (!input) return;
    input[1] = ScratchProject.offsetInputValue(
      input[1],
      delta,
      options?.arrayAdjust ?? 0,
      options?.coerceNumber ?? false
    );
  }

  private static offsetInputValue(
    value: ScratchInputValue,
    delta: number,
    arrayAdjust: number,
    coerceNumber: boolean
  ): ScratchInputValue {
    if (value === null) {
      return value;
    }
    if (typeof value === 'number') {
      return value + delta;
    }
    if (typeof value === 'string') {
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        const updated = numeric + delta;
        return coerceNumber ? updated : String(updated);
      }
      return value;
    }

    if (Array.isArray(value) && value.length >= 2) {
      const [kind, raw, extra] = value;
      const adjustedDelta = delta + arrayAdjust;
      if (typeof raw === 'number') {
        if (value.length === 2 || extra === undefined) {
          return [kind, raw + adjustedDelta];
        }
        return [kind, raw + adjustedDelta, extra];
      }
      if (typeof raw === 'string') {
        const numeric = Number(raw);
        if (!Number.isNaN(numeric)) {
          const updated = numeric + adjustedDelta;
          if (value.length === 2 || extra === undefined) {
            return [kind, coerceNumber ? updated : String(updated)];
          }
          return [kind, coerceNumber ? updated : String(updated), extra];
        }
      }
    }

    return value;
  }

  private static defaultRenameStrategy(name: string, existing: ReadonlySet<string>): string {
    let counter = 2;
    let nextName = `${name} (${counter})`;
    while (existing.has(nextName)) {
      counter += 1;
      nextName = `${name} (${counter})`;
    }
    return nextName;
  }

  private static parseProjectData(projectText: string): ScratchProjectData {
    let parsed: unknown;
    try {
      parsed = JSON.parse(projectText);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse project.json: ${message}`);
    }
    ScratchProject.assertProjectData(parsed);
    return parsed as ScratchProjectData;
  }

  private static cloneProjectData(data: Readonly<ScratchProjectData>): ScratchProjectData {
    return structuredClone(data);
  }

  private static assertProjectData(parsed: unknown): void {
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid project.json (not an object).');
    }
    const root = parsed as { targets?: unknown };
    if (!Array.isArray(root.targets)) {
      throw new Error('Invalid project.json (missing targets array).');
    }
  }
}

function extensionOf(md5ext: string): string {
  const dot = md5ext.lastIndexOf('.');
  return dot === -1 ? '' : md5ext.slice(dot + 1);
}

function stripExtension(md5ext: string): string {
  const dot = md5ext.lastIndexOf('.');
  return dot === -1 ? md5ext : md5ext.slice(0, dot);
}
