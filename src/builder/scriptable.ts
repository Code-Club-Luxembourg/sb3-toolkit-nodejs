import { createHash } from 'node:crypto';
import type { ScratchAssetIndex } from '../scratch/asset-index';
import type { ScratchBlocks, ScratchSprite, ScratchStage } from '../types';
import type { Block } from './block';
import { BlockRef } from './block-ref';
import { CommentRef } from './comment-ref';
import { Id } from './ids';
import { ListRef, VariableRef } from './refs';

/** A target whose `blocks`/`variables`/`lists` follow the standard shape. */
type ScriptTarget = ScratchSprite | ScratchStage;

export type ScriptFilter = string | readonly string[] | ((ref: BlockRef) => boolean) | undefined;

export type SoundDataFormat = 'wav' | 'mp3';

/**
 * Common script / variable / list / sound / comment operations shared by
 * `Sprite` and `Stage`.
 *
 * Both target kinds wrap a live target entry from the project's `targets`
 * array by reference, so mutations write straight through. Sprite-only setters
 * (position, size, rotation style, …) and stage-only setters (backdrop) live
 * on the subclasses.
 */
export abstract class Scriptable {
  constructor(
    protected readonly target: ScriptTarget,
    protected readonly assets: ScratchAssetIndex
  ) {}

  /** The target's display name (matches `target.name` in the `.sb3`). */
  get name(): string {
    return this.target.name;
  }

  /** Return the live target. */
  data(): ScriptTarget {
    return this.target;
  }

  /**
   * Add a script (a block chain starting at a hat or root block) to this
   * target. Resolves id collisions with existing blocks automatically.
   */
  addScript(root: Block, x = 0, y = 0): this {
    const newBlocks = root.toBlocks(x, y);

    const collisions = Object.keys(newBlocks).filter((id) => id in this.target.blocks);
    if (collisions.length > 0) {
      const idMap = new Map<string, string>();
      for (const oldId of collisions) {
        let newId: string;
        do {
          newId = Id.generate();
        } while (newId in this.target.blocks || newId in newBlocks);
        idMap.set(oldId, newId);
      }
      remapBlockIds(newBlocks, idMap);
    }

    Object.assign(this.target.blocks, newBlocks);
    return this;
  }

  /** Find all non-null blocks with the given opcode. */
  findBlocks(opcode: string): BlockRef[] {
    const result: BlockRef[] = [];
    for (const [id, block] of Object.entries(this.target.blocks)) {
      if (block?.opcode === opcode) {
        result.push(new BlockRef(this.target.blocks, id));
      }
    }
    return result;
  }

  /**
   * Find top-level scripts (hat blocks at the root of a chain).
   *
   * `filter` may be:
   *   - undefined            — every top-level script
   *   - string               — only scripts whose hat opcode equals the string
   *   - readonly string[]    — only scripts whose hat opcode is in the list
   *   - (ref: BlockRef) => boolean — predicate over the hat's BlockRef
   */
  findScripts(filter?: ScriptFilter): BlockRef[] {
    const result: BlockRef[] = [];
    for (const [id, block] of Object.entries(this.target.blocks)) {
      if (!block?.topLevel) continue;
      const ref = new BlockRef(this.target.blocks, id);
      if (matchesFilter(ref, block.opcode, filter)) {
        result.push(ref);
      }
    }
    return result;
  }

  /**
   * Get a reference to a specific block by id. Throws if no block with the
   * given id exists on this target.
   */
  block(id: string): BlockRef {
    const b = this.target.blocks[id];
    if (!b) {
      throw new Error(`Block "${id}" not found on target "${this.target.name}"`);
    }
    return new BlockRef(this.target.blocks, id);
  }

  /** Add a variable to this target and return a `VariableRef`. */
  addVariable(name: string, initialValue: string | number | boolean = ''): VariableRef {
    const id = Id.generate();
    this.target.variables[id] = [name, initialValue];
    return new VariableRef(name, id);
  }

  /** Add a list to this target and return a `ListRef`. */
  addList(name: string): ListRef {
    const id = Id.generate();
    this.target.lists[id] = [name, []];
    return new ListRef(name, id);
  }

  /**
   * Add a sound from raw audio bytes and return its index. `rate` and
   * `sampleCount` are auto-detected from the WAV header when `dataFormat` is
   * `wav` and the values are omitted; for other formats pass them explicitly
   * (defaults: 44100 Hz, 0 samples — `0` is a safe placeholder when unknown).
   * A compressed WAV (e.g. IMA ADPCM) without a `fact` chunk has no derivable
   * sample count, so this throws unless `sampleCount` is passed.
   */
  addSound(
    name: string,
    data: Buffer,
    dataFormat: SoundDataFormat = 'wav',
    rate?: number,
    sampleCount?: number
  ): number {
    const assetId = createHash('md5').update(data).digest('hex');
    const md5ext = `${assetId}.${dataFormat}`;
    this.assets.add(md5ext, data);

    let resolvedRate = rate;
    let resolvedSampleCount = sampleCount;
    if ((resolvedRate === undefined || resolvedSampleCount === undefined) && dataFormat === 'wav') {
      const parsed = parseWavHeader(data);
      if (parsed) {
        resolvedRate ??= parsed.rate;
        resolvedSampleCount ??= parsed.sampleCount;
      }
      const formatTag = parsed?.formatTag;
      if (resolvedSampleCount === undefined && formatTag !== undefined && !UNCOMPRESSED_WAV_FORMATS.has(formatTag)) {
        // Compressed (e.g. IMA ADPCM) without a `fact` chunk: the sample count
        // can't be derived from the byte length, so make the caller supply it.
        throw new Error(
          `Cannot determine the sample count of WAV sound "${name}" (format tag 0x${formatTag.toString(16)}, no fact chunk); pass sampleCount explicitly`
        );
      }
    }

    this.target.sounds.push({
      name,
      dataFormat,
      assetId,
      md5ext,
      rate: resolvedRate ?? 44_100,
      sampleCount: resolvedSampleCount ?? 0
    });

    return this.target.sounds.length - 1;
  }

