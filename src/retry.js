/**
 * Retries an async operation with capped, jittered exponential backoff. Pure and
 * transport-agnostic so the policy can be feature-tested without real timers or
 * network. Inject `random` for deterministic tests.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {Object} [opts]
 * @param {number} [opts.retries] Max retries after the first attempt (default 3).
 * @param {number} [opts.baseMs] Base backoff in ms; capped exponential = min(maxMs, baseMs·2^(n-1)).
 * @param {number} [opts.maxMs] Ceiling for any single delay (default 30000).
 * @param {(ms: number) => Promise<void>} [opts.sleep]
 * @param {() => number} [opts.random] Returns [0,1); used for jitter.
 * @param {(err: unknown) => boolean} [opts.isRetryable]
 * @param {(err: unknown) => number | undefined} [opts.retryAfterMs] Overrides the
 *   computed backoff when it returns a finite, non-negative value (e.g. Retry-After).
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
    const {
        retries = 3,
        baseMs = 500,
        maxMs = 30000,
        sleep = defaultSleep,
        random = Math.random,
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
            await sleep(nextDelay(attempt, err));
        }
    }

    /**
     * @param {number} n
     * @param {unknown} err
     * @returns {number}
     */
    function nextDelay(n, err) {
        const override = retryAfterMs(err);
        if (override !== undefined && Number.isFinite(override) && override >= 0) {
            return Math.min(override, maxMs);
        }
        // Equal jitter: half fixed, half random, to avoid synchronised retries.
        const exp = Math.min(maxMs, baseMs * 2 ** (n - 1));
        return exp / 2 + random() * (exp / 2);
    }
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function defaultSleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
