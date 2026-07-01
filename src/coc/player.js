/**
 * Player service — verifies in-game API tokens and fetches normalised profiles.
 *
 * @typedef {Object} PlayerProfile
 * @property {string} tag
 * @property {string} name
 * @property {string | null} role  "member" | "admin" (Elder) | "coLeader" | "leader"
 * @property {number} townHallLevel
 * @property {string | null} clanTag
 * @property {string | null} clanName
 *
 * @param {{ get: (path: string) => Promise<{ data: any }>, post: (path: string, body: unknown) => Promise<{ data: any }> }} client
 */
export function createPlayerService(client) {
    return {
        /**
         * Verifies a player-supplied in-game API token (Settings → More Settings →
         * API Token). Tokens are single-use and short-lived.
         *
         * @param {string} playerTag
         * @param {string} token
         * @returns {Promise<boolean>}
         */
        async verifyToken(playerTag, token) {
            const path = `players/${encodeURIComponent(playerTag)}/verifytoken`;
            const { data } = await client.post(path, { token });
            return data?.status === "ok";
        },

        /**
         * @param {string} playerTag
         * @returns {Promise<PlayerProfile>}
         */
        async getPlayer(playerTag) {
            const { data } = await client.get(`players/${encodeURIComponent(playerTag)}`);
            return {
                tag: data.tag,
                name: data.name,
                role: data.role ?? null,
                townHallLevel: data.townHallLevel,
                clanTag: data.clan?.tag ?? null,
                clanName: data.clan?.name ?? null,
            };
        },
    };
}
