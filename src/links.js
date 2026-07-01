import Database from "better-sqlite3";

/**
 * Persistent Discord ↔ player-tag links (SQLite via better-sqlite3). A player
 * tag maps to one Discord user, but a Discord user may link several accounts.
 *
 * @typedef {{ playerTag: string, discordId: string, playerName: string | null }} Link
 *
 * @param {string} [path] File path, or ":memory:" (default) for tests.
 */
export function createLinkStore(path = ":memory:") {
    const db = new Database(path);
    db.pragma("journal_mode = WAL");
    db.exec(`
        CREATE TABLE IF NOT EXISTS links (
            player_tag  TEXT PRIMARY KEY,
            discord_id  TEXT NOT NULL,
            player_name TEXT,
            linked_at   INTEGER NOT NULL
        )
    `);

    const upsertStmt = db.prepare(`
        INSERT INTO links (player_tag, discord_id, player_name, linked_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(player_tag) DO UPDATE SET
            discord_id = excluded.discord_id,
            player_name = excluded.player_name,
            linked_at = excluded.linked_at
    `);
    const byPlayerStmt = db.prepare(
        "SELECT player_tag, discord_id, player_name FROM links WHERE player_tag = ?",
    );
    const byDiscordStmt = db.prepare(
        "SELECT player_tag, discord_id, player_name FROM links WHERE discord_id = ? ORDER BY linked_at",
    );
    const deleteStmt = db.prepare("DELETE FROM links WHERE player_tag = ?");

    /** @param {any} row @returns {Link} */
    const toLink = (row) => ({
        playerTag: row.player_tag,
        discordId: row.discord_id,
        playerName: row.player_name,
    });

    return {
        /**
         * @param {string} discordId
         * @param {string} playerTag
         * @param {string | null} [playerName]
         * @param {number} [now]
         */
        link(discordId, playerTag, playerName = null, now = Date.now()) {
            upsertStmt.run(playerTag, discordId, playerName, now);
        },

        /** @param {string} playerTag @returns {Link | null} */
        getByPlayer(playerTag) {
            const row = byPlayerStmt.get(playerTag);
            return row ? toLink(row) : null;
        },

        /** @param {string} discordId @returns {Link[]} */
        listByDiscord(discordId) {
            return byDiscordStmt.all(discordId).map(toLink);
        },

        /** @param {string} playerTag @returns {boolean} */
        unlink(playerTag) {
            return deleteStmt.run(playerTag).changes > 0;
        },

        close() {
            db.close();
        },
    };
}
