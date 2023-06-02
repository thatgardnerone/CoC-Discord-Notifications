const fs = require('fs');
const path = require('node:path');
const { Collection } = require('discord.js');

const loadCommands = () => {
    const commands = new Collection();

    const commandsPath = path.join(__dirname, '/');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
            commands.set(command.data.name, command);
        } else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
    }
    return commands;
}

module.exports = {
    loadCommands
}
