/*
 ██████╗ ██╗      █████╗  ██████╗███████╗██╗   ██╗████████╗
██╔════╝ ██║     ██╔══██╗██╔════╝██╔════╝╚██╗ ██╔╝╚══██╔══╝
██║  ███╗██║     ███████║██║     █████╗   ╚████╔╝    ██║   
██║   ██║██║     ██╔══██║██║     ██╔══╝    ╚██╔╝     ██║   
╚██████╔╝███████╗██║  ██║╚██████╗███████╗   ██║      ██║   
 ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝   ╚═╝      ╚═╝   

-------------------------------------
📡 Discord : https://discord.gg/xQF9f9yUEM
🌐 Website : https://glaceyt.com
🎥 YouTube : https://youtube.com/@GlaceYT
✅ Verified | 🧩 Tested | ⚙️ Stable
-------------------------------------
> © 2025 GlaceYT.com | All rights reserved.
*/
const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, ThumbnailBuilder } = require('discord.js');
const musicIcons = require('../../UI/icons/musicicons');
const cmdIcons = require('../../UI/icons/commandicons');
const { autoplayCollection } = require('../../mongodb');
const { playlistCollection } = require('../../mongodb');
const SpotifyWebApi = require('spotify-web-api-node');
const { getData } = require('spotify-url-info')(fetch);
const config = require('../../config.js');
const { maximizeVoiceChannelBitrate } = require('../../utils/voiceQuality');
const {
    joinPersistentVoice,
    disablePersistentVoice
} = require('../../utils/voiceKeepAlive');

const spotifyApi = new SpotifyWebApi({
    clientId: config.spotifyClientId,
    clientSecret: config.spotifyClientSecret,
});

