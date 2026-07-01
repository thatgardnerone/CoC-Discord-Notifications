import { detectMemberEvents } from "./members.js";
import { membershipEmbed } from "../discord/embeds.js";

/**
 * One poll cycle of the membership feature: fetch the current roster, diff it
 * against the stored snapshot, post a single batched clan-feed embed for any
 * changes, and persist the new snapshot. Wired into the scheduler by the entry
 * point at the (slower) members cadence.
 *
 * The first run establishes a baseline without posting, so the bot never
 * announces the whole clan as "joined" on startup.
 *
 * @param {Object} deps
 * @param {{ getMembers: () => Promise<import("../coc/members.js").Member[]> }} deps.membersService
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ send: (channelKey: string, payload: object) => Promise<boolean> }} deps.notifier
 * @param {{ info: (msg: string, fields?: object) => void }} [deps.logger]
 * @param {string} [deps.key] Snapshot key (default "members").
 * @param {string} [deps.feedChannel] Channel key for feed posts (default "clanFeed").
 */
export function createMembersWatcher({
    membersService,
    store,
    notifier,
    logger = console,
    key = "members",
    feedChannel = "clanFeed",
}) {
    return {
        async poll() {
            // Let fetch errors propagate to the scheduler (which logs + retries);
            // don't advance the snapshot on a failed fetch.
            const current = await membersService.getMembers();

            // Floor against a malformed/empty payload: a live clan is never empty
            // (the bot's own clan has members), so an empty roster means a bad
            // response, not a mass exodus. Skip without diffing or persisting —
            // else we'd broadcast "everyone left" and clobber the snapshot with [].
            if (current.length === 0) {
                logger.info("empty roster returned; skipping members poll");
                return;
            }

            const previous = store.getSnapshot(key);

            // Best-effort delivery: the notifier never throws, and we always
            // advance the snapshot once we have a valid roster — so a transient
            // send failure drops that one feed post rather than replaying every
            // change on the next poll.
            try {
                if (previous) {
                    const events = detectMemberEvents(previous, current);
                    if (events.length > 0) {
                        await notifier.send(feedChannel, { embeds: [membershipEmbed(events)] });
                        logger.info(`membership events posted: ${events.length}`);
                    }
                }
            } finally {
                store.setSnapshot(key, current);
            }
        },
    };
}
