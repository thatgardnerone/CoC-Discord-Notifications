/**
 * Routes a notification to the channel configured for its type, so feature
 * modules never hard-code channel IDs and users can split noise across channels
 * (see #53). Unconfigured or unsendable channels are skipped (logged, not thrown)
 * so a misconfiguration can't crash a poll.
 *
 * @param {Object} deps
 * @param {{ channels: { fetch: (id: string) => Promise<any> } }} deps.client
 * @param {Record<string, string | null>} deps.channels Map of type → channel ID.
 * @param {{ warn: (msg: string) => void, error: (msg: string) => void }} [deps.logger]
 */
export function createNotifier({ client, channels, logger = console }) {
    return {
        /**
         * Best-effort send: never throws — logs and returns false on any failure
         * (unconfigured channel, unsendable channel, or a Discord API error). This
         * lets callers advance their state without risking duplicate posts.
         *
         * @param {string} channelKey e.g. "warLog", "warReminders", "clanFeed".
         * @param {object} payload Discord message payload ({ content?, embeds?, allowedMentions? }).
         * @returns {Promise<boolean>} true if sent, false if skipped/failed.
         */
        async send(channelKey, payload) {
            const id = channels[channelKey];
            if (!id) {
                logger.warn(`No channel configured for '${channelKey}' — skipping`);
                return false;
            }

            try {
                const channel = await client.channels.fetch(id);
                if (
                    !channel ||
                    typeof channel.isTextBased !== "function" ||
                    !channel.isTextBased()
                ) {
                    logger.warn(
                        `Channel for '${channelKey}' (${id}) is not a sendable text channel — skipping`,
                    );
                    return false;
                }
                await channel.send(payload);
                return true;
            } catch (err) {
                logger.error(
                    `Failed to send to '${channelKey}' (${id}): ${err instanceof Error ? err.message : String(err)}`,
                );
                return false;
            }
        },

        /**
         * Best-effort "living message": edits a message in place, or creates (and
         * pins) a fresh one when there's no id yet or the previous message is gone
         * (deleted, or lost after a channel change). Powers the auto-updating Clan
         * HQ dashboard — one message that stays current instead of a stream of
         * posts. Never throws; returns the message id to persist, or null when
         * skipped/failed (unconfigured channel or API error) so the caller simply
         * retries on the next tick.
         *
         * @param {string} channelKey
         * @param {string | null} messageId Previously-created message id, or null.
         * @param {object} payload Discord message payload ({ embeds?, content? }).
         * @returns {Promise<string | null>}
         */
        async upsertPinned(channelKey, messageId, payload) {
            const id = channels[channelKey];
            if (!id) {
                logger.warn(`No channel configured for '${channelKey}' — skipping dashboard`);
                return null;
            }

            try {
                const channel = await client.channels.fetch(id);
                if (
                    !channel ||
                    typeof channel.isTextBased !== "function" ||
                    !channel.isTextBased()
                ) {
                    logger.warn(
                        `Channel for '${channelKey}' (${id}) is not a sendable text channel — skipping`,
                    );
                    return null;
                }

                if (messageId) {
                    try {
                        const existing = await channel.messages.fetch(messageId);
                        await existing.edit(payload);
                        return existing.id;
                    } catch {
                        // Message is gone (deleted/purged) — fall through to recreate.
                        logger.warn(
                            `Pinned message ${messageId} missing in '${channelKey}' — recreating`,
                        );
                    }
                }

                const created = await channel.send(payload);
                try {
                    await created.pin();
                } catch (err) {
                    // Pinning needs Manage Messages; a missing perm shouldn't lose
                    // the dashboard — it just won't be pinned.
                    logger.warn(
                        `Could not pin dashboard message in '${channelKey}': ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
                return created.id;
            } catch (err) {
                logger.error(
                    `Failed to upsert pinned message in '${channelKey}' (${id}): ${err instanceof Error ? err.message : String(err)}`,
                );
                return null;
            }
        },
    };
}
