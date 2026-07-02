import { describe, it, expect } from "vitest";
import {
    weekKey,
    accumulateDonations,
    donationRatio,
    donationLeaderboard,
    currentSeasonTable,
} from "../src/features/donations.js";

/**
 * @param {string} tag @param {number} donations @param {number} received @param {string} [name]
 * @returns {import("../src/coc/members.js").Member}
 */
const m = (tag, donations, received, name = `P${tag}`) => ({
    tag,
    name,
    role: "member",
    townHall: 15,
    trophies: 4000,
    donations,
    donationsReceived: received,
    clanRank: 1,
});

describe("weekKey", () => {
    it("returns an ISO-week key in UTC", () => {
        // 2026-07-02 is a Thursday → ISO week 27 of 2026.
        expect(weekKey(new Date("2026-07-02T12:00:00Z"))).toBe("2026-W27");
    });

    it("groups Mon–Sun into the same week and rolls over on Monday", () => {
        const sun = weekKey(new Date("2026-07-05T23:59:00Z")); // Sunday
        const mon = weekKey(new Date("2026-07-06T00:01:00Z")); // Monday
        expect(sun).toBe("2026-W27");
        expect(mon).toBe("2026-W28");
    });
});

describe("accumulateDonations", () => {
    it("establishes a baseline on the first poll without a rollover", () => {
        const { next, rollover } = accumulateDonations(null, [m("#A", 100, 50)], "2026-W27");
        expect(rollover).toBeNull();
        expect(next).toEqual({
            period: "2026-W27",
            last: { "#A": { d: 100, r: 50 } },
            tally: {},
        });
    });

    it("accumulates deltas across polls within the same week (no rollover)", () => {
        const base = accumulateDonations(null, [m("#A", 100, 50)], "2026-W27").next;
        const { next, rollover } = accumulateDonations(base, [m("#A", 130, 60)], "2026-W27");
        expect(rollover).toBeNull();
        expect(next.tally["#A"]).toEqual({ tag: "#A", name: "P#A", donated: 30, received: 10 });
        expect(next.last["#A"]).toEqual({ d: 130, r: 60 });
    });

    it("treats a counter drop as a season reset (delta = current, not negative)", () => {
        const base = accumulateDonations(null, [m("#A", 400, 200)], "2026-W27").next;
        // Season reset: counter fell to 30/10 — those are this poll's donations.
        const { next } = accumulateDonations(base, [m("#A", 30, 10)], "2026-W27");
        expect(next.tally["#A"]).toEqual({ tag: "#A", name: "P#A", donated: 30, received: 10 });
    });

    it("emits the completed week's rows as rollover when the week changes", () => {
        const w27 = accumulateDonations(null, [m("#A", 100, 0), m("#B", 0, 0)], "2026-W27").next;
        const mid = accumulateDonations(w27, [m("#A", 150, 0), m("#B", 0, 0)], "2026-W27").next;
        const { next, rollover } = accumulateDonations(
            mid,
            [m("#A", 170, 0), m("#B", 0, 0)],
            "2026-W28",
        );
        // #A donated 70 across the week; #B (0) is dropped from the rollover.
        expect(rollover).toEqual([{ tag: "#A", name: "P#A", donated: 70, received: 0 }]);
        // New week starts with an empty tally but a fresh baseline.
        expect(next.period).toBe("2026-W28");
        expect(next.tally).toEqual({});
        expect(next.last["#A"]).toEqual({ d: 170, r: 0 });
    });

    it("counts a newly-seen member's current counter as their delta", () => {
        const base = accumulateDonations(null, [m("#A", 100, 0)], "2026-W27").next;
        const { next } = accumulateDonations(base, [m("#A", 100, 0), m("#B", 40, 5)], "2026-W27");
        expect(next.tally["#B"]).toEqual({ tag: "#B", name: "P#B", donated: 40, received: 5 });
    });
});

describe("donationRatio", () => {
    it("divides donated by received", () => {
        expect(donationRatio(100, 50)).toBe(2);
    });
    it("falls back to the donated count when nothing was received", () => {
        expect(donationRatio(100, 0)).toBe(100);
    });
});

describe("donationLeaderboard", () => {
    it("ranks by donated desc with ratio as tiebreak and attaches ratio", () => {
        const ranked = donationLeaderboard([
            { tag: "#A", name: "Ann", donated: 100, received: 100 },
            { tag: "#B", name: "Bob", donated: 100, received: 20 },
            { tag: "#C", name: "Cid", donated: 300, received: 50 },
        ]);
        expect(ranked.map((r) => r.tag)).toEqual(["#C", "#B", "#A"]);
        expect(ranked[0].ratio).toBe(6);
    });
});

describe("currentSeasonTable", () => {
    it("builds a ranked table straight from live members", () => {
        const table = currentSeasonTable([m("#A", 100, 10), m("#B", 500, 10)]);
        expect(table.map((r) => r.tag)).toEqual(["#B", "#A"]);
        expect(table[0]).toMatchObject({ name: "P#B", donated: 500, received: 10, ratio: 50 });
    });
});
