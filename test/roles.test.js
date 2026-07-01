import { describe, it, expect } from "vitest";
import { roleForCocRole, resolveRoleChange } from "../src/discord/roles.js";

const roleMap = { leader: "L", coLeader: "C", elder: "E", member: null };

describe("roleForCocRole", () => {
    it("maps CoC roles (admin => Elder), null for unknown/unmapped", () => {
        expect(roleForCocRole("leader", roleMap)).toBe("L");
        expect(roleForCocRole("coLeader", roleMap)).toBe("C");
        expect(roleForCocRole("admin", roleMap)).toBe("E"); // CoC "admin" is Elder
        expect(roleForCocRole("member", roleMap)).toBeNull(); // no Member role configured
        expect(roleForCocRole(null, roleMap)).toBeNull();
    });
});

describe("resolveRoleChange", () => {
    it("adds the desired role when absent", () => {
        expect(resolveRoleChange("coLeader", roleMap, [])).toEqual({ add: ["C"], remove: [] });
    });

    it("removes stale managed roles on promotion/demotion", () => {
        // was Co-leader, now Elder
        expect(resolveRoleChange("admin", roleMap, ["C"])).toEqual({ add: ["E"], remove: ["C"] });
    });

    it("is idempotent when the member already holds the right role", () => {
        expect(resolveRoleChange("leader", roleMap, ["L"])).toEqual({ add: [], remove: [] });
    });

    it("strips all managed roles when the new rank maps to nothing (e.g. member)", () => {
        expect(resolveRoleChange("member", roleMap, ["E"])).toEqual({ add: [], remove: ["E"] });
    });

    it("never touches unmanaged roles", () => {
        const change = resolveRoleChange("coLeader", roleMap, ["some-other-role", "C"]);
        expect(change.add).toEqual([]);
        expect(change.remove).toEqual([]);
    });
});
