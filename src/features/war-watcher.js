import {
    detectWarEvents,
    detectNewAttacks,
    computeMissedAttacks,
    membersWithAttacksLeft,
} from "./war.js";
import { HttpError } from "../coc/http.js";
import { cocTimeToUnix } from "../coc/time.js";
import {
    warPreparationEmbed,
    warStartEmbed,
    warEndEmbed,
    attackLogEmbed,
    missedAttackEmbed,
    attackReminderMessage,
} from "../discord/embeds.js";

/**
 * One poll cycle of the war feature: fetch the current war, diff it against the
 * stored snapshot, post an embed to the war-log channel for each transition,
 * remind members with attacks left as war end approaches, and persist the
 * snapshot. Wired into the scheduler by the entry point.
 *
 * @param {Object} deps
 * @param {{ getCurrentWar: () => Promise<import("./war.js").WarSnapshot> }} deps.warService
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ send: (channelKey: string, payload: object) => Promise<boolean> }} deps.notifier
 * @param {{ getByPlayer: (tag: string) => ({ discordId: string } | null) }} [deps.linkStore] Resolves mentions.
 * @param {number} [deps.remindWindowSeconds] Remind once when the war has ≤ this long left (default 2h).
 * @param {() => number} [deps.now] Epoch-ms clock (injectable for tests).
 * @param {{ info: (msg: string, fields?: object) => void, warn: (msg: string, fields?: object) => void }} [deps.logger]
 * @param {string} [deps.key] Snapshot key (default "war").
 * @param {string} [deps.logChannel] Channel key for war-log posts (default "warLog").
 * @param {string} [deps.remindChannel] Channel key for reminders (default "warReminders").
 */
export function createWarWatcher({
    warService,
    store,
    notifier,
    linkStore,
    remindWindowSeconds = 7200,
    now = () => Date.now(),
    logger = console,
    key = "war",
    logChannel = "warLog",
    remindChannel = "warReminders",
}) {
    const remindKey = `${key}:reminded`;
    return {
        async poll() {
            let current;
            try {
                current = await warService.getCurrentWar();
            } catch (err) {
                if (err instanceof HttpError && err.status === 403) {
                    // Clan war log is private — expected until the leader makes it public.
                    logger.warn(
                        "war log is private; skipping war poll (set war log to Public in-game)",
                    );
                    return;
                }
                throw err;
            }
            const previous = store.getSnapshot(key);

            // Best-effort delivery: the notifier never throws (it logs and returns
            // false on failure), and we always advance the snapshot once we have a
            // valid current war — so a transient send failure drops that one
            // notification rather than re-posting it (and every later transition)
            // on the next poll. The finally is belt-and-suspenders for that invariant.
            try {
                // Live attack log first. Only diff within a war we were already
                // watching (so the first inWar poll never posts a burst), but
                // include the closing poll (inWar -> warEnded) so the final attack
                // rush isn't lost. warEnded still carries members/attacks.
                if (
                    previous?.state === "inWar" &&
                    (current.state === "inWar" || current.state === "warEnded")
                ) {
                    const attacks = detectNewAttacks(previous, current);
                    if (attacks.length > 0) {
                        await notifier.send(logChannel, { embeds: [attackLogEmbed(attacks)] });
                        logger.info(`war attacks posted: ${attacks.length}`);
                    }
                }

                for (const event of detectWarEvents(previous, current)) {
                    const sent = await notifier.send(logChannel, { embeds: [embedFor(event)] });
                    logger.info(`war event ${sent ? "posted" : "dropped"}: ${event.type}`);

                    // At war end, also post who didn't use all their attacks.
                    if (event.type === "warEnd") {
                        const missed = computeMissedAttacks(event.war);
                        await notifier.send(logChannel, {
                            embeds: [missedAttackEmbed(event.war, missed)],
                        });
                    }
                }

                if (current.state === "inWar" && linkStore) {
                    await maybeRemind(current);
                }
            } finally {
                store.setSnapshot(key, current);
            }
        },
    };

    /**
     * Posts a single reminder per war once it enters the reminder window,
     * pinging linked members who still have attacks left.
     * @param {import("./war.js").ActiveWar} war
     */
    async function maybeRemind(war) {
        const endUnix = cocTimeToUnix(war.endTime);
        if (endUnix == null) return;
        const remaining = endUnix - Math.floor(now() / 1000);
        if (remaining <= 0 || remaining > remindWindowSeconds) return;
        if (store.getSnapshot(remindKey) === war.endTime) return; // already reminded this war

        const due = membersWithAttacksLeft(war);
        if (due.length > 0) {
            const resolved = due.map((d) => {
                const link = linkStore?.getByPlayer(d.tag);
                return {
                    remaining: d.remaining,
                    mention: link ? `<@${link.discordId}>` : `**${d.name}**`,
                    userId: link ? link.discordId : null,
                };
            });
            const timeLeft =
                remaining >= 3600
                    ? `${Math.round(remaining / 3600)}h`
                    : `${Math.max(1, Math.round(remaining / 60))}m`;
            await notifier.send(remindChannel, {
                content: attackReminderMessage(resolved, timeLeft),
                allowedMentions: { users: resolved.map((r) => r.userId).filter(Boolean) },
            });
            logger.info(`war reminder posted: ${due.length} members`);
        }
        // Mark reminded even if nobody was due, so we don't re-check every poll.
        store.setSnapshot(remindKey, war.endTime);
    }
}

/**
 * @param {import("./war.js").WarEvent} event
 * @returns {import("discord.js").EmbedBuilder}
 */
function embedFor(event) {
    switch (event.type) {
        case "warPreparation":
            return warPreparationEmbed(event.war);
        case "warStart":
            return warStartEmbed(event.war);
        case "warEnd":
            return warEndEmbed(event.war, event.result ?? "tie");
    }
}
