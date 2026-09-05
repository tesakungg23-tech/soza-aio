const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const lavalinkConfig = require('../lavalink');
const { dynamicCard } = require("../UI/dynamicCard");
const path = require("path");
const axios = require('axios');
const musicIcons = require('../UI/icons/musicicons');
const { Riffy } = require('riffy');
const { autoplayCollection } = require('../mongodb');


const lyricsStateManager = {
    activeGuilds: new Map(), 
    stoppedGuilds: new Set(), 
    collectors: new Map(),   
    
    startLyrics(guildId, data) {
        this.activeGuilds.set(guildId, { ...data, timestamp: Date.now() });
        this.stoppedGuilds.delete(guildId); 
        console.log(`✅ Lyrics STATE: STARTED for guild ${guildId}`);
    },
    
    stopLyrics(guildId, permanent = false) {
        this.activeGuilds.delete(guildId);
        if (permanent) {
            this.stoppedGuilds.add(guildId);
        }
        
        if (this.collectors.has(guildId)) {
            this.collectors.get(guildId).stop('manual_stop');
            this.collectors.delete(guildId);
        }
        
    },
    
    isActive(guildId) {
        return this.activeGuilds.has(guildId);
    },
    
    isManuallyStopped(guildId) {
        return this.stoppedGuilds.has(guildId);
    },
    
    clearGuild(guildId) {
        this.activeGuilds.delete(guildId);
        this.stoppedGuilds.delete(guildId);
        if (this.collectors.has(guildId)) {
            this.collectors.get(guildId).stop('cleanup');
            this.collectors.delete(guildId);
        }
       // console.log(`🧹 Lyrics STATE: CLEARED for guild ${guildId}`);
    },
    
    setCollector(guildId, collector) {
        this.collectors.set(guildId, collector);
    }
};

const advancedMessageManager = {
    trackMessages: new Map(),
    lyricsMessages: new Map(),
    queueMessages: new Map(),
    lastEmbeds: new Map(),
    controlPanels: new Map(),
    cleanupTimeouts: new Map(),

    getAutoDeleteTime: function (type, context = {}) {
        const times = {
            'track': 0,              // Keep now-playing visible until an explicit stop
            'lyrics': 0,            // Manual control only
            'queue': 45000,         // 45 seconds (quick reference)
            'control': 300000,      // 5 minutes (interactive controls)
            'success': 3000,        // 3 seconds (quick confirmations)
            'error': 3000,          // 3 seconds (errors need more time)
            'warning': 3000,        // 3 seconds (warnings)
            'info': 3000,           // 3 seconds (information)
            'session_end': 3000,    // 3 seconds for session end
            'autoplay': 3000,       // 3 seconds for autoplay
            'autoplay_success': 3000, // 3 seconds for autoplay success
            'autoplay_fail': 3000,  // 3 seconds for autoplay fail
            'volume': 3000,         // 3 seconds (volume changes)
            'pause_resume': 5000,   // 5 seconds (playback controls)
            'skip': 3000,           // 3 seconds (skip confirmations)
            'stop': 3000,           // 3 seconds for stop messages
            'loop': 3000,           // 3 seconds (loop mode changes)
            'shuffle': 3000,        // 3 seconds (shuffle confirmations)
            'queue_cleared': 3000   // 3 seconds (queue modifications)
        };

        if (context.isImportant) return times[type] * 1.5;
        if (context.isQuick) return Math.max(times[type] * 0.5, 3000);
        if (context.queueSize && context.queueSize > 10) return times[type] * 1.2;

        return times[type] || 3000;
    },

    addMessage: function (guildId, messageId, channelId, type, context = {}) {
        const autoDeleteTime = this.getAutoDeleteTime(type, context);
        const messageData = {
            messageId,
            channelId,
            type,
            timestamp: Date.now(),
            autoDelete: autoDeleteTime,
            context
        };

        const collections = {
            'track': this.trackMessages,
            'lyrics': this.lyricsMessages,
            'queue': this.queueMessages,
            'lastEmbed': this.lastEmbeds,
            'control': this.controlPanels
        };

        if (collections[type]) {
            collections[type].set(guildId, messageData);

            if (autoDeleteTime > 0) {
                const timeoutId = setTimeout(async () => {
                    await this.deleteMessage(null, messageData);
                    collections[type].delete(guildId);
                    this.cleanupTimeouts.delete(guildId + '_' + type);
                }, autoDeleteTime);

                this.cleanupTimeouts.set(guildId + '_' + type, timeoutId);
            }
        }
    },

    addQuickDeleteMessage: function (client, message, type = 'info') {
        if (!message || !message.id) return;
        setTimeout(() => {
            message.delete().catch(() => { });
        }, 3000);
        return message;
    },

    async cleanupGuildMessages(client, guildId, types = ['track', 'lyrics', 'queue', 'lastEmbed', 'control']) {
        const promises = [];
        const collections = {
            'track': this.trackMessages,
            'lyrics': this.lyricsMessages,
            'queue': this.queueMessages,
            'lastEmbed': this.lastEmbeds,
            'control': this.controlPanels
        };

        for (const type of types) {
            if (collections[type] && collections[type].has(guildId)) {
                const msgData = collections[type].get(guildId);
                promises.push(this.deleteMessage(client, msgData));
                collections[type].delete(guildId);

                const timeoutKey = guildId + '_' + type;
                if (this.cleanupTimeouts.has(timeoutKey)) {
                    clearTimeout(this.cleanupTimeouts.get(timeoutKey));
                    this.cleanupTimeouts.delete(timeoutKey);
                }
            }
        }

        await Promise.allSettled(promises);
    },

    async deleteMessage(client, messageData) {
        if (!messageData) return;

        const { messageId, channelId } = messageData;

        try {
            const channel = client ? client.channels.cache.get(channelId) : null;
            if (!channel) return;

            const message = await channel.messages.fetch(messageId).catch(() => null);
            if (!message) return;

            await message.delete().catch(() => {
                if (message.components && message.components.length > 0) {
                    const disabledComponents = message.components.map(row =>
                        new ActionRowBuilder().addComponents(
                            row.components.map(component =>
                                ButtonBuilder.from(component).setDisabled(true)
                            )
                        )
                    );
                    message.edit({ components: disabledComponents }).catch(() => { });
                }
            });
        } catch (err) {
            console.warn(`V2 Message cleanup warning: ${err.message}`);
        }
    },

    createV2Container(type, data = {}) {
        const colors = {
            success: 0x00ff7f,
            error: 0xff4757,
            info: 0x3498db,
            warning: 0xffa500,
            music: 0xdc92ff,
            lyrics: 0xff69b4,
            queue: 0x9b59b6,
            session_end: 0x95a5a6,
            volume: 0x2196f3,
            autoplay: 0x17a2b8
        };

        return new ContainerBuilder()
            .setAccentColor(colors[type] || colors.info);
    }
};

const sessionManager = {
    activeSessions: new Map(),

    createSession(guildId, userId, data) {
        this.activeSessions.set(guildId, {
            userId,
            startTime: Date.now(),
            lastActivity: Date.now(),
            ...data
        });
    },

    updateActivity(guildId) {
        if (this.activeSessions.has(guildId)) {
            this.activeSessions.get(guildId).lastActivity = Date.now();
        }
    },

    isAuthorized(guildId, userId) {
        const session = this.activeSessions.get(guildId);
        return !session || session.userId === userId;
    },

    endSession(guildId) {
        this.activeSessions.delete(guildId);
    }
};

const lyricIntervals = new Map();
const queueDisplayTimeouts = new Map();

