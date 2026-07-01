/**
 * Clan Capital raid-weekend event detection. Poll-only API, so raid start/end
 * are derived by comparing the latest raid season against the stored snapshot.
 *
 * @typedef {{ state: "none" }} NoRaid
 * @typedef {Object} RaidMember
 * @property {string} tag
 * @property {string} name
 * @property {number} attacksUsed
 * @property {number} attacksAllowed
 * @property {number} looted Capital gold looted this weekend.
 *
 * @typedef {Object} RaidSeason
 * @property {"ongoing"|"ended"} state
 * @property {string} startTime
 * @property {string} endTime
 * @property {number} totalLoot
 * @property {number} raidsCompleted
 * @property {number} totalAttacks
 * @property {number} districtsDestroyed
 * @property {number} offensiveReward
 * @property {number} defensiveReward
 * @property {RaidMember[]} members
 *
 * @typedef {NoRaid | RaidSeason} RaidSnapshot
 *
 * @typedef {{ type: "raidStart", raid: RaidSeason }} RaidStartEvent
 * @typedef {{ type: "raidEnd", raid: RaidSeason }} RaidEndEvent
 * @typedef {RaidStartEvent | RaidEndEvent} RaidEvent
 */

/**
 * Detects raid-weekend transitions between two snapshots. Seasons are
 * distinguished by `startTime`, so a fresh weekend (new startTime) reads as a
 * start even if the previous snapshot was a different, already-ended season.
 *
 * `previous` is null on the watcher's first run (baseline) — no events, so the
 * bot never re-announces a weekend it booted into.
 *
 * @param {RaidSnapshot | null} previous
 * @param {RaidSnapshot} current
 * @returns {RaidEvent[]}
 */
export function detectRaidEvents(previous, current) {
    /** @type {RaidEvent[]} */
    const events = [];
    if (!previous) return events; // first run: establish baseline silently
    if (current.state === "none") return events;

    const prevStart = previous.state === "none" ? null : previous.startTime;

    // A new weekend is ongoing that we weren't already watching.
    if (current.state === "ongoing" && prevStart !== current.startTime) {
        events.push({ type: "raidStart", raid: current });
    }

    // The exact weekend we were watching has just ended.
    if (
        current.state === "ended" &&
        previous.state === "ongoing" &&
        prevStart === current.startTime
    ) {
        events.push({ type: "raidEnd", raid: current });
    }

    return events;
}

/**
 * Members who opened the raid but left attacks on the table (used < allowed),
 * ordered by most attacks missed. No-shows aren't in the API payload, so they
 * can't be reported here.
 *
 * @param {RaidSeason} raid
 * @returns {{ tag: string, name: string, used: number, allowed: number }[]}
 */
export function computeMissedRaiders(raid) {
    return raid.members
        .filter((m) => m.attacksUsed < m.attacksAllowed)
        .map((m) => ({ tag: m.tag, name: m.name, used: m.attacksUsed, allowed: m.attacksAllowed }))
        .sort((a, b) => b.allowed - b.used - (a.allowed - a.used));
}

/**
 * Members ranked by capital gold looted (descending), for the contribution
 * leaderboard.
 *
 * @param {RaidSeason} raid
 * @returns {RaidMember[]}
 */
export function capitalLeaderboard(raid) {
    return [...raid.members].sort((a, b) => b.looted - a.looted);
}
