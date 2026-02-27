import type { ScratchTarget } from '../../types';
import type { ScratchAssetIndex } from '../../scratch/asset-index';
import { ErrorCode, ValidationError, ValidationPath } from '../errors';

export function validateAssets(
  target: ScratchTarget,
  targetIndex: number,
  targetPath: string,
  assets: ScratchAssetIndex,
  errors: ValidationError[]
): void {
  for (let i = 0; i < target.costumes.length; i += 1) {
    const costume = target.costumes[i];
    if (!assets.has(costume.md5ext)) {
      errors.push(
        new ValidationError(
          ErrorCode.MISSING_ASSET,
          new ValidationPath(`${targetPath}.costumes[${i}].md5ext`, targetIndex),
          `Costume asset "${costume.md5ext}" not found in asset index`
        )
      );
    }
  }

  for (let i = 0; i < target.sounds.length; i += 1) {
    const sound = target.sounds[i];
    if (!assets.has(sound.md5ext)) {
      errors.push(
        new ValidationError(
          ErrorCode.MISSING_ASSET,
          new ValidationPath(`${targetPath}.sounds[${i}].md5ext`, targetIndex),
          `Sound asset "${sound.md5ext}" not found in asset index`
        )
      );
    }
  }
}
