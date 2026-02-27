import type { ScratchMonitor } from './monitor';
import type { ScratchTarget } from './target';

/**
 * Metadata for a Scratch project.json file.
 */
export interface ScratchProjectMeta {
  semver: string;
  vm: string;
  agent?: string;
}

/**
 * Root structure of a Scratch project.json file.
 */
export interface ScratchProjectData {
  targets: ScratchTarget[];
  monitors: ScratchMonitor[];
  extensions: string[];
  meta: ScratchProjectMeta;
}
