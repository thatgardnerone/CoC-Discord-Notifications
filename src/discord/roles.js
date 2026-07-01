/**
 * Maps a clan member's in-game rank to a Discord role and keeps it in sync.
 *
 * @typedef {import("../config.js").Config["roles"]} RoleMap
 */

/**
 * @param {string | null} cocRole CoC role: "leader" | "coLeader" | "admin" (Elder) | "member".
 * @param {RoleMap} roleMap
 * @returns {string | null} The mapped Discord role ID, or null if unmapped.
 */
export function roleForCocRole(cocRole, roleMap) {
    switch (cocRole) {
        case "leader":
            return roleMap.leader;
        case "coLeader":
            return roleMap.coLeader;
        case "admin":
            return roleMap.elder;
        case "member":
            return roleMap.member;
        default:
            return null;
    }
}

/**
 * Computes the role changes so a member holds exactly the role for their current
 * rank: add the desired role if missing, and remove any *other* managed clan
 * roles they still hold (handles promotion/demotion). Unmanaged roles are left
 * untouched.
 *
 * @param {string | null} cocRole
 * @param {RoleMap} roleMap
 * @param {string[]} currentRoleIds
 * @returns {{ add: string[], remove: string[] }}
 */
export function resolveRoleChange(cocRole, roleMap, currentRoleIds) {
    const managed = [roleMap.leader, roleMap.coLeader, roleMap.elder, roleMap.member].filter(
        /** @returns {id is string} */ (id) => Boolean(id),
    );
    const desired = roleForCocRole(cocRole, roleMap);
    const current = new Set(currentRoleIds);

    return {
        add: desired && !current.has(desired) ? [desired] : [],
        remove: managed.filter((id) => id !== desired && current.has(id)),
    };
}

/**
 * Applies {@link resolveRoleChange} to a Discord guild member. Thin wrapper over
 * the pure logic; tolerant of Discord API failures (logs, never throws).
 *
 * @param {import("discord.js").GuildMember} member
 * @param {string | null} cocRole
 * @param {RoleMap} roleMap
 * @param {{ warn: (msg: string, fields?: object) => void }} [logger]
 * @returns {Promise<{ add: string[], remove: string[] }>}
 */
export async function applyClanRole(member, cocRole, roleMap, logger = console) {
    const change = resolveRoleChange(cocRole, roleMap, [...member.roles.cache.keys()]);
    try {
        if (change.add.length) await member.roles.add(change.add);
        if (change.remove.length) await member.roles.remove(change.remove);
    } catch (err) {
        logger.warn(
            `role sync failed for ${member.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
    }
    return change;
}
