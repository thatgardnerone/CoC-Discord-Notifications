import { Client, GatewayIntentBits, MessageFlags, PermissionFlagsBits } from "discord.js";
import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { loadConfig } from "./src/config.js";
import { createLogger } from "./src/logger.js";
import { createCocClient } from "./src/coc/http.js";
import { createClanService } from "./src/coc/clan.js";
import { createWarService } from "./src/coc/war.js";
import { createStore } from "./src/store.js";
import { createScheduler } from "./src/scheduler.js";
import { createNotifier } from "./src/discord/notifier.js";
import { createWarWatcher } from "./src/features/war-watcher.js";
import { clanInfoEmbed, warStartEmbed } from "./src/discord/embeds.js";

dotenv.config();

const logger = createLogger({ level: /** @type {any} */ (process.env.LOG_LEVEL) || "info" });

// Fail fast on bad config, before opening any connection.
let config;
try {
    config = loadConfig();
} catch (err) {
    logger.error("configuration error", {
        message: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
}

mkdirSync(dirname(config.storage.dbPath), { recursive: true });

const coc = createCocClient({ token: config.coc.token });
const clanService = createClanService(coc, config.coc.clanTag);
const warService = createWarService(coc, config.coc.clanTag);
const store = createStore(config.storage.dbPath);
const discord = new Client({ intents: [GatewayIntentBits.Guilds] });
const notifier = createNotifier({ client: discord, channels: config.channels, logger });
const warWatcher = createWarWatcher({ warService, store, notifier, logger });
const scheduler = createScheduler({
    onError: (err) =>
        logger.error("poll failed", { message: err instanceof Error ? err.message : String(err) }),
});

let started = false;
discord.once("clientReady", () => {
    logger.info("logged in", { user: discord.user?.tag, guild: config.discord.guildId });
    // Guard against a re-fired ready (gateway reconnect) double-registering intervals.
    if (started) return;
    started = true;
    // Start polling once connected, so the notifier can resolve channels.
    scheduler.every(config.poll.warSeconds, () => warWatcher.poll());
    scheduler.every(
        900,
        () => logger.info("heartbeat", { uptimeSec: Math.round(process.uptime()) }),
        {
            runImmediately: false,
        },
    );
});

discord.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        switch (interaction.commandName) {
            case "ping":
                await interaction.reply({ content: "Pong!", flags: MessageFlags.Ephemeral });
                break;

            case "clan_info": {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const clan = await clanService.getInfo();
                await interaction.editReply({ embeds: [clanInfoEmbed(clan)] });
                break;
            }

            case "debug_war": {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    await interaction.reply({
                        content: "You need the Manage Server permission to use this.",
                        flags: MessageFlags.Ephemeral,
                    });
                    break;
                }
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const nowSec = Math.floor(Date.now() / 1000);
                const asCocTime = (unixSec) =>
                    new Date(unixSec * 1000).toISOString().replace(/[-:]/g, "");
                const sample = {
                    state: "inWar",
                    teamSize: 15,
                    startTime: asCocTime(nowSec - 3600),
                    endTime: asCocTime(nowSec + 82800),
                    clan: { name: "Our Clan", tag: config.coc.clanTag, stars: 0, destruction: 0 },
                    opponent: { name: "Debug Opponent", tag: "#DEBUG", stars: 0, destruction: 0 },
                };
                const posted = await notifier.send("warLog", {
                    content: "🧪 **Debug preview** — not a real war event.",
                    embeds: [warStartEmbed(sample)],
                });
                await interaction.editReply(
                    posted
                        ? "Posted a debug war-start preview to the war-log channel."
                        : "Couldn't post — is CHANNEL_WAR_LOG configured and visible to the bot?",
                );
                break;
            }
        }
    } catch (err) {
        logger.error("command failed", {
            command: interaction.commandName,
            message: err instanceof Error ? err.message : String(err),
        });
        const message = { content: "Something went wrong — please try again shortly." };
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply(message).catch(() => {});
        } else {
            await interaction.reply({ ...message, flags: MessageFlags.Ephemeral }).catch(() => {});
        }
    }
});

/** @param {string} signal */
async function shutdown(signal) {
    logger.info("shutting down", { signal });
    scheduler.stop();
    try {
        store.close();
    } catch {
        // already closed
    }
    try {
        await discord.destroy();
    } catch {
        // ignore
    }
    process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => {
    logger.error("unhandled rejection", {
        reason: reason instanceof Error ? reason.message : String(reason),
    });
});

discord.login(config.discord.token);
