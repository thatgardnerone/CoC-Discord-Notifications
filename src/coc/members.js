/**
 * Clan roster service — fetches `/clans/{tag}/members` and normalises each
 * member into a stable shape for diffing and display. Note the CoC API field is
 * `townHallLevel` here (capital H), unlike the war member object's
 * `townhallLevel` — we normalise to `townHall` so the inconsistency stays
 * contained to this boundary.
 *
 * @typedef {Object} Member
 * @property {string} tag
 * @property {string} name
 * @property {"member"|"admin"|"coLeader"|"leader"} role Raw CoC role (admin = Elder in-game).
 * @property {number} townHall
 * @property {number} trophies
 * @property {number} donations
 * @property {number} donationsReceived
 * @property {number} clanRank Trophy rank within the clan (1 = top).
 */

/**
 * @param {{ get: (path: string) => Promise<{ data: any }> }} client
 * @param {string} clanTag Raw tag (e.g. "#PVVY8L2L"); encoded internally.
 */
export function createMembersService(client, clanTag) {
    const path = `clans/${encodeURIComponent(clanTag)}/members`;

    return {
        /** @returns {Promise<Member[]>} */
        async getMembers() {
            const { data } = await client.get(path);
            return (data.items ?? []).map(normaliseMember);
        },
    };
}

/**
 * @param {any} m
 * @returns {import("./members.js").Member}
 */
export function normaliseMember(m) {
    return {
        tag: m.tag,
        name: m.name,
        role: m.role,
        townHall: m.townHallLevel ?? 0,
        trophies: m.trophies ?? 0,
        donations: m.donations ?? 0,
        donationsReceived: m.donationsReceived ?? 0,
        clanRank: m.clanRank ?? 0,
    };
}
