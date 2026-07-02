import { describe, it, expect, vi } from "vitest";
import { createDonationsWatcher } from "../src/features/donations-watcher.js";

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** @param {string} tag @param {number} donations @param {number} received */
const m = (tag, donations, received) => ({
    tag,
    name: `P${tag}`,
    role: "member",
    townHall: 15,
    trophies: 4000,
    donations,
    donationsReceived: received,
    clanRank: 1,
});

/**
 * @param {{ members: any[], previous?: any, at: string }} args
 */
function harness({ members, previous, at }) {
    const membersService = { getMembers: vi.fn().mockResolvedValue(members) };
    const state = new Map();
    if (previous !== undefined) state.set("donations", previous);
    const store = {
        getSnapshot: vi.fn((k) => (state.has(k) ? state.get(k) : null)),
        setSnapshot: vi.fn((k, v) => state.set(k, v)),
    };
    const notifier = { send: vi.fn().mockResolvedValue(true) };
    const watcher = createDonationsWatcher({
        membersService,
        store,
        notifier,
        logger: silent,
        clock: () => new Date(at),
    });
    return { membersService, store, notifier, watcher, state };
}

describe("donations watcher", () => {
    it("establishes a baseline on first run without posting", async () => {
        const { notifier, store, watcher, state } = harness({
            members: [m("#A", 100, 50)],
            previous: undefined,
            at: "2026-07-02T12:00:00Z",
        });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalled();
        expect(state.get("donations").period).toBe("2026-W27");
    });

    it("does not post while still inside the same week, but keeps accumulating", async () => {
        const first = harness({
            members: [m("#A", 100, 50)],
            at: "2026-07-02T12:00:00Z",
        });
        await first.watcher.poll();

        const second = harness({
            members: [m("#A", 140, 60)],
            previous: first.state.get("donations"),
            at: "2026-07-03T12:00:00Z", // still W27
        });
        await second.watcher.poll();

        expect(second.notifier.send).not.toHaveBeenCalled();
        expect(second.state.get("donations").tally["#A"].donated).toBe(40);
    });

    it("posts the weekly leaderboard when the ISO week rolls over", async () => {
        const w27 = harness({ members: [m("#A", 100, 0)], at: "2026-07-05T12:00:00Z" }); // Sun W27
        await w27.watcher.poll();

        const rollover = harness({
            members: [m("#A", 170, 0)],
            previous: w27.state.get("donations"),
            at: "2026-07-06T09:00:00Z", // Mon W28
        });
        await rollover.watcher.poll();

        expect(rollover.notifier.send).toHaveBeenCalledTimes(1);
        const [channel, payload] = rollover.notifier.send.mock.calls[0];
        expect(channel).toBe("donations");
        expect(payload.embeds[0].data.title).toContain("2026-W27");
        // Tally reset for the new week.
        expect(rollover.state.get("donations").period).toBe("2026-W28");
        expect(rollover.state.get("donations").tally).toEqual({});
    });

    it("skips an empty roster without posting or persisting", async () => {
        const { notifier, store, watcher } = harness({
            members: [],
            previous: { period: "2026-W27", last: {}, tally: {} },
            at: "2026-07-06T09:00:00Z",
        });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).not.toHaveBeenCalled();
    });

    it("does not advance state when the fetch fails", async () => {
        const membersService = { getMembers: vi.fn().mockRejectedValue(new Error("boom")) };
        const store = { getSnapshot: vi.fn(), setSnapshot: vi.fn() };
        const notifier = { send: vi.fn() };
        const watcher = createDonationsWatcher({ membersService, store, notifier, logger: silent });

        await expect(watcher.poll()).rejects.toThrow("boom");
        expect(store.setSnapshot).not.toHaveBeenCalled();
    });
});