  /**
   * Add a comment to this target. Pass `blockId` to anchor it to a specific
   * block; leave undefined for a free-floating comment.
   */
  addComment(
    text: string,
    options: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      minimized?: boolean;
      blockId?: string | null;
    } = {}
  ): CommentRef {
    const id = Id.generate();
    const comments = this.target.comments as Record<string, unknown>;
    comments[id] = {
      blockId: options.blockId ?? null,
      x: options.x ?? 0,
      y: options.y ?? 0,
      width: options.width ?? 200,
      height: options.height ?? 200,
      minimized: options.minimized ?? false,
      text
    };
    return new CommentRef(comments, id);
  }

  /** Find comments on this target, optionally filtered by anchor block id. */
  findComments(blockId?: string): CommentRef[] {
    const result: CommentRef[] = [];
    const comments = this.target.comments as Record<string, unknown>;
    for (const [id, comment] of Object.entries(comments)) {
      if (!comment || typeof comment !== 'object') continue;
      if (blockId !== undefined && (comment as { blockId?: unknown }).blockId !== blockId) {
        continue;
      }
      result.push(new CommentRef(comments, id));
    }
    return result;
  }
}

/** WAV format tags whose sample count is `data` length / block align: PCM, IEEE float, extensible. */
const UNCOMPRESSED_WAV_FORMATS: ReadonlySet<number> = new Set([0x0001, 0x0003, 0xfffe]);

function parseWavHeader(data: Buffer): { rate?: number; sampleCount?: number; formatTag?: number } | null {
  if (data.length < 44) return null;
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WAVE') {
    return null;
  }

  // Walk chunks looking for `fmt ` (format, sample rate, frame size), `fact`
  // (sample count of compressed formats) and `data` (length).
  let formatTag: number | undefined;
  let rate: number | undefined;
  let blockAlign: number | undefined;
  let factSampleCount: number | undefined;
  let dataBytes: number | undefined;
  let cursor = 12;
  while (cursor + 8 <= data.length) {
    const chunkId = data.toString('ascii', cursor, cursor + 4);
    const chunkSize = data.readUInt32LE(cursor + 4);
    if (chunkId === 'fmt ' && chunkSize >= 16 && cursor + 8 + 16 <= data.length) {
      formatTag = data.readUInt16LE(cursor + 8);
      rate = data.readUInt32LE(cursor + 8 + 4);
      blockAlign = data.readUInt16LE(cursor + 8 + 12);
    } else if (chunkId === 'fact' && chunkSize >= 4 && cursor + 8 + 4 <= data.length) {
      factSampleCount = data.readUInt32LE(cursor + 8);
    } else if (chunkId === 'data') {
      dataBytes = chunkSize;
    }
    cursor += 8 + chunkSize + (chunkSize % 2);
  }

  const out: { rate?: number; sampleCount?: number; formatTag?: number } = {};
  if (rate && rate > 0) out.rate = rate;
  if (factSampleCount !== undefined) {
    out.sampleCount = factSampleCount;
  } else if (dataBytes !== undefined && formatTag !== undefined && UNCOMPRESSED_WAV_FORMATS.has(formatTag)) {
    if (blockAlign && blockAlign > 0) out.sampleCount = Math.floor(dataBytes / blockAlign);
  }
  if (formatTag !== undefined) out.formatTag = formatTag;
  return Object.keys(out).length > 0 ? out : null;
}

function matchesFilter(ref: BlockRef, opcode: string, filter: ScriptFilter): boolean {
  if (filter === undefined) return true;
  if (typeof filter === 'string') return opcode === filter;
  if (Array.isArray(filter)) return (filter as readonly string[]).includes(opcode);
  return (filter as (r: BlockRef) => boolean)(ref);
}

function remapBlockIds(blocks: ScratchBlocks, idMap: Map<string, string>): void {
  const entries = Object.entries(blocks);

  for (const [oldId] of entries) {
    if (idMap.has(oldId)) {
      Reflect.deleteProperty(blocks, oldId);
    }
  }

  for (const [oldId, block] of entries) {
    if (!block) continue;
    const newId = idMap.get(oldId) ?? oldId;

    if (block.next) {
      const remapped = idMap.get(block.next);
      if (remapped !== undefined) block.next = remapped;
    }
    if (block.parent) {
      const remapped = idMap.get(block.parent);
      if (remapped !== undefined) block.parent = remapped;
    }
    for (const input of Object.values(block.inputs)) {
      if (!Array.isArray(input)) continue;
      if (typeof input[1] === 'string') {
        const remapped = idMap.get(input[1]);
        if (remapped !== undefined) input[1] = remapped;
      }
      if (typeof input[2] === 'string') {
        const remapped = idMap.get(input[2]);
        if (remapped !== undefined) input[2] = remapped;
      }
    }

    blocks[newId] = block;
  }
}
