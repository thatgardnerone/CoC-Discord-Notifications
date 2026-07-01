import dotenv from "dotenv";
import { REST, Routes } from "discord.js";

// Import local files
import { CommandManager } from "./CommandManager.js";

dotenv.config();

const rest = new REST({ version: "10" }).setToken(process.env["DISCORD_TOKEN"]);
const client_id = process.env["DISCORD_CLIENT_ID"];
const guild_id = process.env["DISCORD_GUILD_ID"];

(async () => {
    try {
        console.log(`Refreshing slash commands (Guild: ${guild_id})`);

        await rest.put(Routes.applicationGuildCommands(client_id, guild_id), {
            body: CommandManager.commands, // add commands
        });
    } catch (e) {
        console.error(e);
    }
})();
