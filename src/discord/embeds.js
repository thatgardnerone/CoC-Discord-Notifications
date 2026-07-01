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
