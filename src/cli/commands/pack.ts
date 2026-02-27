import path from 'node:path';
import type { Command } from 'commander';
import { resolvePaths } from '../../model';
import { makePositiveIntParser } from '../parse';
import { buildBridgeScript } from '../packager/bridge';
import { packProject } from '../packager/pack';

interface PackOptions {
  out: string;
  stageWidth: number;
  stageHeight: number;
  autoplay?: boolean;
  bridge?: boolean;
  countdownSeconds?: number;
  checksumFile?: string;
  checksumUrl?: string;
}

/**
 * Register the `pack` CLI command.
 */
export function registerPackCommand(program: Readonly<Command>): void {
  program
    .command('pack')
    .description('Package a .sb3 project into an HTML file using @turbowarp/packager')
    .requiredOption('-o, --out <file>', 'Output HTML file path')
    .requiredOption('--stage-width <px>', 'Stage width in pixels', makePositiveIntParser('Stage width'))
    .requiredOption('--stage-height <px>', 'Stage height in pixels', makePositiveIntParser('Stage height'))
    .option('--autoplay', 'Auto-start the project after load (green flag)')
    .option('--bridge', 'Forward Scratch broadcasts to the parent frame via postMessage (for iframe embedding)')
    .option(
      '--countdown-seconds <seconds>',
      'Show a countdown overlay and reload if the project checksum changes',
      makePositiveIntParser('Countdown seconds')
    )
    .option('--checksum-file <file>', 'Checksum file path (default: <output>.sha256)')
    .option('--checksum-url <url>', 'Checksum URL used by the HTML (default: basename of checksum file)')
    .argument('<project>', 'Input .sb3 project file')
    .action(async (project: string, options: Readonly<PackOptions>) => {
      const [projectPath] = await resolvePaths([project]);
      const outputPath = path.resolve(options.out);

      await packProject({
        projectPath,
        outputPath,
        stageWidth: options.stageWidth,
        stageHeight: options.stageHeight,
        autoplay: Boolean(options.autoplay),
        customJs: options.bridge ? buildBridgeScript() : undefined,
        countdownSeconds: options.countdownSeconds,
        checksumFile: options.checksumFile,
        checksumUrl: options.checksumUrl
      });
      console.log(`Packed ${path.basename(projectPath)} to ${path.basename(outputPath)}`);
    });
}
