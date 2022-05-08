export const CommandManager = {
    get commands() {
        return [
            {
                name:        "ping",
                description: "Ping the bot to see if it's alive.",
            },
            {
                name:        "clan_info",
                description: "Summarise this clan's info",
            },
        ];
    },

    // Can include helper functions here
};