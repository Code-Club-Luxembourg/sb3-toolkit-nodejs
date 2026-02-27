# sb3-toolkit-nodejs

Node.js / TypeScript toolkit for working with Scratch `.sb3` projects. It is a
**library first** — the programmatic API is the product, and a CLI ships as an
optional convenience on top.

- **Builder API** — create projects programmatically with typed per-block factories, build block scripts, and query/modify existing blocks
- **Validator** — check a project for structural and semantic errors, with precise error messages and a pluggable custom-rule interface
- **CLI tools** *(optional)* — merge sprites, arrange projects in a grid, package to HTML, download from Scratch

The package is written in TypeScript and ships compiled JavaScript plus type
declarations, so it is consumable from both TypeScript and plain JavaScript. The
core (`ScratchProject`, `ScratchValidator`, the builder) reads and writes `.sb3`
archives with [JSZip](https://stuk.github.io/jszip/); the CLI is layered on top
via [Commander](https://github.com/tj/commander.js) and the `pack` command uses
the [TurboWarp Packager](https://packager.turbowarp.org/).

## Requirements
- Node.js 20+ (the repo pins Node 22 via `.nvmrc`)
- npm
- nvm is recommended to manage Node versions

## Install

### As a dependency

```bash
npm install @code-club-luxembourg/sb3-toolkit
```

The package is published under the `@code-club-luxembourg` scope. If you install
it straight from git instead, the `prepare` script compiles `dist/` for you on
install:

```bash
npm install github:Code-Club-Luxembourg/sb3-toolkit-nodejs
```

Everything is re-exported from the package root, so a single import gives you the
builder, validator and project model:

```typescript
import { ScratchProject, ScratchValidator, Events, Looks, Motion } from '@code-club-luxembourg/sb3-toolkit';
```

### For local development

```bash
git clone <this-repo> && cd sb3-toolkit-nodejs
npm install      # runs `prepare` → builds dist/
npm test
```

## Quickstart

### Build a project programmatically

```typescript
import { ScratchProject, Events, Looks, Motion } from '@code-club-luxembourg/sb3-toolkit';

const project = ScratchProject.create();
const cat = project.addSprite('Cat');

cat.addScript(
  Events.whenFlagClicked()
    .then(Motion.moveSteps(10))
    .then(Looks.say('Hello!'))
);

await project.saveToSb3File('output.sb3');
```

Typed factories (`Motion`, `Looks`, `Control`, …) cover every Scratch block;
dropdown fields take string-union enums like `RotationStyle` or `Key`;
variables/lists/broadcasts are first-class `VariableRef` / `ListRef` /
`BroadcastRef` values returned by `addVariable()` / `addList()`, so name and id
never drift out of sync. `Block.make(opcode)` remains for custom procedures and
extension blocks that don't have a typed factory. See
[docs/builder.md](docs/builder.md) for the full API, the `Input` value object,
the fluent `Sprite` setters, and manipulation examples.

### Validate an existing `.sb3`

```typescript
import { ScratchProject, ScratchValidator, ErrorCode } from '@code-club-luxembourg/sb3-toolkit';

const project = await ScratchProject.fromSb3File('project.sb3');
const result = ScratchValidator.validate(project);

for (const error of result.errors) {
  // error.code is a string-typed ErrorCode; error.path is a stringable
  // ValidationPath carrying both display text and structured metadata
  // (path.targetIndex / path.blockId).
  console.log(`[${error.severity}] ${error.code} at ${error.path}: ${error.message}`);
}

// Filter by code or by target — the structured fields avoid string parsing:
const blockErrors = result.errors.filter(
  (e) => e.code === ErrorCode.MISSING_INPUT && e.path.targetIndex !== null
);
```

See [docs/validator.md](docs/validator.md) for the full API, all error codes,
the structured `ValidationPath`, options, and the custom `Rule` interface.

### Manipulate or download projects from the CLI

The CLI is an optional convenience layered on the library. Installing the package
exposes the `sb3` binary, so you can run it with `npx` (or directly if the
package is installed globally):

```bash
npx sb3 --help
npx sb3 validate project.sb3
npx sb3 merge base.sb3 source1.sb3 source2.sb3 -o merged.sb3
```

| Command | Description | Docs |
|---------|-------------|------|
| `sb3 merge <base> <sources...> -o <out>` | Merge sprites from source projects into a base project | [docs/cli-merge.md](docs/cli-merge.md) |
| `sb3 grid <sources...> -o <out> --columns <n>` | Arrange projects side by side in a grid | [docs/cli-grid.md](docs/cli-grid.md) |
| `sb3 pack <project> -o <out> --stage-width <px> --stage-height <px>` | Package a project into a standalone HTML file | [docs/cli-pack.md](docs/cli-pack.md) |
| `sb3 project-download <project_id>` | Download a single project by ID | [docs/cli-project-download.md](docs/cli-project-download.md) |
| `sb3 studio-download <studio_id>` | Download all projects from a Scratch studio | [docs/cli-studio-download.md](docs/cli-studio-download.md) |
| `sb3 validate <files...>` | Validate projects against the structural + semantic rules | — |
| `sb3 info <files...>` | Print a summary of a project (sprites, scripts, opcodes, assets) | — |
| `sb3 trim <file>` | Strip unreferenced assets and write a smaller file | — |
| `sb3 sprite-extract <project>` | Extract a single sprite into a `.sprite3` file | — |
| `sb3 sprite-import <project> <sprites...>` | Inject `.sprite3` files into a project as new sprites | — |

Run any command with `--help` for its full option list. Inside this repo the
same commands are also wired up as npm scripts that build first, e.g.
`npm run sb3:merge -- base.sb3 source1.sb3 -o out.sb3`.

## Quality tooling

```bash
npm run build    # tsc → dist/ (compiled JS + .d.ts declarations)
npm run lint     # eslint
npm test         # vitest
```

The typed block factories under `src/builder/blocks/` are generated from a
single source of truth — regenerate them with `npm run generate-blocks` after
changing the generator in `bin/generate-blocks.ts`.

## Project structure
- `src/index.ts` — package entry; re-exports the public API and types
- `src/model.ts` — public API surface (builder, validator, project model)
- `src/types/` — Scratch project JSON types
- `src/scratch/` — `ScratchProject` and `ScratchAssetIndex` (project load/save, sprite/variable/backdrop helpers, `resolvePaths`)
- `src/validator/` — `ScratchValidator`, the opcode registry, `ErrorCode`, `ValidationPath`, validation rules, and the `Rule` interface for extensions
- `src/builder/` — `Block` / `Sprite` / `Stage` / `BlockRef` / `Input` core, `blocks/*` typed factories, `field/*` enums, and `VariableRef` / `ListRef` / `BroadcastRef`
- `src/studio/` — Scratch API client with retries (`ScratchApi`), studio/project download helpers
- `src/cli/index.ts` — CLI entry (the `sb3` binary)
- `src/cli/commands/` — merge, grid, pack, download, validate, info, trim, sprite-extract/import commands
- `src/cli/packager/` — the TurboWarp-based HTML packager used by `pack`
- `bin/generate-blocks.ts` — code generator for the typed block factories (run via `npm run generate-blocks`)

## The `pack` command

The `pack` command bundles a `.sb3` project into a standalone HTML player:

```bash
npx sb3 pack project.sb3 -o project.html --stage-width 960 --stage-height 720 --autoplay
```

A Scratch project runs as JavaScript in the browser, so the output necessarily
embeds a JS runtime (the Scratch VM, renderer, audio, storage). The packager
uses the [TurboWarp Packager](https://packager.turbowarp.org/) to inline that
runtime and embed the project. See [docs/cli-pack.md](docs/cli-pack.md) for the
live-reload (`--countdown-seconds`) and checksum options.

## Implementation notes

- Project data is held as nested objects mirroring `project.json`, so unknown
  fields round-trip faithfully. Scratch's empty maps (`variables`, `blocks`, …)
  are preserved as `{}` on save.
- The builder's reference objects bind to the live project data, so mutations
  through `Sprite` / `BlockRef` update the project in place.
- The opcode registry, validation rules, and error codes cover the standard
  Scratch 3 block set.

## License

MIT © Michel Weimerskirch
