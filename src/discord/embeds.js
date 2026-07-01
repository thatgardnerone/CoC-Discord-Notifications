import { EmbedBuilder } from "discord.js";
import { cocTimeToUnix } from "../coc/time.js";

/** @param {string | undefined} cocTime @returns {string} */
function discordTime(cocTime) {
    const unix = cocTimeToUnix(cocTime);
    return unix ? `<t:${unix}:R>` : "soon";
}

/**
 * Builds the embed for the /clan_info command.
 *
 * @param {import("../coc/clan.js").ClanInfo} clan
 * @returns {EmbedBuilder}
 */
export function clanInfoEmbed(clan) {
    return new EmbedBuilder()
        .setTitle(`${clan.name} (${clan.tag})`)
        .setDescription(clan.description || null)
        .addFields(
            { name: "Level", value: String(clan.level), inline: true },
            { name: "Members", value: `${clan.members}/50`, inline: true },
            { name: "Points", value: String(clan.points), inline: true },
            { name: "War Wins", value: String(clan.warWins), inline: true },
            { name: "War League", value: clan.warLeague ?? "—", inline: true },
            { name: "Location", value: clan.location ?? "—", inline: true },
        );
}

/**
 * @param {import("../features/war.js").ActiveWar} war
 * @returns {EmbedBuilder}
 */
export function warPreparationEmbed(war) {
    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`🛡️ War declared — ${war.clan.name} vs ${war.opponent.name}`)
        .addFields(
            { name: "Size", value: `${war.teamSize}v${war.teamSize}`, inline: true },
            { name: "Opponent", value: `${war.opponent.name} (${war.opponent.tag})`, inline: true },
            { name: "Battle day starts", value: discordTime(war.startTime), inline: false },
        );
}

/**
 * @param {import("../features/war.js").ActiveWar} war
 * @returns {EmbedBuilder}
 */
export function warStartEmbed(war) {
    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`⚔️ Battle day! ${war.clan.name} vs ${war.opponent.name}`)
        .setDescription("Attacks are open — don't forget to use both!")
        .addFields(
            { name: "Size", value: `${war.teamSize}v${war.teamSize}`, inline: true },
            { name: "War ends", value: discordTime(war.endTime), inline: true },
        );
}

/**
 * Batches new war attacks from a single poll into one embed (avoids one message
 * per attack). 🟢 = our attack, 🔴 = opponent attack.
 *
 * @param {import("../features/war.js").LoggedAttack[]} attacks
 * @returns {EmbedBuilder}
 */
export function attackLogEmbed(attacks) {
    const lines = attacks.map((a) => {
        const flag = a.side === "clan" ? "🟢" : "🔴";
        return `${flag} **${a.attackerName}** — ${a.stars}⭐ (${a.destructionPercentage}%)`;
    });
    // Guard: setDescription("") throws in discord.js v14.
    const description = lines.join("\n").slice(0, 4096) || "No new attacks.";
    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle("⚔️ War attacks")
        .setDescription(description);
}

/**
 * Builds the war attack-reminder message. Mentions are pre-resolved by the
 * caller (linked members → `<@id>`, otherwise their in-game name).
 *
 * @param {{ mention: string, remaining: number }[]} due
 * @param {string} timeLeft Human label for time remaining, e.g. "2h" or "45m".
 * @returns {string}
 */
export function attackReminderMessage(due, timeLeft) {
    const lines = due.map(
        (d) => `${d.mention} — ${d.remaining} attack${d.remaining > 1 ? "s" : ""} left`,
    );
    return `⏰ **${timeLeft} left** in the war — use your attacks!\n${lines.join("\n")}`;
}

/**
 * @param {import("../features/war.js").ActiveWar} war
 * @param {import("../features/war.js").MissedAttacker[]} missed
 * @returns {EmbedBuilder}
 */
