import crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { buildCountdownScript } from './custom-js';
import { loadPackager } from './loader';

export interface PackRequest {
  projectPath: string;
  outputPath: string;
  stageWidth: number;
  stageHeight: number;
  autoplay: boolean;
  customJs?: string;
  countdownSeconds?: number;
  checksumFile?: string;
  checksumUrl?: string;
}

/**
 * Package a `.sb3` project into an HTML file using TurboWarp packager.
 */
export async function packProject(request: PackRequest): Promise<void> {
  const { Packager, loadProject } = loadPackager();

  const projectData = await fs.readFile(request.projectPath);
  const loadedProject = await loadProject(projectData);
  const packager = new Packager();

  packager.project = loadedProject;
  const packagerOptions = packager.options as {
    target?: string;
    stageWidth?: number;
    stageHeight?: number;
    autoplay?: boolean;
    custom?: { js?: string };
  };
  packagerOptions.target = 'html';
  packagerOptions.stageWidth = request.stageWidth;
  packagerOptions.stageHeight = request.stageHeight;
  packagerOptions.autoplay = request.autoplay;

  const jsParts: string[] = [];

  if (request.customJs) {
    jsParts.push(request.customJs);
  }

  if (request.countdownSeconds) {
    const checksum = crypto.createHash('sha256').update(projectData).digest('hex');
    const checksumFile = path.resolve(request.checksumFile ?? `${request.outputPath}.sha256`);
    const checksumUrl = request.checksumUrl ?? path.basename(checksumFile);

    jsParts.push(buildCountdownScript({
      countdownSeconds: request.countdownSeconds,
      checksumUrl,
      initialChecksum: checksum
    }));

    await fs.writeFile(checksumFile, `${checksum}\n`, 'utf8');
  }

  if (jsParts.length > 0) {
    packagerOptions.custom ??= {};
    packagerOptions.custom.js = jsParts.join('\n\n');
  }

  const result = await packager.package();
  if (result.type !== 'text/html') {
    throw new Error(`Unexpected package output type: ${result.type}`);
  }

  await fs.writeFile(request.outputPath, result.data);
}
