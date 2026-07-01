import Database from "better-sqlite3";

/**
 * Persistent snapshot store (SQLite via better-sqlite3). Because the CoC API is
 * poll-only, the bot compares the previous snapshot with the current one on each
 * poll — this store is where "previous" lives, so state survives restarts and we
 * don't re-announce everything (or miss changes) after a deploy.
 *
 * @param {string} [path] File path, or ":memory:" (default) for tests.
 */
export function createStore(path = ":memory:") {
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS snapshots (
            key        TEXT PRIMARY KEY,
            value      TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )
    `);

    const selectStmt = db.prepare("SELECT value FROM snapshots WHERE key = ?");
    const upsertStmt = db.prepare(`
        INSERT INTO snapshots (key, value, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    return {
        /**
         * @param {string} key
         * @returns {any} The parsed snapshot, or null if none stored.
         */
        getSnapshot(key) {
            const row = /** @type {{ value: string } | undefined} */ (selectStmt.get(key));
            return row ? JSON.parse(row.value) : null;
        },

        /**
         * @param {string} key
         * @param {unknown} value JSON-serialisable snapshot.
         * @param {number} [now] Epoch ms (injectable for tests).
         */
        setSnapshot(key, value, now = Date.now()) {
            upsertStmt.run(key, JSON.stringify(value), now);
        },

        close() {
            db.close();
        },
    };
}
