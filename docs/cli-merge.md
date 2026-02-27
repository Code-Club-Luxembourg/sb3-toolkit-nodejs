# CLI: merge

Merge sprites from one or more source projects into a base project.

## Usage

```bash
npm run sb3:merge -- <base.sb3> <source1.sb3> [source2.sb3 ...] -o <output.sb3>
```

## Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output `.sb3` file path (required) |
| `-s, --sprites <names>` | Comma-separated list of sprite names to merge (default: all sprites) |

## Examples

Merge all sprites from `cat2.sb3` into `cat1.sb3`:
```bash
npm run sb3:merge -- cat1.sb3 cat2.sb3 -o out.sb3
```

Merge only the `Cat` and `Dog` sprites:
```bash
npm run sb3:merge -- cat1.sb3 cat2.sb3 -o out.sb3 -s Cat,Dog
```

Merge from multiple sources:
```bash
npm run sb3:merge -- base.sb3 source1.sb3 source2.sb3 -o merged.sb3
```

## Output

```
Merged <N> project(s) into <base.sb3> (output: <output.sb3>)
```

## Notes

- The base project's stage (backdrop, variables, broadcasts) is preserved.
- Sprites are taken from source projects only; the base project's own sprites are kept as-is.
- Sprite name collisions are resolved by appending ` (2)`, ` (3)`, etc.
- Costume and sound assets required by merged sprites are copied automatically.
- Layer order is normalized after merging: stage is layer 0, sprites increment from 1.
