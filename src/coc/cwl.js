import { HttpError } from "./http.js";
import { normaliseWar } from "./war.js";

/**
 * Clan War League service. Reads the league group (the month's 8-clan group and
 * its 7 rounds of war tags) and resolves our clan's current round war. A CWL
 * round war has the same shape as a regular war, so it reuses {@link normaliseWar}
 * and all the war detection/embeds.
 *
 * @typedef {{ state: string, season: string, clanTags: string[], rounds: string[][] }} LeagueGroup
 *
 * @param {{ get: (path: string) => Promise<{ data: any }> }} client
 * @param {string} clanTag Our clan tag (normalised, e.g. "#PVVY8L2L").
 */
export function createCwlService(client, clanTag) {
    const encodedTag = encodeURIComponent(clanTag);

    /** @returns {Promise<LeagueGroup | null>} null when not in CWL (404). */
    async function getLeagueGroup() {
        try {
            const { data } = await client.get(`clans/${encodedTag}/currentwar/leaguegroup`);
            return {
                state: data.state,
                season: data.season,
                clanTags: (data.clans ?? []).map(/** @param {any} c */ (c) => c.tag),
                rounds: (data.rounds ?? []).map(
                    /** @param {any} r */ (r) =>
                        (r.warTags ?? []).filter(/** @param {string} t */ (t) => t && t !== "#0"),
                ),
            };
        } catch (err) {
            if (err instanceof HttpError && err.status === 404) return null;
            throw err;
        }
    }

    /** @param {string} warTag @returns {Promise<import("../features/war.js").WarSnapshot>} */
    async function getLeagueWar(warTag) {
        const { data } = await client.get(`clanwarleagues/wars/${encodeURIComponent(warTag)}`);
        return normaliseWar(data);
    }

    /**
     * Our clan's most relevant CWL war right now: the in-progress round if any,
     * else the upcoming (preparation) round, else the latest ended round. The war
     * is oriented so OUR clan is `clan`. Returns null when CWL isn't active.
     *
     * @returns {Promise<{ war: import("../features/war.js").ActiveWar, round: number } | null>}
     */
    async function findCurrentWar() {
        const group = await getLeagueGroup();
        if (!group || (group.state !== "inWar" && group.state !== "preparation")) return null;

        /** @type {{ war: any, round: number } | null} */
        let inWar = null;
        /** @type {{ war: any, round: number } | null} */
        let prep = null;
        /** @type {{ war: any, round: number } | null} */
        let ended = null;

        for (let i = 0; i < group.rounds.length; i++) {
            for (const warTag of group.rounds[i]) {
                const war = await getLeagueWar(warTag);
                if (war.state === "notInWar") continue;
                if (war.clan.tag !== clanTag && war.opponent.tag !== clanTag) continue;
                const entry = { war: orient(war, clanTag), round: i + 1 };
                if (entry.war.state === "inWar") inWar = entry;
                else if (entry.war.state === "preparation") prep = entry;
                else ended = entry;
                break; // our war for this round found
            }
        }
        return inWar ?? prep ?? ended;
    }

    return { getLeagueGroup, getLeagueWar, findCurrentWar };
}

/**
 * Orients a war so `clan` is our clan (CWL wars fetched by tag are from an
 * arbitrary side's perspective).
 *
 * @param {any} war
 * @param {string} tag
 */
function orient(war, tag) {
    if (war.state === "notInWar" || war.clan.tag === tag) return war;
    return { ...war, clan: war.opponent, opponent: war.clan };
}
