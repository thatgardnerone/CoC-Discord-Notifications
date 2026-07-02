import { accumulateDonations, donationLeaderboard, weekKey } from "./donations.js";
import { donationLeaderboardEmbed } from "../discord/embeds.js";

/**
 * One poll cycle of the donations feature: fetch the roster, fold this poll's
 * donation deltas into the running weekly tally, and — when the ISO week has
 * rolled over — post the just-completed week's leaderboard to #donations. The
 * accumulator (with season-reset handling) lives in `donations.js`; this wrapper
 * owns the clock, the snapshot, and delivery.
 *
 * First run establishes a baseline without posting. Reuses the members service,
 * so it runs on its own (slower) cadence independent of the membership feed.
 *
 * @param {Object} deps
 * @param {{ getMembers: () => Promise<import("../coc/members.js").Member[]> }} deps.membersService
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ send: (channelKey: string, payload: object) => Promise<boolean> }} deps.notifier
 * @param {{ info: (msg: string, fields?: object) => void }} [deps.logger]
 * @param {() => Date} [deps.clock] Injectable for tests; defaults to wall clock.
 * @param {string} [deps.key] Snapshot key (default "donations").
 * @param {string} [deps.feedChannel] Channel key for posts (default "donations").
 */
export function createDonationsWatcher({
    membersService,
    store,
    notifier,
    logger = console,
    clock = () => new Date(),
    key = "donations",
    feedChannel = "donations",
}) {
    return {
        async poll() {
            // Let fetch errors propagate to the scheduler; don't advance state.
            const current = await membersService.getMembers();

            // Same floor as the membership feed: an empty roster is a bad payload,
            // not reality. Skip without accumulating or clobbering the snapshot.
            if (current.length === 0) {
                logger.info("empty roster returned; skipping donations poll");
                return;
            }

            const period = weekKey(clock());
            const previous = store.getSnapshot(key);
            const { next, rollover } = accumulateDonations(previous, current, period);

            // Best-effort delivery: notifier never throws, and we always persist
            // the advanced accumulator — so a failed post drops that one weekly
            // leaderboard rather than replaying it (the tally has already reset).
            try {
                if (rollover && rollover.length > 0) {
                    await notifier.send(feedChannel, {
                        embeds: [
                            donationLeaderboardEmbed(
                                donationLeaderboard(rollover),
                                previous.period,
                            ),
                        ],
                    });
                    logger.info(`weekly donation leaderboard posted for ${previous.period}`);
                }
            } finally {
                store.setSnapshot(key, next);
            }
        },
    };
}
