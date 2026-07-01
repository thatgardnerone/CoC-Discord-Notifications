import { describe, it, expect } from "vitest";
import { normaliseRaid } from "../src/coc/capital.js";
import {
    detectRaidEvents,
    computeMissedRaiders,
    capitalLeaderboard,
} from "../src/features/capital.js";

/**
 * @param {"ongoing"|"ended"} state
 * @param {string} startTime
 * @param {import("../src/features/capital.js").RaidMember[]} [members]
 * @returns {import("../src/features/capital.js").RaidSeason}
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

/** @param {string} tag @param {number} used @param {number} allowed @param {number} looted */
const rm = (tag, used, allowed, looted) => ({
    tag,
    name: `P${tag}`,
    attacksUsed: used,
    attacksAllowed: allowed,
    looted,
});

describe("normaliseRaid", () => {
    it("maps the raw capital season fields and combines attack limits", () => {
        const raid = normaliseRaid({
            state: "ended",
            startTime: "20260626T070000.000Z",
            endTime: "20260629T070000.000Z",
            capitalTotalLoot: 320582,
            raidsCompleted: 6,
            totalAttacks: 84,
            enemyDistrictsDestroyed: 29,
            offensiveReward: 188,
            defensiveReward: 224,
            members: [
                {
                    tag: "#U",
                    name: "Viking King",
                    attacks: 6,
                    attackLimit: 5,
                    bonusAttackLimit: 1,
                    capitalResourcesLooted: 25293,
                },
            ],
        });
        expect(raid).toMatchObject({
            state: "ended",
            totalLoot: 320582,
            districtsDestroyed: 29,
            offensiveReward: 188,
            defensiveReward: 224,
        });
        expect(raid.state === "none" ? [] : raid.members[0]).toEqual({
            tag: "#U",
            name: "Viking King",
            attacksUsed: 6,
            attacksAllowed: 6, // 5 + 1 bonus
            looted: 25293,
        });
    });

    it("returns a none-state snapshot when the clan has no raid history", () => {
        expect(normaliseRaid(undefined)).toEqual({ state: "none" });
    });
});

describe("detectRaidEvents", () => {
    it("emits nothing on the first run (null baseline)", () => {
        expect(detectRaidEvents(null, season("ongoing", "#w1"))).toEqual([]);
    });

    it("emits raidStart when a new weekend goes live", () => {
        const curr = season("ongoing", "20260703T070000.000Z");
        const events = detectRaidEvents(season("ended", "20260626T070000.000Z"), curr);
        expect(events).toEqual([{ type: "raidStart", raid: curr }]);
    });

    it("emits raidStart from a no-raid baseline", () => {
        const curr = season("ongoing", "20260703T070000.000Z");
        expect(detectRaidEvents({ state: "none" }, curr)).toEqual([
            { type: "raidStart", raid: curr },
        ]);
    });

    it("stays silent mid-weekend (same ongoing season)", () => {
        const s = "20260703T070000.000Z";
        expect(detectRaidEvents(season("ongoing", s), season("ongoing", s))).toEqual([]);
    });

    it("emits raidEnd only for the weekend it was watching", () => {
        const s = "20260703T070000.000Z";
        const ended = season("ended", s);
        expect(detectRaidEvents(season("ongoing", s), ended)).toEqual([
            { type: "raidEnd", raid: ended },
        ]);
    });

    it("stays silent between weekends (ended → same ended)", () => {
        const s = "20260626T070000.000Z";
        expect(detectRaidEvents(season("ended", s), season("ended", s))).toEqual([]);
    });
});

describe("computeMissedRaiders", () => {
    it("lists only members who left attacks unused, most-missed first", () => {
        const raid = season("ended", "#w", [
            rm("#A", 6, 6, 100), // done
            rm("#B", 4, 6, 80), // missed 2
            rm("#C", 5, 6, 90), // missed 1
        ]);
        expect(computeMissedRaiders(raid)).toEqual([
            { tag: "#B", name: "P#B", used: 4, allowed: 6 },
            { tag: "#C", name: "P#C", used: 5, allowed: 6 },
        ]);
    });
});

describe("capitalLeaderboard", () => {
    it("ranks members by capital gold looted, descending", () => {
        const raid = season("ended", "#w", [
            rm("#A", 6, 6, 100),
            rm("#B", 6, 6, 500),
            rm("#C", 6, 6, 300),
        ]);
        expect(capitalLeaderboard(raid).map((m) => m.tag)).toEqual(["#B", "#C", "#A"]);
    });
});
