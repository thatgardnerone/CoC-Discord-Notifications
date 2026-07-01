import { detectWarEvents, detectNewAttacks, computeMissedAttacks } from "./war.js";
import { HttpError } from "../coc/http.js";
import {
    warPreparationEmbed,
    warStartEmbed,
    warEndEmbed,
    attackLogEmbed,
    missedAttackEmbed,
} from "../discord/embeds.js";

/**
 * One poll cycle of the war feature: fetch the current war, diff it against the
 * stored snapshot, post an embed to the war-log channel for each transition, and
 * persist the new snapshot. Wired into the scheduler by the entry point.
 *
 * @param {Object} deps
 * @param {{ getCurrentWar: () => Promise<import("./war.js").WarSnapshot> }} deps.warService
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ send: (channelKey: string, payload: object) => Promise<boolean> }} deps.notifier
 * @param {{ info: (msg: string, fields?: object) => void, warn: (msg: string, fields?: object) => void }} [deps.logger]
 * @param {string} [deps.key] Snapshot key (default "war").
 */
export function createWarWatcher({ warService, store, notifier, logger = console, key = "war" }) {
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
                for (const event of detectWarEvents(previous, current)) {
                    const sent = await notifier.send("warLog", { embeds: [embedFor(event)] });
                    logger.info(`war event ${sent ? "posted" : "dropped"}: ${event.type}`);

                    // At war end, also post who didn't use all their attacks.
                    if (event.type === "warEnd") {
                        const missed = computeMissedAttacks(event.war);
                        await notifier.send("warLog", {
                            embeds: [missedAttackEmbed(event.war, missed)],
                        });
                    }
                }

                // Live attack log — only within an ongoing war we were already
                // watching (otherwise the first inWar poll would post a burst).
                if (previous?.state === "inWar" && current.state === "inWar") {
                    const attacks = detectNewAttacks(previous, current);
                    if (attacks.length > 0) {
                        await notifier.send("warLog", { embeds: [attackLogEmbed(attacks)] });
                        logger.info(`war attacks posted: ${attacks.length}`);
                    }
                }
            } finally {
                store.setSnapshot(key, current);
            }
        },
    };
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
