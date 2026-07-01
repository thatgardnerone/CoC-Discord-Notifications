import { describe, it, expect, vi } from "vitest";
import { createNotifier } from "../src/discord/notifier.js";

const silentLogger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };

function fakeChannel() {
    return { isTextBased: () => true, send: vi.fn().mockResolvedValue({}) };
}
/** @param {any} channel */
function fakeClient(channel) {
    return { channels: { fetch: vi.fn().mockResolvedValue(channel) } };
}

const channels = {
    warReminders: null,
    warLog: "111111111111111111",
    cwl: null,
    capital: null,
    clanFeed: null,
    verify: null,
};

describe("notifier (channel routing)", () => {
    it("sends the payload to the configured channel", async () => {
        const channel = fakeChannel();
        const client = fakeClient(channel);
        const notifier = createNotifier({ client, channels, logger: silentLogger });

        const sent = await notifier.send("warLog", { content: "War started!" });

        expect(sent).toBe(true);
        expect(client.channels.fetch).toHaveBeenCalledWith("111111111111111111");
        expect(channel.send).toHaveBeenCalledWith({ content: "War started!" });
    });

    it("skips (no throw) when the channel key is unconfigured", async () => {
        const client = fakeClient(fakeChannel());
        const logger = { ...silentLogger, warn: vi.fn() };
        const notifier = createNotifier({ client, channels, logger });

        const sent = await notifier.send("warReminders", { content: "x" });

        expect(sent).toBe(false);
        expect(client.channels.fetch).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("skips when the resolved channel is not sendable", async () => {
        const client = fakeClient(null);
        const notifier = createNotifier({ client, channels, logger: silentLogger });

        const sent = await notifier.send("warLog", { content: "x" });

        expect(sent).toBe(false);
    });

    it("never throws: logs and returns false when the Discord send fails", async () => {
        const channel = {
            isTextBased: () => true,
            send: vi.fn().mockRejectedValue(new Error("discord 500")),
        };
        const client = fakeClient(channel);
        const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
        const notifier = createNotifier({ client, channels, logger });

        const sent = await notifier.send("warLog", { content: "x" });

        expect(sent).toBe(false);
        expect(logger.error).toHaveBeenCalled();
    });
});
