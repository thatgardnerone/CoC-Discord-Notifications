import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

export default [
    { ignores: ["node_modules/", "coverage/", ".idea/", "*.log"] },
    js.configs.recommended,
    {
        files: ["**/*.js"],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: "module",
            globals: { ...globals.node },
        },
        rules: {
            "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
            "no-console": "off",
        },
    },
    // Turn off stylistic rules that Prettier owns.
    prettier,
];
