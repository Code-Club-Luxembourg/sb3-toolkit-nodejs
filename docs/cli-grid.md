# CLI: grid

Arrange multiple Scratch projects side by side in a grid layout, producing a single combined project.

## Usage

```bash
npm run sb3:grid -- <project1.sb3> <project2.sb3> [project3.sb3 ...] -o <output.sb3> --columns <count>
```

## Options

| Option | Description |
|--------|-------------|
| `-o, --output <file>` | Output `.sb3` file path (required) |
| `--columns <count>` | Number of grid columns (required) |
| `--rows <count>` | Number of grid rows (optional; computed from project count if omitted) |

## Examples

Two projects side by side (1 row × 2 columns):
```bash
npm run sb3:grid -- project1.sb3 project2.sb3 -o out.sb3 --columns 2
```

Four projects in a 2×2 grid:
```bash
npm run sb3:grid -- p1.sb3 p2.sb3 p3.sb3 p4.sb3 -o out.sb3 --columns 2 --rows 2
```

## Output

```
Gridded <N> project(s) into <output.sb3> (<columns>x<rows>, <width>x<height>px)
```

## Notes

- The first project is used as the base: its stage, variables, and broadcasts are preserved.
- Each cell is 480×360 px (one standard Scratch stage); the output `.sb3` keeps the standard stage dimensions.
- Sprite positions (`x`, `y`) are offset into their grid cell.
- Absolute-coordinate blocks (`motion_gotoxy`, `motion_glidesecstoxy`, `motion_setx`, `motion_sety`, `motion_glideto`) are adjusted to match the cell offset.
- Sprite name collisions are resolved by appending ` (2)`, ` (3)`, etc.
- Layer order is normalized after merging.
