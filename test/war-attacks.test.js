import { describe, it, expect } from "vitest";
import {
    detectNewAttacks,
    computeMissedAttacks,
    membersWithAttacksLeft,
} from "../src/features/war.js";

/**
 * @param {Array<{order:number,defenderTag:string,stars:number,pct:number}>} attacks
 * @param {string} tag @param {string} name
 */
const member = (tag, name, attacks) => ({
    tag,
    name,
    mapPosition: 1,
    townhallLevel: 15,
    attacks: attacks.map((a) => ({
        order: a.order,
        attackerTag: tag,
        defenderTag: a.defenderTag,
        stars: a.stars,
        destructionPercentage: a.pct,
    })),
});

/**
 * @param {any[]} clanMembers
 * @param {any[]} [oppMembers]
 * @param {number} [attacksPerMember]
 * @returns {import("../src/features/war.js").ActiveWar}
 */
const war = (clanMembers, oppMembers = [], attacksPerMember = 2) => ({
    state: "inWar",
    teamSize: 15,
    attacksPerMember,
    clan: { name: "Us", tag: "#U", stars: 0, destruction: 0, members: clanMembers },
    opponent: { name: "Foes", tag: "#O", stars: 0, destruction: 0, members: oppMembers },
});

describe("detectNewAttacks", () => {
    it("returns attacks present in curr but not prev, ordered by war order", () => {
        const prev = war([
            member("#A", "Ann", [{ order: 1, defenderTag: "#x", stars: 2, pct: 80 }]),
        ]);
        const curr = war([
            member("#A", "Ann", [
                { order: 1, defenderTag: "#x", stars: 2, pct: 80 },
                { order: 3, defenderTag: "#y", stars: 3, pct: 100 },
            ]),
        ]);

        const found = detectNewAttacks(prev, curr);

        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ order: 3, attackerName: "Ann", stars: 3, side: "clan" });
    });

    it("includes both sides and tags each with its side", () => {
        const prev = war([], []);
        const curr = war(
            [member("#A", "Ann", [{ order: 1, defenderTag: "#o1", stars: 3, pct: 100 }])],
            [member("#B", "Bob", [{ order: 2, defenderTag: "#c1", stars: 1, pct: 40 }])],
        );

        const found = detectNewAttacks(prev, curr);

        expect(found.map((a) => a.side)).toEqual(["clan", "opponent"]);
    });

    it("returns nothing when no new attacks were made", () => {
        const same = war([
            member("#A", "Ann", [{ order: 1, defenderTag: "#x", stars: 2, pct: 80 }]),
        ]);
        expect(detectNewAttacks(same, same)).toEqual([]);
    });
});

describe("computeMissedAttacks", () => {
    it("lists our members who used fewer than the allowed attacks", () => {
        const w = war(
            [
                member("#A", "Ann", [
                    { order: 1, defenderTag: "#x", stars: 3, pct: 100 },
                    { order: 2, defenderTag: "#y", stars: 2, pct: 70 },
                ]),
                member("#B", "Bob", [{ order: 3, defenderTag: "#z", stars: 1, pct: 30 }]),
                member("#C", "Cat", []),
            ],
            [],
            2,
        );

        const missed = computeMissedAttacks(w);

        expect(missed).toEqual([
            { tag: "#B", name: "Bob", used: 1, of: 2 },
            { tag: "#C", name: "Cat", used: 0, of: 2 },
        ]);
    });

    it("respects a 1-attack war (CWL)", () => {
        const w = war(
            [
                member("#A", "Ann", [{ order: 1, defenderTag: "#x", stars: 3, pct: 100 }]),
                member("#B", "Bob", []),
            ],
            [],
            1,
        );
        expect(computeMissedAttacks(w).map((m) => m.name)).toEqual(["Bob"]);
    });
});

describe("membersWithAttacksLeft", () => {
    it("lists members with unused attacks and how many remain", () => {
        const w = war(
            [
                member("#A", "Ann", [
                    { order: 1, defenderTag: "#x", stars: 3, pct: 100 },
                    { order: 2, defenderTag: "#y", stars: 2, pct: 70 },
                ]),
                member("#B", "Bob", [{ order: 3, defenderTag: "#z", stars: 1, pct: 30 }]),
                member("#C", "Cat", []),
            ],
            [],
            2,
        );

        expect(membersWithAttacksLeft(w)).toEqual([
            { tag: "#B", name: "Bob", remaining: 1 },
            { tag: "#C", name: "Cat", remaining: 2 },
        ]);
    });
});
