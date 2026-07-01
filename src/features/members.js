import { diffBy, changedFields } from "../diff.js";

/**
 * Membership event detection: diffs two roster snapshots and derives the
 * noteworthy changes — joins, leaves, role promotions/demotions, Town Hall
 * upgrades, and in-game name changes. Poll-only API, so this is how the clan
 * feed is produced.
 *
 * @typedef {import("../coc/members.js").Member} Member
 *
 * @typedef {{ type: "join", member: Member }} JoinEvent
 * @typedef {{ type: "leave", member: Member }} LeaveEvent
 * @typedef {{ type: "roleChange", member: Member, from: Member["role"], to: Member["role"], promoted: boolean }} RoleChangeEvent
 * @typedef {{ type: "townHallUpgrade", member: Member, from: number, to: number }} TownHallEvent
 * @typedef {{ type: "nameChange", member: Member, from: string, to: string }} NameChangeEvent
 * @typedef {JoinEvent | LeaveEvent | RoleChangeEvent | TownHallEvent | NameChangeEvent} MemberEvent
 */

/** Role hierarchy for deciding promote vs demote (higher = more senior). */
const ROLE_RANK = { member: 0, admin: 1, coLeader: 2, leader: 3 };

/**
 * @param {Member[]} previous
 * @param {Member[]} current
 * @returns {MemberEvent[]}
 */
export function detectMemberEvents(previous, current) {
    const { added, removed, common } = diffBy(previous, current, (m) => m.tag);

    /** @type {MemberEvent[]} */
    const events = [];

    for (const member of added) events.push({ type: "join", member });
    for (const member of removed) events.push({ type: "leave", member });

    for (const { before, after } of common) {
        // Watch only stable fields — trophies/donations churn every poll and are
        // deliberately excluded (surfaced by /roster and donations, not the feed).
        for (const field of changedFields(before, after, ["role", "townHall", "name"])) {
            if (field === "role") {
                events.push({
                    type: "roleChange",
                    member: after,
                    from: before.role,
                    to: after.role,
                    promoted: ROLE_RANK[after.role] > ROLE_RANK[before.role],
                });
            } else if (field === "townHall" && after.townHall > before.townHall) {
                // Only celebrate upgrades; TH never legitimately drops.
                events.push({
                    type: "townHallUpgrade",
                    member: after,
                    from: before.townHall,
                    to: after.townHall,
                });
            } else if (field === "name") {
                events.push({
                    type: "nameChange",
                    member: after,
                    from: before.name,
                    to: after.name,
                });
            }
        }
    }

    return events;
}
