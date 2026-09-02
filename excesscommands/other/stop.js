function temporaryReply(message, content, timeout = 5000) {
    return message.reply(content).then(reply => {
        setTimeout(() => reply.delete().catch(() => {}), timeout);
        return reply;
    });
}

module.exports = {
    async execute(message, args, client) {
        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return temporaryReply(message, '❌ Join a voice channel first, then use `.stop`.');
        }

        const botVoiceChannel = message.guild.members.me?.voice?.channel;
        if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
            return temporaryReply(message, '❌ Join the same voice channel as me to stop the music.');
        }

        if (!client.riffy) {
            return temporaryReply(message, '❌ The music system is not ready yet. Please try again shortly.');
        }

        const player = client.riffy.players.get(message.guild.id);
        if (!player) {
            return temporaryReply(message, '❌ There is no active music player in this server.');
        }

        const queueLength = player.queue?.length || 0;

        try {
            if (client.musicMessageManager) {
                await client.musicMessageManager.cleanupGuildMessages(
                    client,
                    message.guild.id
                );
            }

            player.destroy();
            return temporaryReply(
                message,
                `⏹️ Music stopped and queue cleared (${queueLength} track${queueLength === 1 ? '' : 's'} removed).`
            );
        } catch (error) {
            console.error('Prefix music stop error:', error);
            return temporaryReply(message, '❌ I could not stop the music. Please try again.');
        }
    }
};