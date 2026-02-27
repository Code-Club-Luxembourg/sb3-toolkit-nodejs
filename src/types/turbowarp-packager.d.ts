declare module '@turbowarp/packager' {
  interface PackagerResult {
    type: string;
    data: Uint8Array;
  }

  class Packager {
    project: unknown;
    options: {
      target?: string;
      stageWidth?: number;
      stageHeight?: number;
      [key: string]: unknown;
    };
    constructor();
    package(): Promise<PackagerResult>;
  }

  export function loadProject(data: Uint8Array): Promise<unknown>;
  export { Packager };
}
