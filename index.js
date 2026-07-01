import { Client, GatewayIntentBits, MessageFlags } from "discord.js";
import dotenv from "dotenv";

import { loadConfig } from "./src/config.js";
import { createCocClient } from "./src/coc/http.js";
import { createClanService } from "./src/coc/clan.js";
import { clanInfoEmbed } from "./src/discord/embeds.js";

dotenv.config();

// Fail fast on bad config, before opening any connection.
let config;
try {
    config = loadConfig();
} catch (err) {
    console.error(`Configuration error: ${err.message}`);
    process.exit(1);
}

const coc = createCocClient({ token: config.coc.token });
const clanService = createClanService(coc, config.coc.clanTag);
const discord = new Client({ intents: [GatewayIntentBits.Guilds] });

discord.once("clientReady", () => {
    console.log(`Logged in as ${discord.user.tag} for guild ${config.discord.guildId}`);
});

discord.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case "ping":
                await interaction.reply({ content: "Pong!", flags: MessageFlags.Ephemeral });
                break;

            case "clan_info": {
                // Ephemeral: only the invoker sees it — no channel noise.
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const clan = await clanService.getInfo();
                await interaction.editReply({ embeds: [clanInfoEmbed(clan)] });
                break;
            }
        }
    } catch (err) {
        console.error(
            `Command '${interaction.commandName}' failed:`,
            err instanceof Error ? err.message : err,
        );
        const message = {
            content: "Something went wrong fetching that — please try again shortly.",
        };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(message).catch(() => {});
        } else {
            await interaction.reply({ ...message, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled promise rejection:", reason);
});

discord.login(config.discord.token);
