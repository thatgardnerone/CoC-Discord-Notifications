export const CommandManager = {
    get commands() {
        return [
            {
                name: "ping",
                description: "Ping the bot to see if it's alive.",
            },
            {
                name: "clan_info",
                description: "Summarise this clan's info",
            },
            {
                name: "debug_war",
                description: "(Admin) Post a debug war-start preview to the war-log channel",
                // Only members with Manage Server see/use this (bitfield for ManageGuild = 32).
                default_member_permissions: "32",
            },
        ];
    },

    // Can include helper functions here
};
