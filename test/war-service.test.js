import { describe, it, expect, vi } from "vitest";
import { createWarService } from "../src/coc/war.js";

const rawInWar = {
    state: "inWar",
    teamSize: 15,
    attacksPerMember: 2,
    startTime: "20260701T120000.000Z",
    endTime: "20260702T120000.000Z",
    clan: {
        name: "Us",
        tag: "#U",
        stars: 20,
        destructionPercentage: 88.5,
        members: [
            {
                tag: "#A",
                name: "Ann",
                mapPosition: 1,
                townhallLevel: 15,
                attacks: [
                    {
                        order: 1,
                        attackerTag: "#A",
                        defenderTag: "#x",
                        stars: 3,
                        destructionPercentage: 100,
                    },
                ],
            },
        ],
    },
    opponent: { name: "Foes", tag: "#O", stars: 15, destructionPercentage: 70.1, members: [] },
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

    it("normalises an active war: flattens destructionPercentage and keeps members/attacks", async () => {
        const war = await createWarService(clientReturning(rawInWar), "#U").getCurrentWar();
        expect(war).toEqual({
            state: "inWar",
            teamSize: 15,
            attacksPerMember: 2,
            startTime: "20260701T120000.000Z",
            endTime: "20260702T120000.000Z",
            clan: {
                name: "Us",
                tag: "#U",
                stars: 20,
                destruction: 88.5,
                members: [
                    {
                        tag: "#A",
                        name: "Ann",
                        mapPosition: 1,
                        townhallLevel: 15,
                        attacks: [
                            {
                                order: 1,
                                attackerTag: "#A",
                                defenderTag: "#x",
                                stars: 3,
                                destructionPercentage: 100,
                            },
                        ],
                    },
                ],
            },
            opponent: { name: "Foes", tag: "#O", stars: 15, destruction: 70.1, members: [] },
        });
    });

    it("defaults members to [] when the side has none", async () => {
        const war = await createWarService(
            clientReturning({
                ...rawInWar,
                opponent: { name: "F", tag: "#O", stars: 0, destructionPercentage: 0 },
            }),
            "#U",
        ).getCurrentWar();
        expect(war.state === "inWar" && war.opponent.members).toEqual([]);
    });
});
