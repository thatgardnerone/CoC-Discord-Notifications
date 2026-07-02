import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config.js";

const validEnv = {
    DISCORD_TOKEN: "discord-token",
    DISCORD_CLIENT_ID: "972807855897972797",
    DISCORD_GUILD_ID: "703988019073384569",
    COC_TOKEN: "coc-token",
    COC_CLAN_TAG: "#PVVY8L2L",
};

describe("loadConfig", () => {
    it("builds a structured config from a valid environment", () => {
        const cfg = loadConfig(validEnv);
        expect(cfg.discord).toEqual({
            token: "discord-token",
            clientId: "972807855897972797",
            guildId: "703988019073384569",
        });
        expect(cfg.coc.token).toBe("coc-token");
        expect(cfg.coc.clanTag).toBe("#PVVY8L2L");
    });

    it("fails fast, naming every missing required variable at once", () => {
        expect(() => loadConfig({})).toThrowError(ConfigError);
        try {
            loadConfig({ DISCORD_TOKEN: "x" });
            expect.unreachable("loadConfig should have thrown");
        } catch (err) {
            if (!(err instanceof ConfigError)) throw err;
            expect(err.missing).toEqual([
                "DISCORD_CLIENT_ID",
                "DISCORD_GUILD_ID",
                "COC_TOKEN",
                "COC_CLAN_TAG",
            ]);
            expect(err.message).toContain("DISCORD_CLIENT_ID");
        }
    });

    it("treats blank/whitespace values as missing", () => {
        expect(() => loadConfig({ ...validEnv, COC_TOKEN: "   " })).toThrowError(ConfigError);
    });

    it("normalises the clan tag (leading # and uppercase)", () => {
        expect(loadConfig({ ...validEnv, COC_CLAN_TAG: "pvvy8l2l" }).coc.clanTag).toBe("#PVVY8L2L");
        expect(loadConfig({ ...validEnv, COC_CLAN_TAG: "#pvvy8l2l" }).coc.clanTag).toBe(
            "#PVVY8L2L",
        );
    });

    it("rejects malformed Discord IDs and clan tags, listing what's invalid", () => {
        try {
            loadConfig({ ...validEnv, DISCORD_GUILD_ID: "nope", COC_CLAN_TAG: "#ZZZ" });
            expect.unreachable("loadConfig should have thrown");
        } catch (err) {
            if (!(err instanceof ConfigError)) throw err;
            expect(err.invalid).toEqual([
                "DISCORD_GUILD_ID (not a Discord ID)",
                "COC_CLAN_TAG (not a valid clan tag)",
            ]);
        }
    });

    it("exposes channel IDs, defaulting unset ones to null and rejecting malformed ones", () => {
        const cfg = loadConfig({ ...validEnv, CHANNEL_WAR_LOG: "1521776553116172390" });
        expect(cfg.channels.warLog).toBe("1521776553116172390");
        expect(cfg.channels.warReminders).toBeNull();
        expect(() => loadConfig({ ...validEnv, CHANNEL_VERIFY: "abc" })).toThrowError(ConfigError);
    });

    it("applies default poll intervals and honours valid overrides", () => {
        expect(loadConfig(validEnv).poll.warSeconds).toBe(300);
        expect(loadConfig({ ...validEnv, POLL_WAR_SECONDS: "30" }).poll.warSeconds).toBe(30);
        expect(loadConfig(validEnv).poll.donationsSeconds).toBe(3600);
        expect(
            loadConfig({ ...validEnv, POLL_DONATIONS_SECONDS: "900" }).poll.donationsSeconds,
        ).toBe(900);
    });

    it("exposes the donations channel like the others", () => {
        expect(loadConfig(validEnv).channels.donations).toBeNull();
        expect(
            loadConfig({ ...validEnv, CHANNEL_DONATIONS: "1521776553116172390" }).channels
                .donations,
        ).toBe("1521776553116172390");
    });

    it("rejects malformed or non-positive poll intervals (no silent busy-loop)", () => {
        for (const bad of ["abc", "0", "-5", "30abc"]) {
            expect(() => loadConfig({ ...validEnv, POLL_WAR_SECONDS: bad })).toThrowError(
                ConfigError,
            );
        }
    });

    it("defaults the DB path and honours COC_DB_PATH", () => {
        expect(loadConfig(validEnv).storage.dbPath).toBe("data/coc.db");
        expect(
            loadConfig({ ...validEnv, COC_DB_PATH: "/srv/coc-bot/shared/data/coc.db" }).storage
                .dbPath,
        ).toBe("/srv/coc-bot/shared/data/coc.db");
    });

    it("reads clan-role → Discord-role mappings, defaulting unset to null", () => {
        const cfg = loadConfig({ ...validEnv, ROLE_COLEADER: "703994260688601120" });
        expect(cfg.roles.coLeader).toBe("703994260688601120");
        expect(cfg.roles.member).toBeNull();
        expect(() => loadConfig({ ...validEnv, ROLE_LEADER: "notanid" })).toThrowError(ConfigError);
    });

    it("reads the war reminder window (REMIND_HOURS_BEFORE), default 2", () => {
        expect(loadConfig(validEnv).war.remindHoursBefore).toBe(2);
        expect(loadConfig({ ...validEnv, REMIND_HOURS_BEFORE: "6" }).war.remindHoursBefore).toBe(6);
    });

    it("returns a deeply immutable config", () => {
        const cfg = loadConfig(validEnv);
        expect(() => {
            cfg.discord.token = "mutated";
        }).toThrow();
    });
});
