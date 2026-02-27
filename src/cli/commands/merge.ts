import path from 'node:path';
import type { Command } from 'commander';
import { ScratchProject, resolvePaths } from '../../model';
import { loadProjects } from '../io';

interface MergeOptions {
  out: string;
  sprites?: string;
}

/**
 * Register the `merge` CLI command.
 */
export function registerMergeCommand(program: Readonly<Command>): void {
  program
    .command('merge')
    .description('Merge sprites from one or more .sb3 projects into a base project')
    .requiredOption('-o, --out <file>', 'Output .sb3 file path')
    .option('-s, --sprites <list>', 'Comma-separated sprite names to merge')
    .argument('<base>', 'Base .sb3 project')
    .argument('<sources...>', 'One or more .sb3 projects to merge from')
    .action(async (base: string, sources: readonly string[], options: Readonly<MergeOptions>) => {
      const files = [base, ...sources];
      const [basePath, ...sourcePaths] = await resolvePaths(files);
      const outputPath = path.resolve(options.out);
      const baseName = path.basename(basePath);
      const outputName = path.basename(outputPath);

      const baseProject = await ScratchProject.fromSb3File(basePath);
      const sourceProjects = await loadProjects(sourcePaths);

      const spriteNames = options.sprites
        ? options.sprites.split(',').map((name) => name.trim()).filter(Boolean)
        : undefined;

      const merged = ScratchProject.mergeSprites(baseProject, sourceProjects, {
        spriteNames
      });

      await merged.saveToSb3File(outputPath);
      console.log(
        `Merged ${sourceProjects.length} project(s) into ${baseName} (output: ${outputName})`
      );
    });
}
