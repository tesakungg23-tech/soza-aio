const {
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { joinPersistentVoice } = require('../../utils/voiceKeepAlive');

module.exports = {
    category: 'audio',

    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Join your voice channel and stay connected without playback'),

    async execute(interaction, client) {
        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({
                content: 'You need to be in a voice channel first.',
                ephemeral: true
            });
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions?.has(PermissionFlagsBits.Connect)) {
            return interaction.reply({
                content: 'I need the Connect permission to join that voice channel.',
                ephemeral: true
            });
        }

        const botVoiceChannel = interaction.guild.members.me?.voice?.channel;
        if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
            return interaction.reply({
                content: `I am already connected to **${botVoiceChannel.name}**. I will not interrupt that connection.`,
                ephemeral: true
            });
        }

        try {
            const result = await joinPersistentVoice(client, voiceChannel, {
                requestedBy: interaction.user.id
            });

            await interaction.reply({
                content: result.alreadyConnected
                    ? `I am already connected to **${voiceChannel.name}** and will stay there without playing audio.`
                    : `Joined **${voiceChannel.name}**. I will stay connected and automatically reconnect if Discord drops the voice session.`,
                ephemeral: true
            });
        } catch (error) {
            console.error(`[VOICE 24/7] Failed to join ${voiceChannel.name}:`, error);
            await interaction.reply({
                content: 'I could not join that voice channel. Check my Connect permission and try again.',
                ephemeral: true
            });
        }
    }
};