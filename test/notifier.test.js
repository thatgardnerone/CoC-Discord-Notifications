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
    clanHq: "222222222222222222",
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

describe("notifier.upsertPinned (living message)", () => {
    it("edits the existing message in place when the id is known", async () => {
        const existing = { id: "msg-1", edit: vi.fn().mockResolvedValue({}) };
        const channel = {
            isTextBased: () => true,
            send: vi.fn(),
            messages: { fetch: vi.fn().mockResolvedValue(existing) },
        };
        const notifier = createNotifier({
            client: fakeClient(channel),
            channels,
            logger: silentLogger,
        });

        const id = await notifier.upsertPinned("clanHq", "msg-1", { embeds: [] });

        expect(id).toBe("msg-1");
        expect(existing.edit).toHaveBeenCalledWith({ embeds: [] });
        expect(channel.send).not.toHaveBeenCalled();
    });

    it("creates and pins a fresh message when there is no id yet", async () => {
        const created = { id: "msg-new", pin: vi.fn().mockResolvedValue({}) };
        const channel = {
            isTextBased: () => true,
            send: vi.fn().mockResolvedValue(created),
            messages: { fetch: vi.fn() },
        };
        const notifier = createNotifier({
            client: fakeClient(channel),
            channels,
            logger: silentLogger,
        });

        const id = await notifier.upsertPinned("clanHq", null, { embeds: [] });

        expect(id).toBe("msg-new");
        expect(channel.send).toHaveBeenCalled();
        expect(created.pin).toHaveBeenCalled();
    });

    it("recreates the message only when it is genuinely gone (Discord 10008)", async () => {
        const created = { id: "msg-2", pin: vi.fn().mockResolvedValue({}) };
        const gone = Object.assign(new Error("Unknown Message"), { code: 10008 });
        const channel = {
            isTextBased: () => true,
            send: vi.fn().mockResolvedValue(created),
            messages: { fetch: vi.fn().mockRejectedValue(gone) },
        };
        const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
        const notifier = createNotifier({ client: fakeClient(channel), channels, logger });

        const id = await notifier.upsertPinned("clanHq", "stale-id", { embeds: [] });

        expect(id).toBe("msg-2");
        expect(channel.send).toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalled();
    });

    it("keeps the id and does NOT recreate on a transient error (no duplicate pins)", async () => {
        const transient = Object.assign(new Error("rate limited"), { code: 429 });
        const channel = {
            isTextBased: () => true,
            send: vi.fn(),
            messages: { fetch: vi.fn().mockRejectedValue(transient) },
        };
        const logger = { warn: vi.fn(), info: vi.fn(), error: vi.fn() };
        const notifier = createNotifier({ client: fakeClient(channel), channels, logger });

        const id = await notifier.upsertPinned("clanHq", "msg-1", { embeds: [] });

        expect(id).toBe("msg-1"); // id retained → watcher won't create a second message
        expect(channel.send).not.toHaveBeenCalled();
    });

    it("still returns the id when pinning fails (missing Manage Messages)", async () => {
        const created = { id: "msg-3", pin: vi.fn().mockRejectedValue(new Error("Missing Perms")) };
        const channel = {
            isTextBased: () => true,
            send: vi.fn().mockResolvedValue(created),
            messages: { fetch: vi.fn() },
        };
        const notifier = createNotifier({
            client: fakeClient(channel),
            channels,
            logger: silentLogger,
        });

        const id = await notifier.upsertPinned("clanHq", null, { embeds: [] });

        expect(id).toBe("msg-3");
    });

    it("returns null (no throw) for an unconfigured channel", async () => {
        const client = fakeClient(fakeChannel());
        const notifier = createNotifier({ client, channels, logger: silentLogger });

        const id = await notifier.upsertPinned("capital", null, { embeds: [] });

        expect(id).toBeNull();
        expect(client.channels.fetch).not.toHaveBeenCalled();
    });
});
