import { describe, it, expect, vi } from "vitest";
import { createCapitalWatcher } from "../src/features/capital-watcher.js";

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/**
 * @param {"ongoing"|"ended"} state
 * @param {string} startTime
 * @param {any[]} [members]
 */
const season = (state, startTime, members = []) => ({
    state,
    startTime,
    endTime: "20260629T070000.000Z",
    totalLoot: 320582,
    raidsCompleted: 6,
    totalAttacks: 84,
    districtsDestroyed: 29,
    offensiveReward: 188,
    defensiveReward: 224,
    members,
});

/**
 * @param {{ current: any, previous?: any }} args
 */
function harness({ current, previous }) {
    const capitalService = { getCurrentRaid: vi.fn().mockResolvedValue(current) };
    const state = new Map();
    if (previous !== undefined) state.set("capital", previous);
    const store = {
        getSnapshot: vi.fn((k) => (state.has(k) ? state.get(k) : null)),
        setSnapshot: vi.fn((k, v) => state.set(k, v)),
    };
    const notifier = { send: vi.fn().mockResolvedValue(true) };
    const watcher = createCapitalWatcher({ capitalService, store, notifier, logger: silent });
    return { capitalService, store, notifier, watcher };
}

/** @param {any} notifier @param {string} channel */
const sendsTo = (notifier, channel) =>
    notifier.send.mock.calls.filter((/** @type {any[]} */ c) => c[0] === channel).length;

describe("capital watcher", () => {
    it("establishes a baseline on first run without posting", async () => {
        const current = season("ongoing", "#w1");
        const { notifier, store, watcher } = harness({ current, previous: undefined });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalledWith("capital", current);
    });

    it("posts a single start embed when a new weekend goes live", async () => {
        const current = season("ongoing", "20260703T070000.000Z");
        const { notifier, store, watcher } = harness({
            current,
            previous: season("ended", "20260626T070000.000Z"),
        });

        await watcher.poll();

        expect(sendsTo(notifier, "capital")).toBe(1);
        expect(store.setSnapshot).toHaveBeenCalledWith("capital", current);
    });

    it("posts summary + missed + leaderboard (3 sends) at weekend end", async () => {
        const s = "20260703T070000.000Z";
        const members = [
            { tag: "#A", name: "Ann", attacksUsed: 6, attacksAllowed: 6, looted: 500 },
            { tag: "#B", name: "Bob", attacksUsed: 4, attacksAllowed: 6, looted: 200 },
        ];
        const { notifier, watcher } = harness({
            current: season("ended", s, members),
            previous: season("ongoing", s, members),
        });

        await watcher.poll();

        expect(sendsTo(notifier, "capital")).toBe(3);
    });

    it("stays silent mid-weekend but keeps the snapshot fresh", async () => {
        const s = "20260703T070000.000Z";
        const current = season("ongoing", s);
        const { notifier, store, watcher } = harness({ current, previous: season("ongoing", s) });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalledWith("capital", current);
    });

    it("does not advance the snapshot when the fetch fails", async () => {
        const capitalService = { getCurrentRaid: vi.fn().mockRejectedValue(new Error("boom")) };
        const store = { getSnapshot: vi.fn(), setSnapshot: vi.fn() };
        const notifier = { send: vi.fn() };
        const watcher = createCapitalWatcher({ capitalService, store, notifier, logger: silent });

        await expect(watcher.poll()).rejects.toThrow("boom");
        expect(store.setSnapshot).not.toHaveBeenCalled();
    });
});
