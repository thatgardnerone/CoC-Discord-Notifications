import { describe, it, expect, afterEach } from "vitest";
import { tmpdir } from "node:os";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { createStore } from "../src/store.js";

describe("store", () => {
    /** @type {ReturnType<typeof createStore> | undefined} */
    let store;
    afterEach(() => store?.close());

    it("returns null for an unknown key", () => {
        store = createStore();
        expect(store.getSnapshot("war")).toBeNull();
    });

    it("round-trips a snapshot", () => {
        store = createStore();
        store.setSnapshot("war", { state: "inWar", attacks: 3 });
        expect(store.getSnapshot("war")).toEqual({ state: "inWar", attacks: 3 });
    });

    it("overwrites an existing snapshot", () => {
        store = createStore();
        store.setSnapshot("war", { state: "preparation" });
        store.setSnapshot("war", { state: "inWar" });
        expect(store.getSnapshot("war")).toEqual({ state: "inWar" });
    });

    it("isolates snapshots by key", () => {
        store = createStore();
        store.setSnapshot("war", { a: 1 });
        store.setSnapshot("members", [{ tag: "#X" }]);
        expect(store.getSnapshot("members")).toEqual([{ tag: "#X" }]);
    });

    it("persists across restarts (survives a reopen of the same file)", () => {
        const path = join(tmpdir(), `coc-store-test-${process.pid}-${Date.now()}.db`);
        try {
            const first = createStore(path);
            first.setSnapshot("k", { v: 1 });
            first.close();

            const second = createStore(path);
            expect(second.getSnapshot("k")).toEqual({ v: 1 });
            second.close();
        } finally {
            for (const suffix of ["", "-wal", "-shm"]) rmSync(path + suffix, { force: true });
        }
    });
});
