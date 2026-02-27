export { ScratchAssetIndex } from './scratch/asset-index';
export { ScratchProject } from './scratch/project';
export type { CostumeDataFormat, SpriteOptions } from './scratch/project';
export { resolvePaths } from './scratch/paths';

export { ScratchValidator } from './validator/validator';
export type { ValidatorOptions } from './validator/validator';
export {
  ErrorCode,
  ValidationError,
  ValidationPath,
  ValidationResult
} from './validator/errors';
export type { ValidationSeverity } from './validator/errors';
export type { Rule } from './validator/rules/rule';
export { DEFAULT_OPCODE_REGISTRY, OPCODE_METADATA } from './validator/opcodes';
export type { OpcodeRegistry, OpcodeSpec, ScratchOpcode, OpcodeInputKeys, OpcodeMetadata } from './validator/opcodes';

// Builder API
export { Block } from './builder/block';
export type { RawInputValue } from './builder/block';
export { BlockRef } from './builder/block-ref';
export { CommentRef } from './builder/comment-ref';
export { Input, INPUT_SHADOW, INPUT_NO_SHADOW, INPUT_BLOCK_AND_SHADOW } from './builder/input';
export type { InputSlot, InputTuple } from './builder/input';
export { Procedure } from './builder/procedure';
export type { ProcedureArg, ProcedureArgKind } from './builder/procedure';
export { Scriptable } from './builder/scriptable';
export type { ScriptFilter, SoundDataFormat } from './builder/scriptable';
export { ScriptLocation } from './builder/script-location';
export { Sprite } from './builder/sprite';
export { Stage } from './builder/stage';
export { Id, generateId } from './builder/ids';
export { VariableRef, ListRef, BroadcastRef } from './builder/refs';

// Typed per-block factories
export { Control, Data, Events, Looks, Motion, Operators, Pen, Sensing, Sound } from './builder/blocks';

// Field enums
export {
  CurrentMenu,
  DragMode,
  ForwardBackward,
  FrontBack,
  GraphicEffect,
  GreaterThanMenu,
  Key,
  MathOp,
  NumberName,
  RotationStyle,
  SoundEffect,
  StopOption
} from './builder/field';
