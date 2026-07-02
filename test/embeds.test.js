import { describe, it, expect } from "vitest";
import {
    clanInfoEmbed,
    warPreparationEmbed,
    warStartEmbed,
    warEndEmbed,
    attackLogEmbed,
    missedAttackEmbed,
    attackReminderMessage,
    cwlStatusEmbed,
    membershipEmbed,
    rosterEmbed,
    raidStartEmbed,
    raidEndEmbed,
    capitalMissedEmbed,
    capitalLeaderboardEmbed,
    donationLeaderboardEmbed,
    donationTableEmbed,
    dashboardEmbed,
} from "../src/discord/embeds.js";

/** @type {import("../src/features/war.js").ActiveWar} */
const activeWar = {
    state: "inWar",
    teamSize: 15,
    startTime: "20260701T120000.000Z",
    endTime: "20260702T120000.000Z",
    clan: { name: "Us", tag: "#U", stars: 20, destruction: 88.5, members: [] },
    opponent: { name: "Foes", tag: "#O", stars: 15, destruction: 70.1, members: [] },
};

const clan = {
    name: "Breakfast Foods",
    tag: "#PVVY8L2L",
    level: 24,
    members: 42,
    description: "Chill war clan",
    points: 30000,
    warWins: 150,
    location: "United States",
    warLeague: "Crystal League III",
};

describe("clanInfoEmbed", () => {
    it("renders clan info as an embed", () => {
        const data = clanInfoEmbed(clan).toJSON();
        expect(data.title).toBe("Breakfast Foods (#PVVY8L2L)");
        expect(data.description).toBe("Chill war clan");
        const fields = data.fields ?? [];
        expect(fields.map((f) => f.name)).toContain("Members");
        expect(fields.find((f) => f.name === "Members")?.value).toBe("42/50");
    });

    it("falls back gracefully for missing optional values", () => {
        const data = clanInfoEmbed({
            ...clan,
            description: "",
            location: null,
            warLeague: null,
        }).toJSON();
        expect(data.description).toBeUndefined(); // null description => omitted
        const fields = data.fields ?? [];
        expect(fields.find((f) => f.name === "Location")?.value).toBe("—");
    });
});

describe("war embeds", () => {
    it("warPreparationEmbed names the opponent and size", () => {
        const data = warPreparationEmbed(activeWar).toJSON();
        expect(data.title).toContain("vs Foes");
        expect((data.fields ?? []).find((f) => f.name === "Size")?.value).toBe("15v15");
    });

    it("warStartEmbed shows both clans and size", () => {
        const data = warStartEmbed(activeWar).toJSON();
        expect(data.title).toContain("Us vs Foes");
        expect((data.fields ?? []).find((f) => f.name === "Size")?.value).toBe("15v15");
    });

    it("warEndEmbed reflects the result and score", () => {
        expect(warEndEmbed(activeWar, "win").toJSON().title).toContain("Victory");
        expect(warEndEmbed(activeWar, "lose").toJSON().title).toContain("Defeat");
        expect(warEndEmbed(activeWar, "tie").toJSON().title).toContain("Draw");
        const data = warEndEmbed(activeWar, "win").toJSON();
        expect((data.fields ?? []).find((f) => f.name === "Stars")?.value).toBe("20 – 15");
    });

    it("attackLogEmbed lists attacks with side flags", () => {
        const data = attackLogEmbed([
            {
                order: 1,
                side: "clan",
                attackerTag: "#A",
                attackerName: "Ann",
                defenderTag: "#x",
                stars: 3,
                destructionPercentage: 100,
            },
            {
                order: 2,
                side: "opponent",
                attackerTag: "#B",
                attackerName: "Bob",
                defenderTag: "#y",
                stars: 1,
                destructionPercentage: 40,
            },
        ]).toJSON();
        expect(data.description).toContain("🟢 **Ann**");
        expect(data.description).toContain("🔴 **Bob**");
        expect(data.description).toContain("3⭐");
    });

    it("attackLogEmbed does not throw on an empty list (no empty setDescription)", () => {
        expect(() => attackLogEmbed([]).toJSON()).not.toThrow();
    });

    it("cwlStatusEmbed shows the round, matchup and score", () => {
        const data = cwlStatusEmbed(activeWar, 3).toJSON();
        expect(data.title).toContain("CWL Round 3");
        expect(data.title).toContain("Us vs Foes");
        expect((data.fields ?? []).find((f) => f.name === "Stars")?.value).toBe("20 – 15");
    });

    it("attackReminderMessage lists due members with mentions and hours left", () => {
        const msg = attackReminderMessage(
            [
                { mention: "<@111>", remaining: 2 },
                { mention: "**Bob**", remaining: 1 },
            ],
            "2h",
        );
        expect(msg).toContain("2h left");
        expect(msg).toContain("<@111> — 2 attacks left");
        expect(msg).toContain("**Bob** — 1 attack left");
    });

    it("missedAttackEmbed lists missers, or celebrates when none", () => {
        const missed = missedAttackEmbed(activeWar, [
            { tag: "#B", name: "Bob", used: 1, of: 2 },
        ]).toJSON();
        expect(missed.description).toContain("Bob");
        expect(missed.description).toContain("1/2");

        const clean = missedAttackEmbed(activeWar, []).toJSON();
        expect(clean.description).toContain("Everyone used all their attacks");
    });
});

