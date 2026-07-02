/**
 * Donation tracking. The CoC API exposes per-member `donations` /
 * `donationsReceived` as running totals that reset to 0 at the monthly season
 * rollover. A *weekly* leaderboard therefore can't just read the counter — it
 * has to accumulate the deltas between polls into a per-week tally, and cope with
 * the counter dropping to (near) 0 mid-week when the season resets.
 *
 * The accumulator is a pure reducer over successive polls so it's fully testable
 * without a clock or network; the watcher supplies the current ISO-week key.
 *
 * @typedef {import("../coc/members.js").Member} Member
 *
 * @typedef {Object} DonationCount
 * @property {number} d Cumulative donations given (this season).
 * @property {number} r Cumulative donations received (this season).
 *
 * @typedef {Object} DonationRow
 * @property {string} tag
 * @property {string} name
 * @property {number} donated
 * @property {number} received
 *
 * @typedef {Object} DonationState
 * @property {string} period ISO-week key the `tally` is accumulating into.
 * @property {Record<string, DonationCount>} last Last-seen cumulative per tag.
 * @property {Record<string, DonationRow>} tally Accumulated deltas this week.
 */

/**
 * ISO-8601 week key (UTC), e.g. "2026-W27". Weeks start Monday; the week's year
 * is the year of its Thursday, so end-of-December/early-January weeks are grouped
 * correctly. Used to detect when a new week has begun.
 *
 * @param {Date} date
 * @returns {string}
 */
export function weekKey(date) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    // Shift to the Thursday of this week (Mon=0 … Sun=6).
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    const week = 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * A single poll's contribution, per member, since we last saw them. If the
 * counter dropped (season reset, or the rare re-join), the delta is the current
 * value — everything before the drop was already tallied on earlier polls.
 *
 * @param {DonationCount | undefined} was
 * @param {DonationCount} cur
 * @returns {DonationCount} The delta to add to the running tally.
 */
function delta(was, cur) {
    if (!was) return { d: cur.d, r: cur.r }; // first sighting: counts from 0
    return {
        d: cur.d >= was.d ? cur.d - was.d : cur.d,
        r: cur.r >= was.r ? cur.r - was.r : cur.r,
    };
}

/**
 * Folds one poll into the running weekly tally. On the first ever poll it just
 * establishes a baseline (no rollover). When `period` differs from the stored
 * period the week has rolled over: the just-completed week's rows are returned
 * as `rollover` (for the watcher to post) and a fresh tally begins.
 *
 * @param {DonationState | null} prev
 * @param {Member[]} members Current roster with cumulative counters.
 * @param {string} period Current ISO-week key.
 * @returns {{ next: DonationState, rollover: DonationRow[] | null }}
 */
export function accumulateDonations(prev, members, period) {
    /** @type {Record<string, DonationCount>} */
    const nextLast = {};
    for (const m of members) nextLast[m.tag] = { d: m.donations, r: m.donationsReceived };

    if (!prev) {
        // Baseline only — we have no prior counters to diff against yet.
        return { next: { period, last: nextLast, tally: {} }, rollover: null };
    }

    // Accumulate this poll's deltas into the (cloned) running tally first, so the
    // final boundary-crossing delta lands in the week we're about to post.
    /** @type {Record<string, DonationRow>} */
    const tally = {};
    for (const [tag, row] of Object.entries(prev.tally)) tally[tag] = { ...row };

    for (const m of members) {
        const { d, r } = delta(prev.last[m.tag], { d: m.donations, r: m.donationsReceived });
        const row = tally[m.tag] ?? { tag: m.tag, name: m.name, donated: 0, received: 0 };
        row.name = m.name; // keep the display name fresh
        row.donated += d;
        row.received += r;
        tally[m.tag] = row;
    }

    if (prev.period !== period) {
        const rollover = Object.values(tally).filter((row) => row.donated > 0 || row.received > 0);
        return { next: { period, last: nextLast, tally: {} }, rollover };
    }

    return { next: { period, last: nextLast, tally }, rollover: null };
}

/**
 * Donation-to-received ratio. Someone who only gives (received 0) is shown as
 * their donation count so they still sort sensibly and read as "generous".
 *
 * @param {number} donated
 * @param {number} received
 * @returns {number}
 */
export function donationRatio(donated, received) {
    return received > 0 ? donated / received : donated;
}

/**
 * Ranks rows for the leaderboard: most donated first, ratio as the tiebreak.
 *
 * @param {DonationRow[]} rows
 * @returns {(DonationRow & { ratio: number })[]}
 */
export function donationLeaderboard(rows) {
    return rows
        .map((row) => ({ ...row, ratio: donationRatio(row.donated, row.received) }))
        .sort((a, b) => b.donated - a.donated || b.ratio - a.ratio);
}

/**
 * Current-season table straight from the live roster (for /donations) — the API
 * counter already is the season-to-date total, so no accumulation is needed.
 *
 * @param {Member[]} members
 * @returns {(DonationRow & { ratio: number })[]}
 */
export function currentSeasonTable(members) {
    return donationLeaderboard(
        members.map((m) => ({
            tag: m.tag,
            name: m.name,
            donated: m.donations,
            received: m.donationsReceived,
        })),
    );
}
