import { describe, it, expect } from "vitest";
import { buildDashboardView, topDonator, pickActiveWar } from "../src/features/dashboard.js";

/** @param {Partial<import("../src/coc/clan.js").ClanInfo>} [over] */
const clan = (over = {}) => ({
    name: "Breakfast Foods",
    tag: "#PVVY8L2L",
    level: 24,
    members: 42,
    description: "",
    points: 30000,
    warWins: 150,
    location: "US",
    warLeague: "Crystal League III",
    ...over,
});

/** @param {string} name @param {number} stars @param {number} destruction */
const warSide = (name, stars, destruction) => ({
    name,
    tag: "#" + name,
    stars,
    destruction,
    members: [],
});

/** @type {import("../src/features/war.js").ActiveWar} */
const inWar = {
    state: "inWar",
    teamSize: 15,
    startTime: "20260701T120000.000Z",
    endTime: "20260702T120000.000Z",
    clan: warSide("Us", 20, 55.5),
    opponent: warSide("Foes", 15, 40.1),
};

/**
 * @param {"ongoing"|"ended"} state
 * @param {Partial<import("../src/features/capital.js").RaidSeason>} [over]
 * @returns {import("../src/features/capital.js").RaidSeason}
 */
const raidSeason = (state, over = {}) => ({
    state,
    startTime: "20260626T070000.000Z",
    endTime: "20260629T070000.000Z",
    totalLoot: 320582,
    raidsCompleted: 6,
    totalAttacks: 84,
    districtsDestroyed: 12,
    offensiveReward: 0,
    defensiveReward: 0,
    members: [],
    ...over,
});

const donationsState = {
    period: "2026-W27",
    last: {},
    tally: {
        "#A": { tag: "#A", name: "Ann", donated: 300, received: 10 },
        "#B": { tag: "#B", name: "Bob", donated: 800, received: 0 },
    },
};

describe("topDonator", () => {
    it("returns the highest weekly-tally donor", () => {
        expect(topDonator(donationsState)).toEqual({ name: "Bob", donated: 800 });
    });
    it("returns null when nothing donated yet or state missing", () => {
        expect(topDonator(null)).toBeNull();
        expect(topDonator({ period: "x", last: {}, tally: {} })).toBeNull();
        expect(
            topDonator({
                period: "x",
                last: {},
                tally: { "#A": { tag: "#A", name: "Z", donated: 0, received: 5 } },
            }),
        ).toBeNull();
    });
});

describe("pickActiveWar", () => {
    /** @type {import("../src/features/war.js").WarSnapshot} */
    const notIn = { state: "notInWar" };
    it("prefers a live regular war over CWL", () => {
        expect(pickActiveWar(inWar, { ...inWar, opponent: warSide("CwlFoe", 0, 0) })).toBe(inWar);
    });
    it("falls back to a live CWL round when no regular war is on", () => {
        const cwl = { ...inWar, opponent: warSide("CwlFoe", 0, 0) };
        expect(pickActiveWar(notIn, cwl)).toBe(cwl);
    });
    it("returns a notInWar snapshot (section reads idle) when neither is live", () => {
        expect(pickActiveWar(notIn, notIn)).toBe(notIn);
        expect(pickActiveWar(null, null)).toBeNull();
    });
});

describe("buildDashboardView", () => {
    it("assembles all four sections when everything is present", () => {
        const view = buildDashboardView({
            war: inWar,
            raid: raidSeason("ongoing"),
            donations: donationsState,
            clan: clan(),
        });
        expect(view.clanName).toBe("Breakfast Foods");
        expect(view.war).toMatchObject({ opponent: "Foes", ourStars: 20, theirStars: 15 });
        expect(view.war?.phase).toContain("Battle");
        expect(view.raid).toMatchObject({ totalLoot: 320582, districtsDestroyed: 12 });
        expect(view.topDonator).toEqual({ name: "Bob", donated: 800 });
        expect(view.totals).toEqual({
            members: 42,
            warLeague: "Crystal League III",
            level: 24,
            points: 30000,
        });
    });

    it("nulls the war section when not in a war", () => {
        const view = buildDashboardView({
            war: { state: "notInWar" },
            raid: null,
            donations: null,
            clan: clan(),
        });
        expect(view.war).toBeNull();
    });

    it("only shows the raid section while a weekend is ongoing", () => {
        const ended = buildDashboardView({
            war: null,
            raid: raidSeason("ended"),
            donations: null,
            clan: clan(),
        });
        expect(ended.raid).toBeNull();
    });

    it("degrades gracefully when clan info is missing (partial board)", () => {
        const view = buildDashboardView({ war: inWar, raid: null, donations: null, clan: null });
        expect(view.totals).toBeNull();
        // Falls back to the war's clan name when clan info is unavailable.
        expect(view.clanName).toBe("Us");
        expect(view.war).not.toBeNull();
    });

    it("defaults the clan name when neither clan info nor a war is available", () => {
        const view = buildDashboardView({
            war: { state: "notInWar" },
            raid: null,
            donations: null,
            clan: null,
        });
        expect(view.clanName).toBe("Clan");
    });
});
