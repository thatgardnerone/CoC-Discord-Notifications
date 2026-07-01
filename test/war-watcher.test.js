import { describe, it, expect, vi } from "vitest";
import { createWarWatcher } from "../src/features/war-watcher.js";
import { HttpError } from "../src/coc/http.js";
import { cocTimeToUnix } from "../src/coc/time.js";

const END_UNIX = /** @type {number} */ (cocTimeToUnix("20260702T120000.000Z"));
/** @param {number} hoursLeft */
const clockAt = (hoursLeft) => () => (END_UNIX - hoursLeft * 3600) * 1000;

const silent = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

/** @param {string} tag @param {string} name @param {number[]} orders Global war order of each attack */
const attacker = (tag, name, orders) => ({
    tag,
    name,
    mapPosition: 1,
    townhallLevel: 15,
    attacks: orders.map((order) => ({
        order,
        attackerTag: tag,
        defenderTag: `#d${order}`,
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
 * @param {{ current: any, previous: any, linkStore?: any, now?: () => number }} args
 */
function harness({ current, previous, linkStore, now }) {
    const warService = { getCurrentWar: vi.fn().mockResolvedValue(current) };
    const state = new Map();
    if (previous !== undefined) state.set("war", previous);
    const store = {
        getSnapshot: vi.fn((k) => (state.has(k) ? state.get(k) : null)),
        setSnapshot: vi.fn((k, v) => state.set(k, v)),
        close: vi.fn(),
    };
    const notifier = { send: vi.fn().mockResolvedValue(true) };
    const watcher = createWarWatcher({
        warService,
        store,
        notifier,
        linkStore,
        now,
        logger: silent,
    });
    return { warService, store, notifier, watcher, state };
}

/** Count notifier sends to a given channel. @param {any} notifier @param {string} channel */
const sendsTo = (notifier, channel) =>
    notifier.send.mock.calls.filter((/** @type {any[]} */ c) => c[0] === channel).length;

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
        // Same attacks in both snapshots -> no new attacks, just end + missed.
        const roster = [attacker("#A", "Ann", [1, 2]), attacker("#B", "Bob", [3])];
        const { notifier, watcher } = harness({
            current: snap("warEnded", roster),
            previous: snap("inWar", roster),
        });

        await watcher.poll();

        // war-end embed + missed-attack report = 2 sends, both to warLog
        expect(notifier.send).toHaveBeenCalledTimes(2);
        expect(notifier.send.mock.calls.every(([ch]) => ch === "warLog")).toBe(true);
    });

    it("posts a live attack-log for new attacks within an ongoing war", async () => {
        const previous = snap("inWar", [attacker("#A", "Ann", [1])]);
        const current = snap("inWar", [attacker("#A", "Ann", [1, 2])]);
        const { notifier, watcher } = harness({ current, previous });

        await watcher.poll();

        expect(notifier.send).toHaveBeenCalledTimes(1);
        expect(notifier.send).toHaveBeenCalledWith(
            "warLog",
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
    });

    it("posts the final attacks on the closing (inWar -> warEnded) poll, then end + missed", async () => {
        const previous = snap("inWar", [attacker("#A", "Ann", [1]), attacker("#B", "Bob", [2])]);
        // Ann lands one more attack (order 3) right at war end; Bob still missed one.
        const current = snap("warEnded", [
            attacker("#A", "Ann", [1, 3]),
            attacker("#B", "Bob", [2]),
        ]);
        const { notifier, watcher } = harness({ current, previous });

        await watcher.poll();

        // attack-log (final attack) + war-end embed + missed report = 3 sends
        expect(notifier.send).toHaveBeenCalledTimes(3);
    });

    it("does not post an attack burst on the first inWar poll (prep -> inWar)", async () => {
        const current = snap("inWar", [attacker("#A", "Ann", [1, 2])]);
        const { notifier, watcher } = harness({ current, previous: snap("preparation") });

        await watcher.poll();

        // only the war-start embed — not the pre-existing attacks
        expect(notifier.send).toHaveBeenCalledTimes(1);
    });

    it("routes posts to a custom log channel when configured (CWL reuse)", async () => {
        const warService = { getCurrentWar: vi.fn().mockResolvedValue(snap("inWar")) };
        const store = {
            getSnapshot: vi.fn().mockReturnValue(snap("preparation")),
            setSnapshot: vi.fn(),
            close: vi.fn(),
        };
        const notifier = { send: vi.fn().mockResolvedValue(true) };
        const watcher = createWarWatcher({
            warService,
            store,
            notifier,
            logger: silent,
            key: "cwl",
            logChannel: "cwl",
        });

        await watcher.poll();

        expect(notifier.send).toHaveBeenCalledWith(
            "cwl",
            expect.objectContaining({ embeds: expect.any(Array) }),
        );
    });

    describe("attack reminders", () => {
        const linked = {
            getByPlayer: vi.fn((tag) => (tag === "#A" ? { discordId: "disc-A" } : null)),
        };

        it("reminds members with attacks left as war nears end, @-mentioning linked users", async () => {
            const roster = [attacker("#A", "Ann", [1]), attacker("#B", "Bob", [])];
            const { notifier, store, watcher } = harness({
                current: snap("inWar", roster),
                previous: snap("inWar", roster),
                linkStore: linked,
                now: clockAt(1), // 1h left, within default 2h window
            });

            await watcher.poll();

            const reminders = notifier.send.mock.calls.filter(
                (/** @type {any[]} */ c) => c[0] === "warReminders",
            );
            expect(reminders).toHaveLength(1);
            const payload = reminders[0][1];
            expect(payload.content).toContain("<@disc-A>"); // linked → mention
            expect(payload.content).toContain("**Bob**"); // unlinked → name
            expect(payload.allowedMentions).toEqual({ users: ["disc-A"] });
            expect(store.setSnapshot).toHaveBeenCalledWith("war:reminded", "20260702T120000.000Z");
        });

        it("reminds only once per war", async () => {
            const roster = [attacker("#A", "Ann", [1])];
            const { notifier, watcher } = harness({
                current: snap("inWar", roster),
                previous: snap("inWar", roster),
                linkStore: linked,
                now: clockAt(1),
            });

            await watcher.poll();
            await watcher.poll();

            expect(sendsTo(notifier, "warReminders")).toBe(1);
        });

        it("does not remind while the war is still far from ending", async () => {
            const roster = [attacker("#A", "Ann", [1])];
            const { notifier, watcher } = harness({
                current: snap("inWar", roster),
                previous: snap("inWar", roster),
                linkStore: linked,
                now: clockAt(10), // 10h left > 2h window
            });

            await watcher.poll();

            expect(sendsTo(notifier, "warReminders")).toBe(0);
        });

        it("marks reminded without posting when everyone has attacked", async () => {
            const roster = [attacker("#A", "Ann", [1, 2])]; // both attacks used
            const { notifier, store, watcher } = harness({
                current: snap("inWar", roster),
                previous: snap("inWar", roster),
                linkStore: linked,
                now: clockAt(1),
            });

            await watcher.poll();

            expect(sendsTo(notifier, "warReminders")).toBe(0);
            expect(store.setSnapshot).toHaveBeenCalledWith("war:reminded", "20260702T120000.000Z");
        });
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
