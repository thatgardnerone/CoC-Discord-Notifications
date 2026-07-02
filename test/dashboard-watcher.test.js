import { describe, it, expect, vi } from "vitest";
import { createDashboardWatcher } from "../src/features/dashboard-watcher.js";

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

const clanInfo = {
    name: "Us",
    tag: "#U",
    level: 24,
    members: 42,
    description: "",
    points: 30000,
    warWins: 150,
    location: "US",
    warLeague: "Crystal III",
};

/**
 * @param {{ snapshots?: Record<string, any>, upsertResult?: string | null, clanThrows?: boolean }} [opts]
 */
function harness({ snapshots = {}, upsertResult = "msg-1", clanThrows = false } = {}) {
    const state = new Map(Object.entries(snapshots));
    const store = {
        getSnapshot: vi.fn((k) => (state.has(k) ? state.get(k) : null)),
        setSnapshot: vi.fn((k, v) => state.set(k, v)),
    };
    const notifier = { upsertPinned: vi.fn().mockResolvedValue(upsertResult) };
    const clanService = {
        getInfo: clanThrows
            ? vi.fn().mockRejectedValue(new Error("503"))
            : vi.fn().mockResolvedValue(clanInfo),
    };
    const watcher = createDashboardWatcher({
        store,
        notifier,
        clanService,
        logger: silent,
        clock: () => new Date("2026-07-02T12:00:00Z"),
    });
    return { store, notifier, clanService, watcher, state };
}

describe("dashboard watcher", () => {
    it("creates the message on first run (null id) and persists the new id", async () => {
        const h = harness({ upsertResult: "msg-1" });

        await h.watcher.poll();

        expect(h.notifier.upsertPinned).toHaveBeenCalledWith(
            "clanHq",
            null,
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
        expect(h.store.setSnapshot).toHaveBeenCalledWith("dashboard:msg", "msg-1");
    });

    it("edits in place using the stored id and does not rewrite it when unchanged", async () => {
        const h = harness({ snapshots: { "dashboard:msg": "msg-1" }, upsertResult: "msg-1" });

        await h.watcher.poll();

        expect(h.notifier.upsertPinned).toHaveBeenCalledWith("clanHq", "msg-1", expect.any(Object));
        expect(h.store.setSnapshot).not.toHaveBeenCalled();
    });

    it("persists a recreated id when the message was replaced", async () => {
        const h = harness({ snapshots: { "dashboard:msg": "old" }, upsertResult: "new" });

        await h.watcher.poll();

        expect(h.store.setSnapshot).toHaveBeenCalledWith("dashboard:msg", "new");
    });

    it("does not persist when the channel is unconfigured (upsert returns null)", async () => {
        const h = harness({ upsertResult: null });

        await h.watcher.poll();

        expect(h.store.setSnapshot).not.toHaveBeenCalled();
    });

    it("still renders (partial board) when clan info fetch fails", async () => {
        const h = harness({ snapshots: { war: { state: "notInWar" } }, clanThrows: true });

        await h.watcher.poll();

        expect(h.notifier.upsertPinned).toHaveBeenCalled();
        expect(silent.warn).toHaveBeenCalled();
    });

    it("reads the war, cwl, capital and donations snapshots", async () => {
        const h = harness();
        await h.watcher.poll();
        const keys = h.store.getSnapshot.mock.calls.map((c) => c[0]);
        expect(keys).toEqual(
            expect.arrayContaining(["war", "cwl", "capital", "donations", "dashboard:msg"]),
        );
    });
});
