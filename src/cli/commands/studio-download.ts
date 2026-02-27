import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { Command } from 'commander';
import { downloadAndSaveProject, iterStudioProjects } from '../../studio/download';
import { makeIntRangeParser, makeNonNegativeNumberParser } from '../parse';

interface StudioDownloadOptions {
  outputDir: string;
  pageSize: number;
  maxProjects: number;
  delay: number;
  skipExisting: boolean;
}

/**
 * Register the `studio-download` CLI command.
 */
export function registerStudioDownloadCommand(program: Readonly<Command>): void {
  program
    .command('studio-download')
    .description('Download all projects from a Scratch studio via the Scratch API')
    .argument('<studio_id>', 'Scratch studio ID')
    .option('-o, --output-dir <dir>', 'Directory to store downloaded .sb3 files', 'studio_downloads')
    .option('--page-size <count>', 'Projects per API page', makeIntRangeParser('page-size', 1, 100), 40)
    .option('--max-projects <count>', 'Stop after this many projects (0 means no limit)', makeIntRangeParser('max-projects', 0, 100_000), 0)
    .option('--delay <seconds>', 'Delay in seconds between API requests', makeNonNegativeNumberParser('delay'), 0.2)
    .option('--no-skip-existing', 'Download even if the target .sb3 exists and metadata indicates no changes')
    .addHelpText('after', '\nExample:\n  $ studio-download 123456 -o ./projects --page-size 40 --delay 0.5')
    .action(async (studioId: string, options: StudioDownloadOptions) => {
      const outputDir = path.resolve(options.outputDir);
      await fs.mkdir(outputDir, { recursive: true, mode: 0o755 });

      let downloaded = 0;
      let failed = 0;
      for await (const item of iterStudioProjects(studioId, options.pageSize, options.delay)) {
        if (options.maxProjects && downloaded >= options.maxProjects) {
          break;
        }

        const projectId = item.id;
        if (!Number.isInteger(projectId) || projectId <= 0) {
          continue;
        }

        try {
          const outcome = await downloadAndSaveProject(outputDir, projectId, options.delay, options.skipExisting);
          if (outcome === 'downloaded') {
            downloaded += 1;
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.log(`Failed ${projectId}: ${message}`);
          failed += 1;
        }
      }

      const summary = failed > 0 ? ` (${failed} failed)` : '';
      console.log(`Done. Downloaded ${downloaded} project(s).${summary}`);
    });
}
