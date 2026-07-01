import { describe, it, expect } from "vitest";
import { createLogger } from "../src/logger.js";

describe("logger", () => {
    it("emits structured JSON lines with level, timestamp, message and fields", () => {
        /** @type {string[]} */
        const lines = [];
        const log = createLogger({
            write: (l) => lines.push(l),
            now: () => "2026-07-01T00:00:00Z",
        });

        log.info("bot started", { guild: "123" });

        expect(JSON.parse(lines[0])).toEqual({
            t: "2026-07-01T00:00:00Z",
            level: "info",
            msg: "bot started",
            guild: "123",
        });
    });

    it("filters messages below the configured level", () => {
        /** @type {string[]} */
        const lines = [];
        const log = createLogger({ write: (l) => lines.push(l), level: "warn" });

        log.debug("nope");
        log.info("also nope");
        log.warn("shown");
        log.error("also shown");

        expect(lines.map((l) => JSON.parse(l).msg)).toEqual(["shown", "also shown"]);
    });

    it("terminates each line with a newline", () => {
        /** @type {string[]} */
        const lines = [];
        const log = createLogger({ write: (l) => lines.push(l) });
        log.error("boom");
        expect(lines[0].endsWith("\n")).toBe(true);
    });
});
