import { createHash } from 'node:crypto';
import type { ScratchSprite } from '../types';
import type { ScratchAssetIndex } from '../scratch/asset-index';
import type { RotationStyle } from './field/rotation-style';
import { Scriptable } from './scriptable';

export type CostumeDataFormat = 'svg' | 'png';

function registerCostumeAsset(
  assets: ScratchAssetIndex,
  data: Buffer,
  dataFormat: CostumeDataFormat
): { assetId: string; md5ext: string } {
  const assetId = createHash('md5').update(data).digest('hex');
  const md5ext = `${assetId}.${dataFormat}`;
  assets.add(md5ext, data);
  return { assetId, md5ext };
}

/**
 * A reference to a sprite target, for adding scripts, costumes and variables
 * and for querying its blocks. Mutations write through to the live project.
 *
 * Shared script/variable/list operations live on `Scriptable`; this class adds
 * the sprite-only setters and costume support.
 */
export class Sprite extends Scriptable {
  /** The live sprite target (narrowed return). */
  override data(): ScratchSprite {
    return this.target as ScratchSprite;
  }

  /** Set the active costume by index. Throws when out of range. */
  setCurrentCostume(index: number): this {
    const sprite = this.data();
    const count = sprite.costumes.length;
    if (index < 0 || index >= count) {
      throw new Error(
        `Costume index ${index} is out of range (0..${count - 1}) on sprite "${sprite.name}"`
      );
    }
    sprite.currentCostume = index;
    return this;
  }

  setPosition(x: number, y: number): this {
    const sprite = this.data();
    sprite.x = x;
    sprite.y = y;
    return this;
  }

  setSize(size: number): this {
    this.data().size = size;
    return this;
  }

  setDirection(direction: number): this {
    this.data().direction = direction;
    return this;
  }

  setVisible(visible: boolean): this {
    this.data().visible = visible;
    return this;
  }

  setDraggable(draggable: boolean): this {
    this.data().draggable = draggable;
    return this;
  }

  setRotationStyle(style: RotationStyle): this {
    this.data().rotationStyle = style;
    return this;
  }

  setVolume(volume: number): this {
    this.data().volume = volume;
    return this;
  }

  /** Add a costume from raw image data and return its index. */
  addCostume(name: string, data: Buffer, dataFormat: CostumeDataFormat = 'svg'): number {
    const { assetId, md5ext } = registerCostumeAsset(this.assets, data, dataFormat);
    const sprite = this.data();
    sprite.costumes.push({
      name,
      dataFormat,
      assetId,
      md5ext,
      rotationCenterX: 0,
      rotationCenterY: 0
    });
    return sprite.costumes.length - 1;
  }
}
