import { Client, Intents } from "discord.js";
import dotenv from "dotenv";

// Import local files
import { CommandManager } from "./CommandManager.js";

dotenv.config();

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

function getClanInfo() {

}

client.on("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
        case "ping":
            await interaction.reply("Pong!");
            break;
    }
});

client.login(process.env.DISCORD_TOKEN);