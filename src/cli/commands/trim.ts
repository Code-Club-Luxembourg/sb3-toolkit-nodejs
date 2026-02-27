import path from 'node:path';
import type { Command } from 'commander';
import { resolvePaths, ScratchProject } from '../../model';

interface TrimOptions {
  out?: string;
  inPlace: boolean;
}

/** Register the `trim` CLI command. */
export function registerTrimCommand(program: Readonly<Command>): void {
  program
    .command('trim')
    .description('Strip unreferenced assets from a .sb3 project and write a smaller file')
    .argument('<file>', 'Input .sb3 file')
    .option('-o, --out <file>', 'Output .sb3 file path')
    .option('--in-place', 'Overwrite the input file', false)
    .addHelpText(
      'after',
      '\nExample:\n  $ sb3 trim project.sb3 -o trimmed.sb3\n  $ sb3 trim project.sb3 --in-place'
    )
    .action(async (file: string, options: Readonly<TrimOptions>) => {
      if (options.inPlace && options.out) {
        throw new Error('--in-place and --out are mutually exclusive.');
      }
      if (!options.inPlace && !options.out) {
        throw new Error('Pass --out=<path> or --in-place.');
      }

      const resolved = await resolvePaths([file]);
      const inputPath = resolved[0];
      const outputPath = options.inPlace || !options.out ? inputPath : path.resolve(options.out);

      const project = await ScratchProject.fromSb3File(inputPath);
      const before = project.assets.size;
      const removed = project.trimAssets();
      const after = project.assets.size;
      await project.saveToSb3File(outputPath);

      console.log(
        `Trimmed ${path.basename(inputPath)}: ${before} → ${after} asset(s) (${removed.length} removed) -> ${path.basename(outputPath)}`
      );
    });
}
