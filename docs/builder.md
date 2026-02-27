# Scratch Builder API

The builder API lets you create and manipulate Scratch projects programmatically: create sprites, build block scripts with typed per-block factories, and query or modify existing blocks.

## Quickstart

```typescript
import {
  Control, Data, Events, Looks, Motion, ScratchProject
} from './src/model';

const project = ScratchProject.create();
const cat = project.addSprite('Cat', { x: 0, y: 0, size: 100 });
const score = cat.addVariable('score', 0);

cat.addScript(
  Events.whenFlagClicked()
    .then(Data.setVariableTo(0, score))
    .then(Control.repeat(10, [Data.changeVariableBy(1, score)]))
    .then(Looks.say('Done!'))
);

await project.saveToSb3File('output.sb3');
```

## `ScratchProject.create(meta?)`

Creates an empty `ScratchProject` with a blank stage and no sprites.

```typescript
const project = ScratchProject.create({ semver: '3.0.0', vm: '0.2.0' });
```

## `ScratchProject.addSprite(name, options?)`

Adds a new sprite with a blank costume and returns a `Sprite` for further work.

```typescript
const cat = project.addSprite('Cat');

const dog = project.addSprite('Dog', {
  x: 100, y: -50,
  size: 80,
  direction: 180,
  visible: true,
  rotationStyle: 'left-right',
  draggable: false
});
```

## `ScratchProject.sprite(name)`

Returns a `Sprite` for an existing sprite by name. Throws if not found.

## Backdrops

```typescript
const idx = project.addBackdrop('Forest', svgData);
project.addBackdrop('Ocean', pngData, 'png');
project.setCurrentBackdrop(idx);
```

## Project-level variables and lists

```typescript
const score = project.addVariable('timer', 0);
const highscores = project.addList('highscores');
// score is a VariableRef; pass it directly to Data factories.
```

## Typed per-block factories

Each Scratch category is a module exporting one factory per block:

| Module     | Examples                                              |
|------------|-------------------------------------------------------|
| `Motion`   | `moveSteps`, `turnRight`, `goToXY`, `pointTowards`    |
| `Looks`    | `say`, `switchCostumeTo`, `changeEffectBy`            |
| `Sound`    | `play`, `setVolumeTo`, `changeEffectBy`               |
| `Events`   | `whenFlagClicked`, `whenKeyPressed`, `broadcast`      |
| `Control`  | `repeat`, `forever`, `if`, `ifElse`, `stop`           |
| `Sensing`  | `touchingObject`, `keyPressed`, `askAndWait`          |
| `Operators`| `add`, `equals`, `random`, `mathOp`                   |
| `Data`     | `setVariableTo`, `changeVariableBy`, `addToList`      |
| `Pen`      | `clear`, `penDown`, `setPenColorToColor`              |

Dropdown fields take typed enums from `field/*`:

```typescript
import {
  Control, Events, GraphicEffect, Key, Looks, Motion, RotationStyle, StopOption
} from './src/model';

Motion.setRotationStyle(RotationStyle.LeftRight);
Events.whenKeyPressed(Key.Space);
Control.stop(StopOption.All);
Looks.changeEffectBy(25, GraphicEffect.Color);
```

Variables, lists, and broadcasts are passed as `VariableRef` / `ListRef` /
`BroadcastRef` values returned by `addVariable()` / `addList()`. The factory
emits both the display name and the id, so they never drift out of sync.

```typescript
const score = cat.addVariable('score', 0);
const items = cat.addList('items');

Data.setVariableTo(0, score);
Data.addToList('hello', items);
```

Control substacks always take a `Block[]` — `Control.if(cond, [...])` and
`Control.ifElse(cond, [...], [...])` share the same shape.

## `Block.make(opcode)` for custom blocks

For custom procedures, extension blocks, or anything without a typed
factory, build with the fluent `Block.make()` API:

```typescript
import { Block } from './src/model';

const call = Block.make('procedures_call')
  .input('arg0', 7)
  .mutation({
    tagName: 'mutation',
    proccode: 'doThing %n',
    argumentids: '["arg0"]',
    children: [],
    warp: 'false'
  });
```

## Chaining blocks

`Block.then(next)` appends a block to the end of the chain and returns the
**root**, so `root.then(a).then(b)` anchors back on the root. Pass the root
to `Sprite.addScript()`.

```typescript
Events.whenFlagClicked()
  .then(Motion.moveSteps(10))
  .then(Looks.say('Hello!'));
```

`Block.andThen(next)` is the same operation but returns the **appended**
block, so the chain walks forward — useful when you need a reference to a
deep block (still pass the original root to `addScript`):

