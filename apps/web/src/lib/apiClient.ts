/**
 * API client with timeout and exponential backoff retry.
 * Every API call has a timeout; retries use exponential backoff.
 */

const DEFAULT_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return body?.message ?? body?.error ?? res.statusText ?? `HTTP ${res.status}`;
  } catch {
    return res.statusText || `HTTP ${res.status}`;
  }
}

/**
 * POST multipart to /api/ingest
 */
export async function ingestFile(file: File, onProgress?: (pct: number) => void): Promise<{ session_id: string }> {
  const url = '/api/ingest';
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

      const p = new Promise<{ session_id: string }>((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress((e.loaded / e.total) * 100);
          }
        });
        xhr.addEventListener('load', () => {
          clearTimeout(timeoutId);
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              resolve(data);
            } catch {
              reject(new ApiError('Invalid JSON response', xhr.status));
            }
          } else {
            let msg = xhr.responseText || xhr.statusText || `HTTP ${xhr.status}`;
            try {
              const parsed = JSON.parse(xhr.responseText);
              msg = parsed?.message ?? parsed?.error ?? msg;
            } catch {
              // keep msg as is
            }
            reject(new ApiError(msg, xhr.status));
          }
        });
        xhr.addEventListener('error', () => {
          clearTimeout(timeoutId);
          reject(new ApiError('Network error'));
        });
        xhr.addEventListener('abort', () => {
          clearTimeout(timeoutId);
          reject(new ApiError('Request timed out'));
        });
        xhr.open('POST', url);
        xhr.send(formData);
      });

      return await p;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new ApiError('Unknown error');
}

/**
 * GET /api/session/:id - digitization result
 */
export async function getSession(sessionId: string): Promise<{ digitization: import('../types/visualizationParams').DigitizationResult; viz_params?: import('../types/visualizationParams').VisualizationParameterJSON }> {
  const url = `/api/session/${sessionId}`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' });
      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        throw new ApiError(msg, res.status);
      }
      return await res.json();
    } catch (e) {
      lastError = e instanceof ApiError ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new ApiError('Unknown error');
}

/**
 * GET /api/session/:id/overlay - overlay image URL or blob
 */
export async function getOverlayUrl(sessionId: string): Promise<string> {
  const url = `/api/session/${sessionId}/overlay`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' });
      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        throw new ApiError(msg, res.status);
      }
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch (e) {
      lastError = e instanceof ApiError ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new ApiError('Unknown error');
}

/**
 * POST /api/session/:id/interpret - trigger interpretation, returns viz params
 */
export async function triggerInterpretation(sessionId: string): Promise<import('../types/visualizationParams').VisualizationParameterJSON> {
  const url = `/api/session/${sessionId}/interpret`;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetchWithTimeout(url, { method: 'POST' });
      if (!res.ok) {
        const msg = await parseErrorResponse(res);
        throw new ApiError(msg, res.status);
      }
      return await res.json();
    } catch (e) {
      lastError = e instanceof ApiError ? e : new Error(String(e));
      if (attempt < MAX_RETRIES) {
        const backoff = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await sleep(backoff);
      } else {
        throw lastError;
      }
    }
  }

  throw lastError ?? new ApiError('Unknown error');
}
