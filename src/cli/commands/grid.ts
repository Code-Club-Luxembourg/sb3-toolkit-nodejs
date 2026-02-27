import path from 'node:path';
import type { Command } from 'commander';
import { ScratchProject, resolvePaths } from '../../model';
import { loadProjects } from '../io';
import { makePositiveIntParser } from '../parse';

interface GridOptions {
  out: string;
  columns: number;
  rows?: number;
}

/**
 * Register the `grid` CLI command.
 */
export function registerGridCommand(program: Readonly<Command>): void {
  program
    .command('grid')
    .description('Arrange multiple .sb3 projects into a grid in a new project')
    .requiredOption('-o, --out <file>', 'Output .sb3 file path')
    .requiredOption('-c, --columns <count>', 'Number of columns in the grid', makePositiveIntParser('Grid columns'))
    .option('-r, --rows <count>', 'Number of rows in the grid', makePositiveIntParser('Grid rows'))
    .argument('<sources...>', 'One or more .sb3 projects to place in the grid')
    .action(async (sources: readonly string[], options: Readonly<GridOptions>) => {
      const sourcePaths = await resolvePaths(sources);
      const outputPath = path.resolve(options.out);
      const outputName = path.basename(outputPath);

      const projects = await loadProjects(sourcePaths);

      const rows = options.rows ?? Math.ceil(projects.length / options.columns);
      const grid = ScratchProject.gridProjects(projects, {
        columns: options.columns,
        rows: options.rows
      });

      await grid.saveToSb3File(outputPath);

      const pixels = ScratchProject.gridPixelSize(options.columns, rows);
      console.log(
        `Gridded ${projects.length} project(s) into ${outputName} (${options.columns}x${rows}, ${pixels.width}x${pixels.height}px)`
      );
    });
}
