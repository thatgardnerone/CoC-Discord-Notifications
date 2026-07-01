import { describe, it, expect, vi } from "vitest";
import { createWarWatcher } from "../src/features/war-watcher.js";
import { HttpError } from "../src/coc/http.js";

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** @param {string} tag @param {string} name @param {number} n Number of attacks used */
const attacker = (tag, name, n) => ({
    tag,
    name,
    mapPosition: 1,
    townhallLevel: 15,
    attacks: Array.from({ length: n }, (_, i) => ({
        order: i + 1,
        attackerTag: tag,
        defenderTag: `#d${i}`,
        stars: 3,
        destructionPercentage: 100,
    })),
});

/**
 * @param {"preparation"|"inWar"|"warEnded"} state
 * @param {any[]} [clanMembers]
 */
const snap = (state, clanMembers = []) => ({
    state,
    teamSize: 15,
    attacksPerMember: 2,
    startTime: "20260701T120000.000Z",
    endTime: "20260702T120000.000Z",
    clan: { name: "Us", tag: "#U", stars: 10, destruction: 90, members: clanMembers },
    opponent: { name: "Foes", tag: "#O", stars: 5, destruction: 70, members: [] },
});

/**
 * @param {{ current: import("../src/features/war.js").WarSnapshot, previous: import("../src/features/war.js").WarSnapshot | null }} args
 */
function harness({ current, previous }) {
    const warService = { getCurrentWar: vi.fn().mockResolvedValue(current) };
    const store = {
        getSnapshot: vi.fn().mockReturnValue(previous),
        setSnapshot: vi.fn(),
        close: vi.fn(),
    };
    const notifier = { send: vi.fn().mockResolvedValue(true) };
    const watcher = createWarWatcher({ warService, store, notifier, logger: silent });
    return { warService, store, notifier, watcher };
}

describe("war watcher", () => {
    it("posts to warLog on a state transition and persists the new snapshot", async () => {
        const current = snap("inWar");
        const { store, notifier, watcher } = harness({ current, previous: snap("preparation") });

        await watcher.poll();

        expect(notifier.send).toHaveBeenCalledTimes(1);
        expect(notifier.send).toHaveBeenCalledWith(
            "warLog",
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
        expect(store.setSnapshot).toHaveBeenCalledWith("war", current);
    });

    it("establishes a baseline on first run without posting", async () => {
        const current = snap("inWar");
        const { notifier, store, watcher } = harness({ current, previous: null });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalledWith("war", current);
    });

    it("does nothing visible when the state is unchanged (still persists)", async () => {
        const current = snap("inWar");
        const { notifier, store, watcher } = harness({ current, previous: snap("inWar") });

        await watcher.poll();

        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).toHaveBeenCalledWith("war", current);
    });

    it("posts the missed-attack report alongside the war-end embed", async () => {
        const current = snap("warEnded", [attacker("#A", "Ann", 2), attacker("#B", "Bob", 1)]);
        const { notifier, watcher } = harness({ current, previous: snap("inWar") });

        await watcher.poll();

        // war-end embed + missed-attack report = 2 sends, both to warLog
        expect(notifier.send).toHaveBeenCalledTimes(2);
        expect(notifier.send.mock.calls.every(([ch]) => ch === "warLog")).toBe(true);
    });

    it("posts a live attack-log for new attacks within an ongoing war", async () => {
        const previous = snap("inWar", [attacker("#A", "Ann", 1)]);
        const current = snap("inWar", [attacker("#A", "Ann", 2)]);
        const { notifier, watcher } = harness({ current, previous });

        await watcher.poll();

        expect(notifier.send).toHaveBeenCalledTimes(1);
        expect(notifier.send).toHaveBeenCalledWith(
            "warLog",
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
    });

    it("does not post an attack burst on the first inWar poll (prep -> inWar)", async () => {
        const current = snap("inWar", [attacker("#A", "Ann", 2)]);
        const { notifier, watcher } = harness({ current, previous: snap("preparation") });

        await watcher.poll();

        // only the war-start embed — not the pre-existing attacks
        expect(notifier.send).toHaveBeenCalledTimes(1);
    });

    it("degrades gracefully when the war log is private (403): warns, no throw, no write", async () => {
        const warService = { getCurrentWar: vi.fn().mockRejectedValue(new HttpError(403)) };
        const store = { getSnapshot: vi.fn(), setSnapshot: vi.fn(), close: vi.fn() };
        const notifier = { send: vi.fn() };
        const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        const watcher = createWarWatcher({ warService, store, notifier, logger });

        await expect(watcher.poll()).resolves.toBeUndefined();
        expect(logger.warn).toHaveBeenCalled();
        expect(notifier.send).not.toHaveBeenCalled();
        expect(store.setSnapshot).not.toHaveBeenCalled();
    });

    it("re-throws non-403 errors for the scheduler to handle", async () => {
        const warService = { getCurrentWar: vi.fn().mockRejectedValue(new HttpError(500)) };
        const store = { getSnapshot: vi.fn(), setSnapshot: vi.fn(), close: vi.fn() };
        const notifier = { send: vi.fn() };
        const watcher = createWarWatcher({ warService, store, notifier, logger: silent });

        await expect(watcher.poll()).rejects.toBeInstanceOf(HttpError);
    });
});
