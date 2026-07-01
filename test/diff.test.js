import { describe, it, expect } from "vitest";
import { diffBy, changedFields } from "../src/diff.js";

/** @param {{ tag: string }} m */
const byTag = (m) => m.tag;

describe("diffBy", () => {
    it("classifies added, removed, and common items by key", () => {
        const prev = [
            { tag: "#A", role: "member" },
            { tag: "#B", role: "elder" },
        ];
        const curr = [
            { tag: "#B", role: "coLeader" },
            { tag: "#C", role: "member" },
        ];

        const { added, removed, common } = diffBy(prev, curr, byTag);

        expect(added).toEqual([{ tag: "#C", role: "member" }]);
        expect(removed).toEqual([{ tag: "#A", role: "member" }]);
        expect(common).toEqual([
            { before: { tag: "#B", role: "elder" }, after: { tag: "#B", role: "coLeader" } },
        ]);
    });

    it("treats an empty baseline as all-added (no false leaves on first run)", () => {
        const { added, removed, common } = diffBy([], [{ tag: "#A" }], byTag);
        expect(added).toHaveLength(1);
        expect(removed).toHaveLength(0);
        expect(common).toHaveLength(0);
    });

    it("treats an empty current as all-removed", () => {
        const { added, removed } = diffBy([{ tag: "#A" }], [], byTag);
        expect(added).toHaveLength(0);
        expect(removed).toEqual([{ tag: "#A" }]);
    });
});

describe("changedFields", () => {
    it("returns only the watched fields that differ", () => {
        const before = { role: "member", townHallLevel: 14, donations: 100 };
        const after = { role: "elder", townHallLevel: 15, donations: 100 };
        expect(changedFields(before, after, ["role", "townHallLevel", "donations"])).toEqual([
            "role",
            "townHallLevel",
        ]);
    });

    it("returns an empty array when no watched field changed", () => {
        const before = { role: "member", donations: 100 };
        const after = { role: "member", donations: 250 };
        expect(changedFields(before, after, ["role"])).toEqual([]);
    });
});
