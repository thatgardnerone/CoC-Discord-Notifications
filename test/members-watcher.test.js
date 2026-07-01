import { describe, it, expect, vi } from "vitest";
import { createMembersWatcher } from "../src/features/members-watcher.js";

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/**
 * @param {string} tag
 * @param {Partial<import("../src/coc/members.js").Member>} [over]
 */
const member = (tag, over = {}) => ({
    tag,
    name: `Player ${tag}`,
    role: "member",
    townHall: 14,
    trophies: 4000,
    donations: 100,
    donationsReceived: 100,
    clanRank: 1,
    ...over,
});

/**
 * @param {{ current: any[], previous?: any[] }} args
 */
function harness({ current, previous }) {
    const membersService = { getMembers: vi.fn().mockResolvedValue(current) };
    const state = new Map();
    if (previous !== undefined) state.set("members", previous);
    const store = {
        getSnapshot: vi.fn((k) => (state.has(k) ? state.get(k) : null)),
        setSnapshot: vi.fn((k, v) => state.set(k, v)),
    };
    const notifier = { send: vi.fn().mockResolvedValue(true) };
    const watcher = createMembersWatcher({ membersService, store, notifier, logger: silent });
    return { membersService, store, notifier, watcher };
}

describe("members watcher", () => {
    it("establishes a baseline on first run without posting", async () => {
        const current = [member("#A"), member("#B")];
        const { notifier, store, watcher } = harness({ current, previous: undefined });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalledWith("members", current);
    });

    it("posts one batched feed embed on changes and persists the new snapshot", async () => {
        const previous = [member("#A"), member("#B", { role: "member" })];
        const current = [member("#A"), member("#B", { role: "admin" }), member("#C")]; // promote + join

        const { notifier, store, watcher } = harness({ current, previous });

        await watcher.poll();

        expect(notifier.send).toHaveBeenCalledTimes(1);
        expect(notifier.send).toHaveBeenCalledWith(
            "clanFeed",
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
        expect(store.setSnapshot).toHaveBeenCalledWith("members", current);
    });

    it("stays silent (but still persists) when nothing noteworthy changed", async () => {
        // Only trophies/donations churned — not fed.
        const previous = [member("#A", { trophies: 4000 })];
        const current = [member("#A", { trophies: 4300 })];
        const { notifier, store, watcher } = harness({ current, previous });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalledWith("members", current);
    });

    it("still advances the snapshot when the notifier send fails", async () => {
        const previous = [member("#A")];
        const current = [member("#A"), member("#B")];
        const membersService = { getMembers: vi.fn().mockResolvedValue(current) };
        const store = { getSnapshot: vi.fn().mockReturnValue(previous), setSnapshot: vi.fn() };
        const notifier = { send: vi.fn().mockResolvedValue(false) };
        const watcher = createMembersWatcher({ membersService, store, notifier, logger: silent });

        await watcher.poll();

        expect(store.setSnapshot).toHaveBeenCalledWith("members", current);
    });

    it("does not advance the snapshot when the fetch fails", async () => {
        const membersService = { getMembers: vi.fn().mockRejectedValue(new Error("boom")) };
        const store = { getSnapshot: vi.fn(), setSnapshot: vi.fn() };
        const notifier = { send: vi.fn() };
        const watcher = createMembersWatcher({ membersService, store, notifier, logger: silent });

        await expect(watcher.poll()).rejects.toThrow("boom");
        expect(store.setSnapshot).not.toHaveBeenCalled();
    });
});
