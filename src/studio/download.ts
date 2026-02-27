import * as fs from 'node:fs/promises';
import path from 'node:path';
import type { ScratchProjectData } from '../types';
import { ScratchAssetIndex } from '../scratch/asset-index';
import { BLANK_COSTUME_SVG, ScratchProject } from '../scratch/project';
import {
  ASSET_URL,
  PROJECT_DOWNLOAD_URL,
  PROJECT_META_URL,
  STUDIO_PROJECTS_URL,
  delaySeconds,
  formatUrl,
  requestBytes,
  requestBytesBatch,
  requestJson
} from './api';
import { DownloadResult, JsonDownload, RawDownload } from './download-result';

export { DownloadResult, JsonDownload, RawDownload };

export interface StudioProjectEntry {
  id: number;
  title?: string;
}

export interface ProjectMetadata {
  project_token?: string;
  history?: {
    created?: string;
    modified?: string;
    shared?: string;
  };
}

export interface StoredProjectMetadata {
  historyModified: string | null;
  downloadedAt: string;
}

export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
}

const NULL_LOGGER: Logger = {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  info: () => {}
};

/** Stream project entries from a studio using the Scratch API. */
export async function* iterStudioProjects(
  studioId: string,
  limit: number,
  delay: number
): AsyncGenerator<StudioProjectEntry> {
  let offset = 0;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  while (true) {
    const url = `${formatUrl(STUDIO_PROJECTS_URL, { studio_id: studioId })}?limit=${limit}&offset=${offset}`;
    const batch = await requestJson<StudioProjectEntry[]>(url);
    if (!batch.length) {
      return;
    }
    for (const item of batch) {
      yield item;
    }
    offset += limit;
    await delaySeconds(delay);
  }
}

/** Build the output path for a downloaded project. */
export function targetPath(outputDir: string, projectId: number): string {
  return path.join(outputDir, `${projectId}.sb3`);
}

/** Build the metadata sidecar path for a downloaded project. */
export function metadataPath(outputDir: string, projectId: number): string {
  return path.join(outputDir, `${projectId}.meta.json`);
}

/** Fetch the metadata for a project. */
export async function fetchProjectMetadata(projectId: number): Promise<ProjectMetadata> {
  return requestJson<ProjectMetadata>(formatUrl(PROJECT_META_URL, { project_id: projectId }));
}

/** Read the locally stored metadata sidecar, or undefined when absent. */
export async function readStoredProjectMetadata(
  outputDir: string,
  projectId: number
): Promise<StoredProjectMetadata | undefined> {
  const filePath = metadataPath(outputDir, projectId);
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw) as StoredProjectMetadata;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

/**
 * Return true when the remote project's history.modified is no newer than the
 * stored copy's.
 *
 * Project tokens rotate on every metadata request, so they are deliberately
 * not used as a freshness signal. If either side lacks a parseable
 * `history.modified` timestamp, the project is treated as out-of-date.
 */
export function isProjectUpToDate(
  stored: Readonly<StoredProjectMetadata> | undefined,
  remote: Readonly<ProjectMetadata>
): boolean {
  const storedModified = stored?.historyModified;
  const remoteModified = remote.history?.modified;
  if (!storedModified || !remoteModified) return false;

  const storedTime = Date.parse(storedModified);
  const remoteTime = Date.parse(remoteModified);
  if (Number.isNaN(storedTime) || Number.isNaN(remoteTime)) return false;

  return remoteTime <= storedTime;
}

/**
 * Persist project metadata alongside the downloaded `.sb3` file.
 *
 * Always writes a sidecar (even when `history.modified` is missing) so the
 * download is recorded; the project token is never persisted because it is
 * a short-lived credential.
 */
export async function writeProjectMetadata(
  outputDir: string,
  projectId: number,
  metadata: Readonly<ProjectMetadata>
): Promise<string> {
  const historyModified = metadata.history?.modified ?? null;
  const stored: StoredProjectMetadata = {
    historyModified,
    downloadedAt: new Date().toISOString()
  };

  const filePath = metadataPath(outputDir, projectId);
  await writeFileAtomic(filePath, `${JSON.stringify(stored, null, 2)}\n`);
  return filePath;
}

/**
 * Download a project as raw `.sb3` or as JSON plus individually fetched assets.
 */
