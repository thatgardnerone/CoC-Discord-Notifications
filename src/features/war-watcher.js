import { detectWarEvents } from "./war.js";
import { warPreparationEmbed, warStartEmbed, warEndEmbed } from "../discord/embeds.js";

/**
 * One poll cycle of the war feature: fetch the current war, diff it against the
 * stored snapshot, post an embed to the war-log channel for each transition, and
 * persist the new snapshot. Wired into the scheduler by the entry point.
 *
 * @param {Object} deps
 * @param {{ getCurrentWar: () => Promise<import("./war.js").WarSnapshot> }} deps.warService
 * @param {{ getSnapshot: (key: string) => any, setSnapshot: (key: string, value: unknown) => void }} deps.store
 * @param {{ send: (channelKey: string, payload: object) => Promise<boolean> }} deps.notifier
 * @param {{ info: (msg: string, fields?: object) => void }} [deps.logger]
 * @param {string} [deps.key] Snapshot key (default "war").
 */
export function createWarWatcher({ warService, store, notifier, logger = console, key = "war" }) {
    return {
        async poll() {
            const current = await warService.getCurrentWar();
            const previous = store.getSnapshot(key);

            for (const event of detectWarEvents(previous, current)) {
                await notifier.send("warLog", { embeds: [embedFor(event)] });
                logger.info(`war event posted: ${event.type}`);
            }

            store.setSnapshot(key, current);
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
