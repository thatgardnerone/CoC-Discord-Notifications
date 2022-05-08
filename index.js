import { Client, Intents } from "discord.js";
import axios from "axios";
import dotenv from "dotenv";

// Import local files

dotenv.config();

const client = new Client({ intents: [Intents.FLAGS.GUILDS] });

async function getClanInfo() {
    const response = await instance.get("clans/" + coc_clan_tag);
    return response.data;
}

client.on("ready", async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const info = await getClanInfo();
    console.log(`Clan info:\n${JSON.stringify(info.name)}`);
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
        case "ping":
            await interaction.reply("Pong!");
            break;
        case "clan_info":
            const info = await getClanInfo();
            await interaction.reply(JSON.stringify(info.name))
            break;
    }
});

client.login(process.env.DISCORD_TOKEN);