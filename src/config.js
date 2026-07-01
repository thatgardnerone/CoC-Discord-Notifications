/**
 * Loads and validates the bot's runtime configuration from environment
 * variables. Fails fast (before any network/Discord connection) naming every
 * problem at once — both missing required vars and malformed values — so typos
 * surface immediately rather than as opaque runtime errors later.
 *
 * @typedef {Object} Config
 * @property {{ token: string, clientId: string, guildId: string }} discord
 * @property {{ token: string, clanTag: string }} coc
 * @property {Record<ChannelKey, string | null>} channels
 * @property {{ warSeconds: number, membersSeconds: number, capitalSeconds: number }} poll
 * @property {{ dbPath: string }} storage
 * @property {Record<RoleKey, string | null>} roles
 * @property {{ remindHoursBefore: number }} war
 *
 * @typedef {"warReminders"|"warLog"|"cwl"|"capital"|"clanFeed"|"verify"} ChannelKey
 * @typedef {"leader"|"coLeader"|"elder"|"member"} RoleKey
 */

const REQUIRED = [
    "DISCORD_TOKEN",
    "DISCORD_CLIENT_ID",
    "DISCORD_GUILD_ID",
    "COC_TOKEN",
    "COC_CLAN_TAG",
];

/** @type {Record<ChannelKey, string>} */
const CHANNEL_ENV = {
    warReminders: "CHANNEL_WAR_REMINDERS",
    warLog: "CHANNEL_WAR_LOG",
    cwl: "CHANNEL_CWL",
    capital: "CHANNEL_CAPITAL",
    clanFeed: "CHANNEL_CLAN_FEED",
    verify: "CHANNEL_VERIFY",
};

/** @type {Record<RoleKey, string>} */
const ROLE_ENV = {
    leader: "ROLE_LEADER",
    coLeader: "ROLE_COLEADER",
    elder: "ROLE_ELDER",
    member: "ROLE_MEMBER",
};

const SNOWFLAKE = /^\d{17,20}$/;
// Supercell tag alphabet, uppercased, with a leading #.
const CLAN_TAG = /^#[0289PYLQGRJCUV]+$/;

export class ConfigError extends Error {
    /** @param {{ missing?: string[], invalid?: string[] }} problems */
    constructor({ missing = [], invalid = [] }) {
        const parts = [];
        if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
        if (invalid.length) parts.push(`invalid: ${invalid.join("; ")}`);
        super(`Invalid configuration — ${parts.join(" | ")}`);
        this.name = "ConfigError";
        /** @type {string[]} */
        this.missing = missing;
        /** @type {string[]} */
        this.invalid = invalid;
    }
}

/**
 * Parses a positive-integer env var, recording a problem if present but malformed.
 *
 * @param {string | undefined} value
 * @param {number} fallback
 * @param {string} key
 * @param {string[]} invalid
 * @returns {number}
 */
function positiveIntOr(value, fallback, key, invalid) {
    if (value === undefined || value.trim() === "") return fallback;
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) {
        invalid.push(`${key} (must be a positive integer)`);
        return fallback;
    }
    const n = Number.parseInt(trimmed, 10);
    if (n <= 0) {
        invalid.push(`${key} (must be greater than 0)`);
        return fallback;
    }
    return n;
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
    if (missing.length > 0) throw new ConfigError({ missing });

    /** @param {string} key @returns {string} */
    const req = (key) => /** @type {string} */ (env[key]).trim();

    /** @type {string[]} */
    const invalid = [];

    const clientId = req("DISCORD_CLIENT_ID");
    const guildId = req("DISCORD_GUILD_ID");
    if (!SNOWFLAKE.test(clientId)) invalid.push("DISCORD_CLIENT_ID (not a Discord ID)");
    if (!SNOWFLAKE.test(guildId)) invalid.push("DISCORD_GUILD_ID (not a Discord ID)");

    const clanTag = normaliseClanTag(req("COC_CLAN_TAG"));
    if (!CLAN_TAG.test(clanTag)) invalid.push("COC_CLAN_TAG (not a valid clan tag)");

    const channels = /** @type {Record<ChannelKey, string | null>} */ ({});
    for (const key of /** @type {ChannelKey[]} */ (Object.keys(CHANNEL_ENV))) {
        const raw = env[CHANNEL_ENV[key]];
        const value = raw && raw.trim() !== "" ? raw.trim() : null;
        if (value !== null && !SNOWFLAKE.test(value)) {
            invalid.push(`${CHANNEL_ENV[key]} (not a Discord ID)`);
        }
        channels[key] = value;
    }

    const roles = /** @type {Record<RoleKey, string | null>} */ ({});
    for (const key of /** @type {RoleKey[]} */ (Object.keys(ROLE_ENV))) {
        const raw = env[ROLE_ENV[key]];
        const value = raw && raw.trim() !== "" ? raw.trim() : null;
        if (value !== null && !SNOWFLAKE.test(value)) {
            invalid.push(`${ROLE_ENV[key]} (not a Discord role ID)`);
        }
        roles[key] = value;
    }

    const poll = {
        warSeconds: positiveIntOr(env.POLL_WAR_SECONDS, 300, "POLL_WAR_SECONDS", invalid),
        membersSeconds: positiveIntOr(
            env.POLL_MEMBERS_SECONDS,
            600,
            "POLL_MEMBERS_SECONDS",
            invalid,
        ),
        capitalSeconds: positiveIntOr(
            env.POLL_CAPITAL_SECONDS,
            3600,
            "POLL_CAPITAL_SECONDS",
            invalid,
        ),
    };

    if (invalid.length > 0) throw new ConfigError({ invalid });

    return deepFreeze({
        discord: { token: req("DISCORD_TOKEN"), clientId, guildId },
        coc: { token: req("COC_TOKEN"), clanTag },
        channels,
        poll,
        storage: { dbPath: env.COC_DB_PATH?.trim() || "data/coc.db" },
        roles,
        war: {
            remindHoursBefore: positiveIntOr(
                env.REMIND_HOURS_BEFORE,
                2,
                "REMIND_HOURS_BEFORE",
                invalid,
            ),
        },
    });
}
