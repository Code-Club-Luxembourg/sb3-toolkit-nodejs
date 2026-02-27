const USER_AGENT = 'sb3-toolkit-nodejs/1.0 (+https://scratch.mit.edu)';

export const STUDIO_PROJECTS_URL = 'https://api.scratch.mit.edu/studios/{studio_id}/projects';
export const PROJECT_META_URL = 'https://api.scratch.mit.edu/projects/{project_id}';
export const PROJECT_DOWNLOAD_URL = 'https://projects.scratch.mit.edu/{project_id}?token={token}';
export const ASSET_URL = 'https://assets.scratch.mit.edu/internalapi/asset/{md5ext}/get/';

/** Per-request wall-clock cap (milliseconds), including retries. */
const DEFAULT_MAX_DURATION_MS = 60_000;
/** How many times to re-issue a request after a retryable failure. */
const DEFAULT_MAX_RETRIES = 3;
/** Base delay (ms) between retries — capped at the parsed Retry-After when present. */
const BASE_RETRY_DELAY_MS = 500;
/** How much of a failed response body to surface in error messages. */
const ERROR_BODY_SNIPPET_BYTES = 200;

/**
 * Thrown by `ScratchApi` for a non-2xx response or a transport failure.
 *
 * `statusCode` is 0 for transport-level failures (DNS, connection reset,
 * timeout) where no HTTP response was received. `retryAfterSeconds` is parsed
 * from the `Retry-After` header when present (delta-seconds form only).
 */
export class ScratchApiException extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly url: string,
    public readonly bodySnippet = '',
    public readonly retryAfterSeconds: number | null = null,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ScratchApiException';
  }
}

/**
 * Substitute `{key}` placeholders in a URL template with `encodeURIComponent`-encoded
 * parameter values, so opaque tokens or values containing reserved characters
 * cannot corrupt the URL.
 */
export function formatUrl(template: string, params: Record<string, string | number>): string {
  let out = template;
  for (const [key, value] of Object.entries(params)) {
    out = out.replace(`{${key}}`, encodeURIComponent(String(value)));
  }
  return out;
}

/** Sleep for the requested number of seconds. */
export function delaySeconds(seconds: number): Promise<void> {
  if (!seconds || seconds <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(resolve, seconds * 1000);
  });
}

export interface ApiOptions {
  /** Set to false to issue requests without the retry wrapper (handy in tests). */
  autoRetry?: boolean;
  /** Max retry attempts after a transient failure (default 3). */
  maxRetries?: number;
  /** Max wall-clock time for one full request in ms (default 60_000). */
  maxDurationMs?: number;
}

function parseRetryAfter(headers: Headers): number | null {
  const value = headers.get('retry-after');
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    return parseInt(value, 10);
  }
  return null;
}

function truncate(text: string): string {
  if (text.length <= ERROR_BODY_SNIPPET_BYTES) return text;
  return `${text.slice(0, ERROR_BODY_SNIPPET_BYTES)}…`;
}

function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function retryDelayMs(attempt: number, retryAfter: number | null): number {
  if (retryAfter !== null) return retryAfter * 1000;
  return BASE_RETRY_DELAY_MS * attempt;
}

async function requestOnce(
  url: string,
  signal: AbortSignal | undefined
): Promise<{ response: Response; bodyText?: string }> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal
  });
  return { response };
}

async function requestWithRetry(
  url: string,
  options: Required<ApiOptions>
): Promise<{ response: Response; status: number; body: ArrayBuffer }> {
  const controller = new AbortController();
  const timer = setTimeout(() => { controller.abort(); }, options.maxDurationMs);

  try {
    let lastException: ScratchApiException | null = null;
    const maxAttempts = options.autoRetry ? options.maxRetries + 1 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const { response } = await requestOnce(url, controller.signal);
        const status = response.status;

        if (options.autoRetry && shouldRetry(status) && attempt < maxAttempts) {
          const retryAfter = parseRetryAfter(response.headers);
          await response.body?.cancel();
          await delaySeconds(retryDelayMs(attempt, retryAfter) / 1000);
          continue;
        }

        const body = await response.arrayBuffer();
        return { response, status, body };
      } catch (error) {
        if ((error as { name?: string }).name === 'AbortError') {
          throw new ScratchApiException(`Request timed out for ${url}`, 0, url, '', null, error);
        }
        lastException = new ScratchApiException(
          `Transport error for ${url}: ${(error as Error).message}`,
          0,
          url,
          '',
          null,
          error
        );
        if (!options.autoRetry || attempt >= maxAttempts) {
          throw lastException;
        }
        await delaySeconds(retryDelayMs(attempt, null) / 1000);
      }
    }
    throw lastException ?? new ScratchApiException(`Request failed for ${url}`, 0, url);
  } finally {
    clearTimeout(timer);
  }
}

