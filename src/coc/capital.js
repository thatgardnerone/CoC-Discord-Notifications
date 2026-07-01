/**
 * Clan Capital raid service — fetches `/clans/{tag}/capitalraidseasons` and
 * normalises the latest raid weekend into a stable shape for diffing and
 * embeds. The endpoint returns most-recent-first; we only ever look at the
 * current/latest season (`items[0]`).
 *
 * Caveat: the `members` array lists only participants — a member who never
 * opened the raid is absent entirely. So missed-raid tracking covers people who
 * attacked but didn't finish their 6, not no-shows (they aren't in the payload).
 *
 * @param {{ get: (path: string) => Promise<{ data: any }> }} client
 * @param {string} clanTag Raw tag (e.g. "#PVVY8L2L"); encoded internally.
 */
export function createCapitalService(client, clanTag) {
    const path = `clans/${encodeURIComponent(clanTag)}/capitalraidseasons?limit=1`;

    return {
        /** @returns {Promise<import("../features/capital.js").RaidSnapshot>} */
        async getCurrentRaid() {
            const { data } = await client.get(path);
            const season = (data.items ?? [])[0];
            return normaliseRaid(season);
        },
    };
}

/**
 * @param {any} s Raw season object, or undefined when the clan has no raid history.
 * @returns {import("../features/capital.js").RaidSnapshot}
 */
export function normaliseRaid(s) {
    if (!s) return { state: "none" };
    return {
        state: s.state,
        startTime: s.startTime,
        endTime: s.endTime,
        totalLoot: s.capitalTotalLoot ?? 0,
        raidsCompleted: s.raidsCompleted ?? 0,
        totalAttacks: s.totalAttacks ?? 0,
        districtsDestroyed: s.enemyDistrictsDestroyed ?? 0,
        offensiveReward: s.offensiveReward ?? 0,
        defensiveReward: s.defensiveReward ?? 0,
        members: (s.members ?? []).map(
            /** @param {any} m */ (m) => ({
                tag: m.tag,
                name: m.name,
                attacksUsed: m.attacks ?? 0,
                // Total swings allowed = base limit + any bonus attacks earned.
                attacksAllowed: (m.attackLimit ?? 0) + (m.bonusAttackLimit ?? 0),
                looted: m.capitalResourcesLooted ?? 0,
            }),
        ),
    };
}