export function missedAttackEmbed(war, missed) {
    const description = missed.length
        ? missed
              .map((m) => `• **${m.name}** — used ${m.used}/${m.of}`)
              .join("\n")
              .slice(0, 4096)
        : "Everyone used all their attacks! 🎉";
    return new EmbedBuilder()
        .setColor(missed.length ? 0xe74c3c : 0x2ecc71)
        .setTitle(`📋 Missed attacks — vs ${war.opponent.name}`)
        .setDescription(description);
}

/**
 * @param {import("../features/war.js").ActiveWar} war Oriented so `clan` is us.
 * @param {number} round CWL round number (1–7).
 * @returns {EmbedBuilder}
 */
export function cwlStatusEmbed(war, round) {
    const stateLabel = { preparation: "Preparation", inWar: "Battle day", warEnded: "Ended" };
    return new EmbedBuilder()
        .setColor(0x9b59b6)
        .setTitle(`🏆 CWL Round ${round} — ${war.clan.name} vs ${war.opponent.name}`)
        .addFields(
            { name: "State", value: stateLabel[war.state] ?? war.state, inline: true },
            { name: "Stars", value: `${war.clan.stars} – ${war.opponent.stars}`, inline: true },
            {
                name: "Destruction",
                value: `${war.clan.destruction.toFixed(1)}% – ${war.opponent.destruction.toFixed(1)}%`,
                inline: true,
            },
        );
}

/** @param {number} n @returns {string} */
const num = (n) => n.toLocaleString("en-US");

/**
 * @param {import("../features/capital.js").RaidSeason} raid
 * @returns {EmbedBuilder}
 */
export function raidStartEmbed(raid) {
    return new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🏰 Raid weekend has begun!")
        .setDescription("Capital raids are open — everyone gets 6 attacks. Go get that loot!")
        .addFields({ name: "Ends", value: discordTime(raid.endTime), inline: true });
}

/**
 * End-of-weekend summary: loot, districts, raids completed and medals earned.
 *
 * @param {import("../features/capital.js").RaidSeason} raid
 * @returns {EmbedBuilder}
 */
export function raidEndEmbed(raid) {
    // Reused by /raid mid-weekend, so the title reflects whether it's live.
    const title =
        raid.state === "ongoing"
            ? "🏰 Raid weekend so far"
            : "🏰 Raid weekend over — here's the haul";
    return new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(title)
        .addFields(
            { name: "Capital Gold", value: `${num(raid.totalLoot)} 🟡`, inline: true },
            { name: "Raids Completed", value: String(raid.raidsCompleted), inline: true },
            { name: "Districts Destroyed", value: String(raid.districtsDestroyed), inline: true },
            { name: "Total Attacks", value: String(raid.totalAttacks), inline: true },
            { name: "Offence Medals", value: `${num(raid.offensiveReward)} 🏅`, inline: true },
            { name: "Defence Medals", value: `${num(raid.defensiveReward)} 🛡️`, inline: true },
        );
}

/**
 * @param {{ name: string, used: number, allowed: number }[]} missed
 * @returns {EmbedBuilder}
 */
export function capitalMissedEmbed(missed) {
    const description = missed.length
        ? missed
              .map((m) => `• **${m.name}** — used ${m.used}/${m.allowed}`)
              .join("\n")
              .slice(0, 4096)
        : "Everyone who raided used all their attacks! 🎉";
    return new EmbedBuilder()
        .setColor(missed.length ? 0xe74c3c : 0x2ecc71)
        .setTitle("📋 Unfinished raids")
        .setDescription(description);
}

/**
 * Capital-gold contribution leaderboard. Medals for the top three; loot shown
 * per member. Capped at 50 (max clan raiders) — well within the 4096-char limit.
 *
 * @param {import("../features/capital.js").RaidMember[]} board
 * @returns {EmbedBuilder}
 */
