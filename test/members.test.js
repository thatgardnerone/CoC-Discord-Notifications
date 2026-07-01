import { describe, it, expect } from "vitest";
import { detectMemberEvents } from "../src/features/members.js";
import { normaliseMember } from "../src/coc/members.js";

/**
 * @param {string} tag
 * @param {Partial<import("../src/coc/members.js").Member>} [over]
 * @returns {import("../src/coc/members.js").Member}
 */
const member = (tag, over = {}) => ({
    tag,
    name: `Player ${tag}`,
    role: "member",
    townHall: 14,
    trophies: 4000,
    donations: 100,
    donationsReceived: 100,
    clanRank: 1,
    ...over,
});

describe("detectMemberEvents", () => {
    it("emits a join for a member present only in the current snapshot", () => {
        const events = detectMemberEvents([member("#A")], [member("#A"), member("#B")]);
        expect(events).toEqual([{ type: "join", member: member("#B") }]);
    });

    it("emits a leave for a member gone from the current snapshot", () => {
        const events = detectMemberEvents([member("#A"), member("#B")], [member("#A")]);
        expect(events).toEqual([{ type: "leave", member: member("#B") }]);
    });

    it("flags a promotion with direction and old→new role", () => {
        const events = detectMemberEvents(
            [member("#A", { role: "member" })],
            [member("#A", { role: "admin" })],
        );
        expect(events).toEqual([
            {
                type: "roleChange",
                member: member("#A", { role: "admin" }),
                from: "member",
                to: "admin",
                promoted: true,
            },
        ]);
    });

    it("flags a demotion as not promoted", () => {
        const events = detectMemberEvents(
            [member("#A", { role: "coLeader" })],
            [member("#A", { role: "admin" })],
        );
        expect(events[0]).toMatchObject({ type: "roleChange", promoted: false });
    });

    it("emits a Town Hall upgrade only when the level increases", () => {
        const up = detectMemberEvents(
            [member("#A", { townHall: 14 })],
            [member("#A", { townHall: 15 })],
        );
        expect(up).toEqual([
            { type: "townHallUpgrade", member: member("#A", { townHall: 15 }), from: 14, to: 15 },
        ]);

        // A spurious decrease (bad data) must not emit an event.
        const down = detectMemberEvents(
            [member("#A", { townHall: 15 })],
            [member("#A", { townHall: 14 })],
        );
        expect(down).toEqual([]);
    });

    it("emits a name change with old→new name", () => {
        const events = detectMemberEvents(
            [member("#A", { name: "Old" })],
            [member("#A", { name: "New" })],
        );
        expect(events).toEqual([
            { type: "nameChange", member: member("#A", { name: "New" }), from: "Old", to: "New" },
        ]);
    });

    it("does not emit for churny fields (trophies/donations)", () => {
        const events = detectMemberEvents(
            [member("#A", { trophies: 4000, donations: 100 })],
            [member("#A", { trophies: 4200, donations: 500 })],
        );
        expect(events).toEqual([]);
    });

    it("handles simultaneous changes to one member (role + TH at once)", () => {
        const events = detectMemberEvents(
            [member("#A", { role: "member", townHall: 14 })],
            [member("#A", { role: "admin", townHall: 15 })],
        );
        expect(events.map((e) => e.type).sort()).toEqual(["roleChange", "townHallUpgrade"]);
    });

    it("treats an empty previous snapshot as all-added (baseline handled by the watcher)", () => {
        const events = detectMemberEvents([], [member("#A")]);
        expect(events).toEqual([{ type: "join", member: member("#A") }]);
    });
});

describe("normaliseMember", () => {
    it("maps the capital-H townHallLevel field and fills sane defaults", () => {
        const m = normaliseMember({
            tag: "#A",
            name: "Ann",
            role: "leader",
            townHallLevel: 16,
            trophies: 5200,
            donations: 1200,
            donationsReceived: 800,
            clanRank: 1,
        });
        expect(m).toEqual({
            tag: "#A",
            name: "Ann",
            role: "leader",
            townHall: 16,
            trophies: 5200,
            donations: 1200,
            donationsReceived: 800,
            clanRank: 1,
        });
    });

    it("defaults missing numeric fields to 0", () => {
        const m = normaliseMember({ tag: "#B", name: "Bob", role: "member" });
        expect(m).toMatchObject({ townHall: 0, trophies: 0, donations: 0, clanRank: 0 });
    });
});
