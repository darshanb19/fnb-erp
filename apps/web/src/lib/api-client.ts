/**
 * api-client — typed fetch wrapper for the F&B ERP API.
 *
 * Responsibilities (per architecture §17 / DL-029):
 *   (a) Attaches Authorization: Bearer <token> from the auth context.
 *   (b) Parses success responses with a caller-supplied Zod schema.
 *   (c) On HTTP error (status >= 400), parses the §17.5 error envelope
 *       { code, message, details?, timestamp } and throws ApiError.
 *   (d) Network failures (fetch throws) → ApiError with code 'network.fetch_failed'.
 *   (e) Zod parse failures → ApiError with code 'system.zod_parse_failed'.
 *
 * Usage:
 *   const client = createApiClient({ baseUrl: API_BASE_URL, getToken: () => session?.accessToken ?? null });
 *   const cluster = await client.get({ path: '/api/v1/clusters/123', schema: ClusterSchema });
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Typed error thrown by all api-client methods on any failure. */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ---------------------------------------------------------------------------
// Error envelope shape from apps/api (Master Spec §7.5 / base-error.ts)
// ---------------------------------------------------------------------------

const errorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
  timestamp: z.string().optional(),
});

// ---------------------------------------------------------------------------
// ApiClient interface
// ---------------------------------------------------------------------------

export interface ApiClient {
  get<T>(opts: { path: string; schema: z.ZodType<T>; signal?: AbortSignal }): Promise<T>;
  post<T>(opts: {
    path: string;
    body?: unknown;
    schema: z.ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T>;
  put<T>(opts: {
    path: string;
    body?: unknown;
    schema: z.ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T>;
  patch<T>(opts: {
    path: string;
    body?: unknown;
    schema: z.ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T>;
  delete<T>(opts: {
    path: string;
    body?: unknown;
    schema: z.ZodType<T>;
    signal?: AbortSignal;
  }): Promise<T>;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createApiClient(opts: {
  baseUrl: string;
  getToken: () => string | null;
}): ApiClient {
  const { baseUrl, getToken } = opts;

  async function request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const token = getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const url = `${baseUrl}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      });
    } catch (err) {
      throw new ApiError(
        'network.fetch_failed',
        err instanceof Error ? err.message : 'Network request failed',
        undefined,
        undefined,
      );
    }

    // HTTP error — parse the §17.5 error envelope
    if (!response.ok) {
      let parsed: z.infer<typeof errorEnvelopeSchema> | null = null;
      try {
        const raw: unknown = await response.json();
        const result = errorEnvelopeSchema.safeParse(raw);
        if (result.success) {
          parsed = result.data;
        }
      } catch {
        // ignore JSON parse failures; fall through to generic error
      }
      throw new ApiError(
        parsed?.code ?? 'http.error',
        parsed?.message ?? `HTTP ${response.status}`,
        parsed?.details,
        response.status,
      );
    }

    // 204 No Content — no body; caller's schema must accept undefined/null
    if (response.status === 204) {
      const result = schema.safeParse(undefined);
      if (!result.success) {
        throw new ApiError(
          'system.zod_parse_failed',
          'Response body is empty but schema expected content',
          result.error.flatten(),
          response.status,
        );
      }
      return result.data;
    }

    // Parse the success body with the caller-supplied Zod schema
    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch (err) {
      throw new ApiError(
        'network.fetch_failed',
        err instanceof Error ? err.message : 'Failed to parse response JSON',
        undefined,
        response.status,
      );
    }

    const parseResult = schema.safeParse(rawJson);
    if (!parseResult.success) {
      throw new ApiError(
        'system.zod_parse_failed',
        'Response did not match expected schema',
        parseResult.error.flatten(),
        response.status,
      );
    }

    return parseResult.data;
  }

  return {
    get: ({ path, schema, signal }) => request('GET', path, schema, undefined, signal),
    post: ({ path, body, schema, signal }) => request('POST', path, schema, body, signal),
    put: ({ path, body, schema, signal }) => request('PUT', path, schema, body, signal),
    patch: ({ path, body, schema, signal }) => request('PATCH', path, schema, body, signal),
    delete: ({ path, body, schema, signal }) => request('DELETE', path, schema, body, signal),
  };
}
