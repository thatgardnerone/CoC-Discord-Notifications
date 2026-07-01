/**
 * Loads and validates the bot's runtime configuration from environment
 * variables. Fails fast (before any network/Discord connection) with a clear
 * message naming every missing variable at once.
 *
 * @typedef {Object} Config
 * @property {{ token: string, clientId: string, guildId: string }} discord
 * @property {{ token: string, clanTag: string }} coc
 * @property {Record<ChannelKey, string | null>} channels
 * @property {{ warSeconds: number, membersSeconds: number, capitalSeconds: number }} poll
 *
 * @typedef {"warReminders"|"warLog"|"cwl"|"capital"|"clanFeed"|"verify"} ChannelKey
 */

const REQUIRED = ["DISCORD_TOKEN", "DISCORD_CLIENT_ID", "DISCORD_GUILD_ID", "COC_TOKEN", "COC_CLAN_TAG"];

/** @type {Record<ChannelKey, string>} */
const CHANNEL_ENV = {
    warReminders: "CHANNEL_WAR_REMINDERS",
    warLog: "CHANNEL_WAR_LOG",
    cwl: "CHANNEL_CWL",
    capital: "CHANNEL_CAPITAL",
    clanFeed: "CHANNEL_CLAN_FEED",
    verify: "CHANNEL_VERIFY",
};

export class ConfigError extends Error {
    /** @param {string[]} missing */
    constructor(missing) {
        super(`Missing required environment variables: ${missing.join(", ")}`);
        this.name = "ConfigError";
        /** @type {string[]} */
        this.missing = missing;
    }
}

/**
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function intOr(value, fallback) {
    if (value === undefined || value.trim() === "") return fallback;
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? fallback : n;
}

/**
 * @param {string} raw
 * @returns {string}
 */
function normaliseClanTag(raw) {
    const tag = raw.trim().toUpperCase();
    return tag.startsWith("#") ? tag : `#${tag}`;
}

/**
 * @template T
 * @param {T} obj
 * @returns {Readonly<T>}
 */
function deepFreeze(obj) {
    if (obj && typeof obj === "object") {
        for (const value of Object.values(obj)) deepFreeze(value);
        Object.freeze(obj);
    }
    return obj;
}

/**
 * @param {Record<string, string | undefined>} [env]
 * @returns {Readonly<Config>}
 */
export function loadConfig(env = process.env) {
    const missing = REQUIRED.filter((key) => {
        const value = env[key];
        return value === undefined || value.trim() === "";
    });
    if (missing.length > 0) throw new ConfigError(missing);

    /** @param {string} key @returns {string} */
    const req = (key) => /** @type {string} */ (env[key]);

    const channels = /** @type {Record<ChannelKey, string | null>} */ ({});
    for (const key of /** @type {ChannelKey[]} */ (Object.keys(CHANNEL_ENV))) {
        const value = env[CHANNEL_ENV[key]];
        channels[key] = value && value.trim() !== "" ? value : null;
    }

    return deepFreeze({
        discord: {
            token: req("DISCORD_TOKEN"),
            clientId: req("DISCORD_CLIENT_ID"),
            guildId: req("DISCORD_GUILD_ID"),
        },
        coc: {
            token: req("COC_TOKEN"),
            clanTag: normaliseClanTag(req("COC_CLAN_TAG")),
        },
        channels,
        poll: {
            warSeconds: intOr(env.POLL_WAR_SECONDS, 300),
            membersSeconds: intOr(env.POLL_MEMBERS_SECONDS, 600),
            capitalSeconds: intOr(env.POLL_CAPITAL_SECONDS, 3600),
        },
    });
}
