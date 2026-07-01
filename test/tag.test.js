import { describe, it, expect } from "vitest";
import { normaliseTag } from "../src/coc/tag.js";

describe("normaliseTag", () => {
    it("uppercases and adds a single leading #", () => {
        expect(normaliseTag("pvvy8l2l")).toBe("#PVVY8L2L");
        expect(normaliseTag("#pvvy8l2l")).toBe("#PVVY8L2L");
    });
    it("trims whitespace and collapses repeated #", () => {
        expect(normaliseTag("  #abc ")).toBe("#ABC");
        expect(normaliseTag("##abc")).toBe("#ABC");
    });
});
