/**
 * Current-war data service — fetches `/clans/{tag}/currentwar` and normalises it
 * into the {@link import("../features/war.js").WarSnapshot} shape used by event
 * detection and embeds.
 *
 * @param {{ get: (path: string) => Promise<{ data: any }> }} client
 * @param {string} clanTag Raw tag (e.g. "#PVVY8L2L").
 */
export function createWarService(client, clanTag) {
    const path = `clans/${encodeURIComponent(clanTag)}/currentwar`;

    return {
        /** @returns {Promise<import("../features/war.js").WarSnapshot>} */
        async getCurrentWar() {
            const { data } = await client.get(path);
            return normaliseWar(data);
        },
    };
}

/**
 * @param {any} data
 * @returns {import("../features/war.js").WarSnapshot}
 */
function normaliseWar(data) {
    if (!data || data.state === "notInWar") return { state: "notInWar" };
    return {
        state: data.state,
        teamSize: data.teamSize,
        startTime: data.startTime,
        endTime: data.endTime,
        clan: {
            name: data.clan.name,
            tag: data.clan.tag,
            stars: data.clan.stars,
            destruction: data.clan.destructionPercentage,
            attacks: data.clan.attacks,
        },
        opponent: {
            name: data.opponent.name,
            tag: data.opponent.tag,
            stars: data.opponent.stars,
            destruction: data.opponent.destructionPercentage,
        },
    };
}
