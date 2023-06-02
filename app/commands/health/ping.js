const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Simple ping-pong health check'),
    async execute(interaction) {
        await interaction.reply('pong!');
    }
};
