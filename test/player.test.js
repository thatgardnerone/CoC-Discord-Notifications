import { describe, it, expect, vi } from "vitest";
import { createPlayerService } from "../src/coc/player.js";

describe("player service", () => {
    it("verifyToken posts the token to the encoded verifytoken endpoint", async () => {
        const client = {
            post: vi.fn().mockResolvedValue({ data: { status: "ok" } }),
            get: vi.fn(),
        };
        const ok = await createPlayerService(client).verifyToken("#PVVY8L2L", "abc123");

        expect(ok).toBe(true);
        expect(client.post).toHaveBeenCalledWith("players/%23PVVY8L2L/verifytoken", {
            token: "abc123",
        });
    });

    it("verifyToken returns false when the API says invalid", async () => {
        const client = {
            post: vi.fn().mockResolvedValue({ data: { status: "invalid" } }),
            get: vi.fn(),
        };
        expect(await createPlayerService(client).verifyToken("#X", "bad")).toBe(false);
    });

    it("getPlayer normalises the profile (role, clan)", async () => {
        const client = {
            get: vi.fn().mockResolvedValue({
                data: {
                    tag: "#P",
                    name: "Jamie",
                    role: "coLeader",
                    townHallLevel: 16,
                    clan: { tag: "#PVVY8L2L", name: "Breakfast Foods" },
                },
            }),
            post: vi.fn(),
        };
        const player = await createPlayerService(client).getPlayer("#P");

        expect(player).toEqual({
            tag: "#P",
            name: "Jamie",
            role: "coLeader",
            townHallLevel: 16,
            clanTag: "#PVVY8L2L",
            clanName: "Breakfast Foods",
        });
        expect(client.get).toHaveBeenCalledWith("players/%23P");
    });

    it("getPlayer tolerates a clanless player", async () => {
        const client = {
            get: vi.fn().mockResolvedValue({ data: { tag: "#P", name: "Solo", townHallLevel: 9 } }),
            post: vi.fn(),
        };
        const player = await createPlayerService(client).getPlayer("#P");
        expect(player.clanTag).toBeNull();
        expect(player.role).toBeNull();
    });
});