describe("membership embeds", () => {
    /**
     * @param {string} name
     * @param {Partial<import("../src/coc/members.js").Member>} [over]
     * @returns {import("../src/coc/members.js").Member}
     */
    const m = (name, over = {}) => ({
        tag: "#" + name,
        name,
        role: "member",
        townHall: 14,
        trophies: 4000,
        donations: 0,
        donationsReceived: 0,
        clanRank: 1,
        ...over,
    });

    it("membershipEmbed renders each event type in one embed", () => {
        const data = membershipEmbed([
            { type: "join", member: m("Ann", { townHall: 15, role: "member" }) },
            { type: "leave", member: m("Bob", { townHall: 13 }) },
            {
                type: "roleChange",
                member: m("Cid", { role: "coLeader" }),
                from: "admin",
                to: "coLeader",
                promoted: true,
            },
            { type: "townHallUpgrade", member: m("Dee"), from: 14, to: 15 },
            { type: "nameChange", member: m("Eve"), from: "Evelyn", to: "Eve" },
        ]).toJSON();
        expect(data.description).toContain("📥 **Ann** joined — TH15, 4000🏆, Member");
        expect(data.description).toContain("📤 **Bob** left — TH13, 4000🏆");
        expect(data.description).toContain("⬆️ **Cid** promoted to Co-Leader (was Elder)");
        expect(data.description).toContain("🏠 **Dee** upgraded to TH15 (was TH14)");
        expect(data.description).toContain("✏️ **Evelyn** is now known as **Eve**");
    });

    it("membershipEmbed marks a demotion with the down arrow", () => {
        const data = membershipEmbed([
            {
                type: "roleChange",
                member: m("Cid", { role: "member" }),
                from: "admin",
                to: "member",
                promoted: false,
            },
        ]).toJSON();
        expect(data.description).toContain("⬇️ **Cid** demoted to Member (was Elder)");
    });

    it("rosterEmbed sorts by seniority then trophies and shows the count", () => {
        const data = rosterEmbed([
            m("Grunt", { role: "member", trophies: 3000 }),
            m("Boss", { role: "leader", trophies: 5000 }),
            m("HighGrunt", { role: "member", trophies: 4500 }),
        ]).toJSON();
        expect(data.title).toContain("(3/50)");
        const body = data.description ?? "";
        // Leader first, then the higher-trophy member before the lower one.
        expect(body.indexOf("Boss")).toBeLessThan(body.indexOf("HighGrunt"));
        expect(body.indexOf("HighGrunt")).toBeLessThan(body.indexOf("Grunt"));
    });

    it("rosterEmbed does not throw on an empty roster", () => {
        expect(() => rosterEmbed([]).toJSON()).not.toThrow();
    });
});

describe("capital embeds", () => {
    /**
     * @param {Partial<import("../src/features/capital.js").RaidSeason>} [over]
     * @returns {import("../src/features/capital.js").RaidSeason}
     */
    const raid = (over = {}) => ({
        state: "ended",
        startTime: "20260626T070000.000Z",
        endTime: "20260629T070000.000Z",
        totalLoot: 320582,
        raidsCompleted: 6,
        totalAttacks: 84,
        districtsDestroyed: 29,
        offensiveReward: 188,
        defensiveReward: 224,
        members: [],
        ...over,
    });

    it("raidStartEmbed announces the weekend with an end time", () => {
        const data = raidStartEmbed(raid({ state: "ongoing" })).toJSON();
        expect(data.title).toContain("Raid weekend");
        expect((data.fields ?? []).find((f) => f.name === "Ends")).toBeTruthy();
    });

    it("raidEndEmbed shows loot, districts and medals (formatted)", () => {
        const data = raidEndEmbed(raid()).toJSON();
        const fields = data.fields ?? [];
        expect(fields.find((f) => f.name === "Capital Gold")?.value).toContain("320,582");
        expect(fields.find((f) => f.name === "Districts Destroyed")?.value).toBe("29");
        expect(fields.find((f) => f.name === "Offence Medals")?.value).toContain("188");
    });

    it("raidEndEmbed title reflects whether the weekend is live (for /raid reuse)", () => {
        expect(raidEndEmbed(raid({ state: "ongoing" })).toJSON().title).toContain("so far");
        expect(raidEndEmbed(raid({ state: "ended" })).toJSON().title).toContain("over");
    });

    it("capitalMissedEmbed lists missers, or celebrates when none", () => {
        const missed = capitalMissedEmbed([{ name: "Bob", used: 4, allowed: 6 }]).toJSON();
        expect(missed.description).toContain("**Bob** — used 4/6");

        const clean = capitalMissedEmbed([]).toJSON();
        expect(clean.description).toContain("used all their attacks");
    });

    it("capitalLeaderboardEmbed medals the top three and formats loot", () => {
        const data = capitalLeaderboardEmbed([
            { tag: "#A", name: "Ann", attacksUsed: 6, attacksAllowed: 6, looted: 25293 },
            { tag: "#B", name: "Bob", attacksUsed: 6, attacksAllowed: 6, looted: 12000 },
        ]).toJSON();
        expect(data.description).toContain("🥇 **Ann** — 25,293");
        expect(data.description).toContain("🥈 **Bob** — 12,000");
    });

    it("capitalLeaderboardEmbed does not throw on no participants", () => {
        expect(() => capitalLeaderboardEmbed([]).toJSON()).not.toThrow();
    });
});

