#!/usr/bin/env node
import { Command } from 'commander';
import { registerGridCommand } from './commands/grid';
import { registerInfoCommand } from './commands/info';
import { registerMergeCommand } from './commands/merge';
import { registerPackCommand } from './commands/pack';
import { registerProjectDownloadCommand } from './commands/project-download';
import { registerSpriteExtractCommand } from './commands/sprite-extract';
import { registerSpriteImportCommand } from './commands/sprite-import';
import { registerStudioDownloadCommand } from './commands/studio-download';
import { registerTrimCommand } from './commands/trim';
import { registerValidateCommand } from './commands/validate';

/**
 * Build and configure the CLI command program.
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name('sb3')
    .description('sb3-toolkit — Scratch .sb3 toolkit CLI')
    .version('1.0.0');

  registerMergeCommand(program);
  registerGridCommand(program);
  registerPackCommand(program);
  registerProjectDownloadCommand(program);
  registerStudioDownloadCommand(program);
  registerValidateCommand(program);
  registerInfoCommand(program);
  registerTrimCommand(program);
  registerSpriteExtractCommand(program);
  registerSpriteImportCommand(program);

  return program;
}

if (require.main === module) {
  createProgram().parseAsync().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
