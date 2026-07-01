import { EmbedBuilder } from "discord.js";

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
