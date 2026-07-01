import { detectRaidEvents, computeMissedRaiders, capitalLeaderboard } from "./capital.js";
import {
    raidStartEmbed,
    raidEndEmbed,
    capitalMissedEmbed,
    capitalLeaderboardEmbed,
} from "../discord/embeds.js";

/**
 * One poll cycle of the Clan Capital feature: fetch the latest raid season, diff
 * it against the stored snapshot, and post to the capital channel on a weekend
 * start ("raids are open") or end (summary + unfinished-raids + gold
 * leaderboard). Persists the snapshot afterward. Wired into the scheduler at the
 * (slow) capital cadence — a raid weekend spans days, so hourly polling is ample.
 *
 * First run establishes a baseline without posting, so booting mid-weekend never
 * re-announces a start.
 *
 * @param {Object} deps
 * @param {{ getCurrentRaid: () => Promise<import("./capital.js").RaidSnapshot> }} deps.capitalService
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ send: (channelKey: string, payload: object) => Promise<boolean> }} deps.notifier
 * @param {{ info: (msg: string, fields?: object) => void }} [deps.logger]
 * @param {string} [deps.key] Snapshot key (default "capital").
 * @param {string} [deps.feedChannel] Channel key for posts (default "capital").
 */
export function createCapitalWatcher({
    capitalService,
    store,
    notifier,
    logger = console,
    key = "capital",
    feedChannel = "capital",
}) {
    return {
        async poll() {
            // Let fetch errors propagate to the scheduler (which logs + retries);
            // don't advance the snapshot on a failed fetch.
            const current = await capitalService.getCurrentRaid();
            const previous = store.getSnapshot(key);

            // Best-effort delivery: the notifier never throws, and we always
            // advance the snapshot once we have a valid raid — so a transient
            // send failure drops that one post rather than replaying it (and the
            // whole weekend summary) on the next poll.
            try {
                for (const event of detectRaidEvents(previous, current)) {
                    if (event.type === "raidStart") {
                        const sent = await notifier.send(feedChannel, {
                            embeds: [raidStartEmbed(event.raid)],
                        });
                        logger.info(`raid start ${sent ? "posted" : "dropped"}`);
                    } else {
                        // Weekend ended: summary, then who left attacks unused, then
                        // the capital-gold contribution leaderboard.
                        await notifier.send(feedChannel, { embeds: [raidEndEmbed(event.raid)] });
                        await notifier.send(feedChannel, {
                            embeds: [
                                capitalMissedEmbed(event.raid, computeMissedRaiders(event.raid)),
                            ],
                        });
                        await notifier.send(feedChannel, {
                            embeds: [capitalLeaderboardEmbed(capitalLeaderboard(event.raid))],
                        });
                        logger.info("raid end posted (summary + missed + leaderboard)");
                    }
                }
            } finally {
                store.setSnapshot(key, current);
            }
        },
    };
}
