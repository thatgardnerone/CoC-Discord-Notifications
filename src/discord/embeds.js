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
