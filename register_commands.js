const { REST }   = require("@discordjs/rest");
const { Routes } = require("discord-api-types/v10");

require("dotenv").config();

const commands = [
    {
        name:        "ping",
        description: "Ping the bot",
    },
    {
        name:        "help",
        description: "Show the list of commands",
    },
];

// noinspection JSClosureCompilerSyntax,JSCheckFunctionSignatures
const rest      = new REST({ version: "10" }).setToken(process.env["DISCORD_TOKEN"]);
const client_id = process.env["DISCORD_CLIENT_ID"];
const guild_id  = process.env["DISCORD_GUILD_ID"];

(async () => {
    try {
        console.log("Started refreshing application (/) commands");

        await rest.put(
            Routes.applicationGuildCommands(client_id, guild_id),
            {
                body: commands,
            },
        );
    } catch (e) {
        console.error(e);
    }
})();