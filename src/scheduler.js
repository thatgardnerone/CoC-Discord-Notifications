/**
 * A small polling scheduler. Runs registered tasks on fixed intervals, isolating
 * failures (one poll throwing never stops the loop or other polls) and skipping a
 * tick if the previous run is still in flight (so a slow API call can't pile up
 * overlapping polls). `stop()` clears every interval for graceful shutdown.
 *
 * @param {Object} [opts]
 * @param {(err: unknown) => void} [opts.onError] Handles a task rejection/throw.
 */
export function createScheduler({ onError } = {}) {
    /** @type {ReturnType<typeof setInterval>[]} */
    const handles = [];

    const reportError =
        onError ??
        ((err) =>
            console.error("scheduled task failed:", err instanceof Error ? err.message : err));

    return {
        /**
         * @param {number} seconds Interval in seconds.
         * @param {() => Promise<void> | void} task
         * @param {{ runImmediately?: boolean }} [options]
         */
        every(seconds, task, { runImmediately = true } = {}) {
            let inFlight = false;
            const run = async () => {
                if (inFlight) return; // don't stack overlapping runs
                inFlight = true;
                try {
                    await task();
                } catch (err) {
                    reportError(err);
                } finally {
                    inFlight = false;
                }
            };

            if (runImmediately) void run();
            handles.push(setInterval(() => void run(), seconds * 1000));
        },

        stop() {
            for (const handle of handles) clearInterval(handle);
            handles.length = 0;
        },
    };
}
