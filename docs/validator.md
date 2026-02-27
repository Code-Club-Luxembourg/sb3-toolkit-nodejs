# Scratch Validator

`ScratchValidator` validates a `ScratchProject` and returns structured error
messages. Designed for validating AI-generated Scratch code before use, with
typed errors so consumers can filter by code or by block.

## Basic usage

```typescript
import { ScratchProject, ScratchValidator } from './src/model';

const project = await ScratchProject.fromSb3File('project.sb3');
const result = ScratchValidator.validate(project);

if (result.isValid) {
  console.log('Project is valid');
} else {
  for (const error of result.errors) {
    console.log(`[${error.severity}] ${error.code} at ${error.path}: ${error.message}`);
  }
}
```

## `ValidationResult` and `ValidationError`

```typescript
class ValidationResult {
  isValid: boolean;                     // true iff no 'error'-severity issues
  errors: readonly ValidationError[];
}

class ValidationError {
  code: ErrorCode;                      // one of the ErrorCode string constants
  path: ValidationPath;                 // stringable; carries targetIndex + blockId
  message: string;
  severity: 'error' | 'warning';
}

class ValidationPath {
  path: string;                         // dot-notation, e.g. "targets[1].blocks.abc.inputs.STEPS"
  targetIndex: number | null;           // null for project-level paths (meta, targets)
  blockId: string | null;               // when the finding is inside a block
  toString(): string;                   // returns `path` — template-literal friendly
}
```

`isValid` is `true` only when there are zero `severity: 'error'` entries.
Warnings are informational and do not affect validity.

### Filtering findings

Because `code` is a string-typed `ErrorCode` and `path` carries structured
fields, you can filter without parsing the path string:

```typescript
import { ErrorCode } from './src/model';

// Only errors on a specific sprite (target index 2):
const onSprite = result.errors.filter((e) => e.path.targetIndex === 2);

// Findings inside one specific block:
const onBlock = result.errors.filter((e) => e.path.blockId === 'abc123');

// Treat a specific code as something you handle yourself:
const others = result.errors.filter((e) => e.code !== ErrorCode.TOPLEVEL_NO_COORDS);
```

## Constructor options

```typescript
const validator = new ScratchValidator({
  assets?: ScratchAssetIndex,    // when set, checks costume/sound md5ext presence
  strictOpcodes?: boolean,       // default false: unknown opcodes are warnings; true makes them errors
  registry?: OpcodeRegistry,     // override the built-in opcode registry
  rules?: Rule[],                // extra user-supplied rules
});

const result = validator.run(project);

// One-off static call:
const result = ScratchValidator.validate(project, { strictOpcodes: true });
```

## Custom validation rules

Implement the `Rule` interface to add project-wide checks. User rules run
after the built-ins and produce `ValidationError`s as a stream (any iterable,
so generators work):

```typescript
import { ScratchValidator, ValidationError, ValidationPath, ErrorCode, type Rule } from './src/model';

class NoEmptySpritesRule implements Rule {
  *validate(project) {
    for (const [i, sprite] of project.listSprites().entries()) {
      if (Object.keys(sprite.blocks).length === 0) {
        yield new ValidationError(
          ErrorCode.MISSING_FIELD,
          new ValidationPath(`targets[${i + 1}].blocks`, i + 1),
          `Sprite "${sprite.name}" has no scripts`,
          'warning'
        );
      }
    }
  }
}

// Either via withRule:
const validator = new ScratchValidator().withRule(new NoEmptySpritesRule());

// Or via the constructor:
const validator = new ScratchValidator({ rules: [new NoEmptySpritesRule()] });
```

## Validation rules (built-in)

### Structural (`MISSING_FIELD`, `WRONG_TYPE`, `MISSING_STAGE`, `DUPLICATE_STAGE`)

- Project must have exactly one `isStage: true` target.
- Each target must have non-empty `name`, and correct-type `variables`, `lists`, `broadcasts`, `blocks`, `comments`, `costumes`, `sounds`, `volume`.
- Each costume must have `name`, `assetId`, `md5ext`, `dataFormat` as strings plus numeric `rotationCenterX`/`Y`.
- Each sound must have `name`, `assetId`, `md5ext`, `dataFormat` as strings plus non-negative numeric `rate` and `sampleCount`.
- Sprites must have finite numeric `x`, `y`, `size`, `direction`; boolean `visible`; positive integer `layerOrder`; and a valid `rotationStyle`.

