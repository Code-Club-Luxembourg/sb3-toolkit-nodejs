import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { downloadAndSaveProject } from '../../studio/download';
import { makeNonNegativeNumberParser } from '../parse';

interface ProjectDownloadOptions {
  outputDir: string;
  delay: number;
  skipExisting: boolean;
}

/**
 * Register the `project-download` CLI command.
 */
export function registerProjectDownloadCommand(program: Readonly<Command>): void {
  program
    .command('project-download')
    .description('Download a specific Scratch project via the Scratch API')
    .argument('<project_id>', 'Scratch project ID')
    .option('-o, --output-dir <dir>', 'Directory to store downloaded .sb3 files', 'project_downloads')
    .option('--delay <seconds>', 'Delay in seconds between API requests', makeNonNegativeNumberParser('delay'), 0.2)
    .option('--no-skip-existing', 'Download even if the target .sb3 exists and metadata indicates no changes')
    .addHelpText('after', '\nExample:\n  $ project-download 123456 -o ./projects --delay 0.5')
    .action(async (projectIdArg: string, options: ProjectDownloadOptions) => {
      const outputDir = path.resolve(options.outputDir);
      await fs.mkdir(outputDir, { recursive: true, mode: 0o755 });

      const projectId = Number(projectIdArg);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        throw new Error(`Invalid project ID: ${projectIdArg}`);
      }

      const outcome = await downloadAndSaveProject(outputDir, projectId, options.delay, options.skipExisting);
      console.log(`Done. Downloaded ${outcome === 'downloaded' ? 1 : 0} project(s).`);
    });
}
