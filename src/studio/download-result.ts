import type { ScratchProjectData } from '../types';

/**
 * Outcome of downloading a project. Exactly one of two concrete subclasses:
 * `RawDownload` (an opaque `.sb3` blob) or `JsonDownload` (parsed project JSON
 * plus individually fetched assets).
 *
 * Discriminate with `instanceof` — the typed subclass fields are non-nullable,
 * so the compiler can prove which payload is present.
 */
// eslint-disable-next-line @typescript-eslint/no-extraneous-class
export abstract class DownloadResult {
  /** @internal */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected constructor() {}

  static raw(rawSb3: Buffer): RawDownload {
    return new RawDownload(rawSb3);
  }

  static json(project: ScratchProjectData, assets: Map<string, Buffer>): JsonDownload {
    return new JsonDownload(project, assets);
  }
}

/**
 * A project downloaded as an opaque `.sb3` zip blob. Write `sb3` directly.
 */
export class RawDownload extends DownloadResult {
  constructor(public readonly sb3: Buffer) {
    super();
  }
}

/**
 * A project downloaded as JSON plus its individually fetched assets, ready to
 * be re-assembled into an `.sb3` via `ScratchProject`.
 */
export class JsonDownload extends DownloadResult {
  constructor(
    public readonly project: ScratchProjectData,
    public readonly assets: Map<string, Buffer>
  ) {
    super();
  }
}
