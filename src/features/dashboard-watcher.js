import { buildDashboardView, pickActiveWar } from "./dashboard.js";
import { dashboardEmbed } from "../discord/embeds.js";

/**
 * One tick of the Clan HQ dashboard: read the war / capital / donations
 * snapshots the other watchers already persist, fetch fresh clan info, render one
 * embed, and edit the pinned dashboard message in place (creating + pinning it on
 * the first run). Persists the message id so edits survive restarts.
 *
 * Dormant until CHANNEL_CLAN_HQ is set — `notifier.upsertPinned` returns null for
 * an unconfigured channel, so this simply no-ops until the channel exists. A
 * failed clan fetch degrades to a partial board (that section nulls out) rather
 * than skipping the tick.
 *
 * @param {Object} deps
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ upsertPinned: (channelKey: string, messageId: string | null, payload: object) => Promise<string | null> }} deps.notifier
 * @param {{ getInfo: () => Promise<import("../coc/clan.js").ClanInfo> }} deps.clanService
 * @param {{ info: (msg: string) => void, warn: (msg: string) => void }} [deps.logger]
 * @param {() => Date} [deps.clock] Injectable for tests.
 * @param {string} [deps.key] Snapshot key namespace (default "dashboard").
 * @param {string} [deps.channel] Channel key to post/edit in (default "clanHq").
 */
export function createDashboardWatcher({
    store,
    notifier,
    clanService,
    logger = console,
    clock = () => new Date(),
    key = "dashboard",
    channel = "clanHq",
}) {
    const msgKey = `${key}:msg`;
    return {
        async poll() {
            // Fresh clan info (one read/tick) for the totals line; a failure just
            // drops that section rather than the whole dashboard.
            let clan = null;
            try {
                clan = await clanService.getInfo();
            } catch (err) {
                logger.warn(
                    `dashboard: clan info fetch failed: ${err instanceof Error ? err.message : String(err)}`,
                );
            }

            const view = buildDashboardView({
                // Prefer a live regular war, else a live CWL round (both stored as
                // WarSnapshots under their own keys).
                war: pickActiveWar(store.getSnapshot("war"), store.getSnapshot("cwl")),
                raid: store.getSnapshot("capital"),
                donations: store.getSnapshot("donations"),
                clan,
            });

            const previousId = store.getSnapshot(msgKey);
            const messageId = await notifier.upsertPinned(channel, previousId, {
                embeds: [dashboardEmbed(view, clock())],
            });

            // Persist only when the id actually changed (first create, or a
            // recreate after the old message vanished) to avoid needless writes.
            if (messageId && messageId !== previousId) {
                store.setSnapshot(msgKey, messageId);
            }
        },
    };
}
