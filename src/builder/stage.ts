import { createHash } from 'node:crypto';
import type { ScratchStage } from '../types';
import { Scriptable } from './scriptable';
import type { CostumeDataFormat } from './sprite';

/**
 * A reference to the stage target, for adding stage scripts, backdrops and
 * global variables/lists. Mutations write through to the live project.
 *
 * Shared script/variable/list operations live on `Scriptable`; this class adds
 * backdrop support. The convenience methods on `ScratchProject`
 * (`addBackdrop`, `setCurrentBackdrop`, `addVariable`, `addList`) continue to
 * work and delegate to a `Stage` under the hood.
 */
export class Stage extends Scriptable {
  /** The live stage target (narrowed return). */
  override data(): ScratchStage {
    return this.target as ScratchStage;
  }

  /** Set the active backdrop by index. Throws when out of range. */
  setCurrentBackdrop(index: number): this {
    const stage = this.data();
    const count = stage.costumes.length;
    if (index < 0 || index >= count) {
      throw new Error(`Backdrop index ${index} is out of range (0..${count - 1})`);
    }
    stage.currentCostume = index;
    return this;
  }

  /** Add a backdrop from raw image data and return its index. */
  addBackdrop(name: string, data: Buffer, dataFormat: CostumeDataFormat = 'svg'): number {
    const assetId = createHash('md5').update(data).digest('hex');
    const md5ext = `${assetId}.${dataFormat}`;
    this.assets.add(md5ext, data);
    const stage = this.data();
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
}
