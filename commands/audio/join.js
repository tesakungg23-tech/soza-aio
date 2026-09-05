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
        // Discord requires an acknowledgement within a few seconds. Joining
        // voice and persisting the session can take longer than that, so
        // acknowledge first and edit the ephemeral reply when finished.
        await interaction.deferReply({ ephemeral: true });

        const voiceChannel = interaction.member?.voice?.channel;

        if (!voiceChannel) {
            return interaction.editReply({
                content: 'You need to be in a voice channel first.',
            });
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (!permissions?.has(PermissionFlagsBits.Connect)) {
            return interaction.editReply({
                content: 'I need the Connect permission to join that voice channel.',
            });
        }

        const botVoiceChannel = interaction.guild.members.me?.voice?.channel;
        if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
            return interaction.editReply({
                content: `I am already connected to **${botVoiceChannel.name}**. I will not interrupt that connection.`,
            });
        }

        try {
            const result = await joinPersistentVoice(client, voiceChannel, {
                requestedBy: interaction.user.id
            });

            await interaction.editReply({
                content: result.alreadyConnected
                    ? `I am already connected to **${voiceChannel.name}** and will stay there without playing audio.`
                    : `Joined **${voiceChannel.name}**. I will stay connected without playing audio and automatically reconnect if Discord drops the voice session.`,
            });
        } catch (error) {
            console.error(`[VOICE 24/7] Failed to join ${voiceChannel.name}:`, error);
            await interaction.editReply({
                content: 'I could not join that voice channel. Check my Connect permission and try again.',
            });
        }
    }
};