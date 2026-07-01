import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "../src/config.js";

const validEnv = {
    DISCORD_TOKEN: "discord-token",
    DISCORD_CLIENT_ID: "111",
    DISCORD_GUILD_ID: "222",
    COC_TOKEN: "coc-token",
    COC_CLAN_TAG: "#PVVY8L2L",
};

describe("loadConfig", () => {
    it("builds a structured config from a valid environment", () => {
        const cfg = loadConfig(validEnv);
        expect(cfg.discord).toEqual({ token: "discord-token", clientId: "111", guildId: "222" });
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
        expect(loadConfig({ ...validEnv, COC_CLAN_TAG: "#pvvy8l2l" }).coc.clanTag).toBe("#PVVY8L2L");
    });

    it("exposes channel IDs, defaulting unset ones to null", () => {
        const cfg = loadConfig({ ...validEnv, CHANNEL_WAR_LOG: "999" });
        expect(cfg.channels.warLog).toBe("999");
        expect(cfg.channels.warReminders).toBeNull();
    });

    it("applies default poll intervals and honours overrides", () => {
        expect(loadConfig(validEnv).poll.warSeconds).toBe(300);
        expect(loadConfig({ ...validEnv, POLL_WAR_SECONDS: "30" }).poll.warSeconds).toBe(30);
        // invalid override falls back to the default rather than NaN
        expect(loadConfig({ ...validEnv, POLL_WAR_SECONDS: "abc" }).poll.warSeconds).toBe(300);
    });

    it("returns a deeply immutable config", () => {
        const cfg = loadConfig(validEnv);
        expect(() => {
            cfg.discord.token = "mutated";
        }).toThrow();
    });
});
