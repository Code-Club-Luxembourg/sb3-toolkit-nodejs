import type { ScratchProjectData, ScratchTarget } from '../../types';
import { ErrorCode, type ErrorCode as ErrorCodeType, ValidationError, ValidationPath, type ValidationSeverity } from '../errors';

const VALID_ROTATION_STYLES = new Set(['all around', 'left-right', "don't rotate"]);
const VALID_VIDEO_STATES = new Set(['on', 'off', 'on-flipped']);
const VALID_COSTUME_FORMATS = new Set(['svg', 'png', 'jpg', 'jpeg', 'bmp', 'gif']);
const VALID_SOUND_FORMATS = new Set(['wav', 'wave', 'mp3']);
const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function error(
  code: ErrorCodeType,
  path: string,
  targetIndex: number | null,
  message: string,
  severity: ValidationSeverity = 'error'
): ValidationError {
  return new ValidationError(code, new ValidationPath(path, targetIndex), message, severity);
}

export function validateStructure(data: ScratchProjectData, errors: ValidationError[]): void {
  if (!Array.isArray(data.targets) || data.targets.length === 0) {
    errors.push(error(ErrorCode.MISSING_FIELD, 'targets', null, 'targets must be a non-empty array'));
    return;
  }

  const rawMeta = (data as unknown as Record<string, unknown>).meta as Record<string, unknown> | undefined;
  if (typeof rawMeta?.semver !== 'string' || !SEMVER_RE.test(rawMeta.semver)) {
    errors.push(
      error(
        ErrorCode.WRONG_TYPE,
        'meta.semver',
        null,
        'meta.semver must be a semver string (e.g. "3.0.0")',
        'warning'
      )
    );
  }

  const stageCount = data.targets.filter((t) => t.isStage).length;
  if (stageCount === 0) {
    errors.push(error(ErrorCode.MISSING_STAGE, 'targets', null, 'Project must have exactly one stage target'));
  } else if (stageCount > 1) {
    errors.push(
      error(ErrorCode.DUPLICATE_STAGE, 'targets', null, `Project has ${stageCount} stage targets; expected exactly one`)
    );
  }

  for (let i = 0; i < data.targets.length; i += 1) {
    validateTarget(data.targets[i], i, `targets[${i}]`, errors);
  }
}

