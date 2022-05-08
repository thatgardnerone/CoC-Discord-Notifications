import { Client, Intents } from "discord.js";
import dotenv from "dotenv";

import { CoC } from "./api/CoC.js";

// Import local files

dotenv.config();

const discord = new Client({ intents: [Intents.FLAGS.GUILDS] });

const clanTag = process.env["COC_CLAN_TAG"];

const coc  = new CoC();
const clan = coc.clans(clanTag);

discord.on("ready", async () => {
    console.log(`Logged in as ${discord.user.tag}!`);
});

discord.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;

    switch (interaction.commandName) {
        case "ping":
            await interaction.reply("Pong!");
            break;
        case "clan_info":
            clan.info.then(async (res) => {
                    const data = res.data;
                    const info = "\n**Name:\t**" + `${data["name"]} ` + `(\`${data["tag"]}\`)` +
                                 "\n**Description:\t**" + data["description"] +
                                 "\n**Members:\t**" + `\`${data["members"]}\`` +
                                 "\n**Clan Level:\t**" + `\`${data["clanLevel"]}\`` +
                                 "\n**Location:\t**" + data["location"]["name"] + "\n";
                    await interaction.reply(info);
                },
            );
            break;
    }
});

discord.login(process.env["DISCORD_TOKEN"]);