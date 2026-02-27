import type { Command } from 'commander';
import { resolvePaths, ScratchProject } from '../../model';

interface InfoOptions {
  top: number;
}

/** Register the `info` CLI command. */
export function registerInfoCommand(program: Readonly<Command>): void {
  program
    .command('info')
    .description('Print a summary of an .sb3 project: sprites, scripts, opcodes, variables, assets')
    .argument('<files...>', 'One or more .sb3 files')
    .option('--top <count>', 'Show the top N opcodes only (0 = all)', (v) => Number.parseInt(v, 10), 10)
    .addHelpText('after', '\nExample:\n  $ sb3 info project.sb3\n  $ sb3 info project.sb3 --top 5')
    .action(async (files: readonly string[], options: Readonly<InfoOptions>) => {
      const top = options.top;
      const resolved = await resolvePaths(files);

      for (const path of resolved) {
        const project = await ScratchProject.fromSb3File(path);
        const sprites = project.listSprites();
        const stage = project.getStage();

        console.log(`=== ${baseName(path)} ===`);
        console.log(`Targets: 1 stage + ${sprites.length} sprite(s)`);

        let blockCount = 0;
        let scriptCount = 0;
        const opcodeCounts = new Map<string, number>();
        for (const target of project.data.targets) {
          for (const block of Object.values(target.blocks)) {
            if (!block) continue;
            blockCount += 1;
            if (block.topLevel) scriptCount += 1;
            opcodeCounts.set(block.opcode, (opcodeCounts.get(block.opcode) ?? 0) + 1);
          }
        }
        console.log(`Blocks: ${blockCount} (${scriptCount} top-level)`);

        let varCount = Object.keys(stage.variables).length;
        for (const sprite of sprites) varCount += Object.keys(sprite.variables).length;
        let listCount = Object.keys(stage.lists).length;
        for (const sprite of sprites) listCount += Object.keys(sprite.lists).length;
        const broadcastCount = Object.keys(stage.broadcasts).length;
        console.log(`Variables: ${varCount}  Lists: ${listCount}  Broadcasts: ${broadcastCount}`);

        const assetCount = [...project.assets.entries()].length;
        console.log(`Assets: ${assetCount} file(s)`);

        if (opcodeCounts.size > 0) {
          const sorted = [...opcodeCounts.entries()].sort((a, b) => b[1] - a[1]);
          const shown = top > 0 ? sorted.slice(0, top) : sorted;
          console.log('Top opcodes:');
          for (const [opcode, count] of shown) {
            console.log(`  ${String(count).padStart(4)}  ${opcode || '(empty)'}`);
          }
        }

        if (sprites.length > 0) {
          console.log('Sprites:');
          for (const sprite of sprites) {
            const topScripts = Object.values(sprite.blocks).filter((b) => b?.topLevel).length;
            console.log(
              `  - ${sprite.name}  (x=${sprite.x} y=${sprite.y} size=${sprite.size} scripts=${topScripts})`
            );
          }
        }
        console.log('');
      }
    });
}

function baseName(p: string): string {
  const slash = p.lastIndexOf('/');
  return slash === -1 ? p : p.slice(slash + 1);
}
