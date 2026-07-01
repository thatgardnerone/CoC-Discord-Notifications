import { normaliseTag } from "../coc/tag.js";

/**
 * Orchestrates account linking: verify the in-game token, then persist the
 * Discord ↔ player link. Kept separate from the Discord command handler so the
 * flow is feature-testable.
 *
 * @param {Object} deps
 * @param {{ verifyToken: (tag: string, token: string) => Promise<boolean>, getPlayer: (tag: string) => Promise<import("../coc/player.js").PlayerProfile> }} deps.playerService
 * @param {{ link: (discordId: string, playerTag: string, playerName?: string | null) => void }} deps.linkStore
 */
export function createLinker({ playerService, linkStore }) {
    return {
        /**
         * @param {string} discordId
         * @param {string} rawTag Player tag as typed by the user.
         * @param {string} token In-game API token.
         * @returns {Promise<{ ok: true, player: import("../coc/player.js").PlayerProfile } | { ok: false, reason: "invalid-token" }>}
         */
        async link(discordId, rawTag, token) {
            const tag = normaliseTag(rawTag);
            const verified = await playerService.verifyToken(tag, token);
            if (!verified) return { ok: false, reason: "invalid-token" };

            const player = await playerService.getPlayer(tag);
            linkStore.link(discordId, player.tag, player.name);
            return { ok: true, player };
        },
    };
}
