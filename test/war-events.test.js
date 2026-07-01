import { describe, it, expect } from "vitest";
import { detectWarEvents, computeWarResult } from "../src/features/war.js";

/**
 * @param {"preparation" | "inWar" | "warEnded"} state
 * @param {{ cs?: number, os?: number, cd?: number, od?: number }} [scores]
 * @returns {import("../src/features/war.js").WarSnapshot}
 */
const war = (state, { cs = 0, os = 0, cd = 0, od = 0 } = {}) => ({
    state,
    teamSize: 15,
    clan: { name: "Us", tag: "#U", stars: cs, destruction: cd },
    opponent: { name: "Foes", tag: "#O", stars: os, destruction: od },
});

const prep = war("preparation");
const inWar = war("inWar");

/** @param {number} cs @param {number} os @param {number} [cd] @param {number} [od] */
const warEnded = (cs, os, cd = 0, od = 0) => war("warEnded", { cs, os, cd, od });

describe("detectWarEvents", () => {
    it("emits nothing on first run (no baseline) — avoids retroactive spam", () => {
        expect(detectWarEvents(null, prep)).toEqual([]);
    });

    it("emits nothing when the state is unchanged", () => {
        expect(detectWarEvents(inWar, inWar)).toEqual([]);
    });

    it("detects preparation start", () => {
        const events = detectWarEvents({ state: "notInWar" }, prep);
        expect(events).toHaveLength(1);
        expect(events[0].type).toBe("warPreparation");
        expect(events[0].war).toBe(prep);
    });

    it("detects battle day on preparation -> inWar", () => {
        const events = detectWarEvents(prep, inWar);
        expect(events[0].type).toBe("warStart");
    });

    it("detects war end with a computed result on inWar -> warEnded", () => {
        const war = warEnded(20, 15);
        const events = detectWarEvents(inWar, war);
        expect(events[0]).toMatchObject({ type: "warEnd", result: "win" });
    });

    it("does not announce leaving a war (-> notInWar)", () => {
        expect(detectWarEvents(inWar, { state: "notInWar" })).toEqual([]);
    });

    it("announces a fresh war after the previous one ended", () => {
        expect(detectWarEvents(warEnded(10, 10), prep)[0].type).toBe("warPreparation");
    });
});

describe("computeWarResult", () => {
    it("wins/loses on star count", () => {
        expect(computeWarResult(warEnded(10, 5))).toBe("win");
        expect(computeWarResult(warEnded(5, 10))).toBe("lose");
    });

    it("breaks star ties on destruction", () => {
        expect(computeWarResult(warEnded(10, 10, 95.5, 90))).toBe("win");
        expect(computeWarResult(warEnded(10, 10, 80, 90))).toBe("lose");
    });

    it("is a tie when stars and destruction are equal", () => {
        expect(computeWarResult(warEnded(10, 10, 90, 90))).toBe("tie");
    });
});
