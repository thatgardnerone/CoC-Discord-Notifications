import { withRetry } from "../retry.js";

/**
 * Error thrown when the CoC API returns a non-2xx status, or a request fails at
 * the network layer (status 0).
 *
 * Deliberately stores only the response status, parsed body, and Retry-After —
 * never request headers or the raw underlying error — so the `Authorization:
 * Bearer <token>` header can never leak into logs (this runs as a journald
 * service).
 */
export class HttpError extends Error {
    /**
     * @param {number} status 0 signals a network/timeout error.
     * @param {Object} [info]
     * @param {unknown} [info.data] Parsed response body (never contains the token).
     * @param {number} [info.retryAfterSeconds]
     */
    constructor(status, info = {}) {
        super(
            status === 0
                ? "CoC API request failed (network error)"
                : `CoC API request failed with status ${status}`,
        );
        this.name = "HttpError";
        this.status = status;
        this.data = info.data;
        this.retryAfterSeconds = info.retryAfterSeconds;
    }
}

/**
 * @typedef {{ status: number, data: any, headers: Record<string, string> }} HttpResponse
 * @typedef {(req: { method: string, path: string }) => Promise<HttpResponse>} Transport
 */

/** @param {unknown} err @returns {boolean} */
function isRetryable(err) {
    if (err instanceof HttpError) {
        // 0 = network/timeout; 408 Request Timeout; 425 Too Early; 429 rate limit; 5xx.
        return (
            err.status === 0 ||
            err.status === 408 ||
            err.status === 425 ||
            err.status === 429 ||
            err.status >= 500
        );
    }
    return true;
}

/** @param {unknown} err @returns {number | undefined} */
function retryAfterMs(err) {
    if (err instanceof HttpError && err.retryAfterSeconds !== undefined) {
        return err.retryAfterSeconds * 1000;
    }
    return undefined;
}

/**
 * Parses a Retry-After header, which RFC 7231 allows to be either delta-seconds
 * or an HTTP-date. Returns seconds, or undefined if unparseable.
 *
 * @param {string | null | undefined} value
 * @returns {number | undefined}
 */
export function parseRetryAfterSeconds(value) {
    if (value == null || value === "") return undefined;
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds);
    const dateMs = Date.parse(value);
    if (!Number.isNaN(dateMs)) return Math.max(0, (dateMs - Date.now()) / 1000);
    return undefined;
}

/**
 * @param {Headers} headers
 * @returns {Record<string, string>}
 */
function headersToObject(headers) {
    /** @type {Record<string, string>} */
    const out = {};
    headers.forEach((value, key) => {
        out[key] = value;
    });
    return out;
}

/**
 * Real transport backed by the platform `fetch` (Node 22+). Applies bearer auth
 * and an abort-based timeout, and normalises all failures into HttpError.
 *
 * @param {{ token: string, baseUrl?: string, timeout?: number, fetchImpl?: typeof fetch }} cfg
 * @returns {Transport}
 */
function fetchTransport({
    token,
    baseUrl = "https://api.clashofclans.com/v1/",
    timeout = 10000,
    fetchImpl = fetch,
}) {
    return async ({ method, path }) => {
        const url = new URL(path, baseUrl).toString();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeout);

        let res;
        try {
            res = await fetchImpl(url, {
                method,
                headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
                signal: controller.signal,
            });
        } catch {
            // Network error, timeout, or abort — retryable, and we surface no
            // request detail (which would include the Authorization header).
            throw new HttpError(0);
        } finally {
            clearTimeout(timer);
        }

        if (!res.ok) {
            throw new HttpError(res.status, {
                data: await safeJson(res),
                retryAfterSeconds: parseRetryAfterSeconds(res.headers.get("retry-after")),
            });
        }

        return {
            status: res.status,
            data: await safeJson(res),
            headers: headersToObject(res.headers),
        };
    };
}

/**
 * @param {Response} res
 * @returns {Promise<any>}
 */
async function safeJson(res) {
    try {
        return await res.json();
    } catch {
        return undefined;
    }
}

/**
 * Creates a hardened CoC HTTP client: bearer auth, an abort timeout, and
 * capped/jittered exponential-backoff retries on 429/5xx/408/425/network errors
 * (honouring Retry-After in either seconds or HTTP-date form). Inject
 * `transport`/`fetchImpl`/`sleep`/`random` to feature-test behaviour.
 *
 * @param {Object} [opts]
 * @param {string} [opts.token]
 * @param {string} [opts.baseUrl]
 * @param {number} [opts.timeout]
 * @param {number} [opts.retries]
 * @param {number} [opts.backoffBaseMs]
 * @param {number} [opts.maxBackoffMs]
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {() => number} [opts.random]
 * @param {Transport} [opts.transport]
 * @param {typeof fetch} [opts.fetchImpl]
 */
export function createCocClient(opts = {}) {
    const {
        token = "",
        baseUrl,
        timeout,
        retries = 3,
        backoffBaseMs = 500,
        maxBackoffMs = 30000,
        sleep,
        random,
        transport,
        fetchImpl,
    } = opts;
    const send = transport ?? fetchTransport({ token, baseUrl, timeout, fetchImpl });

    /**
     * @param {string} path Path relative to the API base (already URL-encoded).
     * @returns {Promise<HttpResponse>}
     */
    function get(path) {
        return withRetry(() => send({ method: "GET", path }), {
            retries,
            baseMs: backoffBaseMs,
            maxMs: maxBackoffMs,
            sleep,
            random,
            isRetryable,
            retryAfterMs,
        });
    }

    return { get };
}
