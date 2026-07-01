import { describe, it, expect } from "vitest";
import { cocTimeToUnix } from "../src/coc/time.js";

describe("cocTimeToUnix", () => {
    it("parses CoC's compact ISO timestamp to unix seconds", () => {
        expect(cocTimeToUnix("20260701T120000.000Z")).toBe(
            Math.floor(Date.UTC(2026, 6, 1, 12, 0, 0) / 1000),
        );
    });

    it("returns null for empty or malformed input", () => {
        expect(cocTimeToUnix("nope")).toBeNull();
        expect(cocTimeToUnix(undefined)).toBeNull();
    });
});