describe("donation embeds", () => {
    const rows = [
        { tag: "#A", name: "Ann", donated: 500, received: 100 },
        { tag: "#B", name: "Bob", donated: 200, received: 0 },
    ];

    it("donationLeaderboardEmbed titles with the week and renders the table", () => {
        const data = donationLeaderboardEmbed(rows, "2026-W27").toJSON();
        expect(data.title).toContain("2026-W27");
        expect(data.description).toContain("🥇");
        expect(data.description).toContain("Ann");
        expect(data.description).toContain("500↑");
        expect(data.description).toContain("5.00"); // 500/100 ratio
    });

    it("donationTableEmbed shows ∞ for give-only members and — for none", () => {
        const data = donationTableEmbed(rows).toJSON();
        expect(data.title).toContain("Season donations");
        expect(data.description).toContain("∞"); // Bob received 0
    });

    it("both donation embeds survive an empty list", () => {
        expect(() => donationLeaderboardEmbed([], "2026-W27").toJSON()).not.toThrow();
        expect(() => donationTableEmbed([]).toJSON()).not.toThrow();
    });
});

describe("dashboardEmbed", () => {
    const at = new Date("2026-07-02T12:00:00Z");
    const fullView = {
        clanName: "Us",
        war: {
            phase: "⚔️ Battle day",
            opponent: "Foes",
            ourStars: 20,
            theirStars: 15,
            ourDestruction: 55.5,
            theirDestruction: 40.1,
            startTime: "20260701T120000.000Z",
            endTime: "20260702T120000.000Z",
        },
        raid: { totalLoot: 320582, districtsDestroyed: 12, endTime: "20260629T070000.000Z" },
        topDonator: { name: "Bob", donated: 800 },
        totals: { members: 42, warLeague: "Crystal III", level: 24, points: 30000 },
    };

    it("renders all four sections and a last-updated timestamp", () => {
        const data = dashboardEmbed(fullView, at).toJSON();
        expect(data.title).toContain("Us — Clan HQ");
        const f = data.fields ?? [];
        expect(f.find((x) => x.name.includes("War"))?.value).toContain("Foes");
        expect(f.find((x) => x.name.includes("War"))?.value).toContain("⭐ 20–15");
        expect(f.find((x) => x.name.includes("Raid"))?.value).toContain("320,582");
        expect(f.find((x) => x.name.includes("Top donator"))?.value).toContain("Bob");
        expect(f.find((x) => x.name === "📋 Clan")?.value).toContain("42/50");
        expect(data.timestamp).toBeTruthy();
    });

    it("shows friendly idle lines when sections are empty (stable layout)", () => {
        const idle = dashboardEmbed(
            { clanName: "Clan", war: null, raid: null, topDonator: null, totals: null },
            at,
        ).toJSON();
        const f = idle.fields ?? [];
        expect(f).toHaveLength(4); // layout stays put across edits
        expect(f.find((x) => x.name.includes("War"))?.value).toContain("No active war");
        expect(f.find((x) => x.name.includes("Raid"))?.value).toContain("No raid weekend");
        expect(f.find((x) => x.name.includes("Top donator"))?.value).toContain("Nothing tracked");
        expect(f.find((x) => x.name === "📋 Clan")?.value).toBe("—");
    });

    it("labels the preparation phase with a battle-day countdown", () => {
        const prep = dashboardEmbed(
            { ...fullView, war: { ...fullView.war, phase: "🛡️ Preparation" } },
            at,
        ).toJSON();
        expect(prep.fields?.find((x) => x.name.includes("War"))?.value).toContain("battle day");
    });
});