function resolveOptions(options: ApiOptions = {}): Required<ApiOptions> {
  return {
    autoRetry: options.autoRetry ?? true,
    maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
    maxDurationMs: options.maxDurationMs ?? DEFAULT_MAX_DURATION_MS
  };
}

/**
 * Fetch a URL and return the response body as a Node.js buffer.
 *
 * Throws `ScratchApiException` on a non-2xx response or transport failure.
 * Transient failures (429 + 5xx) are retried up to `maxRetries` times,
 * honouring `Retry-After`.
 */
export async function requestBytes(url: string, options?: ApiOptions): Promise<Buffer> {
  const resolved = resolveOptions(options);
  const { response, status, body } = await requestWithRetry(url, resolved);

  if (status < 200 || status >= 300) {
    const snippet = truncate(Buffer.from(body).toString('utf-8'));
    throw new ScratchApiException(
      `Request failed (${status}) for ${url}`,
      status,
      url,
      snippet,
      parseRetryAfter(response.headers)
    );
  }

  return Buffer.from(body);
}

/**
 * Fetch a URL and parse the response body as JSON.
 *
 * Throws `ScratchApiException` on a non-2xx response, transport failure, or
 * malformed JSON.
 */
export async function requestJson<T>(url: string, options?: ApiOptions): Promise<T> {
  const data = await requestBytes(url, options);
  try {
    return JSON.parse(data.toString('utf-8')) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScratchApiException(
      `Failed to parse JSON from ${url}: ${message}`,
      200,
      url,
      truncate(data.toString('utf-8')),
      null,
      error
    );
  }
}

/**
 * Fetch many URLs in parallel and return their bodies keyed by URL.
 *
 * By default a single failure rejects the whole batch: the aggregate
 * `ScratchApiException` names every failing URL and carries the first error as
 * its `cause`. Pass `tolerateFailures: true` to instead return only the bodies
 * that succeeded — callers detect missing URLs by their absence from the map.
 */
export async function requestBytesBatch(
  urls: readonly string[],
  options?: ApiOptions & { tolerateFailures?: boolean }
): Promise<Map<string, Buffer>> {
  if (urls.length === 0) {
    return new Map();
  }
  const unique = Array.from(new Set(urls));

  const settled = await Promise.allSettled(
    unique.map((url) => requestBytes(url, options).then((buf) => ({ url, buf })))
  );

  const bodies = new Map<string, Buffer>();
  const failures: ScratchApiException[] = [];
  for (let i = 0; i < settled.length; i += 1) {
    const result = settled[i];
    const url = unique[i];
    if (result.status === 'fulfilled') {
      bodies.set(result.value.url, result.value.buf);
    } else {
      const reason: unknown = result.reason;
      if (reason instanceof ScratchApiException) {
        failures.push(reason);
      } else {
        failures.push(
          new ScratchApiException(
            `Transport error for ${url}: ${(reason as Error).message}`,
            0,
            url,
            '',
            null,
            reason
          )
        );
      }
    }
  }

  if (failures.length > 0 && !options?.tolerateFailures) {
    if (failures.length === 1) throw failures[0];
    const urlsList = failures.map((f) => f.url).join(', ');
    throw new ScratchApiException(
      `${failures.length} concurrent requests failed. First: ${failures[0].message}. URLs: ${urlsList}`,
      failures[0].statusCode,
      failures[0].url,
      failures[0].bodySnippet,
      failures[0].retryAfterSeconds,
      failures[0]
    );
  }

  return bodies;
}
