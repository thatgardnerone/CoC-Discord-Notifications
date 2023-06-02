const { Client, Events, GatewayIntentBits } = require('discord.js');
const { loadCommands } = require('../app/commands/commandManager.js');
const { discord_token } = require('../config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// Load all commands
client.commands = loadCommands();

// When the client is ready, run this code (only once)
client.once(Events.ClientReady, c => {
    console.log(`[INFO] Ready! Logged in as ${c.user.tag}`);
});

// Listen for commands
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    console.log(`[INFO] Received command: ${interaction.commandName}`);

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`[ERROR] Command "${interaction.commandName}" not found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
    }
});

// Login to Discord with your client's token
client.login(discord_token);
