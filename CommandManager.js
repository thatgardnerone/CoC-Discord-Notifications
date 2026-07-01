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
                name: "cwl",
                description: "Show the current Clan War League round and score",
            },
            {
                name: "roster",
                description: "Show the clan roster sorted by role and trophies",
            },
            {
                name: "debug_war",
                description: "(Admin) Post a debug war-start preview to the war-log channel",
                // Only members with Manage Server see/use this (bitfield for ManageGuild = 32).
                default_member_permissions: "32",
            },
            {
                name: "setup_verify",
                description: "(Admin) Post the account-link button to the verify channel",
                default_member_permissions: "32",
            },
            {
                name: "link",
                description: "Link your Clash of Clans account to Discord",
                options: [
                    {
                        type: 3,
                        name: "tag",
                        description: "Your player tag, e.g. #ABC123",
                        required: true,
                    },
                    {
                        type: 3,
                        name: "token",
                        description: "In-game API token: Settings → More Settings → API Token",
                        required: true,
                    },
                ],
            },
            {
                name: "whois",
                description: "Show which Clash of Clans accounts a member has linked",
                options: [
                    {
                        type: 6,
                        name: "member",
                        description: "The member (defaults to you)",
                        required: false,
                    },
                ],
            },
            {
                name: "unlink",
                description: "Unlink one of your Clash of Clans accounts",
                options: [
                    {
                        type: 3,
                        name: "tag",
                        description: "The player tag to unlink",
                        required: true,
                    },
                ],
            },
        ];
    },

    // Can include helper functions here
};
