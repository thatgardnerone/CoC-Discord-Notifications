import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        // Feature/behaviour tests live in test/, exercising modules through their
        // public surface with the CoC API and Discord mocked at the boundary.
        include: ["test/**/*.test.js"],
        environment: "node",
        clearMocks: true,
        restoreMocks: true,
    },
});
