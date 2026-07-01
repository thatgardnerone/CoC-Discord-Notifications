import axios from "axios";
import { withRetry } from "../retry.js";

/**
 * Error thrown by a transport when the CoC API returns a non-2xx status.
 */
export class HttpError extends Error {
    /**
     * @param {number} status
     * @param {Object} [info]
     * @param {unknown} [info.data]
     * @param {Record<string, any>} [info.headers]
     * @param {number} [info.retryAfterSeconds]
     * @param {unknown} [info.cause]
     */
    constructor(status, info = {}) {
        super(`CoC API request failed with status ${status}`);
        this.name = "HttpError";
        this.status = status;
        this.data = info.data;
        this.headers = info.headers;
        this.retryAfterSeconds = info.retryAfterSeconds;
        this.cause = info.cause;
    }
}

/**
 * @typedef {{ status: number, data: any, headers: Record<string, any> }} HttpResponse
 * @typedef {(req: { method: string, path: string }) => Promise<HttpResponse>} Transport
 */

/** @param {unknown} err @returns {boolean} */
function isRetryable(err) {
    // Server-side (5xx) and rate-limit (429) responses are retryable; so are
    // network/timeout errors (which arrive as non-HttpError). 4xx are not.
    if (err instanceof HttpError) return err.status === 429 || err.status >= 500;
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
 * Real transport backed by axios. Normalises axios failures into HttpError.
 *
 * @param {{ token: string, baseUrl?: string, timeout?: number }} cfg
 * @returns {Transport}
 */
function axiosTransport({ token, baseUrl = "https://api.clashofclans.com/v1/", timeout = 10000 }) {
    const instance = axios.create({
        baseURL: baseUrl,
        timeout,
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    });

    return async ({ method, path }) => {
        try {
            const res = await instance.request({ method, url: path });
            return { status: res.status, data: res.data, headers: res.headers };
        } catch (err) {
            const response = /** @type {any} */ (err).response;
            const ra = response?.headers?.["retry-after"];
            throw new HttpError(response?.status ?? 0, {
                data: response?.data,
                headers: response?.headers,
                retryAfterSeconds: ra !== undefined ? Number(ra) : undefined,
                cause: err,
            });
        }
    };
}

/**
 * Creates a hardened CoC HTTP client: bearer auth, a sane timeout, and
 * exponential-backoff retries on 429/5xx/network errors (honouring Retry-After).
 * Inject `transport` (and `sleep`) to feature-test behaviour without axios.
 *
 * @param {Object} [opts]
 * @param {string} [opts.token]
 * @param {string} [opts.baseUrl]
 * @param {number} [opts.timeout]
 * @param {number} [opts.retries]
 * @param {number} [opts.backoffBaseMs]
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {Transport} [opts.transport]
 */
export function createCocClient(opts = {}) {
    const { token = "", baseUrl, timeout, retries = 3, backoffBaseMs = 500, sleep, transport } = opts;
    const send = transport ?? axiosTransport({ token, baseUrl, timeout });

    /**
     * @param {string} path Path relative to the API base (already URL-encoded).
     * @returns {Promise<HttpResponse>}
     */
    function get(path) {
        return withRetry(() => send({ method: "GET", path }), {
            retries,
            baseMs: backoffBaseMs,
            sleep,
            isRetryable,
            retryAfterMs,
        });
    }

    return { get };
}
