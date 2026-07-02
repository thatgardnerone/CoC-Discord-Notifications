/**
 * Clan HQ "living dashboard" — a single always-current message the bot edits in
 * place rather than a stream of posts (see #67, moonshot idea #1). This module is
 * a *pure view* over snapshots the other watchers already persist (war, capital,
 * donations) plus a fresh clan-info fetch, so it adds no diffing logic and no
 * extra CoC load beyond one clan read per tick. `buildDashboardView` flattens
 * those inputs into an embed-ready shape; the embed itself lives in embeds.js.
 *
 * @typedef {import("./war.js").WarSnapshot} WarSnapshot
 * @typedef {import("./capital.js").RaidSnapshot} RaidSnapshot
 * @typedef {import("./donations.js").DonationState} DonationState
 * @typedef {import("../coc/clan.js").ClanInfo} ClanInfo
 *
 * @typedef {Object} DashboardView
 * @property {string} clanName
 * @property {null | { state: string, phase: string, opponent: string, ourStars: number, theirStars: number, ourDestruction: number, theirDestruction: number, startTime?: string, endTime?: string }} war
 * @property {null | { totalLoot: number, districtsDestroyed: number, endTime: string }} raid
 * @property {null | { name: string, donated: number }} topDonator
 * @property {null | { members: number, warLeague: string | null, level: number, points: number }} totals
 */

const WAR_PHASE = {
    preparation: "🛡️ Preparation",
    inWar: "⚔️ Battle day",
    warEnded: "Ended",
};

/**
 * Picks the war to show on the dashboard: a live regular war takes precedence,
 * else a live CWL war, else whichever snapshot exists (so the section reads
 * "no active war" rather than vanishing). Both snapshots share the WarSnapshot
 * shape — CWL reuses the war watcher under a separate key.
 *
 * @param {WarSnapshot | null} war Regular-war snapshot (key "war").
 * @param {WarSnapshot | null} cwl CWL-round snapshot (key "cwl").
 * @returns {WarSnapshot | null}
 */
export function pickActiveWar(war, cwl) {
    const isActive = (/** @type {WarSnapshot | null} */ w) => w != null && w.state !== "notInWar";
    if (isActive(war)) return war;
    if (isActive(cwl)) return cwl;
    return war ?? cwl ?? null;
}

/**
 * The current weekly-tally leader, or null if nothing's been donated yet this
 * week. Reads the donations accumulator's in-progress `tally` (not a completed
 * week), so the dashboard reflects the live race.
 *
 * @param {DonationState | null} donations
 * @returns {{ name: string, donated: number } | null}
 */
export function topDonator(donations) {
    if (!donations || !donations.tally) return null;
    let best = null;
    for (const row of Object.values(donations.tally)) {
        if (row.donated > 0 && (!best || row.donated > best.donated)) {
            best = { name: row.name, donated: row.donated };
        }
    }
    return best;
}

/**
 * Flattens the stored snapshots into an embed-ready view. Every section degrades
 * independently: a missing/idle snapshot just nulls its section rather than
 * failing the whole dashboard.
 *
 * @param {Object} snapshots
 * @param {WarSnapshot | null} snapshots.war
 * @param {RaidSnapshot | null} snapshots.raid
 * @param {DonationState | null} snapshots.donations
 * @param {ClanInfo | null} snapshots.clan
 * @returns {DashboardView}
 */
export function buildDashboardView({ war, raid, donations, clan }) {
    /** @type {DashboardView["war"]} */
    let warView = null;
    if (war && war.state !== "notInWar") {
        warView = {
            state: war.state,
            phase: WAR_PHASE[war.state] ?? war.state,
            opponent: war.opponent.name,
            ourStars: war.clan.stars,
            theirStars: war.opponent.stars,
            ourDestruction: war.clan.destruction,
            theirDestruction: war.opponent.destruction,
            startTime: war.startTime,
            endTime: war.endTime,
        };
    }

    /** @type {DashboardView["raid"]} */
    let raidView = null;
    if (raid && raid.state === "ongoing") {
        raidView = {
            totalLoot: raid.totalLoot,
            districtsDestroyed: raid.districtsDestroyed,
            endTime: raid.endTime,
        };
    }

    return {
        clanName: clan?.name ?? (war && war.state !== "notInWar" ? war.clan.name : "Clan"),
        war: warView,
        raid: raidView,
        topDonator: topDonator(donations),
        totals: clan
            ? {
                  members: clan.members,
                  warLeague: clan.warLeague,
                  level: clan.level,
                  points: clan.points,
              }
            : null,
    };
}
