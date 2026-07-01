import { describe, it, expect, vi } from "vitest";
import { createClanService } from "../src/coc/clan.js";

const payload = {
    name: "Breakfast Foods",
    tag: "#PVVY8L2L",
    clanLevel: 24,
    members: 42,
    description: "Chill war clan",
    clanPoints: 30000,
    warWins: 150,
    location: { name: "United States" },
    warLeague: { name: "Crystal League III" },
};

/** @param {any} data */
const clientReturning = (data) => ({
    get: vi.fn().mockResolvedValue({ status: 200, data, headers: {} }),
});

describe("clan service", () => {
    it("fetches and normalises clan info", async () => {
        const svc = createClanService(clientReturning(payload), "#PVVY8L2L");
        const info = await svc.getInfo();
        expect(info).toEqual({
            name: "Breakfast Foods",
            tag: "#PVVY8L2L",
            level: 24,
            members: 42,
            description: "Chill war clan",
            points: 30000,
            warWins: 150,
            location: "United States",
            warLeague: "Crystal League III",
        });
    });

    it("URL-encodes the clan tag in the request path", async () => {
        const client = clientReturning(payload);
        await createClanService(client, "#PVVY8L2L").getInfo();
        expect(client.get).toHaveBeenCalledWith("clans/%23PVVY8L2L");
    });

    it("tolerates missing optional fields", async () => {
        const client = clientReturning({
            name: "X",
            tag: "#Y",
            clanLevel: 1,
            members: 1,
            clanPoints: 0,
            warWins: 0,
        });
        const info = await createClanService(client, "#Y").getInfo();
        expect(info.description).toBe("");
        expect(info.location).toBeNull();
        expect(info.warLeague).toBeNull();
    });
});
