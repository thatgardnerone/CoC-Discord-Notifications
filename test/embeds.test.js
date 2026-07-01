import { describe, it, expect } from "vitest";
import { clanInfoEmbed } from "../src/discord/embeds.js";

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