```typescript
const hat = Events.whenFlagClicked();
const tail = hat.andThen(Motion.moveSteps(10)).andThen(Looks.say('Hi'));
// tail is the say-block; addScript still takes hat
cat.addScript(hat);
```

## `Input` value object

For uncommon input shapes (variable reporters in input slots, explicit
colors, menus with block reporters), use the `Input` static factory:

```typescript
import { Input } from './src/model';

Operators.equals(Input.variable(score), 10);           // variable as input
Sensing.touchingColor(Input.color('#ff0000'));         // explicit color
Motion.glideTo(Input.number(2), Motion.xPosition());   // forced number
```

Plain `number`/`string`/`Block` values pass directly into typed factories and
are wrapped automatically.

## `Sprite`

Returned by `project.addSprite()` and `project.sprite()`.

### Adding scripts

```typescript
const hat = Events.whenFlagClicked().then(Motion.moveSteps(10));
sprite.addScript(hat);           // places at (0, 0)
sprite.addScript(hat, 50, 100);  // explicit canvas position
```

### Fluent setters

```typescript
sprite
  .setCurrentCostume(1)
  .setPosition(40, -10)
  .setSize(75)
  .setDirection(45)
  .setVisible(false)
  .setDraggable(true)
  .setRotationStyle(RotationStyle.LeftRight)
  .setVolume(80);
```

### Querying blocks

```typescript
const moveBlocks = sprite.findBlocks('motion_movesteps');     // every block of this opcode
const flagScripts = sprite.findScripts('event_whenflagclicked'); // top-level hats only
const ref = sprite.block(blockId);                             // throws if missing
```

Each returns `BlockRef[]` (or a single `BlockRef`).

### Costumes

```typescript
const idx = sprite.addCostume('cat-walk', svgData);
sprite.addCostume('cat-jump', pngData, 'png');
sprite.setCurrentCostume(idx);
```

### Variables and lists

```typescript
const score = sprite.addVariable('score', 0);     // returns VariableRef
const items = sprite.addList('items');             // returns ListRef
```

## `BlockRef`

Wraps a single block within a live blocks map for in-place modification and
read access.

### Typed accessors

```typescript
const move = sprite.block(blockId);

move.opcode();                       // 'motion_movesteps'
move.getInputSlot('STEPS');          // [1, [4, 10]]
move.getInputLiteralValue('STEPS');  // 10
move.getField('VARIABLE');           // ['score', 'var-id']
move.getFieldValue('STOP_OPTION');   // 'all'
```

### Modifying inputs and fields

```typescript
const ref = sprite.block(blockId);

ref.input('STEPS', 20);                     // plain number, auto-wrapped
ref.input('STEPS', Input.variable(score));  // variable reporter
ref.field('STOP_OPTION', 'this script');
ref.field('VARIABLE', 'score', varId);

// Overwriting an input with a previously-nested block frees that subtree:
ref.input('STEPS', 7);   // any prior reporter under STEPS is removed
```

### Inserting and deleting

```typescript
// Insert a new block between this and its current next:
sprite.block(hat.id).insertAfter(Control.wait(1));

// Delete a block and re-link the chain. Substacks and nested inputs are
// recursively removed; deleting a hat promotes the next block to top-level.
sprite.block(moveA.id).delete();
```

## Full example: build and validate a project

```typescript
import {
  Control, Data, Events, Looks, ScratchProject, ScratchValidator
} from './src/model';

const project = ScratchProject.create();
const cat = project.addSprite('Cat');
const score = cat.addVariable('score', 0);

cat.addScript(
  Events.whenFlagClicked()
    .then(Data.setVariableTo(0, score))
    .then(Control.repeat(10, [Data.changeVariableBy(1, score)]))
    .then(Looks.say('Done!'))
);

console.log(ScratchValidator.validate(project).isValid);  // true
await project.saveToSb3File('output.sb3');
```

## Programmatic manipulation of an existing project

```typescript
const project = await ScratchProject.fromSb3File('existing.sb3');
const cat = project.sprite('Cat');

// Double every "move N steps":
for (const ref of cat.findBlocks('motion_movesteps')) {
  const steps = ref.getInputLiteralValue('STEPS');
  if (typeof steps === 'number') ref.input('STEPS', steps * 2);
}

// Prepend "go to x:0 y:0" to every flag-click script:
for (const script of cat.findScripts('event_whenflagclicked')) {
  script.insertAfter(Motion.goToXY(0, 0));
}

await project.saveToSb3File('modified.sb3');
```

## Regenerating the typed factories

The classes in `src/builder/blocks/*` are generated from the enriched opcode
metadata in `src/validator/opcodes.ts`. To regenerate after changing the
metadata:

```bash
npm run generate-blocks
```

The output is committed; runtime users never need to run this.