module.exports = {
    data: new SlashCommandBuilder()
        .setName('music')
        .setDescription('🎵 Advanced music player with V2 components')
        .addSubcommand(subcommand =>
            subcommand
                .setName('play')
                .setDescription('Play a song or playlist in the voice channel.')
                .addStringOption(option =>
                    option.setName('query')
                        .setDescription('Enter the song name or URL.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('nowplaying')
                .setDescription('Get information about the currently playing song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('loop')
                .setDescription('Toggle looping mode for the current track or the entire queue.')
                .addStringOption(option =>
                    option.setName('mode')
                        .setDescription('Select loop mode: none, track, or queue.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Disable Loop', value: 'none' },
                            { name: 'Track Loop', value: 'track' },
                            { name: 'Queue Loop', value: 'queue' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('pause')
                .setDescription('Pause the currently playing song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Resume the paused song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shuffle')
                .setDescription('Shuffle the queue.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('skip')
                .setDescription('Skip the current song.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('stop')
                .setDescription('Stop the music and clear the queue.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('queue')
                .setDescription('View the current music queue.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a specific song from the queue.')
                .addIntegerOption(option =>
                    option.setName('track')
                        .setDescription('Track number to remove.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('createplaylist')
                .setDescription('Create a new playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('visibility')
                        .setDescription('Choose if the playlist is public or private.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Public', value: 'public' },
                            { name: 'Private', value: 'private' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('playplaylist')
                .setDescription('Play a saved playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('viewmyplaylists')
                .setDescription('View your saved playlists.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('viewmyplaylistsongs')
                .setDescription('View songs in your playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('allplaylists')
                .setDescription('View all public playlists.'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deletesong')
                .setDescription('Remove a song from your playlist.')
                .addStringOption(option =>
                    option.setName('playlist')
                        .setDescription('Playlist name.')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('index')
                        .setDescription('Song index to remove.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('deleteplaylist')
                .setDescription('Delete your playlist.')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Playlist name.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('autoplay')
                .setDescription('Enable or disable autoplay.')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable autoplay.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('247')
                .setDescription('Keep the bot connected when the voice channel is empty.')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable 24/7 voice mode.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('addsong')
                .setDescription('Add a song to a playlist.')
                .addStringOption(option =>
                    option.setName('playlist')
                        .setDescription('The playlist name.')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('song')
                        .setDescription('Enter song name or URL.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('volume')
                .setDescription('Set the music volume (0-100).')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Volume level (0-100).')
                        .setRequired(true))),

    async execute(interaction) {
        try {
            await interaction.deferReply();
            const subcommand = interaction.options.getSubcommand();
            const userId = interaction.user.id;
            const guildId = interaction.guild.id;
            const member = interaction.member;
            const { channel } = member.voice;
            const client = interaction.client;

            if (subcommand === '247') {
                const enabled = interaction.options.getBoolean('enabled', true);

                if (!enabled) {
                    const wasEnabled = await disablePersistentVoice(client, guildId);
                    return interaction.editReply({
                        content: wasEnabled
                            ? '24/7 voice mode disabled. I left the persistent voice channel.'
                            : '24/7 voice mode was already disabled.'
                    });
                }

                if (!channel) {
                    return interaction.editReply({
                        content: 'Join a voice channel first, then enable 24/7 mode.'
                    });
                }

                const permissions = channel.permissionsFor(client.user);
                if (!permissions?.has(PermissionFlagsBits.Connect)) {
                    return interaction.editReply({
                        content: 'I need the Connect permission to join that voice channel.'
                    });
                }

                try {
                    const result = await joinPersistentVoice(client, channel, {
                        requestedBy: userId
                    });

                    return interaction.editReply({
                        content: result.alreadyConnected
                            ? `24/7 mode is already enabled in **${channel.name}**. I will stay there when it is empty.`
                            : `24/7 mode enabled in **${channel.name}**. I will stay connected when everyone leaves and reconnect automatically if needed.`
                    });
                } catch (error) {
                    console.error('[VOICE 24/7] Failed to enable from /music 247:', error);
                    return interaction.editReply({
                        content: 'I could not enable 24/7 mode. Check my Connect permission and try again.'
                    });
                }
            }

      
            const checkVoiceChannel = async () => {
                if (!channel) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xff4757)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ VOICE CHANNEL REQUIRED**\nYou must be connected to a voice channel to use music commands.\n\nPlease join a voice channel and try again.')
                        );
                    
                    const reply = await interaction.editReply({ 
                        components: [errorContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    return false;
                }
        
                const botVoiceChannel = interaction.guild.members.me?.voice.channel;
                
                if (botVoiceChannel && botVoiceChannel.id !== channel.id) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xff4757)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ CHANNEL CONFLICT**\nI\'m currently active in a different voice channel.\n\nPlease join the same channel or wait for the current session to end.')
                        );
                    
                    const reply = await interaction.editReply({ 
                        components: [errorContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    return false;
                }
                
             
                const permissions = channel.permissionsFor(client.user);
                if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
                    const errorContainer = new ContainerBuilder()
                        .setAccentColor(0xff4757)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ INSUFFICIENT PERMISSIONS**\nI need permission to connect and speak in the voice channel.\n\nPlease check my permissions and try again.')
                        );
                    
                    const reply = await interaction.editReply({ 
                        components: [errorContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    return false;
                }

                await maximizeVoiceChannelBitrate(channel);
                return true;
            };

      
            const getOrCreatePlayer = async () => {
                let player = client.riffy.players.get(guildId);
                
                if (!player) {
                    try {
                        player = await client.riffy.createConnection({
                            guildId,
                            voiceChannel: channel.id,
                            textChannel: interaction.channel.id,
                            deaf: true
                        });
                    } catch (error) {
                        console.error('Error creating player:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ CONNECTION FAILED**\nUnable to connect to the voice channel.\n\nPlease try again or contact support.')
                            );

                        await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        return null;
                    }
                }
                
                return player;
            };


            const checkPlayerExists = async () => {
                const player = client.riffy.players.get(guildId);
                
                if (!player) {
                    const noPlayerContainer = new ContainerBuilder()
                        .setAccentColor(0xff4757)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**❌ NO ACTIVE PLAYER**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('There is no active music player in this server.\n\n**💡 Quick Fix:**\nUse `/music play` to start playing music and initialize the player.')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎵 Get Started:**\n• Join a voice channel\n• Use `/music play <song name>` to begin\n• Enjoy high-quality audio streaming')
                        );
                
                    const reply = await interaction.editReply({ 
                        components: [noPlayerContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 6000);
                    return false;
                }
                
                return player;
            };

  
            switch (subcommand) {
                case 'play': {
                    try {
                        if (!await checkVoiceChannel()) return;
                    
                        const query = interaction.options.getString('query');
                        const user = interaction.user;
                        let player = await getOrCreatePlayer();
                        if (!player) return;
                
                  
                        if (query.includes('spotify.com')) {
                            try {
                                const spotifyData = await getData(query);
                                const token = await spotifyApi.clientCredentialsGrant();
                                spotifyApi.setAccessToken(token.body.access_token);
                        
                                let trackList = [];
                        
                                if (spotifyData.type === 'track') {
                                    const searchQuery = `${spotifyData.name} - ${spotifyData.artists.map(a => a.name).join(', ')}`;
                                    trackList.push(searchQuery);
                                } else if (spotifyData.type === 'playlist') {
                                    const playlistId = query.split('/playlist/')[1].split('?')[0];
                                    let offset = 0;
                                    const limit = 100;
                                    let fetched = [];
                        
                                    do {
                                        const data = await spotifyApi.getPlaylistTracks(playlistId, { limit, offset });
                                        fetched = data.body.items.filter(item => item.track).map(item =>
                                            `${item.track.name} - ${item.track.artists.map(a => a.name).join(', ')}`
                                        );
                                        trackList.push(...fetched);
                                        offset += limit;
                                    } while (fetched.length === limit);
                                }
                
                                if (trackList.length === 0) {
                                    const noTracksContainer = new ContainerBuilder()
                                        .setAccentColor(0xff4757)
                                        .addTextDisplayComponents(
                                            textDisplay => textDisplay.setContent('**❌ NO TRACKS FOUND**\nNo valid tracks found in this Spotify link.\n\nPlease verify the URL and try again.')
                                        );

                                    const reply = await interaction.editReply({ 
                                        components: [noTracksContainer], 
                                        flags: MessageFlags.IsComponentsV2 
                                    });
                                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                                    return;
                                }
                        
                                let added = 0;
                                for (const trackQuery of trackList) {
                                    const result = await client.riffy.resolve({ query: trackQuery, requester: user });
                                    if (result && result.tracks && result.tracks.length > 0) {
                                        const resolvedTrack = result.tracks[0];
                                        resolvedTrack.requester = {
                                            id: user.id,
                                            username: user.username,
                                            avatarURL: user.displayAvatarURL()
                                        };
                                        player.queue.add(resolvedTrack);
                                        added++;
                                    }
                                }
                        
                                const spotifyContainer = new ContainerBuilder()
                                    .setAccentColor(0x1db954)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**🎵 SPOTIFY INTEGRATION**')
                                    )
                                    .addSeparatorComponents(separator => separator)
                                    .addSectionComponents(
                                        section => section
                                            .addTextDisplayComponents(
                                                textDisplay => textDisplay.setContent(`**${spotifyData.type === 'track' ? '🎵 Track' : '📋 Playlist'} Added Successfully**\n\nAdded **${added}** track${added !== 1 ? 's' : ''} from Spotify to the queue.\n\n**Source:** ${spotifyData.name || 'Spotify Content'}`)
                                            )
                                            .setThumbnailAccessory(
                                                thumbnail => thumbnail
                                                    .setURL(user.displayAvatarURL({ dynamic: true }))
                                                    .setDescription('Requested by')
                                            )
                                    )
                                    .addSeparatorComponents(separator => separator)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent(`**🎧 Queue Status:**\n• Tracks in Queue: **${player.queue.length}**\n• Now Playing: ${player.current ? '✅ Active' : '⏸️ Starting...'}\n• Estimated Time: ~${Math.round(added * 3.5)} minutes`)
                                    );
                        
                                const reply = await interaction.editReply({ 
                                    components: [spotifyContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 8000);
                        
                                if (!player.playing && !player.paused) player.play();
                            } catch (spotifyError) {
                                console.error('Spotify error:', spotifyError);
                                
                                const spotifyErrorContainer = new ContainerBuilder()
                                    .setAccentColor(0xff4757)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**❌ SPOTIFY ERROR**')
                                    )
                                    .addSeparatorComponents(separator => separator)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**Failed to process Spotify link**\n\nThis could be due to:\n• Invalid or private Spotify URL\n• API rate limiting\n• Spotify service issues\n• Configuration problems')
                                    )
                                    .addSeparatorComponents(separator => separator)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**💡 Solutions:**\n• Try a different Spotify link\n• Ensure the playlist/track is public\n• Use YouTube or direct search instead\n• Contact support if issue persists')
                                    );
                                
                                const reply = await interaction.editReply({ 
                                    components: [spotifyErrorContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 10000);
                                return;
                            }
                        }  
                    
                        else if (query.includes('youtube.com') || query.includes('youtu.be')) {
                            let isPlaylist = query.includes('list=');
                            let isMix = query.includes('list=RD');
                    
                            if (isMix) {
                                const mixContainer = new ContainerBuilder()
                                    .setAccentColor(0xff4757)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**❌ UNSUPPORTED CONTENT**\nYouTube mixes and auto-generated playlists are not supported.\n\nPlease use regular playlists, individual videos, or search queries.')
                                    );
                            
                                const reply = await interaction.editReply({ 
                                    components: [mixContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 5000);
                                return;
                            }
                            
                            const resolve = await client.riffy.resolve({ query, requester: user });
                            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                                const noResultsContainer = new ContainerBuilder()
                                    .setAccentColor(0xff4757)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**❌ NO RESULTS FOUND**\nCouldn\'t find any tracks matching your YouTube link.\n\nPlease check the URL and try again.')
                                    );

                                const reply = await interaction.editReply({ 
                                    components: [noResultsContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 5000);
                                return;
                            }
                            
                            if (isPlaylist) {
                                for (const track of resolve.tracks) {
                                    track.requester = {
                                        id: user.id,
                                        username: user.username,
                                        avatarURL: user.displayAvatarURL()
                                    };
                                    player.queue.add(track);
                                }
                    
                                const playlistContainer = new ContainerBuilder()
                                    .setAccentColor(0xdc92ff)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**📋 YOUTUBE PLAYLIST ADDED**')
                                    )
                                    .addSeparatorComponents(separator => separator)
                                    .addSectionComponents(
                                        section => section
                                            .addTextDisplayComponents(
                                                textDisplay => textDisplay.setContent(`**Playlist successfully queued!**\n\nAdded **${resolve.tracks.length}** tracks from YouTube playlist.\n\n**Queue Status:**\n• Total Tracks: ${player.queue.length}\n• Estimated Duration: ~${Math.round(resolve.tracks.length * 3.5)} minutes`)
                                            )
                                            .setThumbnailAccessory(
                                                thumbnail => thumbnail
                                                    .setURL(user.displayAvatarURL({ dynamic: true }))
                                                    .setDescription('Requested by')
                                            )
                                    );
                    
                                const reply = await interaction.editReply({ 
                                    components: [playlistContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 6000);
                            } else {
                                const track = resolve.tracks[0];
                                track.requester = {
                                    id: user.id,
                                    username: user.username,
                                    avatarURL: user.displayAvatarURL()
                                };
                                player.queue.add(track);
                    
                                const trackContainer = new ContainerBuilder()
                                    .setAccentColor(0xdc92ff)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**🎵 TRACK ADDED TO QUEUE**')
                                    )
                                    .addSeparatorComponents(separator => separator)
                                    .addSectionComponents(
                                        section => section
                                            .addTextDisplayComponents(
                                                textDisplay => textDisplay.setContent(`**${track.info.title}**\n\nSuccessfully added to queue!\n\n**Details:**\n• Duration: ${this.formatDuration(track.info.length)}\n• Position: #${player.queue.length}\n• Source: YouTube`)
                                            )
                                            .setThumbnailAccessory(
                                                thumbnail => thumbnail
                                                    .setURL(user.displayAvatarURL({ dynamic: true }))
                                                    .setDescription('Requested by')
                                            )
                                    );
                    
                                const reply = await interaction.editReply({ 
                                    components: [trackContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 6000);
                            }
                    
                            if (!player.playing && !player.paused) player.play();
                        }
                  
                        else {
                            const resolve = await client.riffy.resolve({ query, requester: user });
                            
                            if (!resolve || !resolve.tracks || resolve.tracks.length === 0) {
                                const noResultsContainer = new ContainerBuilder()
                                    .setAccentColor(0xff4757)
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent('**❌ NO SEARCH RESULTS**\nNo tracks found matching your search query.\n\n**💡 Tips:**\n• Try different keywords\n• Include artist name\n• Check spelling\n• Use more specific terms')
                                    );
                            
                                const reply = await interaction.editReply({ 
                                    components: [noResultsContainer], 
                                    flags: MessageFlags.IsComponentsV2 
                                });
                                setTimeout(() => reply.delete().catch(() => {}), 6000);
                                return;
                            }
                
                            const track = resolve.tracks[0];
                            track.requester = {
                                id: user.id,
                                username: user.username,
                                avatarURL: user.displayAvatarURL()
                            };
                            player.queue.add(track);
                
                            const searchContainer = new ContainerBuilder()
                                .setAccentColor(0xdc92ff)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**🎵 SEARCH RESULT ADDED**')
                                )
                                .addSeparatorComponents(separator => separator)
                                .addSectionComponents(
                                    section => section
                                        .addTextDisplayComponents(
                                            textDisplay => textDisplay.setContent(`**${track.info.title}**\n\nTrack found and added to queue!\n\n**Queue Info:**\n• Position: #${player.queue.length}\n• Duration: ${this.formatDuration(track.info.length)}\n• Quality: High Definition`)
                                        )
                                        .setThumbnailAccessory(
                                            thumbnail => thumbnail
                                                .setURL(user.displayAvatarURL({ dynamic: true }))
                                                .setDescription('Requested by')
                                        )
                                );
                
                            const reply = await interaction.editReply({ 
                                components: [searchContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                
                            if (!player.playing && !player.paused) player.play();
                        }
                    } catch (error) {
                        console.error('Error resolving query:', error);
                    
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ PLAYBACK ERROR**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**Something went wrong while processing your request.**\n\nThis could be due to:\n• Network connectivity issues\n• Invalid or restricted content\n• Lavalink server problems\n• Rate limiting')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🔧 Troubleshooting:**\n• Try a different song or URL\n• Check your internet connection\n• Wait a moment and try again\n• Contact support if issues persist\n\n*Advanced users: Check Lavalink configuration*')
                            );
                    
                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 10000);
                    }
                    
                    break;
                }
                
                case 'nowplaying': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const currentTrack = player.current;
                    if (!currentTrack) {
                        const noTrackContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ NO TRACK PLAYING**\nNo track is currently active.\n\nUse `/music play` to start playing music.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [noTrackContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                        return;
                    }
                    
                    const nowPlayingContainer = new ContainerBuilder()
                        .setAccentColor(0xdc92ff)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎵 NOW PLAYING**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addSectionComponents(
                            section => section
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**${currentTrack.info.title}**\n\n${currentTrack.info.uri ? `**🔗 [Listen on Platform](${currentTrack.info.uri})**` : ''}\n\n**Track Details:**\n• Duration: ${this.formatDuration(currentTrack.info.length)}\n• Position: ${this.formatDuration(player.position)} / ${this.formatDuration(currentTrack.info.length)}\n• Volume: ${player.volume}%\n• Loop: ${player.loop || 'None'}\n\n**Requested by:** ${currentTrack.requester?.username || 'Unknown'}`)
                                )
                                .setThumbnailAccessory(
                                    thumbnail => thumbnail
                                        .setURL(currentTrack.info.artwork || currentTrack.requester?.avatarURL || 'https://via.placeholder.com/300x300')
                                        .setDescription('Now Playing')
                                )
                        );
                    
                    const reply = await interaction.editReply({ 
                        components: [nowPlayingContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 12000);
                    break;
                }

                case 'pause': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    player.pause(true);
                    
                    const pauseContainer = new ContainerBuilder()
                        .setAccentColor(0xffa500)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**⏸️ PLAYBACK PAUSED**\nMusic has been paused successfully.\n\nUse `/music resume` to continue playing.')
                        );

                    const reply = await interaction.editReply({ 
                        components: [pauseContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    break;
                }

                case 'resume': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    player.pause(false);
                    
                    const resumeContainer = new ContainerBuilder()
                        .setAccentColor(0x2ecc71)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**▶️ PLAYBACK RESUMED**\nMusic playback has been resumed.\n\nEnjoy your music!')
                        );

                    const reply = await interaction.editReply({ 
                        components: [resumeContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    break;
                }

                case 'shuffle': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    if (player.queue.length === 0) {
                        const emptyQueueContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ EMPTY QUEUE**\nCannot shuffle an empty queue.\n\nAdd some tracks first with `/music play`.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [emptyQueueContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                        return;
                    }
                    
                    player.queue.shuffle();
                    
                    const shuffleContainer = new ContainerBuilder()
                        .setAccentColor(0xe91e63)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🔀 QUEUE SHUFFLED**\nThe music queue has been shuffled randomly.\n\n**Queue Info:**\n• Total Tracks: ' + player.queue.length + '\n• Order: Randomized\n• Next Up: ' + (player.queue[0]?.info.title || 'None'))
                        );

                    const reply = await interaction.editReply({ 
                        components: [shuffleContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 6000);
                    break;
                }

                case 'skip': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const currentTrack = player.current;
                    player.stop();
                    
                    const skipContainer = new ContainerBuilder()
                        .setAccentColor(0x3498db)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**⏭️ TRACK SKIPPED**\n' + (currentTrack ? `Skipped: **${currentTrack.info.title}**` : 'Current track has been skipped.') + '\n\nMoving to the next track in queue...')
                        );

                    const reply = await interaction.editReply({ 
                        components: [skipContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    break;
                }

                case 'stop': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const queueLength = player.queue.length;
                    player.destroy();
                    
                    const stopContainer = new ContainerBuilder()
                        .setAccentColor(0xe74c3c)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**⏹️ MUSIC STOPPED**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**Playback has been completely stopped.**\n\n**Actions Performed:**\n• Music playback stopped\n• Queue cleared (${queueLength} tracks removed)\n• Player disconnected from voice channel\n• All resources cleaned up\n\nUse \`/music play\` to start a new session.`)
                        );

                    const reply = await interaction.editReply({ 
                        components: [stopContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 8000);
                    break;
                }

                case 'queue': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const queue = player.queue;
                    if (!queue || queue.length === 0) {
                        const emptyQueueContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ EMPTY QUEUE**\nThe music queue is currently empty.\n\nAdd tracks with `/music play` to see them here.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [emptyQueueContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                        return;
                    }
                    
                  
                    const formattedQueue = queue.slice(0, 15).map((track, i) => 
                        `**${i + 1}.** ${track.info.title}\n> *Requested by ${track.requester?.username || 'Unknown'}*`
                    ).join('\n\n');
                    
                    const queueContainer = new ContainerBuilder()
                        .setAccentColor(0xdc92ff)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🎶 MUSIC QUEUE**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**Queue Information:**\n• Total Tracks: **${queue.length}**\n• Estimated Duration: **~${Math.round(queue.length * 3.5)} minutes**\n• Loop Mode: **${player.loop || 'None'}**\n• Shuffle: ${player.queue.shuffled ? '✅ On' : '❌ Off'}`)
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**📋 Up Next:**\n\n${formattedQueue}${queue.length > 15 ? `\n\n*...and ${queue.length - 15} more tracks*` : ''}`)
                        );
                    
                    const reply = await interaction.editReply({ 
                        components: [queueContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 15000);
                    break;
                }

                case 'loop': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const mode = interaction.options.getString('mode');
                    
                    try {
                        player.setLoop(mode);
                        
                        const loopContainer = new ContainerBuilder()
                            .setAccentColor(0x9c27b0)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🔄 LOOP MODE UPDATED**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**Loop mode set to: ${mode.toUpperCase()}**\n\n**Mode Details:**\n${this.getLoopModeDescription(mode)}\n\n**Current Status:**\n• Active: ${mode !== 'none' ? '✅ Yes' : '❌ No'}\n• Type: ${mode === 'track' ? '🔂 Single Track' : mode === 'queue' ? '🔁 Entire Queue' : '➡️ No Loop'}`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [loopContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 8000);
                    } catch (error) {
                        console.error('Error setting loop mode:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ LOOP ERROR**\nFailed to set loop mode.\n\nPlease try again or contact support.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'remove': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const trackNumber = interaction.options.getInteger('track');
                    if (trackNumber < 1 || trackNumber > player.queue.length) {
                        const invalidContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**❌ INVALID TRACK NUMBER**\nTrack number must be between 1 and ${player.queue.length}.\n\nUse \`/music queue\` to see valid track numbers.`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [invalidContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 6000);
                        return;
                    }
                    
                    const removedTrack = player.queue[trackNumber - 1];
                    player.queue.remove(trackNumber - 1);
                    
                    const removeContainer = new ContainerBuilder()
                        .setAccentColor(0xe74c3c)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🗑️ TRACK REMOVED**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**Removed from queue:**\n**${removedTrack.info.title}**\n\n**Details:**\n• Position: #${trackNumber}\n• Requested by: ${removedTrack.requester?.username || 'Unknown'}\n• Remaining tracks: ${player.queue.length}`)
                        );

                    const reply = await interaction.editReply({ 
                        components: [removeContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 7000);
                    break;
                }

                case 'volume': {
                    const player = await checkPlayerExists();
                    if (!player) return;
                    
                    const volume = interaction.options.getInteger('level');
                    if (volume < 0 || volume > 100) {
                        const invalidVolumeContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ INVALID VOLUME**\nVolume must be between 0 and 100.\n\nPlease enter a valid volume level.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [invalidVolumeContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                        return;
                    }
                    
                    const oldVolume = player.volume;
                    player.setVolume(volume);
                    
                    const volumeContainer = new ContainerBuilder()
                        .setAccentColor(0x2196f3)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent('**🔊 VOLUME ADJUSTED**')
                        )
                        .addSeparatorComponents(separator => separator)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**Volume changed from ${oldVolume}% to ${volume}%**\n\n**Audio Level:**\n${this.getVolumeBar(volume)}\n\n**Status:**\n• Current: ${volume}%\n• Quality: ${volume > 80 ? 'High' : volume > 40 ? 'Medium' : 'Low'}\n• ${volume === 0 ? '🔇 Muted' : volume > 75 ? '🔊 Loud' : volume > 25 ? '🔉 Medium' : '🔈 Quiet'}`)
                        );

                    const reply = await interaction.editReply({ 
                        components: [volumeContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 8000);
                    break;
                }

                case 'createplaylist': {
                    try {
                        const name = interaction.options.getString('name');
                        const visibility = interaction.options.getString('visibility');

                        const existingPlaylist = await playlistCollection.findOne({ name, owner: userId });
                        if (existingPlaylist) {
                            const existsContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST EXISTS**\nA playlist named **"${name}"** already exists in your collection.\n\nPlease choose a different name or delete the existing playlist first.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [existsContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }

                        await playlistCollection.insertOne({
                            name,
                            owner: userId,
                            visibility,
                            songs: [],
                            createdAt: new Date()
                        });

                        const createContainer = new ContainerBuilder()
                            .setAccentColor(0x2ecc71)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**📋 PLAYLIST CREATED**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addSectionComponents(
                                section => section
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent(`**${name}** has been created successfully!\n\n**Details:**\n• Name: **${name}**\n• Visibility: **${visibility.toUpperCase()}**\n• Owner: ${interaction.user.username}\n• Songs: 0 (empty)\n• Status: Ready for tracks\n\n**Next Steps:**\n• Use \`/music addsong\` to add tracks\n• Use \`/music playplaylist\` to play it`)
                                    )
                                    .setThumbnailAccessory(
                                        thumbnail => thumbnail
                                            .setURL(interaction.user.displayAvatarURL({ dynamic: true }))
                                            .setDescription('Created by')
                                    )
                            );

                        const reply = await interaction.editReply({ 
                            components: [createContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 10000);
                    } catch (error) {
                        console.error('Error creating playlist:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ CREATION FAILED**\nFailed to create playlist due to a database error.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'playplaylist': {
                    if (!await checkVoiceChannel()) return;
                    
                    try {
                        const name = interaction.options.getString('name');
                        const playlist = await playlistCollection.findOne({ name });
                    
                        if (!playlist) {
                            const notFoundContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST NOT FOUND**\nPlaylist **"${name}"** doesn't exist.\n\nUse \`/music viewmyplaylists\` to see available playlists.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [notFoundContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                    
                        if (playlist.visibility === 'private' && playlist.owner !== userId) {
                            const privateContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PRIVATE PLAYLIST**\nYou don't have permission to play this private playlist.\n\nOnly the owner can access private playlists.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [privateContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                    
                        if (playlist.songs.length === 0) {
                            const emptyContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ EMPTY PLAYLIST**\nPlaylist **"${name}"** contains no songs.\n\nUse \`/music addsong\` to add tracks first.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [emptyContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                    
                        let player = await getOrCreatePlayer();
                        if (!player) return;
                    
                      
                        const loadingContainer = new ContainerBuilder()
                            .setAccentColor(0xffa500)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🔄 LOADING PLAYLIST**\nResolving ${playlist.songs.length} tracks from **${name}**...\n\nThis may take a moment for large playlists.`)
                            );

                        await interaction.editReply({ 
                            components: [loadingContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                    
                    
                        let addedTracks = 0;
                        let failedTracks = 0;
                        
                        for (const song of playlist.songs) {
                            try {
                                const resolve = await client.riffy.resolve({ query: song, requester: interaction.user });
                    
                                if (resolve.tracks.length > 0) {
                                    const track = resolve.tracks[0];
                                    track.requester = {
                                        id: interaction.user.id,
                                        username: interaction.user.username,
                                        avatarURL: interaction.user.displayAvatarURL()
                                    };
                                    player.queue.add(track);
                                    addedTracks++;
                                } else {
                                    failedTracks++;
                                }
                            } catch (error) {
                                console.warn(`Failed to resolve track: ${song}`, error);
                                failedTracks++;
                            }
                        }
                    
                        if (addedTracks === 0) {
                            const noTracksContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST LOAD FAILED**\nCouldn't resolve any valid tracks from **"${name}"**.\n\nTracks may be unavailable or URLs may be invalid.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [noTracksContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 8000);
                            return;
                        }
                    
                        const playlistContainer = new ContainerBuilder()
                            .setAccentColor(0x2ecc71)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**📋 PLAYLIST LOADED**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addSectionComponents(
                                section => section
                                    .addTextDisplayComponents(
                                        textDisplay => textDisplay.setContent(`**${name}** is now playing!\n\n**Loading Summary:**\n• ✅ Successfully loaded: **${addedTracks}** tracks\n${failedTracks > 0 ? `• ❌ Failed to load: **${failedTracks}** tracks\n` : ''}• 🎵 Now in queue: **${player.queue.length}** total\n• ⏱️ Estimated duration: **~${Math.round(addedTracks * 3.5)} minutes**\n\n**Status:** ${player.playing ? 'Playing' : 'Starting playback...'}`
                                        )
                                    )
                                    .setThumbnailAccessory(
                                        thumbnail => thumbnail
                                            .setURL(interaction.user.displayAvatarURL({ dynamic: true }))
                                            .setDescription('Requested by')
                                    )
                            );

                        const reply = await interaction.editReply({ 
                            components: [playlistContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 12000);
                        
                        if (!player.playing && !player.paused) {
                            player.play();
                        }
                    } catch (error) {
                        console.error('Error playing playlist:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ PLAYLIST ERROR**\nFailed to play playlist due to an unexpected error.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 6000);
                    }
                    break;
                }

                case 'viewmyplaylists': {
                    try {
                        const playlists = await playlistCollection.find({ owner: userId }).toArray();
                        if (playlists.length === 0) {
                            const noPlaylistsContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**📋 NO PLAYLISTS FOUND**\nYou haven\'t created any playlists yet.\n\nUse `/music createplaylist` to create your first playlist!')
                                );

                            const reply = await interaction.editReply({ 
                                components: [noPlaylistsContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }

                        const playlistList = playlists.map(p => 
                            `**📋 ${p.name}**\n> *${p.visibility === 'public' ? '🌍 Public' : '🔒 Private'} • ${p.songs.length} songs*`
                        ).join('\n\n');

                        const myPlaylistsContainer = new ContainerBuilder()
                            .setAccentColor(0x3498db)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🎶 YOUR PLAYLISTS**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**You have ${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}**\n\n${playlistList}`)
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**💡 Quick Actions:**\n• `/music playplaylist` - Play a playlist\n• `/music viewmyplaylistsongs` - View songs\n• `/music addsong` - Add more tracks\n• `/music deleteplaylist` - Remove playlist')
                            );

                        const reply = await interaction.editReply({ 
                            components: [myPlaylistsContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 15000);
                    } catch (error) {
                        console.error('Error viewing playlists:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ LOAD ERROR**\nFailed to retrieve your playlists.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'viewmyplaylistsongs': {
                    try {
                        const playlistName = interaction.options.getString('name');
                        const playlist = await playlistCollection.findOne({ name: playlistName });
            
                        if (!playlist) {
                            const notFoundContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST NOT FOUND**\nPlaylist **"${playlistName}"** doesn't exist.\n\nCheck the name and try again.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [notFoundContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
            
                        if (playlist.visibility === 'private' && playlist.owner !== userId) {
                            const privateContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ ACCESS DENIED**\nYou don't have permission to view this private playlist.\n\nOnly the owner can view private playlist contents.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [privateContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
            
                        if (playlist.songs.length === 0) {
                            const emptyContainer = new ContainerBuilder()
                                .setAccentColor(0xffa500)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**📋 EMPTY PLAYLIST**\nPlaylist **"${playlistName}"** contains no songs yet.\n\nUse \`/music addsong\` to add some tracks!`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [emptyContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
            
                        const songList = playlist.songs.slice(0, 15).map((song, index) => 
                            `**${index + 1}.** ${song}`
                        ).join('\n');
            
                        const songsContainer = new ContainerBuilder()
                            .setAccentColor(0x3498db)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**🎵 SONGS IN "${playlistName.toUpperCase()}"**`)
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**Playlist Details:**\n• Total Songs: **${playlist.songs.length}**\n• Owner: ${playlist.owner === userId ? 'You' : '<@' + playlist.owner + '>'}\n• Visibility: **${playlist.visibility === 'public' ? '🌍 Public' : '🔒 Private'}**\n• Created: ${playlist.createdAt ? new Date(playlist.createdAt).toLocaleDateString() : 'Unknown'}`)
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**📋 Track List:**\n\n${songList}${playlist.songs.length > 15 ? `\n\n*...and ${playlist.songs.length - 15} more songs*` : ''}`)
                            );
            
                        const reply = await interaction.editReply({ 
                            components: [songsContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 20000);
                    } catch (error) {
                        console.error('Error viewing playlist songs:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ LOAD ERROR**\nFailed to retrieve playlist songs.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'allplaylists': {
                    try {
                        const playlists = await playlistCollection.find({ visibility: 'public' }).toArray();
                        if (playlists.length === 0) {
                            const noPublicContainer = new ContainerBuilder()
                                .setAccentColor(0xffa500)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**🌍 NO PUBLIC PLAYLISTS**\nThere are currently no public playlists available.\n\nBe the first to create and share a public playlist!')
                                );

                            const reply = await interaction.editReply({ 
                                components: [noPublicContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }

                        const publicList = playlists.slice(0, 20).map(p => 
                            `**📋 ${p.name}**\n> *Owner: <@${p.owner}> • ${p.songs.length} songs*`
                        ).join('\n\n');

                        const allPlaylistsContainer = new ContainerBuilder()
                            .setAccentColor(0x2ecc71)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🌍 PUBLIC PLAYLISTS**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**${playlists.length} public playlist${playlists.length !== 1 ? 's' : ''} available**\n\nAnyone can play these playlists using \`/music playplaylist\``)
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**📋 Available Playlists:**\n\n${publicList}${playlists.length > 20 ? `\n\n*...and ${playlists.length - 20} more playlists*` : ''}`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [allPlaylistsContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 25000);
                    } catch (error) {
                        console.error('Error retrieving public playlists:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ LOAD ERROR**\nFailed to retrieve public playlists.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'deletesong': {
                    try {
                        const playlistName = interaction.options.getString('playlist');
                        const songIndex = interaction.options.getInteger('index') - 1; 
                        
                        const playlist = await playlistCollection.findOne({ name: playlistName });
                        
                        if (!playlist) {
                            const notFoundContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST NOT FOUND**\nPlaylist **"${playlistName}"** doesn't exist.\n\nCheck the name and try again.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [notFoundContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                        
                        if (playlist.owner !== userId) {
                            const noPermissionContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**❌ NO PERMISSION**\nYou can only delete songs from your own playlists.\n\nThis playlist belongs to another user.')
                                );

                            const reply = await interaction.editReply({ 
                                components: [noPermissionContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                        
                        if (songIndex < 0 || songIndex >= playlist.songs.length) {
                            const invalidIndexContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ INVALID SONG INDEX**\nSong index must be between 1 and ${playlist.songs.length}.\n\nUse \`/music viewmyplaylistsongs\` to see valid indices.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [invalidIndexContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 7000);
                            return;
                        }
                        
                        const removedSong = playlist.songs[songIndex];
                        
                     
                        playlist.songs.splice(songIndex, 1);
                        
                        await playlistCollection.updateOne(
                            { name: playlistName, owner: userId },
                            { $set: { songs: playlist.songs } }
                        );
                        
                        const deleteSongContainer = new ContainerBuilder()
                            .setAccentColor(0xe74c3c)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🗑️ SONG REMOVED**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**Successfully removed song from playlist!**\n\n**Removed Song:**\n${removedSong}\n\n**Playlist:** ${playlistName}\n**Remaining Songs:** ${playlist.songs.length}\n**Position:** #${songIndex + 1}`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [deleteSongContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 8000);
                    } catch (error) {
                        console.error('Error deleting song from playlist:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ DELETE ERROR**\nFailed to delete song from playlist.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'deleteplaylist': {
                    try {
                        const playlistName = interaction.options.getString('name');
                        
                        const playlist = await playlistCollection.findOne({ name: playlistName });
                        
                        if (!playlist) {
                            const notFoundContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST NOT FOUND**\nPlaylist **"${playlistName}"** doesn't exist.\n\nCheck the name and try again.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [notFoundContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                        
                        if (playlist.owner !== userId) {
                            const noPermissionContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent('**❌ NO PERMISSION**\nYou can only delete your own playlists.\n\nThis playlist belongs to another user.')
                                );

                            const reply = await interaction.editReply({ 
                                components: [noPermissionContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
                        
                        await playlistCollection.deleteOne({ name: playlistName, owner: userId });
                        
                        const deletePlaylistContainer = new ContainerBuilder()
                            .setAccentColor(0xe74c3c)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🗑️ PLAYLIST DELETED**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**Playlist permanently removed!**\n\n**Deleted:** ${playlistName}\n**Songs Lost:** ${playlist.songs.length}\n**Type:** ${playlist.visibility} playlist\n\n**⚠️ This action cannot be undone.**\n\nYou can create a new playlist with the same name if needed.`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [deletePlaylistContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 10000);
                    } catch (error) {
                        console.error('Error deleting playlist:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ DELETE ERROR**\nFailed to delete playlist.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'autoplay': {
                    if (!await checkVoiceChannel()) return;
                    
                    try {
                        const enable = interaction.options.getBoolean('enabled');
                        await autoplayCollection.updateOne(
                            { guildId },
                            { $set: { autoplay: enable, updatedAt: new Date() } },
                            { upsert: true }
                        );
                    
                        const autoplayContainer = new ContainerBuilder()
                            .setAccentColor(enable ? 0x2ecc71 : 0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**🔄 AUTOPLAY SETTINGS**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**Autoplay is now ${enable ? 'ENABLED' : 'DISABLED'}**\n\n**What this means:**\n${enable ? '• Automatic queue replenishment\n• Continuous music playback\n• Smart song suggestions\n• No manual intervention needed' : '• Queue stops when empty\n• Manual track addition required\n• Playback ends after last song\n• Full user control'}\n\n**Status:** ${enable ? '✅ Active' : '❌ Inactive'}`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [autoplayContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                    
                        setTimeout(() => reply.delete().catch(() => {}), 8000);
                        
                       
                        const player = client.riffy.players.get(guildId);
                        if (player) {
                            player.autoplay = enable;
                        }
                    } catch (error) {
                        console.error('Error setting autoplay:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ AUTOPLAY ERROR**\nFailed to set autoplay status.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                case 'addsong': {
                    try {
                        const playlistName = interaction.options.getString('playlist');
                        const songInput = interaction.options.getString('song'); 
            
                        const playlist = await playlistCollection.findOne({ name: playlistName });
            
                        if (!playlist) {
                            const notFoundContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ PLAYLIST NOT FOUND**\nPlaylist **"${playlistName}"** doesn't exist.\n\nUse \`/music viewmyplaylists\` to see available playlists.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [notFoundContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 6000);
                            return;
                        }
            
                        if (playlist.owner !== userId && playlist.visibility === 'private') {
                            const noPermissionContainer = new ContainerBuilder()
                                .setAccentColor(0xff4757)
                                .addTextDisplayComponents(
                                    textDisplay => textDisplay.setContent(`**❌ ACCESS DENIED**\nYou don't have permission to add songs to this private playlist.\n\nOnly the owner can modify private playlists.`)
                                );

                            const reply = await interaction.editReply({ 
                                components: [noPermissionContainer], 
                                flags: MessageFlags.IsComponentsV2 
                            });
                            setTimeout(() => reply.delete().catch(() => {}), 7000);
                            return;
                        }
            
                      
                        await playlistCollection.updateOne(
                            { name: playlistName },
                            { 
                                $push: { songs: songInput },
                                $set: { updatedAt: new Date() }
                            }
                        );
            
                        const addSongContainer = new ContainerBuilder()
                            .setAccentColor(0x2ecc71)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**➕ SONG ADDED**')
                            )
                            .addSeparatorComponents(separator => separator)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent(`**Successfully added to playlist!**\n\n**Song:** ${songInput}\n**Playlist:** ${playlistName}\n**Total Songs:** ${playlist.songs.length + 1}\n**Added by:** ${interaction.user.username}\n\n**Quick Actions:**\n• \`/music playplaylist\` - Play this playlist\n• \`/music viewmyplaylistsongs\` - View all songs`)
                            );

                        const reply = await interaction.editReply({ 
                            components: [addSongContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 10000);
                    } catch (error) {
                        console.error('Error adding song to playlist:', error);
                        
                        const errorContainer = new ContainerBuilder()
                            .setAccentColor(0xff4757)
                            .addTextDisplayComponents(
                                textDisplay => textDisplay.setContent('**❌ ADD ERROR**\nFailed to add song to playlist.\n\nPlease try again later.')
                            );

                        const reply = await interaction.editReply({ 
                            components: [errorContainer], 
                            flags: MessageFlags.IsComponentsV2 
                        });
                        setTimeout(() => reply.delete().catch(() => {}), 5000);
                    }
                    break;
                }

                default:
                    const unknownContainer = new ContainerBuilder()
                        .setAccentColor(0xff4757)
                        .addTextDisplayComponents(
                            textDisplay => textDisplay.setContent(`**❌ UNKNOWN COMMAND**\nSubcommand **"${subcommand}"** is not recognized.\n\nPlease check the command and try again.`)
                        );

                    const reply = await interaction.editReply({ 
                        components: [unknownContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                    setTimeout(() => reply.delete().catch(() => {}), 5000);
                    break;
            }
        } catch (error) {
            console.error('Music command error:', error);
        
            const criticalErrorContainer = new ContainerBuilder()
                .setAccentColor(0xff4757)
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('**❌ CRITICAL ERROR**')
                )
                .addSeparatorComponents(separator => separator)
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('**An unexpected error occurred while processing your music command.**\n\nThis could be due to:\n• Network connectivity issues\n• Database connection problems\n• Lavalink server unavailable\n• Discord API limitations')
                )
                .addSeparatorComponents(separator => separator)
                .addTextDisplayComponents(
                    textDisplay => textDisplay.setContent('**🔧 Recommended Actions:**\n• Try again in a few moments\n• Check your internet connection\n• Verify voice channel permissions\n• Contact support if issue persists\n\n*Error has been logged for investigation*')
                );

            try {
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ 
                        components: [criticalErrorContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                } else {
                    await interaction.reply({ 
                        components: [criticalErrorContainer], 
                        flags: MessageFlags.IsComponentsV2 
                    });
                }
            } catch (replyError) {
                console.error('Failed to send error message:', replyError);
            }
        }
    },


    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
        }
    },

    getLoopModeDescription(mode) {
        const descriptions = {
            'none': '• Music will play through the queue once\n• No tracks will repeat automatically\n• Queue ends when last track finishes',
            'track': '• Current track will repeat indefinitely\n• Same song plays over and over\n• Perfect for favorite tracks',
            'queue': '• Entire queue repeats when finished\n• Continuous playlist playback\n• All tracks cycle through repeatedly'
        };
        return descriptions[mode] || 'Unknown loop mode';
    },

    getVolumeBar(volume) {
        const barLength = 20;
        const filledLength = Math.round((volume / 100) * barLength);
        const emptyLength = barLength - filledLength;
        return '█'.repeat(filledLength) + '░'.repeat(emptyLength) + ` ${volume}%`;
    }
};

/*
 ██████╗ ██╗      █████╗  ██████╗███████╗██╗   ██╗████████╗
██╔════╝ ██║     ██╔══██╗██╔════╝██╔════╝╚██╗ ██╔╝╚══██╔══╝
██║  ███╗██║     ███████║██║     █████╗   ╚████╔╝    ██║   
██║   ██║██║     ██╔══██║██║     ██╔══╝    ╚██╔╝     ██║   
╚██████╔╝███████╗██║  ██║╚██████╗███████╗   ██║      ██║   
 ╚═════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚══════╝   ╚═╝      ╚═╝   

-------------------------------------
📡 Discord : https://discord.gg/xQF9f9yUEM
🌐 Website : https://glaceyt.com
🎥 YouTube : https://youtube.com/@GlaceYT
✅ Verified | 🧩 Tested | ⚙️ Stable
-------------------------------------
> © 2025 GlaceYT.com | All rights reserved.
*/