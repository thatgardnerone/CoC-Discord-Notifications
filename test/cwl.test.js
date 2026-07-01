import { describe, it, expect, vi } from "vitest";
import { createCwlService } from "../src/coc/cwl.js";
import { HttpError } from "../src/coc/http.js";

const OUR = "#US";

/**
 * @param {any} group
 * @param {Record<string, any>} wars keyed by war tag
 */
function fakeClient(group, wars) {
    return {
        get: vi.fn(async (/** @type {string} */ path) => {
            if (path.endsWith("/leaguegroup")) return { data: group };
            const m = path.match(/wars\/(.+)$/);
            const warTag = decodeURIComponent(m ? m[1] : "");
            return { data: wars[warTag] };
        }),
    };
}

/** @param {string} state @param {string} clanTag @param {string} oppTag */
const rawWar = (state, clanTag, oppTag) => ({
    state,
    teamSize: 15,
    attacksPerMember: 1,
    clan: { name: clanTag, tag: clanTag, stars: 3, destructionPercentage: 90, members: [] },
    opponent: { name: oppTag, tag: oppTag, stars: 1, destructionPercentage: 40, members: [] },
});

describe("cwl service", () => {
    it("returns the league group as null when not in CWL (404)", async () => {
        const client = { get: vi.fn().mockRejectedValue(new HttpError(404)) };
        expect(await createCwlService(client, OUR).getLeagueGroup()).toBeNull();
    });

    it("normalises the group and filters #0 placeholder war tags", async () => {
        const client = fakeClient(
            {
                state: "inWar",
                season: "2026-07",
                clans: [{ tag: OUR }, { tag: "#OPP" }],
                rounds: [{ warTags: ["#W1a", "#W1b"] }, { warTags: ["#0", "#0"] }],
            },
            {},
        );
        const group = await createCwlService(client, OUR).getLeagueGroup();
        expect(group?.state).toBe("inWar");
        expect(group?.rounds).toEqual([["#W1a", "#W1b"], []]);
    });

    it("findCurrentWar returns null when the season has ended", async () => {
        const client = fakeClient({ state: "ended", season: "2026-06", clans: [], rounds: [] }, {});
        expect(await createCwlService(client, OUR).findCurrentWar()).toBeNull();
    });

    it("finds our in-progress round, oriented so our clan is `clan`, with the round number", async () => {
        const group = {
            state: "inWar",
            season: "2026-07",
            clans: [{ tag: OUR }],
            rounds: [{ warTags: ["#W1a", "#W1b"] }, { warTags: ["#W2a", "#W2b"] }],
        };
        const wars = {
            "#W1a": rawWar("warEnded", OUR, "#A"), // round 1, ours, ended
            "#W1b": rawWar("warEnded", "#B", "#C"),
            "#W2a": rawWar("inWar", "#D", OUR), // round 2, ours — we're the opponent side
            "#W2b": rawWar("inWar", "#E", "#F"),
        };
        const result = await createCwlService(fakeClient(group, wars), OUR).findCurrentWar();

        expect(result?.round).toBe(2);
        expect(result?.war.state).toBe("inWar");
        expect(result?.war.clan.tag).toBe(OUR); // oriented
        expect(result?.war.opponent.tag).toBe("#D");
    });

    it("prefers an in-progress war over an ended one from an earlier round", async () => {
        const group = {
            state: "inWar",
            season: "2026-07",
            clans: [{ tag: OUR }],
            rounds: [{ warTags: ["#R1"] }, { warTags: ["#R2"] }],
        };
        const wars = { "#R1": rawWar("warEnded", OUR, "#A"), "#R2": rawWar("inWar", OUR, "#B") };
        const result = await createCwlService(fakeClient(group, wars), OUR).findCurrentWar();
        expect(result?.war.state).toBe("inWar");
        expect(result?.war.opponent.tag).toBe("#B");
    });
});
