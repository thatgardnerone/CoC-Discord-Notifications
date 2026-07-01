import {
    Client,
    GatewayIntentBits,
    MessageFlags,
    PermissionFlagsBits,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from "discord.js";
import dotenv from "dotenv";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { loadConfig } from "./src/config.js";
import { createLogger } from "./src/logger.js";
import { createCocClient } from "./src/coc/http.js";
import { createClanService } from "./src/coc/clan.js";
import { createWarService } from "./src/coc/war.js";
import { createCwlService } from "./src/coc/cwl.js";
import { createMembersService } from "./src/coc/members.js";
import { createStore } from "./src/store.js";
import { createScheduler } from "./src/scheduler.js";
import { createNotifier } from "./src/discord/notifier.js";
import { createWarWatcher } from "./src/features/war-watcher.js";
import { createMembersWatcher } from "./src/features/members-watcher.js";
import { createPlayerService } from "./src/coc/player.js";
import { createLinkStore } from "./src/links.js";
import { createLinker } from "./src/features/linking.js";
import { applyClanRole } from "./src/discord/roles.js";
import { normaliseTag } from "./src/coc/tag.js";
import { clanInfoEmbed, warStartEmbed, cwlStatusEmbed, rosterEmbed } from "./src/discord/embeds.js";

/** @param {string | null} role */
const roleLabel = (role) =>
    ({ leader: "Leader", coLeader: "Co-Leader", admin: "Elder", member: "Member" })[role ?? ""] ??
    "Member";

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
const cwlService = createCwlService(coc, config.coc.clanTag);
const membersService = createMembersService(coc, config.coc.clanTag);
const store = createStore(config.storage.dbPath);
const discord = new Client({ intents: [GatewayIntentBits.Guilds] });
const notifier = createNotifier({ client: discord, channels: config.channels, logger });
const linkStore = createLinkStore(config.storage.dbPath);
const warWatcher = createWarWatcher({
    warService,
    store,
    notifier,
    linkStore,
    remindWindowSeconds: config.war.remindHoursBefore * 3600,
    logger,
});
// CWL reuses the war watcher: a CWL round war has the same shape, so we feed it
// our current league-round war and route its posts to #cwl.
const cwlWatcher = createWarWatcher({
    warService: {
        getCurrentWar: async () =>
            (await cwlService.findCurrentWar())?.war ?? { state: "notInWar" },
    },
    store,
    notifier,
    linkStore,
    remindWindowSeconds: config.war.remindHoursBefore * 3600,
    logger,
    key: "cwl",
    logChannel: "cwl",
});
const membersWatcher = createMembersWatcher({ membersService, store, notifier, logger });
const playerService = createPlayerService(coc);
const linker = createLinker({ playerService, linkStore });
const scheduler = createScheduler({
    onError: (err) =>
        logger.error("poll failed", { message: err instanceof Error ? err.message : String(err) }),
});

/**
 * Shared link flow for both /link and the #verify modal: verify + store, then
 * (if the player is in our clan) sync their Discord role. Returns the ephemeral
 * reply text. Never surfaces the token.
 *
 * @param {import("discord.js").ChatInputCommandInteraction | import("discord.js").ModalSubmitInteraction} interaction
 * @param {string} tag
 * @param {string} token
 * @returns {Promise<string>}
 */
async function runLink(interaction, tag, token) {
    const result = await linker.link(interaction.user.id, tag, token);
    if (!result.ok) {
        return "❌ That token didn't match. Get a fresh one in-game (Settings → More Settings → API Token) and try again.";
    }
    const p = result.player;
    const inClan =
        p.clanTag != null && normaliseTag(p.clanTag) === normaliseTag(config.coc.clanTag);
    let roleNote = "";
    if (inClan && interaction.guild) {
        try {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const { add, remove } = await applyClanRole(member, p.role, config.roles, logger);
            if (add.length) roleNote = ` Assigned your **${roleLabel(p.role)}** role.`;
            else if (remove.length) roleNote = " Updated your clan role.";
        } catch (err) {
            logger.warn("role assignment failed", {
                message: err instanceof Error ? err.message : String(err),
            });
        }
    }
    return (
        `✅ Linked **${p.name}** (${p.tag})` +
        (inClan ? ` — ${roleLabel(p.role)} of ${p.clanName}.` : ".") +
        roleNote
    );
}

let started = false;
discord.once("clientReady", () => {
    logger.info("logged in", { user: discord.user?.tag, guild: config.discord.guildId });
    // Guard against a re-fired ready (gateway reconnect) double-registering intervals.
    if (started) return;
    started = true;
    // Start polling once connected, so the notifier can resolve channels.
    scheduler.every(config.poll.warSeconds, () => warWatcher.poll());
    scheduler.every(config.poll.warSeconds, () => cwlWatcher.poll());
    scheduler.every(config.poll.membersSeconds, () => membersWatcher.poll());
    scheduler.every(
        900,
        () => logger.info("heartbeat", { uptimeSec: Math.round(process.uptime()) }),
        {
            runImmediately: false,
        },
    );
});

discord.on("interactionCreate", async (interaction) => {
    try {
        // Onboarding: "Link my account" button opens a private modal.
        if (interaction.isButton() && interaction.customId === "link:start") {
            const modal = new ModalBuilder()
                .setCustomId("link:modal")
                .setTitle("Link your CoC account");
            const tagInput = new TextInputBuilder()
                .setCustomId("tag")
                .setLabel("Player tag (e.g. #ABC123)")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            const tokenInput = new TextInputBuilder()
                .setCustomId("token")
                .setLabel("In-game API token")
                .setStyle(TextInputStyle.Short)
                .setRequired(true);
            modal.addComponents(
                new ActionRowBuilder().addComponents(tagInput),
                new ActionRowBuilder().addComponents(tokenInput),
            );
            await interaction.showModal(modal);
            return;
        }

        if (interaction.isModalSubmit() && interaction.customId === "link:modal") {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const tag = interaction.fields.getTextInputValue("tag");
            const token = interaction.fields.getTextInputValue("token");
            await interaction.editReply(await runLink(interaction, tag, token));
            return;
        }

        if (!interaction.isChatInputCommand()) return;

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

            case "roster": {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const members = await membersService.getMembers();
                await interaction.editReply({ embeds: [rosterEmbed(members)] });
                break;
            }

            case "cwl": {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const current = await cwlService.findCurrentWar();
                if (current) {
                    await interaction.editReply({
                        embeds: [cwlStatusEmbed(current.war, current.round)],
                    });
                } else {
                    const group = await cwlService.getLeagueGroup();
                    if (group && (group.state === "inWar" || group.state === "preparation")) {
                        await interaction.editReply(
                            "CWL is active but I couldn't resolve our current war right now — try again in a moment.",
                        );
                    } else if (group) {
                        await interaction.editReply(
                            `Not currently in an active CWL — last season **${group.season}** (${group.state}).`,
                        );
                    } else {
                        await interaction.editReply("Not currently in Clan War League.");
                    }
                }
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

            case "link": {
                await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                const tag = interaction.options.getString("tag", true);
                const token = interaction.options.getString("token", true);
                await interaction.editReply(await runLink(interaction, tag, token));
                break;
            }

            case "setup_verify": {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    await interaction.reply({
                        content: "You need the Manage Server permission to use this.",
                        flags: MessageFlags.Ephemeral,
                    });
                    break;
                }
                const button = new ButtonBuilder()
                    .setCustomId("link:start")
                    .setLabel("Link my account")
                    .setEmoji("🔗")
                    .setStyle(ButtonStyle.Primary);
                const posted = await notifier.send("verify", {
                    content:
                        "**Link your Clash of Clans account**\nClick below, then paste your player tag and an in-game API token (Settings → More Settings → API Token). You'll get your clan role automatically — only you can see what you enter.",
                    components: [new ActionRowBuilder().addComponents(button)],
                });
                await interaction.reply({
                    content: posted
                        ? "Posted the link prompt to the verify channel."
                        : "Couldn't post — is CHANNEL_VERIFY set and visible to the bot?",
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case "whois": {
                const target = interaction.options.getUser("member") ?? interaction.user;
                const links = linkStore.listByDiscord(target.id);
                const label = target.globalName ?? target.username;
                if (links.length === 0) {
                    await interaction.reply({
                        content: `**${label}** has no linked accounts.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    break;
                }
                const lines = links
                    .map((l) => `• **${l.playerName ?? "?"}** (${l.playerTag})`)
                    .join("\n");
                await interaction.reply({
                    content: `**${label}** has linked:\n${lines}`,
                    flags: MessageFlags.Ephemeral,
                });
                break;
            }

            case "unlink": {
                const tag = normaliseTag(interaction.options.getString("tag", true));
                const existing = linkStore.getByPlayer(tag);
                if (!existing || existing.discordId !== interaction.user.id) {
                    await interaction.reply({
                        content: "You don't have that account linked.",
                        flags: MessageFlags.Ephemeral,
                    });
                    break;
                }
                linkStore.unlink(tag);
                await interaction.reply({
                    content: `Unlinked ${tag}.`,
                    flags: MessageFlags.Ephemeral,
                });
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
        linkStore.close();
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
