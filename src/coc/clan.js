/**
 * Clan data service — fetches and normalises the CoC `/clans/{tag}` resource
 * into a stable shape for the rest of the app (so raw API field names don't leak
 * into embeds/commands).
 *
 * @typedef {Object} ClanInfo
 * @property {string} name
 * @property {string} tag
 * @property {number} level
 * @property {number} members
 * @property {string} description
 * @property {number} points
 * @property {number} warWins
 * @property {string | null} location
 * @property {string | null} warLeague
 */

/**
 * @param {{ get: (path: string) => Promise<{ data: any }> }} client
 * @param {string} clanTag Raw tag (e.g. "#PVVY8L2L"); encoded internally.
 */
export function createClanService(client, clanTag) {
    const path = `clans/${encodeURIComponent(clanTag)}`;

    return {
        /** @returns {Promise<ClanInfo>} */
        async getInfo() {
            const { data } = await client.get(path);
            return {
                name: data.name,
                tag: data.tag,
                level: data.clanLevel,
                members: data.members,
                description: data.description ?? "",
                points: data.clanPoints,
                warWins: data.warWins,
                location: data.location?.name ?? null,
                warLeague: data.warLeague?.name ?? null,
            };
        },
    };
}
