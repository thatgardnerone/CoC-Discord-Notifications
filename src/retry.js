/**
 * Retries an async operation with exponential backoff. Pure and transport-agnostic
 * so the policy can be feature-tested without real timers or network.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {Object} [opts]
 * @param {number} [opts.retries] Max retries after the first attempt (default 3).
 * @param {number} [opts.baseMs] Base backoff in ms; delay = baseMs · 2^(attempt-1).
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {(err: unknown) => boolean} [opts.isRetryable]
 * @param {(err: unknown) => number | undefined} [opts.retryAfterMs] Overrides the
 *   computed backoff when a value is returned (e.g. from a Retry-After header).
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
    const {
        retries = 3,
        baseMs = 500,
        sleep = defaultSleep,
        isRetryable = () => true,
        retryAfterMs = () => undefined,
    } = opts;

    let attempt = 0;
    for (;;) {
        try {
            return await fn();
        } catch (err) {
            attempt += 1;
            if (attempt > retries || !isRetryable(err)) throw err;
            const override = retryAfterMs(err);
            const delay = override !== undefined ? override : baseMs * 2 ** (attempt - 1);
            await sleep(delay);
        }
    }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
