import { describe, it, expect, afterEach } from "vitest";
import { createLinkStore } from "../src/links.js";

describe("link store", () => {
    /** @type {ReturnType<typeof createLinkStore> | undefined} */
    let store;
    afterEach(() => store?.close());

    it("links and looks up by player tag", () => {
        store = createLinkStore();
        store.link("discord-1", "#PVVY8L2L", "Jamie");
        expect(store.getByPlayer("#PVVY8L2L")).toEqual({
            playerTag: "#PVVY8L2L",
            discordId: "discord-1",
            playerName: "Jamie",
        });
        expect(store.getByPlayer("#NOPE")).toBeNull();
    });

    it("supports multiple accounts per Discord user", () => {
        store = createLinkStore();
        store.link("discord-1", "#AAA", "Main");
        store.link("discord-1", "#BBB", "Alt");
        expect(store.listByDiscord("discord-1").map((l) => l.playerTag)).toEqual(["#AAA", "#BBB"]);
    });

    it("re-linking a tag updates its owner", () => {
        store = createLinkStore();
        store.link("discord-1", "#AAA", "Main");
        store.link("discord-2", "#AAA", "Main");
        expect(store.getByPlayer("#AAA")?.discordId).toBe("discord-2");
    });

    it("unlinks and reports whether a row was removed", () => {
        store = createLinkStore();
        store.link("discord-1", "#AAA", "Main");
        expect(store.unlink("#AAA")).toBe(true);
        expect(store.unlink("#AAA")).toBe(false);
        expect(store.getByPlayer("#AAA")).toBeNull();
    });
});
