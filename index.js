import fs from 'fs';
import { Client, Collection, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Read secrets
dotenv.config();
const cocToken = process.env.COC_API_TOKEN;
const discordToken = process.env.DISCORD_TOKEN;

console.log(`discordToken: ${discordToken}`);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});
client.commands = new Collection();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load commands
const commandFiles = fs.readdirSync(join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = await import(join(__dirname, 'commands', file));
    client.commands.set(command.default.name, command.default);
}

// Ready
client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Respond
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) return;

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Log in
client.login(discordToken);
