import { describe, it, expect, vi } from "vitest";
import { createWarService } from "../src/coc/war.js";

const rawInWar = {
    state: "inWar",
    teamSize: 15,
    startTime: "20260701T120000.000Z",
    endTime: "20260702T120000.000Z",
    clan: { name: "Us", tag: "#U", stars: 20, destructionPercentage: 88.5, attacks: 20 },
    opponent: { name: "Foes", tag: "#O", stars: 15, destructionPercentage: 70.1 },
};

/** @param {any} data */
const clientReturning = (data) => ({
    get: vi.fn().mockResolvedValue({ status: 200, data, headers: {} }),
});

describe("war service", () => {
    it("requests the currentwar endpoint with the encoded tag", async () => {
        const client = clientReturning({ state: "notInWar" });
        await createWarService(client, "#PVVY8L2L").getCurrentWar();
        expect(client.get).toHaveBeenCalledWith("clans/%23PVVY8L2L/currentwar");
    });

    it("normalises notInWar", async () => {
        const war = await createWarService(
            clientReturning({ state: "notInWar" }),
            "#U",
        ).getCurrentWar();
        expect(war).toEqual({ state: "notInWar" });
    });

    it("normalises an active war, flattening destructionPercentage", async () => {
        const war = await createWarService(clientReturning(rawInWar), "#U").getCurrentWar();
        expect(war).toEqual({
            state: "inWar",
            teamSize: 15,
            startTime: "20260701T120000.000Z",
            endTime: "20260702T120000.000Z",
            clan: { name: "Us", tag: "#U", stars: 20, destruction: 88.5, attacks: 20 },
            opponent: { name: "Foes", tag: "#O", stars: 15, destruction: 70.1 },
        });
    });
});
