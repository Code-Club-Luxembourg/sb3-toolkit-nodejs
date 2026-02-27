import path from 'node:path';
import type { Command } from 'commander';
import { resolvePaths, ScratchProject } from '../../model';

interface SpriteImportOptions {
  out?: string;
  inPlace: boolean;
}

/** Register the `sprite-import` CLI command. */
export function registerSpriteImportCommand(program: Readonly<Command>): void {
  program
    .command('sprite-import')
    .description('Inject a .sprite3 into an .sb3 project as a new sprite')
    .argument('<project>', 'Target .sb3 file')
    .argument('<sprites...>', 'One or more .sprite3 files')
    .option('-o, --out <file>', 'Output .sb3 file path')
    .option('--in-place', 'Overwrite the input project', false)
    .addHelpText('after', '\nExample:\n  $ sb3 sprite-import project.sb3 cat.sprite3 -o new.sb3')
    .action(
      async (project: string, sprites: readonly string[], options: Readonly<SpriteImportOptions>) => {
        if (options.inPlace && options.out) {
          throw new Error('--in-place and --out are mutually exclusive.');
        }
        if (!options.inPlace && !options.out) {
          throw new Error('Pass --out=<path> or --in-place.');
        }

        const resolved = await resolvePaths([project, ...sprites]);
        const projectPath = resolved[0];
        const spritePaths = resolved.slice(1);
        const outputPath = options.inPlace || !options.out ? projectPath : path.resolve(options.out);

        const loaded = await ScratchProject.fromSb3File(projectPath);
        const added: string[] = [];
        for (const spritePath of spritePaths) {
          const sprite = await loaded.importSprite(spritePath);
          added.push(sprite.name);
        }
        await loaded.saveToSb3File(outputPath);

        console.log(
          `Imported ${added.length} sprite(s) [${added.join(', ')}] into ${path.basename(projectPath)} -> ${path.basename(outputPath)}`
        );
      }
    );
}
