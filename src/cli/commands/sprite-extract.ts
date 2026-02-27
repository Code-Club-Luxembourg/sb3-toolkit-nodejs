import path from 'node:path';
import type { Command } from 'commander';
import { resolvePaths, ScratchProject } from '../../model';

interface SpriteExtractOptions {
  sprite: string;
  out: string;
}

/** Register the `sprite-extract` CLI command. */
export function registerSpriteExtractCommand(program: Readonly<Command>): void {
  program
    .command('sprite-extract')
    .description('Extract a single sprite from an .sb3 into a .sprite3 file')
    .argument('<project>', 'Source .sb3 file')
    .requiredOption('-s, --sprite <name>', 'Name of the sprite to extract')
    .requiredOption('-o, --out <file>', 'Output .sprite3 file path')
    .addHelpText('after', '\nExample:\n  $ sb3 sprite-extract project.sb3 -s Cat -o cat.sprite3')
    .action(async (project: string, options: Readonly<SpriteExtractOptions>) => {
      const resolved = await resolvePaths([project]);
      const inputPath = resolved[0];
      const outputPath = path.resolve(options.out);

      const loaded = await ScratchProject.fromSb3File(inputPath);
      await loaded.extractSprite(options.sprite, outputPath);
      console.log(
        `Extracted sprite "${options.sprite}" from ${path.basename(inputPath)} -> ${path.basename(outputPath)}`
      );
    });
}
