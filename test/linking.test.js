import { describe, it, expect, vi } from "vitest";
import { createLinker } from "../src/features/linking.js";

/** @param {{ verified: boolean }} args */
function harness({ verified }) {
    const playerService = {
        verifyToken: vi.fn().mockResolvedValue(verified),
        getPlayer: vi.fn().mockResolvedValue({
            tag: "#PVVY8L2L",
            name: "Jamie",
            role: "coLeader",
            townHallLevel: 16,
            clanTag: "#PVVY8L2L",
            clanName: "Breakfast Foods",
        }),
    };
    const linkStore = { link: vi.fn() };
    return { playerService, linkStore, linker: createLinker({ playerService, linkStore }) };
}

describe("linker", () => {
    it("verifies, stores the link, and returns the player on success", async () => {
        const { playerService, linkStore, linker } = harness({ verified: true });

        const result = await linker.link("discord-1", "pvvy8l2l", "token-abc");

        // tag normalised before verifying
        expect(playerService.verifyToken).toHaveBeenCalledWith("#PVVY8L2L", "token-abc");
        expect(result).toEqual({ ok: true, player: expect.objectContaining({ name: "Jamie" }) });
        expect(linkStore.link).toHaveBeenCalledWith("discord-1", "#PVVY8L2L", "Jamie");
    });

    it("rejects an invalid token and stores nothing", async () => {
        const { playerService, linkStore, linker } = harness({ verified: false });

        const result = await linker.link("discord-1", "#PVVY8L2L", "bad-token");

        expect(result).toEqual({ ok: false, reason: "invalid-token" });
        expect(playerService.getPlayer).not.toHaveBeenCalled();
        expect(linkStore.link).not.toHaveBeenCalled();
    });
});
