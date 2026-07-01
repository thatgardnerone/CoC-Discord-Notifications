/**
 * Minimal structured (JSON-lines) logger — one object per line, ideal for
 * journald/`journalctl`. Inject `write`/`now` for tests.
 *
 * @param {Object} [opts]
 * @param {(line: string) => void} [opts.write]
 * @param {() => string} [opts.now]
 * @param {"debug"|"info"|"warn"|"error"} [opts.level] Minimum level to emit.
 */
export function createLogger({ write, now, level = "info" } = {}) {
    const emit = write ?? ((line) => void process.stdout.write(line));
    const clock = now ?? (() => new Date().toISOString());
    /** @type {Record<string, number>} */
    const RANK = { debug: 10, info: 20, warn: 30, error: 40 };
    const threshold = RANK[level] ?? RANK.info;

    /**
     * @param {string} lvl
     * @param {string} msg
     * @param {object} [fields]
     */
    function log(lvl, msg, fields) {
        if (RANK[lvl] < threshold) return;
        emit(JSON.stringify({ t: clock(), level: lvl, msg, ...fields }) + "\n");
    }

    return {
        /** @param {string} msg @param {object} [fields] */
        debug: (msg, fields) => log("debug", msg, fields),
        /** @param {string} msg @param {object} [fields] */
        info: (msg, fields) => log("info", msg, fields),
        /** @param {string} msg @param {object} [fields] */
        warn: (msg, fields) => log("warn", msg, fields),
        /** @param {string} msg @param {object} [fields] */
        error: (msg, fields) => log("error", msg, fields),
    };
}
