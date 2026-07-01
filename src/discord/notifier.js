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
    };
}