module.exports = (client) => {
    // Expose the shared message manager to prefix music commands so they
    // can clean up now-playing panels before destroying the Riffy player.
    client.musicMessageManager = advancedMessageManager;

    if (lavalinkConfig.enabled) {
        const nodes = lavalinkConfig.lavalink.nodes || [
            {
                name: lavalinkConfig.lavalink.name,
                host: lavalinkConfig.lavalink.host,
                password: lavalinkConfig.lavalink.password,
                port: lavalinkConfig.lavalink.port,
                secure: lavalinkConfig.lavalink.secure
            }
        ];

        client.riffy = new Riffy(client, nodes, {
            send: (payload) => {
                const guild = client.guilds.cache.get(payload.d.guild_id);
                if (guild) guild.shard.send(payload);
            },
            defaultSearchPlatform: lavalinkConfig.lavalink.defaultSearchPlatform || "ytmsearch",
            restVersion: lavalinkConfig.lavalink.restVersion || "v4",
        });
        
        client.riffy.on('nodeConnect', (node) => {
            console.log(`\x1b[34m[ V2 LAVALINK ]\x1b[0m Node connected: \x1b[32m${node.name}\x1b[0m`);
        });

        client.riffy.on('nodeError', (node, error) => {
            console.error(`\x1b[31m[ V2 LAVALINK ]\x1b[0m Node \x1b[32m${node.name}\x1b[0m error: \x1b[33m${error.message}\x1b[0m`);
        });

        client.on('voiceStateUpdate', async (oldState, newState) => {
            try {
                if (oldState.member.id === client.user.id && oldState.channelId && !newState.channelId) {
                    const player = client.riffy.players.get(oldState.guild.id);
                    if (player) {
                        await handlePlayerCleanup(client, oldState.guild.id, player, 'Bot disconnected');
                    }
                }

                if (
                    oldState.channelId &&
                    oldState.channelId === newState.guild.me?.voice?.channelId &&
                    newState.guild.channels.cache.get(oldState.channelId)?.members.size === 1 &&
                    newState.guild.channels.cache.get(oldState.channelId)?.members.has(client.user.id)
                ) {
                    const player = client.riffy.players.get(oldState.guild.id);
                    if (player) {
                        await handlePlayerCleanup(client, oldState.guild.id, player, 'Channel empty - Auto disconnect');

                        const channel = client.channels.cache.get(player.textChannel);
                        if (channel) {
                            const disconnectContainer = advancedMessageManager.createV2Container('session_end')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**👋 AUTO DISCONNECT**\nLeft voice channel since everyone left.\n\n**Session ended automatically to save resources.**')
                                );

                            const msg = await channel.send({
                                components: [disconnectContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addQuickDeleteMessage(client, msg, 'session_end');
                        }
                    }
                }
            } catch (error) {
                console.error('V2 Voice state update error:', error);
            }
        });

        client.riffy.on('trackStart', async (player, track) => {
            try {
                const channel = client.channels.cache.get(player.textChannel);
                const guildId = player.guildId;

                if (!channel) return;

                await advancedMessageManager.cleanupGuildMessages(client, guildId);
                sessionManager.updateActivity(guildId);

                function formatTime(ms) {
                    if (!ms || ms === 0) return "0:00";
                    const totalSeconds = Math.floor(ms / 1000);
                    const hours = Math.floor(totalSeconds / 3600);
                    const minutes = Math.floor((totalSeconds % 3600) / 60);
                    const seconds = totalSeconds % 60;
                    return `${hours > 0 ? hours + ":" : ""}${minutes.toString().padStart(hours > 0 ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`;
                }

                let cardBuffer = null;
                let attachment = null;

                try {
    

                    cardBuffer = await dynamicCard({
                        thumbnailURL: track.info.thumbnail || track.info.artworkUrl || 'https://via.placeholder.com/300x300/DC92FF/FFFFFF?text=Music',
                        songTitle: track.info.title || 'Unknown Title',
                        songArtist: track.info.author || 'Unknown Artist',
                        trackRequester: track.requester ? track.requester.username : "All In One",
                        fontPath: path.join(__dirname, "../UI", "fonts", "AfacadFlux-Regular.ttf"),
                        backgroundColor: "#DC92FF",
                    });

                    if (cardBuffer) {
                        attachment = new AttachmentBuilder(cardBuffer, { name: 'song-banner.png' });
                    }

                } catch (cardError) {
                    //console.error('Dynamic card error:', cardError);
                }

                let containerBuilder = advancedMessageManager.createV2Container('music')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**🎵 NOW PLAYING**')
                    )
                    .addSeparatorComponents(separator => separator)
                    .addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent([
                                    `**🎵 ${track.info.title}**`,
                                    `**🎤 Artist:** ${track.info.author}`,
                                    `**⏱️ Duration:** ${formatTime(track.info.length)}`,
                                    `**🎶 Source:** ${track.info.sourceName || 'YouTube'}`,
                                    `**🔥 Quality:** ${track.info.stream ? '🔴 Live Stream' : '📹 High Definition'}`
                                ].join('\n'))
                            )
                            .setThumbnailAccessory(
                                thumbnail => thumbnail
                                    .setURL(track.requester?.avatarURL ?? client.user.displayAvatarURL({ dynamic: true, size: 128 }))
                                    .setDescription(`Requested by ${track.requester ? track.requester.username : 'Unknown'}`)
                            )
                    );

                containerBuilder
                    .addSeparatorComponents(separator => separator)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent([
                            `**👤 Requested by:** ${track.requester ? `<@${track.requester.id}>` : 'All In One'}`,
                            `**🎧 Queue Position:** Playing Now`,
                            `**📊 Volume:** ${player.volume}%`,
                            `**🔁 Loop:** ${player.loop || 'None'}`,
                            `**▶️ Status:** ${player.playing ? '🟢 Active' : player.paused ? '🟡 Paused' : '🔴 Stopped'}`
                        ].join('\n'))
                    )
                    .addSeparatorComponents(separator => separator)
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent([
                            '**📈 TRACK STATISTICS**',
                            `**📊 Bitrate:** High Quality Audio`,
                            `**🎯 Seekable:** ${track.info.seekable ? '✅ Yes' : '❌ No'}`,
                            `**🎪 Platform:** ${track.info.sourceName || 'YouTube Music'}`,
                            track.info.uri ? `**🔗 [Open Original](${track.info.uri})**` : ''
                        ].filter(Boolean).join('\n'))
                    );

                if (attachment) {
                    containerBuilder
                        .addSeparatorComponents(separator => separator)
                        .addMediaGalleryComponents(
                            mediaGallery => mediaGallery
                                .addItems(
                                    mediaItem => mediaItem
                                        .setURL('attachment://song-banner.png')
                                        .setDescription(`${track.info.title} - ${track.info.author}`)
                                )
                        );
                }

                const controlRow1 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`v2_volume_down_${track.requester?.id || 'system'}`)
                        .setEmoji('🔉')
                        .setLabel('Vol -')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`v2_pause_${track.requester?.id || 'system'}`)
                        .setEmoji('⏸️')
                        .setLabel('Pause')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(`v2_resume_${track.requester?.id || 'system'}`)
                        .setEmoji('▶️')
                        .setLabel('Resume')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`v2_skip_${track.requester?.id || 'system'}`)
                        .setEmoji('⏭️')
                        .setLabel('Skip')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`v2_volume_up_${track.requester?.id || 'system'}`)
                        .setEmoji('🔊')
                        .setLabel('Vol +')
                        .setStyle(ButtonStyle.Secondary)
                );

                const controlRow2 = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`v2_queue_${track.requester?.id || 'system'}`)
                        .setEmoji('📜')
                        .setLabel('Queue')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`v2_lyrics_${track.requester?.id || 'system'}`)
                        .setEmoji('🎤')
                        .setLabel('Lyrics')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`v2_loop_${track.requester?.id || 'system'}`)
                        .setEmoji('🔁')
                        .setLabel('Loop')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`v2_shuffle_${track.requester?.id || 'system'}`)
                        .setEmoji('🔀')
                        .setLabel('Shuffle')
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`v2_stop_${track.requester?.id || 'system'}`)
                        .setEmoji('⏹️')
                        .setLabel('Stop')
                        .setStyle(ButtonStyle.Danger)
                );

                const messageOptions = {
                    components: [containerBuilder],
                    flags: MessageFlags.IsComponentsV2
                };

                if (attachment) {
                    messageOptions.files = [attachment];
                }

                messageOptions.components.push(controlRow1, controlRow2);

                const message = await channel.send(messageOptions);

                advancedMessageManager.addMessage(guildId, message.id, channel.id, 'track', {
                    isImportant: true,
                    queueSize: player.queue.length
                });

                player.currentMessageId = message.id;

                if (track.requester && track.requester.id) {
                    sessionManager.createSession(guildId, track.requester.id, {
                        trackTitle: track.info.title,
                        startedAt: Date.now()
                    });
                }

            } catch (error) {
                console.error('V2 Track start error:', error);

                try {
                    const channel = client.channels.cache.get(player.textChannel);
                    if (channel) {
                        const errorContainer = advancedMessageManager.createV2Container('error')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ PLAYBACK ERROR**\nFailed to display track information.\n\n*Audio playback continues normally.*')
                            );

                        const errorMsg = await channel.send({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        advancedMessageManager.addMessage(player.guildId, errorMsg.id, channel.id, 'error');
                    }
                } catch (fallbackError) {
                    console.error('V2 Fallback error message failed:', fallbackError);
                }
            }
        });


        client.riffy.on('trackEnd', async (player) => {
            try {
                const guildId = player.guildId;

             
                lyricsStateManager.clearGuild(guildId);

                if (lyricIntervals.has(guildId)) {
                    clearInterval(lyricIntervals.get(guildId));
                    lyricIntervals.delete(guildId);
                }

                await advancedMessageManager.cleanupGuildMessages(client, guildId, ['lyrics']);

                const channel = client.channels.cache.get(player.textChannel);
                if (channel) {
                    const lyricsEndContainer = advancedMessageManager.createV2Container('info')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎤 LYRICS AUTO-CLOSED**\nLyrics session ended with track.')
                        );

                    const lyricsEndMsg = await channel.send({
                        components: [lyricsEndContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    advancedMessageManager.addQuickDeleteMessage(client, lyricsEndMsg, 'info');
                }

                sessionManager.updateActivity(guildId);
            } catch (error) {
                console.error('V2 Track end error:', error);
            }
        });

        client.riffy.on("queueEnd", async (player) => {
            try {
                const channel = client.channels.cache.get(player.textChannel);
                const guildId = player.guildId;

                if (!channel) return;

                await handlePlayerCleanup(client, guildId, player, 'Queue ended');

                const result = await autoplayCollection.findOne({ guildId }).catch(() => null);
                const autoplay = result ? result.autoplay : false;

                if (autoplay) {
                    const autoplayContainer = advancedMessageManager.createV2Container('autoplay')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🔄 AUTOPLAY ACTIVE**\nSearching for similar tracks...\n\n*Continuous music experience enabled.*')
                        );

                    const autoplayMsg = await channel.send({
                        components: [autoplayContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    advancedMessageManager.addQuickDeleteMessage(client, autoplayMsg, 'autoplay');

                    try {
                        await player.autoplay(player);

                        const successContainer = advancedMessageManager.createV2Container('success')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**✅ AUTOPLAY SUCCESS**\nSimilar tracks have been queued.\n\n*Enjoy seamless playback!*')
                            );

                        const successMsg = await channel.send({
                            components: [successContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        advancedMessageManager.addQuickDeleteMessage(client, successMsg, 'autoplay_success');

                    } catch (autoplayError) {
                        console.error('V2 Autoplay failed:', autoplayError);
                        player.destroy();

                        const failContainer = advancedMessageManager.createV2Container('warning')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**⚠️ AUTOPLAY FAILED**\nCouldn\'t find similar tracks.\n\n*Session ended. Use `/music play` to restart.*')
                            );

                        const failMsg = await channel.send({
                            components: [failContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        advancedMessageManager.addQuickDeleteMessage(client, failMsg, 'autoplay_fail');
                    }

                } else {
                    player.destroy();

                    const queueEndContainer = advancedMessageManager.createV2Container('session_end')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎵 MUSIC SESSION COMPLETED**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**All tracks have been played successfully!**\n\n**📊 Session Summary:**\n• ✅ Playback completed without errors\n• 🔌 Player disconnected from voice channel\n• 🧹 All resources cleaned up automatically\n• 🎤 Lyrics sessions terminated\n• 📝 Message cache cleared\n\n*Ready for your next music session!*')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎯 Quick Actions:**\n• Use `/music play <song>` to start a new session\n• Use `/music autoplay true` for continuous music\n• Join a voice channel to begin')
                        );

                    const queueEndMsg = await channel.send({
                        components: [queueEndContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    advancedMessageManager.addQuickDeleteMessage(client, queueEndMsg, 'session_end');
                }

                sessionManager.endSession(guildId);

            } catch (error) {
                console.error('V2 Queue end error:', error);
            }
        });

        client.on('interactionCreate', async (interaction) => {
            if (!interaction.isButton()) return;

            try {
                const match = interaction.customId.match(/^v2_(volume_up|volume_down|pause|resume|skip|stop|queue|lyrics|loop|shuffle|clear)_(\w+)$/);
                if (!match) return;

                const [, action, userId] = match;

                const player = client.riffy.players.get(interaction.guildId);
                if (!player) {
                    const noPlayerContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**⚠️ NO ACTIVE PLAYER**\nMusic player not found or session has ended.\n\n*The session may have expired or been terminated.*')
                        );

                    return interaction.reply({
                        components: [noPlayerContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }

                const botVoiceChannel = interaction.guild.members.me?.voice?.channel;
                const userVoiceChannel = interaction.member?.voice?.channel;

                const isInSameChannel = botVoiceChannel && userVoiceChannel && botVoiceChannel.id === userVoiceChannel.id;
                const isOriginalRequester = sessionManager.isAuthorized(interaction.guildId, interaction.user.id) || interaction.user.id === userId;

                if (!isInSameChannel && !isOriginalRequester && userId !== 'system') {
                    const authContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🚫 VOICE CHANNEL REQUIRED**\n\n**To control the music player, you must:**\n• Join the same voice channel as the bot\n• OR be the original session owner\n\n**Current Bot Channel:** ' + (botVoiceChannel ? botVoiceChannel.name : 'None') + '\n**Your Channel:** ' + (userVoiceChannel ? userVoiceChannel.name : 'None'))
                        );

                    return interaction.reply({
                        components: [authContainer],
                        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                    });
                }

                await interaction.deferReply({ ephemeral: true });
                sessionManager.updateActivity(interaction.guildId);

                switch (action) {
                    case 'volume_up':
                        const newVolumeUp = Math.min(player.volume + 10, 100);
                        player.setVolume(newVolumeUp);

                        const volumeUpContainer = advancedMessageManager.createV2Container('volume')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🔊 VOLUME INCREASED**\n\nVolume: **${newVolumeUp}%**\n${getVolumeBar(newVolumeUp)}\n\n*Perfect for jamming out!*`)
                            );

                        const volUpReply = await interaction.editReply({
                            components: [volumeUpContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => volUpReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('volume'));
                        break;

                    case 'volume_down':
                        const newVolumeDown = Math.max(player.volume - 10, 0);
                        player.setVolume(newVolumeDown);

                        const volumeDownContainer = advancedMessageManager.createV2Container('volume')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🔉 VOLUME DECREASED**\n\nVolume: **${newVolumeDown}%**\n${getVolumeBar(newVolumeDown)}\n\n*${newVolumeDown === 0 ? 'Music is now muted.' : 'Quieter vibes activated.'}*`)
                            );

                        const volDownReply = await interaction.editReply({
                            components: [volumeDownContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => volDownReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('volume'));
                        break;

                    case 'pause':
                        player.pause(true);

                        const pauseContainer = advancedMessageManager.createV2Container('warning')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**⏸️ PLAYBACK PAUSED**\n\nMusic has been paused successfully.\n\n*Use the Resume button when ready to continue.*')
                            );

                        const pauseReply = await interaction.editReply({
                            components: [pauseContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => pauseReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('pause_resume'));
                        break;

                    case 'resume':
                        player.pause(false);

                        const resumeContainer = advancedMessageManager.createV2Container('success')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**▶️ PLAYBACK RESUMED**\n\nMusic playback has been resumed.\n\n*Let the music flow! 🎵*')
                            );

                        const resumeReply = await interaction.editReply({
                            components: [resumeContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => resumeReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('pause_resume'));
                        break;

                    case 'skip':
                        const currentTrack = player.current;
                        await advancedMessageManager.cleanupGuildMessages(client, interaction.guildId, ['track']);
                        player.stop();

                        const skipContainer = advancedMessageManager.createV2Container('info')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**⏭️ TRACK SKIPPED**\n\n${currentTrack ? `**Skipped:** ${currentTrack.info.title}` : 'Current track skipped'}\n\n*${player.queue.length > 0 ? 'Moving to next track...' : 'Queue is empty - session will end.'}*`)
                            );

                        const skipReply = await interaction.editReply({
                            components: [skipContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => skipReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('skip'));
                        break;

                    case 'stop':
                      
                        lyricsStateManager.stopLyrics(interaction.guildId, true);

                        if (lyricIntervals.has(interaction.guildId)) {
                            clearInterval(lyricIntervals.get(interaction.guildId));
                            lyricIntervals.delete(interaction.guildId);
                        }

                        await advancedMessageManager.cleanupGuildMessages(client, interaction.guildId, ['lyrics']);
                        await handlePlayerCleanup(client, interaction.guildId, player, 'Manual stop by user');
                        player.destroy();
                        sessionManager.endSession(interaction.guildId);

                        const stopContainer = advancedMessageManager.createV2Container('error')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**⏹️ MUSIC SESSION TERMINATED**\n\nSession stopped by user request.\n\n**🔧 Actions Performed:**\n• ⏹️ Playback completely stopped\n• 🗑️ Queue cleared and reset\n• 🔌 Player disconnected from voice\n• 🎤 Lyrics sessions permanently disabled\n• 🧹 All resources cleaned up\n\n**Ready for your next session!**')
                            );

                        const stopReply = await interaction.editReply({
                            components: [stopContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        const channel = client.channels.cache.get(player.textChannel);
                        if (channel) {
                            const channelStopContainer = advancedMessageManager.createV2Container('session_end')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**🎵 MUSIC SESSION ENDED**\nStopped by user request.\n\n*All resources have been cleaned up and the bot is ready for the next music session.*')
                                );

                            const stopMsg = await channel.send({
                                components: [channelStopContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            advancedMessageManager.addQuickDeleteMessage(client, stopMsg, 'session_end');
                        }

                        setTimeout(() => stopReply.delete().catch(() => { }), 3000);
                        break;

                    case 'shuffle':
                        if (!player.queue || player.queue.length === 0) {
                            const emptyContainer = advancedMessageManager.createV2Container('warning')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**❌ EMPTY QUEUE**\nCannot shuffle an empty queue.\n\n*Add some tracks first with `/music play`.*')
                                );

                            const emptyReply = await interaction.editReply({
                                components: [emptyContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            setTimeout(() => emptyReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('warning'));
                            return;
                        }

                        player.queue.shuffle();

                        const shuffleContainer = advancedMessageManager.createV2Container('success')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🔀 QUEUE SHUFFLED**\nThe music queue has been shuffled randomly!\n\n**📊 Queue Info:**\n• **Total Tracks:** ${player.queue.length}\n• **Order:** Completely randomized\n• **Next Up:** ${player.queue[0]?.info.title || 'None'}\n\n*Time for some musical surprises! 🎲*`)
                            );

                        const shuffleReply = await interaction.editReply({
                            components: [shuffleContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => shuffleReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('shuffle'));
                        break;

                    case 'loop':
                        const loopMode = player.loop === 'none' ? 'track' : player.loop === 'track' ? 'queue' : 'none';
                        player.setLoop(loopMode);

                        const loopContainer = advancedMessageManager.createV2Container('info')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🔁 LOOP MODE UPDATED**\n\n**Mode:** ${loopMode.toUpperCase()}\n\n${getLoopDescription(loopMode)}\n\n*Loop preferences saved for this session.*`)
                            );

                        const loopReply = await interaction.editReply({
                            components: [loopContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => loopReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('loop'));
                        break;

                    case 'queue':
                        if (!player.queue || player.queue.length === 0) {
                            const emptyQueueContainer = advancedMessageManager.createV2Container('warning')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**📜 EMPTY QUEUE**\n\nNo tracks in queue.\n\n*Add tracks using `/music play <song>`*')
                                );

                            const emptyQueueReply = await interaction.editReply({
                                components: [emptyQueueContainer],
                                flags: MessageFlags.IsComponentsV2
                            });

                            setTimeout(() => emptyQueueReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('warning'));
                        } else {
                            await showV2Queue(client, player, interaction);
                        }
                        break;

                    case 'lyrics':
                        await showV2Lyrics(client, player, interaction);
                        break;

                    default:
                        const unknownContainer = advancedMessageManager.createV2Container('error')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ UNKNOWN ACTION**\n\nUnrecognized control action.')
                            );

                        const unknownReply = await interaction.editReply({
                            components: [unknownContainer],
                            flags: MessageFlags.IsComponentsV2
                        });

                        setTimeout(() => unknownReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                        break;
                }
            } catch (error) {
                console.error('V2 Button interaction error:', error);

                try {
                    const errorContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ INTERACTION ERROR**\n\nSomething went wrong processing your request.\n\n*Please try again or restart the music session.*')
                        );

                    if (interaction.deferred) {
                        const errorReply = await interaction.editReply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2
                        });
                        setTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                    } else {
                        await interaction.reply({
                            components: [errorContainer],
                            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
                        });
                    }
                } catch (fallbackError) {
                    console.error('V2 Interaction fallback error:', fallbackError);
                }
            }
        });

        async function showV2Queue(client, player, interaction) {
            try {
                const channel = client.channels.cache.get(player.textChannel);
                if (!channel) {
                    const channelErrorContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ CHANNEL ERROR**\n\nCould not find music text channel.')
                        );

                    const errorReply = await interaction.editReply({
                        components: [channelErrorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    setTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                    return;
                }

                await advancedMessageManager.cleanupGuildMessages(client, interaction.guildId, ['queue']);

                const queue = player.queue;
                const currentTrack = player.current;

                const queueItems = queue.slice(0, 15).map((track, i) =>
                    `**${i + 1}.** **${track.info.title}**\n> *🎤 ${track.info.author} • 👤 ${track.requester?.username || 'Unknown'} • ⏱️ ${formatTime(track.info.length)}*`
                );

                const queueContainer = advancedMessageManager.createV2Container('queue')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**🎵 MUSIC QUEUE**')
                    )
                    .addSeparatorComponents(separator => separator);

                if (currentTrack) {
                    queueContainer.addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🎧 Currently Playing:**\n**${currentTrack.info.title}**\n*${currentTrack.info.author} • ${formatTime(currentTrack.info.length)}*`)
                            )
                            .setThumbnailAccessory(
                                thumbnail => thumbnail
                                    .setURL(currentTrack.info.thumbnail || 'https://via.placeholder.com/300x300/DC92FF/FFFFFF?text=Music')
                                    .setDescription('Now Playing')
                            )
                    ).addSeparatorComponents(separator => separator);
                }

                queueContainer.addTextDisplayComponents(
                    textDisplay => textDisplay.setContent([
                        '**📊 Queue Statistics:**',
                        `• **Total Tracks:** ${queue.length}`,
                        `• **Estimated Time:** ~${Math.round(queue.length * 3.5)} minutes`,
                        `• **Loop Mode:** ${player.loop || 'None'}`,
                        `• **Shuffle:** ${queue.shuffled ? 'Enabled' : 'Disabled'}`,
                        `• **Volume:** ${player.volume}%`
                    ].join('\n'))
                ).addSeparatorComponents(separator => separator);

                if (queueItems.length > 0) {
                    queueContainer.addTextDisplayComponents(
                        textDisplay => textDisplay.setContent([
                            '**📋 Up Next:**',
                            '',
                            queueItems.join('\n\n'),
                            queue.length > 15 ? `\n\n*...and ${queue.length - 15} more tracks*` : ''
                        ].join('\n'))
                    );
                } else {
                    queueContainer.addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**📭 No tracks in queue**\n\nAdd more tracks with `/music play` or enable autoplay for continuous music.')
                    );
                }

                const queueMessage = await channel.send({
                    components: [queueContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                const context = { queueSize: queue.length };
                advancedMessageManager.addMessage(interaction.guildId, queueMessage.id, channel.id, 'queue', context);

                const successContainer = advancedMessageManager.createV2Container('success')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**📜 QUEUE DISPLAYED**\n\nQueue information shown in channel.\n\n*Auto-deletes in 45 seconds for a clean chat.*')
                    );

                const successReply = await interaction.editReply({
                    components: [successContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                setTimeout(() => successReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('success'));

            } catch (error) {
                console.error('V2 Queue display error:', error);

                const errorContainer = advancedMessageManager.createV2Container('error')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**❌ QUEUE DISPLAY ERROR**\n\nFailed to show queue information.')
                    );

                const errorReply = await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                setTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
            }
        }

   
        async function showV2Lyrics(client, player, interaction) {
            try {
                const channel = client.channels.cache.get(player.textChannel);
                if (!channel) {
                    const channelErrorContainer = advancedMessageManager.createV2Container('error')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ CHANNEL ERROR**\n\nCould not find music text channel.')
                        );

                    const errorReply = await interaction.editReply({
                        components: [channelErrorContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    setTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
                    return;
                }

                if (!player.current) {
                    const noTrackContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎵 NO TRACK PLAYING**\n\nNo song is currently active.\n\n*Start playing music to view lyrics.*')
                        );

                    const noTrackReply = await interaction.editReply({
                        components: [noTrackContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    setTimeout(() => noTrackReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('warning'));
                    return;
                }

             
                if (lyricsStateManager.isActive(interaction.guildId)) {
                    const alreadyActiveContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**⚠️ LYRICS ALREADY ACTIVE**\nLyrics are already running for this track.\n\n*Use the existing lyrics controls or stop them first.*')
                        );

                    await interaction.editReply({
                        components: [alreadyActiveContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                    return;
                }

              
                if (lyricsStateManager.isManuallyStopped(interaction.guildId)) {
                    const stoppedContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🛑 LYRICS MANUALLY DISABLED**\nLyrics were stopped for this session.\n\n*They will not auto-restart. Click below to restart manually.*')
                        );

                    const restartRow = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setCustomId('v2_lyrics_force_restart')
                            .setLabel('Force Restart Lyrics')
                            .setEmoji('🔄')
                            .setStyle(ButtonStyle.Success)
                    );

                    const stoppedReply = await interaction.editReply({
                        components: [stoppedContainer, restartRow],
                        flags: MessageFlags.IsComponentsV2
                    });

              
                    const forceCollector = stoppedReply.createMessageComponentCollector({ time: 30000 });
                    forceCollector.on('collect', async (i) => {
                        if (i.customId === 'v2_lyrics_force_restart') {
                            await i.deferUpdate();
                            lyricsStateManager.clearGuild(interaction.guildId);
                            await startV2LiveLyrics(client, channel, player, player.current.info, await getLyrics(player.current.info.title, player.current.info.author, Math.floor(player.current.info.length / 1000)), interaction);
                        }
                    });

                    setTimeout(() => stoppedReply.delete().catch(() => { }), 30000);
                    return;
                }

                await advancedMessageManager.cleanupGuildMessages(client, interaction.guildId, ['lyrics']);

                if (lyricIntervals.has(interaction.guildId)) {
                    clearInterval(lyricIntervals.get(interaction.guildId));
                    lyricIntervals.delete(interaction.guildId);
                }

                const track = player.current.info;

                const loadingContainer = advancedMessageManager.createV2Container('info')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**🎤 LOADING LYRICS**\n\nSearching for lyrics...\n\n*Please wait while we fetch the lyrics.*')
                    );

                const loadingReply = await interaction.editReply({
                    components: [loadingContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                const lyrics = await getLyrics(track.title, track.author, Math.floor(track.length / 1000));

                if (!lyrics) {
                    const noLyricsContainer = advancedMessageManager.createV2Container('warning')
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ LYRICS NOT FOUND**\n\n**No lyrics available for:**\n**' + track.title + '** - *' + track.author + '*\n\n**Possible reasons:**\n• Song not in lyrics database\n• Instrumental track\n• Very new/obscure song\n• Title/artist mismatch')
                        );

                    await loadingReply.edit({
                        components: [noLyricsContainer],
                        flags: MessageFlags.IsComponentsV2
                    });

                    setTimeout(() => loadingReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('warning', { isImportant: true }));
                    return;
                }

                await loadingReply.delete().catch(() => { });
                await startV2LiveLyrics(client, channel, player, track, lyrics, interaction);

            } catch (error) {
                console.error('V2 Lyrics error:', error);

                const errorContainer = advancedMessageManager.createV2Container('error')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**❌ LYRICS ERROR**\n\nFailed to load lyrics.\n\n*Try again or check if the song has lyrics available.*')
                    );

                const errorReply = await interaction.editReply({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                setTimeout(() => errorReply.delete().catch(() => { }), advancedMessageManager.getAutoDeleteTime('error'));
            }
        }

      
        async function startV2LiveLyrics(client, channel, player, track, lyrics, interaction) {
            try {
                const guildId = player.guildId;
                const lines = lyrics.split('\n').map(line => line.trim()).filter(Boolean);
                const songDuration = Math.floor(track.length / 1000);

            
                lyricsStateManager.startLyrics(guildId, {
                    trackTitle: track.title,
                    startTime: Date.now(),
                    messageId: null
                });

                const lyricsContainer = advancedMessageManager.createV2Container('lyrics')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent(`**🎤 LIVE LYRICS**`)
                    )
                    .addSeparatorComponents(separator => separator)
                    .addSectionComponents(
                        section => section
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${track.title}**\n*${track.author}*\n\n🔄 Syncing lyrics...`)
                            )
                            .setThumbnailAccessory(
                                thumbnail => thumbnail
                                    .setURL(track.thumbnail || 'https://via.placeholder.com/300x300/FF69B4/FFFFFF?text=Lyrics')
                                    .setDescription('Live Lyrics')
                            )
                    );

           
                const lyricsControlRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('v2_lyrics_full')
                        .setLabel('Full Lyrics')
                        .setEmoji('📜')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('v2_lyrics_stop_final')
                        .setLabel('Stop & Disable')
                        .setEmoji('⏹️')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('v2_lyrics_restart')
                        .setLabel('Restart')
                        .setEmoji('🔄')
                        .setStyle(ButtonStyle.Secondary)
                );

                const lyricsMessage = await channel.send({
                    components: [lyricsContainer, lyricsControlRow],
                    flags: MessageFlags.IsComponentsV2
                });

              
                const stateData = lyricsStateManager.activeGuilds.get(guildId);
                if (stateData) {
                    stateData.messageId = lyricsMessage.id;
                    lyricsStateManager.activeGuilds.set(guildId, stateData);
                }

                advancedMessageManager.addMessage(guildId, lyricsMessage.id, channel.id, 'lyrics');

          
                const updateLyrics = async () => {
                    try {
                     
                        if (!lyricsStateManager.isActive(guildId)) {
                            //console.log(`🛑 UpdateLyrics stopped - guild ${guildId} not active`);
                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }
                            return;
                        }

                      
                        if (lyricsStateManager.isManuallyStopped(guildId)) {
                            //console.log(`🛑 UpdateLyrics stopped - guild ${guildId} manually stopped`);
                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }
                            return;
                        }

                        const currentPlayer = client.riffy.players.get(guildId);
                        if (!currentPlayer || !currentPlayer.current || currentPlayer.current.info.title !== track.title) {
                            //console.log(`🛑 UpdateLyrics stopped - track changed or player gone`);

                            lyricsStateManager.clearGuild(guildId);

                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }

                            const autoCleanupContainer = advancedMessageManager.createV2Container('info')
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**🎤 LYRICS AUTO-CLOSED**\nTrack ended or changed.')
                                );

                            await lyricsMessage.edit({
                                components: [autoCleanupContainer],
                                flags: MessageFlags.IsComponentsV2
                            }).catch(() => { });

                            setTimeout(() => {
                                lyricsMessage.delete().catch(() => { });
                                advancedMessageManager.lyricsMessages.delete(guildId);
                            }, 3000);
                            return;
                        }

                        
                        const currentTime = Math.floor(currentPlayer.position / 1000);
                        const linesPerSecond = lines.length / songDuration;
                        const currentLineIndex = Math.floor(currentTime * linesPerSecond);

                        const start = Math.max(0, currentLineIndex - 2);
                        const end = Math.min(lines.length, currentLineIndex + 5);
                        const visibleLines = lines.slice(start, end).map((line, i) => {
                            const actualIndex = start + i;
                            const isCurrentLine = actualIndex === currentLineIndex;
                            return isCurrentLine ? `**► ${line}**` : `${line}`;
                        }).join('\n');

                        const updatedContainer = advancedMessageManager.createV2Container('lyrics')
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🎤 LIVE LYRICS**`)
                            )
                            .addSeparatorComponents(separator => separator)
                            .addSectionComponents(
                                section => section
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent([
                                            `**${track.title}**`,
                                            `*${track.author}*`,
                                            '',
                                            visibleLines || '🎵 *Waiting for lyrics...*'
                                        ].join('\n'))
                                    )
                                    .setThumbnailAccessory(
                                        thumbnail => thumbnail
                                            .setURL(track.thumbnail || 'https://via.placeholder.com/300x300/FF69B4/FFFFFF?text=Lyrics')
                                            .setDescription('Live Lyrics')
                                    )
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**⏱️ Progress:** ${Math.floor(currentTime / 60)}:${(currentTime % 60).toString().padStart(2, '0')} / ${Math.floor(songDuration / 60)}:${(songDuration % 60).toString().padStart(2, '0')}\n**🎵 Line:** ${Math.min(currentLineIndex + 1, lines.length)} of ${lines.length}`)
                            );

                        await lyricsMessage.edit({
                            components: [updatedContainer, lyricsControlRow],
                            flags: MessageFlags.IsComponentsV2
                        }).catch(() => {
                           
                            lyricsStateManager.clearGuild(guildId);
                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }
                        });

                    } catch (updateError) {
                        console.error('Lyrics update error:', updateError);
                        
                        lyricsStateManager.clearGuild(guildId);
                        if (lyricIntervals.has(guildId)) {
                            clearInterval(lyricIntervals.get(guildId));
                            lyricIntervals.delete(guildId);
                        }
                    }
                };

          
                const interval = setInterval(updateLyrics, 2000);
                lyricIntervals.set(guildId, interval);
                updateLyrics(); 

                const collector = lyricsMessage.createMessageComponentCollector({
                    time: 600000,
                    filter: (i) => ['v2_lyrics_full', 'v2_lyrics_stop_final', 'v2_lyrics_restart'].includes(i.customId)
                });

     
                lyricsStateManager.setCollector(guildId, collector);

                collector.on('collect', async (i) => {
                    try {
                        let hasResponded = false;

                        try {
                            await i.deferUpdate();
                            hasResponded = true;
                        } catch (deferError) {
                            console.warn('Defer failed:', deferError.code);
                            if (!hasResponded && !i.replied && !i.deferred) {
                                try {
                                    await i.reply({
                                        content: 'Processing...',
                                        flags: MessageFlags.Ephemeral
                                    });
                                    hasResponded = true;
                                } catch (replyError) {
                                    console.warn('Reply also failed:', replyError.code);
                                    return;
                                }
                            }
                        }

                        if (i.customId === 'v2_lyrics_stop_final') {


                         
                            lyricsStateManager.stopLyrics(guildId, true);

                         
                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }

                         
                            collector.stop('nuclear_stop');

                      
                            advancedMessageManager.lyricsMessages.delete(guildId);

                         
                            try {
                                await lyricsMessage.delete();
                                //console.log('✅ Lyrics message deleted immediately');
                            } catch (deleteError) {
                                //console.warn('Could not delete lyrics message:', deleteError.code);
                            }

                    
                            const confirmMsg = await channel.send({
                                content: '🛑 LYRICS PERMANENTLY STOPPED - Will not auto-restart this session.',
                                components: []
                            });

                            setTimeout(() => confirmMsg.delete().catch(() => { }), 3000);

                               return;

                        } else if (i.customId === 'v2_lyrics_restart') {
                       
                            lyricsStateManager.clearGuild(guildId);
                            lyricsStateManager.startLyrics(guildId, {
                                trackTitle: track.title,
                                startTime: Date.now(),
                                messageId: lyricsMessage.id
                            });

                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }

                            const newInterval = setInterval(updateLyrics, 2000);
                            lyricIntervals.set(guildId, newInterval);
                            updateLyrics();

                        } else if (i.customId === 'v2_lyrics_full') {
                        
                            if (lyricIntervals.has(guildId)) {
                                clearInterval(lyricIntervals.get(guildId));
                                lyricIntervals.delete(guildId);
                            }

                            try {
                                const maxLength = 4000;
                                let lyricsText = lines.join('\n');
                                let isShortened = false;

                                if (lyricsText.length > maxLength) {
                                    const cutPoint = lyricsText.lastIndexOf('\n', maxLength);
                                    if (cutPoint > maxLength * 0.7) {
                                        lyricsText = lyricsText.substring(0, cutPoint);
                                        isShortened = true;
                                    } else {
                                        const lastSpace = lyricsText.lastIndexOf(' ', maxLength);
                                        lyricsText = lyricsText.substring(0, lastSpace > 0 ? lastSpace : maxLength);
                                        isShortened = true;
                                    }
                                }

                                const messageExists = await channel.messages.fetch(lyricsMessage.id).catch(() => null);
                                if (!messageExists) {
                                    const fullLyricsEmbed = new EmbedBuilder()
                                        .setColor(0xff69b4)
                                        .setTitle('📜 FULL LYRICS')
                                        .setDescription(`**${track.title}**\n*${track.author}*\n\n${lyricsText}${isShortened ? '\n\n*...lyrics truncated due to length*' : ''}`)
                                        .setFooter({
                                            text: `${lines.length} lines total ${isShortened ? '(shortened)' : '(complete)'}`
                                        });

                                    const newLyricsMsg = await channel.send({
                                        embeds: [fullLyricsEmbed]
                                    });

                                    setTimeout(() => newLyricsMsg.delete().catch(() => { }), 60000);
                                    return;
                                }

                                const fullLyricsEmbed = new EmbedBuilder()
                                    .setColor(0xff69b4)
                                    .setTitle('📜 FULL LYRICS')
                                    .setDescription(`**${track.title}**\n*${track.author}*\n\n${lyricsText}${isShortened ? '\n\n*...lyrics truncated due to Discord length limits*' : ''}`)
                                    .setThumbnail(track.thumbnail || 'https://via.placeholder.com/300x300/FF69B4/FFFFFF?text=Lyrics')
                                    .setFooter({
                                        text: `${lines.length} lines total ${isShortened ? '(showing first part)' : '(complete)'} • Click buttons to control`,
                                        iconURL: 'https://via.placeholder.com/32x32/FF69B4/FFFFFF?text=♪'
                                    })
                                    .setTimestamp();

                                const backRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder()
                                        .setCustomId('v2_lyrics_back')
                                        .setLabel('Back to Live')
                                        .setEmoji('↩️')
                                        .setStyle(ButtonStyle.Primary),
                                    new ButtonBuilder()
                                        .setCustomId('v2_lyrics_download')
                                        .setLabel('Download Full')
                                        .setEmoji('📥')
                                        .setStyle(ButtonStyle.Secondary),
                                    new ButtonBuilder()
                                        .setCustomId('v2_lyrics_delete')
                                        .setLabel('Delete')
                                        .setEmoji('🗑️')
                                        .setStyle(ButtonStyle.Danger)
                                );

                                await lyricsMessage.edit({
                                    embeds: [fullLyricsEmbed],
                                    components: [backRow],
                                    flags: 0
                                });

                            } catch (fullLyricsError) {
                                console.error('Full lyrics display error:', fullLyricsError);

                                try {
                                    const lyricsFile = new AttachmentBuilder(
                                        Buffer.from(lines.join('\n'), 'utf8'),
                                        { name: `${track.title.replace(/[^a-zA-Z0-9\s]/g, '_')}_lyrics.txt` }
                                    );

                                    if (hasResponded && i.deferred) {
                                        await i.followUp({
                                            content: `📜 **FULL LYRICS** - ${track.title}\n\n*Lyrics too long for display, attached as file.*`,
                                            files: [lyricsFile],
                                            flags: MessageFlags.Ephemeral
                                        });
                                    }
                                } catch (fileError) {
                                    console.error('File fallback failed:', fileError);
                                }
                            }
                        }

                     
                        if (['v2_lyrics_back', 'v2_lyrics_download', 'v2_lyrics_delete'].includes(i.customId)) {
                            const additionalCollector = lyricsMessage.createMessageComponentCollector({ time: 300000 });
                            additionalCollector.on('collect', async (ci) => {
                                try {
                                    await ci.deferUpdate();

                                    if (ci.customId === 'v2_lyrics_back') {
                                        const messageExists = await channel.messages.fetch(lyricsMessage.id).catch(() => null);
                                        if (!messageExists) return;

                                        if (lyricIntervals.has(guildId)) {
                                            clearInterval(lyricIntervals.get(guildId));
                                            lyricIntervals.delete(guildId);
                                        }

                                        const newInterval = setInterval(updateLyrics, 2000);
                                        lyricIntervals.set(guildId, newInterval);
                                        await updateLyrics();

                                    } else if (ci.customId === 'v2_lyrics_download') {
                                        const lyricsFile = new AttachmentBuilder(
                                            Buffer.from(lines.join('\n'), 'utf8'),
                                            { name: `${track.title.replace(/[^a-zA-Z0-9\s]/g, '_')}_lyrics.txt` }
                                        );

                                        await ci.followUp({
                                            content: `📥 **LYRICS DOWNLOAD** - ${track.title}\n\n**Complete lyrics file attached.**`,
                                            files: [lyricsFile],
                                            flags: MessageFlags.Ephemeral
                                        });

                                    } else if (ci.customId === 'v2_lyrics_delete') {
                                        lyricsStateManager.clearGuild(guildId);
                                        if (lyricIntervals.has(guildId)) {
                                            clearInterval(lyricIntervals.get(guildId));
                                            lyricIntervals.delete(guildId);
                                        }

                                        await lyricsMessage.delete();
                                        advancedMessageManager.lyricsMessages.delete(guildId);
                                        collector.stop('manual_delete');
                                        additionalCollector.stop('manual_delete');
                                    }
                                } catch (additionalError) {
                                    console.error('Additional collector error:', additionalError);
                                }
                            });
                        }

                    } catch (collectorError) {
                        console.error('Lyrics collector error:', collectorError);
                    }
                });

                collector.on('end', (collected, reason) => {
                    //console.log(`Lyrics collector ended: ${reason}`);

                    if (reason === 'nuclear_stop' || reason === 'manual_delete') {
                       // console.log('Nuclear stop/manual delete - no cleanup needed');
                        return;
                    }

              
                    lyricsStateManager.clearGuild(guildId);

                    if (lyricIntervals.has(guildId)) {
                        clearInterval(lyricIntervals.get(guildId));
                        lyricIntervals.delete(guildId);
                    }

                    advancedMessageManager.lyricsMessages.delete(guildId);

                    setTimeout(() => {
                        lyricsMessage.delete().catch(() => { });
                    }, 1000);
                });

          
                const successContainer = advancedMessageManager.createV2Container('success')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**🎤 LIVE LYRICS STARTED**\n\nLyrics are now syncing with the music!\n\n**⚠️ Important:** Use "Stop & Disable" to permanently stop lyrics for this session.')
                    );

                const successReply = await interaction.editReply({
                    components: [successContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                setTimeout(() => successReply.delete().catch(() => { }), 5000);

            } catch (error) {
                //console.error('V2 Live lyrics start error:', error);

              
                lyricsStateManager.clearGuild(guildId);
                if (lyricIntervals.has(guildId)) {
                    clearInterval(lyricIntervals.get(guildId));
                    lyricIntervals.delete(guildId);
                }
            }
        }

        async function handlePlayerCleanup(client, guildId, player, reason) {
            try {
                //console.log(`🧹 Starting complete cleanup for guild ${guildId}: ${reason}`);

             
                lyricsStateManager.clearGuild(guildId);

                await advancedMessageManager.cleanupGuildMessages(client, guildId);

                if (lyricIntervals.has(guildId)) {
                    clearInterval(lyricIntervals.get(guildId));
                    lyricIntervals.delete(guildId);
                }

                if (queueDisplayTimeouts.has(guildId)) {
                    clearTimeout(queueDisplayTimeouts.get(guildId));
                    queueDisplayTimeouts.delete(guildId);
                }

                sessionManager.endSession(guildId);

                //console.log(`✅ Complete V2 cleanup finished for guild ${guildId}: ${reason}`);
            } catch (error) {
                //console.error('V2 Player cleanup error:', error);
            }
        }

        function formatTime(ms) {
            if (!ms || ms === 0) return "0:00";
            const totalSeconds = Math.floor(ms / 1000);
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            return `${hours > 0 ? hours + ":" : ""}${minutes.toString().padStart(hours > 0 ? 2 : 1, "0")}:${seconds.toString().padStart(2, "0")}`;
        }

        async function getLyrics(trackName, artistName, duration) {
            try {
                trackName = trackName
                    .replace(/\b(Official|Audio|Video|Lyrics|Theme|Soundtrack|Music|Full Version|HD|4K|Visualizer|Radio Edit|Live|Remix|Mix|Extended|Cover|Parody|Performance|Version|Unplugged|Reupload)\b/gi, "")
                    .replace(/\s*[-_/|]\s*/g, " ")
                    .replace(/\s+/g, " ")
                    .trim();

                artistName = artistName
                    .replace(/\b(Topic|VEVO|Records|Label|Productions|Entertainment|Ltd|Inc|Band|DJ|Composer|Performer)\b/gi, "")
                    .replace(/ x /gi, " & ")
                    .replace(/\s+/g, " ")
                    .trim();

                let response = await axios.get(`https://lrclib.net/api/get`, {
                    params: { track_name: trackName, artist_name: artistName, duration },
                    timeout: 5000
                });

                if (response.data.syncedLyrics || response.data.plainLyrics) {
                    return response.data.syncedLyrics || response.data.plainLyrics;
                }

                response = await axios.get(`https://lrclib.net/api/get`, {
                    params: { track_name: trackName, artist_name: artistName },
                    timeout: 5000
                });

                return response.data.syncedLyrics || response.data.plainLyrics;
            } catch (error) {
                console.error("V2 Lyrics fetch error:", error.response?.data?.message || error.message);
                return null;
            }
        }

        function getVolumeBar(volume) {
            const barLength = 20;
            const filledLength = Math.round((volume / 100) * barLength);
            const emptyLength = barLength - filledLength;
            return '█'.repeat(filledLength) + '░'.repeat(emptyLength) + ` ${volume}%`;
        }

        function getLoopDescription(mode) {
            const descriptions = {
                'none': '*No looping - plays through queue once*',
                'track': '*Current track repeats indefinitely*',
                'queue': '*Entire queue repeats when finished*'
            };
            return descriptions[mode] || '*Unknown loop mode*';
        }

        client.riffy.on('playerDestroy', async (player) => {
            const guildId = player.guildId;
            await handlePlayerCleanup(client, guildId, player, 'Player destroyed');
        });

        client.riffy.on('trackError', async (player, track, error) => {
            const exception = error?.exception || error || {};
            const errorMessage = exception.message || exception.cause || error?.message || 'Unknown Lavalink error';

            console.error(`V2 Track error in guild ${player.guildId}:`, {
                message: errorMessage,
                severity: exception.severity,
                cause: exception.cause,
                identifier: track?.info?.identifier,
                source: track?.info?.sourceName
            });

            const guildId = player.guildId;
            const channel = client.channels.cache.get(player.textChannel);

            if (channel) {
                const errorContainer = advancedMessageManager.createV2Container('error')
                    .addTextDisplayComponents(
                        textDisplay => textDisplay.setContent('**⚠️ TRACK ERROR**\n\n**Failed to play:** ' + track.info.title + '\n\n**Error:** ' + errorMessage + '\n\n*' + (player.queue.length > 0 ? 'Skipping to next track...' : 'Queue is empty.') + '*')
                    );

                const errorMsg = await channel.send({
                    components: [errorContainer],
                    flags: MessageFlags.IsComponentsV2
                });

                advancedMessageManager.addMessage(guildId, errorMsg.id, channel.id, 'error');
            }

            if (player.queue.length > 0) {
                player.stop();
            }
        });

        const cleanupOrphanedResources = async () => {
            try {
                const guildsWithResources = new Set([
                    ...advancedMessageManager.trackMessages.keys(),
                    ...advancedMessageManager.lyricsMessages.keys(),
                    ...advancedMessageManager.queueMessages.keys(),
                    ...advancedMessageManager.lastEmbeds.keys(),
                    ...lyricIntervals.keys(),
                    ...queueDisplayTimeouts.keys(),
                    ...sessionManager.activeSessions.keys(),
                    ...lyricsStateManager.activeGuilds.keys()
                ]);

                for (const guildId of guildsWithResources) {
                    if (!client.riffy.players.has(guildId)) {
                        await handlePlayerCleanup(client, guildId, null, 'Orphaned resource cleanup');
                    }
                }

                //console.log(`V2 Cleanup completed for ${guildsWithResources.size} guilds`);
            } catch (error) {
                //console.error("V2 Cleanup routine error:", error);
            }
        };

        setInterval(cleanupOrphanedResources, 3 * 60 * 1000);

        client.on('error', async (error) => {
            // A Discord client error does not reliably identify the affected
            // guild. Never destroy every guild's player from this global event:
            // an isolated voice failure in one guild would disconnect all
            // other active music sessions as well.
            console.error('V2 Client error:', error);
        });

        process.on('unhandledRejection', (reason, promise) => {
            console.error('V2 Unhandled Rejection at:', promise, 'reason:', reason);
        });

        process.on('uncaughtException', (error) => {
            console.error('V2 Uncaught Exception:', error);
        });

        client.on('raw', d => client.riffy.updateVoiceState(d));

        client.once('clientReady', () => {
            client.riffy.init(client.user.id);
            console.log('\x1b[35m[ V2 MUSIC ]\x1b[0m', '\x1b[32mAdvanced V2 Music System Active ✅\x1b[0m');

            setTimeout(async () => {
                for (const guild of client.guilds.cache.values()) {
                    await advancedMessageManager.cleanupGuildMessages(client, guild.id);
                }
            }, 5000);
        });
                const initializeRiffy = async () => {
            try {
                if (!client.isReady()) {
                    //console.log('\x1b[33m[ V2 LAVALINK ]\x1b[0m Waiting for client to be ready...');
                    await new Promise(resolve => client.once('ready', resolve));
                }

                //console.log('\x1b[34m[ V2 LAVALINK ]\x1b[0m Client ready, initializing Riffy...');
                
              
                client.riffy.init(client.user.id);
                
                //console.log('\x1b[34m[ V2 LAVALINK ]\x1b[0m Riffy.init() called, waiting for node connection...');

              
                await Promise.race([
                    new Promise((resolve) => {
                        client.riffy.once('nodeConnect', resolve);
                    }),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('Node connection timeout after 15 seconds')), 15000)
                    )
                ]);

                console.log('\x1b[35m[ V2 MUSIC ]\x1b[0m', '\x1b[32mAdvanced V2 Music System Active ✅\x1b[0m');

            
                setTimeout(async () => {
                    try {
                        for (const guild of client.guilds.cache.values()) {
                            await advancedMessageManager.cleanupGuildMessages(client, guild.id);
                        }
                        //console.log('\x1b[34m[ V2 LAVALINK ]\x1b[0m Initial cleanup completed');
                    } catch (cleanupError) {
                        console.error('\x1b[33m[ V2 LAVALINK ]\x1b[0m Cleanup error:', cleanupError.message);
                    }
                }, 5000);

            } catch (error) {
                console.error('\x1b[31m[ V2 LAVALINK ]\x1b[0m Initialization failed:', error.message);
                console.error('\x1b[31m[ V2 LAVALINK ]\x1b[0m Stack:', error.stack);
                
              
                console.log('\x1b[33m[ V2 LAVALINK ]\x1b[0m Attempting to verify Lavalink server...');
                try {
                    const testNode = nodes[0];
                    const testUrl = `http${testNode.secure ? 's' : ''}://${testNode.host}:${testNode.port}/version`;
                    console.log('\x1b[34m[ V2 LAVALINK ]\x1b[0m Testing:', testUrl);
                    
                    const response = await axios.get(testUrl, {
                        headers: { 'Authorization': testNode.password },
                        timeout: 5000
                    });
                    
                    console.log('\x1b[32m[ V2 LAVALINK ]\x1b[0m Server is reachable. Version:', response.data);
                    console.log('\x1b[33m[ V2 LAVALINK ]\x1b[0m Server is up but connection failed. Check Riffy compatibility.');
                } catch (testError) {
                    console.error('\x1b[31m[ V2 LAVALINK ]\x1b[0m Server not reachable:', testError.message);
                    console.error('\x1b[31m[ V2 LAVALINK ]\x1b[0m Check your lavalink config and ensure the server is running.');
                }
            }
        };

       
        initializeRiffy();
    } else {
        console.log('\x1b[31m[ V2 MUSIC ]\x1b[0m Lavalink Music System Disabled ❌');
    }
};
