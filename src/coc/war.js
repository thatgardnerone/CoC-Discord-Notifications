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
 * Normalises a raw war payload (regular war or a CWL round war — same shape).
 *
 * @param {any} data
 * @returns {import("../features/war.js").WarSnapshot}
 */
export function normaliseWar(data) {
    if (!data || data.state === "notInWar") return { state: "notInWar" };
    return {
        state: data.state,
        teamSize: data.teamSize,
        attacksPerMember: data.attacksPerMember,
        startTime: data.startTime,
        endTime: data.endTime,
        clan: normaliseSide(data.clan),
        opponent: normaliseSide(data.opponent),
    };
}

/**
 * @param {any} side
 * @returns {import("../features/war.js").WarSide}
 */
function normaliseSide(side) {
    return {
        name: side.name,
        tag: side.tag,
        stars: side.stars ?? 0,
        destruction: side.destructionPercentage ?? 0,
        members: (side.members ?? []).map(
            /** @param {any} m */ (m) => ({
                tag: m.tag,
                name: m.name,
                mapPosition: m.mapPosition,
                townhallLevel: m.townhallLevel,
                attacks: (m.attacks ?? []).map(
                    /** @param {any} a */ (a) => ({
                        order: a.order,
                        attackerTag: a.attackerTag,
                        defenderTag: a.defenderTag,
                        stars: a.stars,
                        destructionPercentage: a.destructionPercentage,
                    }),
                ),
            }),
        ),
    };
}