export function capitalLeaderboardEmbed(board) {
    const medal = ["🥇", "🥈", "🥉"];
    const lines = board
        .slice(0, 50)
        .map((m, i) => `${medal[i] ?? `\`${i + 1}.\``} **${m.name}** — ${num(m.looted)} 🟡`);
    const description = lines.join("\n").slice(0, 4096) || "No participants.";
    return new EmbedBuilder()
        .setColor(0xf1c40f)
        .setTitle("🏆 Capital gold contributions")
        .setDescription(description);
}

const ROLE_LABEL = {
    member: "Member",
    admin: "Elder",
    coLeader: "Co-Leader",
    leader: "Leader",
};

/** @param {import("../coc/members.js").Member["role"]} role */
const roleLabel = (role) => ROLE_LABEL[role] ?? role;

/**
 * Batches all membership changes from a single poll into one clan-feed embed, so
 * a busy poll posts one message rather than spamming one per change.
 *
 * @param {import("../features/members.js").MemberEvent[]} events
 * @returns {EmbedBuilder}
 */
export function membershipEmbed(events) {
    const line = (/** @type {import("../features/members.js").MemberEvent} */ e) => {
        switch (e.type) {
            case "join":
                return `📥 **${e.member.name}** joined — TH${e.member.townHall}, ${e.member.trophies}🏆, ${roleLabel(e.member.role)}`;
            case "leave":
                return `📤 **${e.member.name}** left — TH${e.member.townHall}, ${e.member.trophies}🏆`;
            case "roleChange":
                return `${e.promoted ? "⬆️" : "⬇️"} **${e.member.name}** ${e.promoted ? "promoted" : "demoted"} to ${roleLabel(e.to)} (was ${roleLabel(e.from)})`;
            case "townHallUpgrade":
                return `🏠 **${e.member.name}** upgraded to TH${e.to} (was TH${e.from})`;
            case "nameChange":
                return `✏️ **${e.from}** is now known as **${e.to}**`;
        }
    };
    const description = events.map(line).join("\n").slice(0, 4096) || "No changes.";
    return new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("📋 Clan roster update")
        .setDescription(description);
}

/**
 * Renders the full roster as a monospaced table, sorted by seniority then
 * trophies. Powers the /roster command.
 *
 * @param {import("../coc/members.js").Member[]} members
 * @returns {EmbedBuilder}
 */
export function rosterEmbed(members) {
    const ROLE_RANK = { leader: 0, coLeader: 1, admin: 2, member: 3 };
    const sorted = [...members].sort(
        (a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || b.trophies - a.trophies,
    );
    const rows = sorted.map((m) => {
        const name = m.name.length > 15 ? m.name.slice(0, 14) + "…" : m.name;
        return (
            `${name.padEnd(15)} ${roleLabel(m.role).padEnd(9)} ` +
            `TH${String(m.townHall).padEnd(2)} ${String(m.trophies).padStart(5)}🏆 ${String(m.donations).padStart(5)}↑`
        );
    });
    // Code block for monospaced alignment; guard the 4096-char description cap.
    const body = rows.join("\n").slice(0, 4000) || "No members.";
    return new EmbedBuilder()
        .setColor(0x2ecc71)
        .setTitle(`📋 Clan Roster (${members.length}/50)`)
        .setDescription("```\n" + body + "\n```");
}

/**
 * @param {import("../features/war.js").ActiveWar} war
 * @param {import("../features/war.js").WarResult} result
 * @returns {EmbedBuilder}
 */
export function warEndEmbed(war, result) {
    const meta = {
        win: { color: 0x2ecc71, title: "🏆 Victory!" },
        lose: { color: 0xe74c3c, title: "💀 Defeat" },
        tie: { color: 0x95a5a6, title: "🤝 Draw" },
    }[result];

    return new EmbedBuilder()
        .setColor(meta.color)
        .setTitle(`${meta.title} — ${war.clan.name} vs ${war.opponent.name}`)
        .addFields(
            { name: "Stars", value: `${war.clan.stars} – ${war.opponent.stars}`, inline: true },
            {
                name: "Destruction",
                value: `${war.clan.destruction.toFixed(1)}% – ${war.opponent.destruction.toFixed(1)}%`,
                inline: true,
            },
        );
}