### Block graph (`DANGLING_NEXT`, `DANGLING_PARENT`, `INCONSISTENT_NEXT_PARENT`, `BLOCK_CYCLE`, `DANGLING_INPUT_REF`)

- `block.next` and `block.parent` must reference IDs that exist in the same `blocks` map.
- If `A.next = B` then `B.parent` must equal `A`.
- No cycles in `next`-chains.
- Input slots that reference other blocks (kinds 2 and 3) must point at existing block IDs.
- Null block entries (`blocks[id] = null`) are allowed and skipped.

### Opcode registry (`UNKNOWN_OPCODE`, `MISSING_INPUT`, `MISSING_FIELD_VALUE`)

- Block opcodes are checked against the built-in registry (motion, looks, sound, events, control, sensing, operators, data, procedures, pen — including the internal menu opcodes referenced by the typed builder).
- Unknown opcodes produce a `warning` by default, or an `error` with `strictOpcodes: true`.
- Required inputs and fields for known opcodes must be present.
- `procedures_call` inputs are not checked against the registry (they come from `mutation.argumentids`).

### Asset references (`MISSING_ASSET`)

Only checked when `assets` is passed in options. Each costume and sound `md5ext` must be present in the asset index.

### Variable/list references (`DANGLING_VARIABLE_REF`, `DANGLING_LIST_REF`)

For data blocks (`data_setvariableto`, `data_addtolist`, etc.), the variable/list ID in the block's field must exist on the target sprite or the stage (stage variables and lists are global).

### Warnings only (`TOPLEVEL_NO_COORDS`, `SHADOW_NO_PARENT`)

- Top-level blocks without `x`/`y` coordinates produce a warning.
- Shadow blocks without a parent produce a warning.

## Error codes reference

| Code | Severity | Description |
|------|----------|-------------|
| `MISSING_FIELD` | error | Required field absent or wrong type |
| `WRONG_TYPE` | error | Field present but wrong type |
| `MISSING_STAGE` | error | No stage target found |
| `DUPLICATE_STAGE` | error | More than one `isStage: true` target |
| `UNKNOWN_OPCODE` | warning/error | Opcode not in registry |
| `MISSING_INPUT` | error | Required input for opcode absent |
| `MISSING_FIELD_VALUE` | error | Required field for opcode absent |
| `DANGLING_NEXT` | error | `next` points to non-existent ID |
| `DANGLING_INPUT_REF` | error | Input block reference points to non-existent ID |
| `DANGLING_PARENT` | error | `parent` points to non-existent ID |
| `INCONSISTENT_NEXT_PARENT` | error | `A.next = B` but `B.parent ≠ A` |
| `BLOCK_CYCLE` | error | Cycle detected in `next`-chain |
| `MISSING_ASSET` | error | Costume/sound `md5ext` not in asset index |
| `DANGLING_VARIABLE_REF` | error | Variable ID referenced in block not defined |
| `DANGLING_LIST_REF` | error | List ID referenced in block not defined |
| `TOPLEVEL_NO_COORDS` | warning | Top-level block missing `x`/`y` |
| `SHADOW_NO_PARENT` | warning | Shadow block has no parent |

## Custom opcode registry

To validate a project that uses extension blocks or custom opcodes:

```typescript
import { DEFAULT_OPCODE_REGISTRY, ScratchValidator } from './src/model';
import type { OpcodeRegistry } from './src/model';

const customRegistry: OpcodeRegistry = new Map([
  ...DEFAULT_OPCODE_REGISTRY,
  ['myextension_doSomething', { requiredInputs: ['VALUE'], requiredFields: [] }]
]);

const result = ScratchValidator.validate(project, { registry: customRegistry });
```

## Validating asset references

```typescript
const project = await ScratchProject.fromSb3File('project.sb3');
const result = ScratchValidator.validate(project, { assets: project.assets });
```

Passing `assets: project.assets` enables the check that every costume/sound
referenced in the project JSON is actually present as an asset in the zip.
