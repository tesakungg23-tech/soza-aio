const { PermissionFlagsBits } = require('discord.js');

function temporaryReply(message, content, timeout = 6000) {
    return message.reply(content).then(reply => {
        setTimeout(() => reply.delete().catch(() => {}), timeout);
        return reply;
    });
}

module.exports = {
    async execute(message, args, client) {
        const query = args.join(' ').trim();
        if (!query) {
            return temporaryReply(message, '❌ Please provide a song name or URL.\nExample: `.play royalty`');
        }

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            return temporaryReply(message, '❌ Join a voice channel first, then use `.play <song>`.');
        }

        const botVoiceChannel = message.guild.members.me?.voice?.channel;
        if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
            return temporaryReply(message, '❌ I am already playing music in another voice channel.');
        }

        const permissions = voiceChannel.permissionsFor(client.user);
        if (
            !permissions?.has(PermissionFlagsBits.Connect) ||
            !permissions.has(PermissionFlagsBits.Speak)
        ) {
            return temporaryReply(message, '❌ I need **Connect** and **Speak** permission in that voice channel.');
        }

        if (!client.riffy) {
            return temporaryReply(message, '❌ The music system is not ready yet. Please try again shortly.');
        }

        try {
            let player = client.riffy.players.get(message.guild.id);

            if (!player) {
                player = await client.riffy.createConnection({
                    guildId: message.guild.id,
                    voiceChannel: voiceChannel.id,
                    textChannel: message.channel.id,
                    deaf: true
                });
            }

            const result = await client.riffy.resolve({
                query,
                requester: message.author
            });

            if (!result?.tracks?.length) {
                return temporaryReply(message, `❌ No tracks found for **${query}**.`);
            }

            const track = result.tracks[0];
            track.requester = {
                id: message.author.id,
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL()
            };

            player.queue.add(track);
            const position = player.queue.length;
            const reply = await message.reply(
                `🎵 Added **${track.info.title}** to the queue.\n📍 Position: **#${position}**`
            );
            setTimeout(() => reply.delete().catch(() => {}), 6000);

            if (!player.playing && !player.paused) {
                await player.play();
            }
        } catch (error) {
            console.error('Prefix music play error:', error);
            return temporaryReply(
                message,
                '❌ I could not play that track. Try another title or URL.'
            );
        }
    }
};