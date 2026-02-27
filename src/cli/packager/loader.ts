// eslint-disable-next-line @typescript-eslint/no-require-imports
const packagerModule = require('@turbowarp/packager') as unknown;

interface PackagerExports {
  Packager?: new () => {
    project: unknown;
    options: {
      target?: string;
      stageWidth?: number;
      stageHeight?: number;
      [key: string]: unknown;
    };
    package(): Promise<{ type: string; data: Uint8Array }>;
  };
  loadProject?: (data: Uint8Array) => Promise<unknown>;
}

/**
 * Load the TurboWarp packager exports and verify required symbols.
 */
export function loadPackager(): { Packager: NonNullable<PackagerExports['Packager']>; loadProject: NonNullable<PackagerExports['loadProject']> } {
  const packagerExports = packagerModule as PackagerExports;
  const Packager = packagerExports.Packager;
  const loadProject = packagerExports.loadProject;
  if (!Packager || !loadProject) {
    throw new Error('Packager exports not found from @turbowarp/packager.');
  }
  return { Packager, loadProject };
}