function validateTarget(target: ScratchTarget, targetIndex: number, path: string, errors: ValidationError[]): void {
  if (typeof target.name !== 'string' || target.name.length === 0) {
    errors.push(error(ErrorCode.MISSING_FIELD, `${path}.name`, targetIndex, 'Target name must be a non-empty string'));
  }

  for (const field of ['variables', 'lists', 'broadcasts', 'blocks', 'comments'] as const) {
    if (typeof target[field] !== 'object' || (target[field] as unknown) === null) {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.${field}`, targetIndex, `${field} must be an object`));
    }
  }

  if (typeof target.volume !== 'number') {
    errors.push(error(ErrorCode.WRONG_TYPE, `${path}.volume`, targetIndex, 'volume must be a number'));
  }

  if (!Array.isArray(target.costumes)) {
    errors.push(error(ErrorCode.WRONG_TYPE, `${path}.costumes`, targetIndex, 'costumes must be an array'));
  } else {
    if (target.costumes.length === 0) {
      errors.push(
        error(ErrorCode.MISSING_FIELD, `${path}.costumes`, targetIndex, 'Target must have at least one costume')
      );
    } else {
      if (target.currentCostume < 0 || target.currentCostume >= target.costumes.length) {
        errors.push(
          error(
            ErrorCode.WRONG_TYPE,
            `${path}.currentCostume`,
            targetIndex,
            `currentCostume ${target.currentCostume} is out of range (0..${target.costumes.length - 1})`
          )
        );
      }
    }
    for (let i = 0; i < target.costumes.length; i += 1) {
      validateAssetEntry(
        target.costumes[i],
        'Costume',
        `${path}.costumes[${i}]`,
        targetIndex,
        VALID_COSTUME_FORMATS,
        ['rotationCenterX', 'rotationCenterY'],
        false,
        errors
      );
    }
  }

  if (!Array.isArray(target.sounds)) {
    errors.push(error(ErrorCode.WRONG_TYPE, `${path}.sounds`, targetIndex, 'sounds must be an array'));
  } else {
    for (let i = 0; i < target.sounds.length; i += 1) {
      validateAssetEntry(
        target.sounds[i],
        'Sound',
        `${path}.sounds[${i}]`,
        targetIndex,
        VALID_SOUND_FORMATS,
        ['rate', 'sampleCount'],
        true,
        errors
      );
    }
  }

  if (target.videoState !== undefined && !VALID_VIDEO_STATES.has(target.videoState)) {
    errors.push(
      error(ErrorCode.WRONG_TYPE, `${path}.videoState`, targetIndex, 'videoState must be one of: on, off, on-flipped')
    );
  }

  if (!target.isStage) {
    if (!Number.isFinite(target.x)) {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.x`, targetIndex, 'x must be a finite number'));
    }
    if (!Number.isFinite(target.y)) {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.y`, targetIndex, 'y must be a finite number'));
    }
    if (!Number.isFinite(target.size)) {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.size`, targetIndex, 'size must be a finite number'));
    }
    if (!Number.isFinite(target.direction)) {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.direction`, targetIndex, 'direction must be a finite number'));
    }
    if (typeof target.visible !== 'boolean') {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.visible`, targetIndex, 'visible must be a boolean'));
    }
    if (!Number.isInteger(target.layerOrder) || target.layerOrder < 0) {
      errors.push(
        error(ErrorCode.WRONG_TYPE, `${path}.layerOrder`, targetIndex, 'layerOrder must be a non-negative integer')
      );
    }
    if (!VALID_ROTATION_STYLES.has(target.rotationStyle)) {
      errors.push(
        error(
          ErrorCode.WRONG_TYPE,
          `${path}.rotationStyle`,
          targetIndex,
          `rotationStyle must be one of: "all around", "left-right", "don't rotate"`
        )
      );
    }
  }
}

function validateAssetEntry(
  entry: unknown,
  kind: 'Costume' | 'Sound',
  path: string,
  targetIndex: number,
  validFormats: ReadonlySet<string>,
  numberFields: readonly string[],
  requireNonNegativeNumbers: boolean,
  errors: ValidationError[]
): void {
  if (!entry || typeof entry !== 'object') {
    errors.push(error(ErrorCode.WRONG_TYPE, path, targetIndex, `${kind} must be an object`));
    return;
  }
  const c = entry as Record<string, unknown>;
  for (const field of ['name', 'assetId', 'md5ext', 'dataFormat']) {
    if (typeof c[field] !== 'string') {
      errors.push(error(ErrorCode.MISSING_FIELD, `${path}.${field}`, targetIndex, `${kind} ${field} must be a string`));
    }
  }
  const dataFormat = c.dataFormat;
  if (typeof dataFormat === 'string' && !validFormats.has(dataFormat.toLowerCase())) {
    errors.push(
      error(
        ErrorCode.WRONG_TYPE,
        `${path}.dataFormat`,
        targetIndex,
        `${kind} dataFormat "${dataFormat}" must be one of: ${[...validFormats].join(', ')}`
      )
    );
  }
  for (const field of numberFields) {
    const value = c[field];
    if (typeof value !== 'number') {
      errors.push(error(ErrorCode.MISSING_FIELD, `${path}.${field}`, targetIndex, `${kind} ${field} must be a number`));
    } else if (requireNonNegativeNumbers && value < 0) {
      errors.push(error(ErrorCode.WRONG_TYPE, `${path}.${field}`, targetIndex, `${kind} ${field} must be non-negative`));
    }
  }
}
