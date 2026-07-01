import { describe, it, expect } from "vitest";
import {
    clanInfoEmbed,
    warPreparationEmbed,
    warStartEmbed,
    warEndEmbed,
    attackLogEmbed,
    missedAttackEmbed,
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