export async function downloadProject(
  projectId: number,
  _delay: number,
  meta?: Readonly<ProjectMetadata>
): Promise<DownloadResult> {
  const resolvedMeta = meta ?? (await fetchProjectMetadata(projectId));
  if (!resolvedMeta.project_token) {
    throw new Error('Missing project_token in metadata response.');
  }

  const raw = await requestBytes(
    formatUrl(PROJECT_DOWNLOAD_URL, { project_id: projectId, token: resolvedMeta.project_token })
  );

  if (isJsonBuffer(raw)) {
    let project: ScratchProjectData;
    try {
      project = JSON.parse(raw.toString('utf-8')) as ScratchProjectData;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to parse project JSON for ${projectId}: ${message}`);
    }
    const assets = await downloadAssets(collectAssetIds(project));
    return DownloadResult.json(project, assets);
  }

  return DownloadResult.raw(raw);
}

/**
 * Download a project, optionally skipping unchanged ones, and write to disk.
 * Returns `skipped` if the project was up-to-date, `downloaded` otherwise.
 */
export async function downloadAndSaveProject(
  outputDir: string,
  projectId: number,
  delay: number,
  skipExisting: boolean,
  logger: Logger = NULL_LOGGER
): Promise<'skipped' | 'downloaded'> {
  const target = targetPath(outputDir, projectId);
  const metadata = await fetchProjectMetadata(projectId);

  if (skipExisting) {
    try {
      await fs.access(target);
      const stored = await readStoredProjectMetadata(outputDir, projectId);
      if (isProjectUpToDate(stored, metadata)) {
        logger.info(`Skipping project ${projectId} (unchanged) -> ${target}`);
        return 'skipped';
      }
    } catch {
      // file missing or unreadable — proceed with download
    }
  }

  const result = await downloadProject(projectId, delay, metadata);
  const outputPath = await writeProject(outputDir, projectId, result);
  await writeProjectMetadata(outputDir, projectId, metadata);
  logger.info(`Downloaded project ${projectId} -> ${outputPath}`);
  return 'downloaded';
}

/**
 * Persist a downloaded project to disk and return the output path.
 *
 * Both branches stage via a `.tmp` file and atomically rename, so a killed
 * mid-download process never leaves a partial file at the target path.
 */
export async function writeProject(
  outputDir: string,
  projectId: number,
  result: DownloadResult
): Promise<string> {
  const outputPath = targetPath(outputDir, projectId);

  if (result instanceof RawDownload) {
    await writeFileAtomic(outputPath, result.sb3);
    return outputPath;
  }

  if (!(result instanceof JsonDownload)) {
    throw new Error('Unknown DownloadResult variant');
  }

  const assetIndex = new ScratchAssetIndex();
  for (const [md5ext, data] of result.assets) {
    assetIndex.add(md5ext, data);
  }

  const tmpPath = `${outputPath}.tmp`;
  const project = new ScratchProject(result.project, assetIndex);
  await project.saveToSb3File(tmpPath);
  try {
    await fs.rename(tmpPath, outputPath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => undefined);
    throw error;
  }
  return outputPath;
}

/** Write a file via `.tmp` + atomic rename to avoid partial writes. */
async function writeFileAtomic(filePath: string, data: string | Buffer): Promise<void> {
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, data);
  try {
    await fs.rename(tmpPath, filePath);
  } catch (error) {
    await fs.unlink(tmpPath).catch(() => undefined);
    throw error;
  }
}

/** Collect unique asset md5ext references from a project. */
function collectAssetIds(project: ScratchProjectData): string[] {
  const assetIds = new Set<string>();
  for (const target of project.targets) {
    for (const costume of target.costumes) {
      if (costume.md5ext) assetIds.add(costume.md5ext);
    }
    for (const sound of target.sounds) {
      if (sound.md5ext) assetIds.add(sound.md5ext);
    }
  }
  return [...assetIds];
}

/**
 * Fetch all referenced assets in parallel.
 *
 * Requests dispatch concurrently — politeness is handled by the retry strategy
 * for `429`/`Retry-After`. An asset that is permanently gone from Scratch's CDN
 * (e.g. a `404`) must not sink an otherwise-downloadable project, so missing
 * assets are replaced with a blank placeholder costume and logged as a warning.
 * The placeholder keeps every `project.json` costume/sound reference resolvable,
 * so the resulting `.sb3` still loads.
 */
async function downloadAssets(assetIds: readonly string[]): Promise<Map<string, Buffer>> {
  if (assetIds.length === 0) return new Map();

  const urlByMd5 = new Map<string, string>();
  for (const md5ext of assetIds) {
    urlByMd5.set(md5ext, formatUrl(ASSET_URL, { md5ext }));
  }

  const bodies = await requestBytesBatch([...urlByMd5.values()], {
    tolerateFailures: true
  });

  const assets = new Map<string, Buffer>();
  const missing: string[] = [];
  for (const [md5ext, url] of urlByMd5) {
    const body = bodies.get(url);
    if (body) {
      assets.set(md5ext, body);
    } else {
      assets.set(md5ext, BLANK_COSTUME_SVG);
      missing.push(md5ext);
    }
  }
  if (missing.length > 0) {
    console.warn(
      `Warning: ${missing.length} asset(s) unavailable, substituted blank placeholder: ${missing.join(', ')}`
    );
  }
  return assets;
}

/** Detect whether a buffer contains JSON by its first non-whitespace byte. */
function isJsonBuffer(buffer: Buffer): boolean {
  for (const byte of buffer.values()) {
    if (byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09) {
      continue;
    }
    return byte === 0x7b;
  }
  return false;
}
