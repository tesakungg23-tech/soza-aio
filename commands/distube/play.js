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
require('dotenv').config();
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ButtonStyle } = require('discord.js');
const ytSearch = require('yt-search');
const { maximizeVoiceChannelBitrate } = require('../../utils/voiceQuality');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('distube')
    .setDescription('Complete music control system.')
    .addSubcommand(subcommand =>
      subcommand
        .setName('play')
        .setDescription('Search for and play a song.')
        .addStringOption(option =>
          option.setName('query')
            .setDescription('The song to search for')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('url')
        .setDescription('Play a song from URL.')
        .addStringOption(option =>
          option.setName('url')
            .setDescription('YouTube URL to play')
            .setRequired(true)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('pause')
        .setDescription('Pause the current song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('resume')
        .setDescription('Resume the paused song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('skip')
        .setDescription('Skip the current song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('stop')
        .setDescription('Stop playing and clear the queue.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('nowplaying')
        .setDescription('Show currently playing song.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('queue')
        .setDescription('Show the music queue.')
        .addIntegerOption(option =>
          option.setName('page')
            .setDescription('Page number to view')
            .setMinValue(1)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('loop')
        .setDescription('Toggle loop mode.')
        .addStringOption(option =>
          option.setName('mode')
            .setDescription('Loop mode')
            .setRequired(true)
            .addChoices(
              { name: 'Off', value: '0' },
              { name: 'Song', value: '1' },
              { name: 'Queue', value: '2' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('volume')
        .setDescription('Set the volume.')
        .addIntegerOption(option =>
          option.setName('level')
            .setDescription('Volume level (1-100)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(100)))
    .addSubcommand(subcommand =>
      subcommand
        .setName('shuffle')
        .setDescription('Shuffle the queue.'))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a song from queue.')
        .addIntegerOption(option =>
          option.setName('position')
            .setDescription('Position in queue to remove')
            .setRequired(true)
            .setMinValue(1))),

  // Helper function to auto-delete messages after timeout
  async autoDeleteMessage(message, timeout = 3000) {
    setTimeout(async () => {
      try {
        if (message && message.deletable) {
          await message.delete();
        }
      } catch (error) {
        console.log('Could not delete message:', error.message);
      }
    }, timeout);
  },

  async execute(interaction) {
    await interaction.deferReply();
    
    const subcommand = interaction.options.getSubcommand();
    const query = interaction.options.getString('query') || interaction.options.getString('url');
    const channel = interaction.member.voice.channel;
    const distube = interaction.client.distube;

    // Commands that don't require voice channel
    if (['queue', 'nowplaying'].includes(subcommand)) {
      const queue = distube.getQueue(interaction.guild.id);
      
      if (subcommand === 'queue') {
        if (!queue || !queue.songs.length) {
          const message = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 The queue is empty.')],
          });
          this.autoDeleteMessage(message, 7000); // Queue messages stay for 7 seconds
          return;
        }

        const songsPerPage = 10;
        const page = interaction.options.getInteger('page') || 1;
        const totalPages = Math.ceil(queue.songs.length / songsPerPage);
        
        if (page > totalPages) {
          const message = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription(`🚫 Page ${page} doesn't exist. Total pages: ${totalPages}`)],
            ephemeral: true,
          });
          this.autoDeleteMessage(message, 7000);
          return;
        }

        const startIndex = (page - 1) * songsPerPage;
        const endIndex = Math.min(startIndex + songsPerPage, queue.songs.length);
        const pageSongs = queue.songs.slice(startIndex, endIndex);

        const embed = new EmbedBuilder()
          .setTitle(`🎵 Music Queue - Page ${page}/${totalPages}`)
          .setColor('#00FF00')
          .setDescription(`**Total Songs:** ${queue.songs.length}\n**Total Duration:** ${queue.formattedDuration}\n\n`);

        pageSongs.forEach((song, index) => {
          const position = startIndex + index + 1;
          const isCurrentSong = position === 1;
          const prefix = isCurrentSong ? '🎶 **[NOW PLAYING]**' : `**${position}.**`;
          
          embed.addFields({
            name: `${prefix} ${song.name}`,
            value: `Duration: ${song.formattedDuration} | Requested by: ${song.user.displayName}`,
            inline: false,
          });
        });

        const components = [];
        if (totalPages > 1) {
          const row = new ActionRowBuilder();
          
          if (page > 1) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`queue_${page - 1}`)
                .setLabel('◀ Previous')
                .setStyle(ButtonStyle.Secondary)
            );
          }
          
          if (page < totalPages) {
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`queue_${page + 1}`)
                .setLabel('Next ▶')
                .setStyle(ButtonStyle.Secondary)
            );
          }
          
          if (row.components.length > 0) {
            components.push(row);
          }
        }

        const message = await interaction.followUp({ embeds: [embed], components });

        if (components.length > 0) {
          const collector = interaction.channel.createMessageComponentCollector({ 
            filter: i => i.customId.startsWith('queue_') && i.user.id === interaction.user.id,
            time: 60000 
          });

          collector.on('collect', async i => {
            const newPage = parseInt(i.customId.split('_')[1]);
            
            const newStartIndex = (newPage - 1) * songsPerPage;
            const newEndIndex = Math.min(newStartIndex + songsPerPage, queue.songs.length);
            const newPageSongs = queue.songs.slice(newStartIndex, newEndIndex);

            const newEmbed = new EmbedBuilder()
              .setTitle(`🎵 Music Queue - Page ${newPage}/${totalPages}`)
              .setColor('#00FF00')
              .setDescription(`**Total Songs:** ${queue.songs.length}\n**Total Duration:** ${queue.formattedDuration}\n\n`);

            newPageSongs.forEach((song, index) => {
              const position = newStartIndex + index + 1;
              const isCurrentSong = position === 1;
              const prefix = isCurrentSong ? '🎶 **[NOW PLAYING]**' : `**${position}.**`;
              
              newEmbed.addFields({
                name: `${prefix} ${song.name}`,
                value: `Duration: ${song.formattedDuration} | Requested by: ${song.user.displayName}`,
                inline: false,
              });
            });

            const newComponents = [];
            const newRow = new ActionRowBuilder();
            
            if (newPage > 1) {
              newRow.addComponents(
                new ButtonBuilder()
                  .setCustomId(`queue_${newPage - 1}`)
                  .setLabel('◀ Previous')
                  .setStyle(ButtonStyle.Secondary)
              );
            }
            
            if (newPage < totalPages) {
              newRow.addComponents(
                new ButtonBuilder()
                  .setCustomId(`queue_${newPage + 1}`)
                  .setLabel('Next ▶')
                  .setStyle(ButtonStyle.Secondary)
              );
            }
            
            if (newRow.components.length > 0) {
              newComponents.push(newRow);
            }

            await i.update({ embeds: [newEmbed], components: newComponents });
          });

          collector.on('end', () => {
            const disabledComponents = components.map(row => 
              new ActionRowBuilder().addComponents(
                row.components.map(button => ButtonBuilder.from(button).setDisabled(true))
              )
            );
            message.edit({ components: disabledComponents }).catch(() => {});
            // Auto-delete queue message after 7 seconds
            this.autoDeleteMessage(message, 7000);
          });
        } else {
          // Auto-delete queue message after 7 seconds if no pagination
          this.autoDeleteMessage(message, 7000);
        }

        return;
      }

      if (subcommand === 'nowplaying') {
        if (!queue || !queue.songs.length) {
          const message = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
          });
          this.autoDeleteMessage(message);
          return;
        }

        const song = queue.songs[0];
        const embed = new EmbedBuilder()
          .setTitle('🎶 Now Playing')
          .setDescription(`**${song.name}**`)
          .addFields(
            { name: '👤 Artist', value: song.uploader.name || 'Unknown', inline: true },
            { name: '⏱️ Duration', value: song.formattedDuration, inline: true },
            { name: '🎵 Requested by', value: song.user.displayName, inline: true },
            { name: '🔁 Loop Mode', value: this.getLoopModeText(queue.repeatMode), inline: true },
            { name: '🔊 Volume', value: `${queue.volume}%`, inline: true },
            { name: '⏸️ Status', value: queue.paused ? 'Paused' : 'Playing', inline: true }
          )
          .setColor('#FF00FF')
          .setTimestamp();

        if (song.thumbnail) embed.setThumbnail(song.thumbnail);

        const message = await interaction.followUp({ embeds: [embed] });
        this.autoDeleteMessage(message);
        return;
      }
    }

    // Commands that require voice channel
    if (!channel) {
      const message = await interaction.followUp({
        embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 You need to be in a voice channel to use music commands.')],
        ephemeral: true,
      });
      this.autoDeleteMessage(message);
      return;
    }

    await maximizeVoiceChannelBitrate(channel);

    const queue = distube.getQueue(interaction.guild.id);

    try {
      switch (subcommand) {
        case 'play':
        case 'url':
          if (subcommand === 'play') {
            const searchResult = await ytSearch(query);

            if (!searchResult || !searchResult.videos.length) {
              const message = await interaction.followUp({
                embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 No songs found for your query.')],
              });
              this.autoDeleteMessage(message);
              return;
            }

            const videos = searchResult.videos.slice(0, 3);

            const embed = new EmbedBuilder()
              .setTitle('Search Results')
              .setDescription('Select a song to play:')
              .setColor('#ff00ff');
            
            videos.forEach((video, index) => {
              embed.addFields({
                name: `${index + 1}. ${video.title}`,
                value: `Duration: ${video.timestamp} | ${video.author.name}`,
                inline: false,
              });
            });
            
            const row1 = new ActionRowBuilder();
            
            videos.forEach((video, index) => {
              row1.addComponents(
                new ButtonBuilder()
                  .setCustomId(`play_${index}`)
                  .setLabel(`${index + 1}`)
                  .setStyle(ButtonStyle.Primary)
              );
            });
            
            const sentMessage = await interaction.followUp({ embeds: [embed], components: [row1] });
            
            const filter = i => i.customId.startsWith('play_') && i.user.id === interaction.user.id;
            const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });

            collector.on('collect', async i => {
              try {
                const disabledRow = new ActionRowBuilder().addComponents(
                  row1.components.map(button => 
                    ButtonBuilder.from(button).setDisabled(true)
                  )
                );
                
                await i.update({ components: [disabledRow] });
                
                const [action, index] = i.customId.split('_');
                const selectedVideo = videos[parseInt(index)];

                if (selectedVideo) {
                  const queueMessage = await interaction.followUp({
                    embeds: [
                      new EmbedBuilder()
                        .setColor('#FF00FF')
                        .setDescription(`🎶 Queuing: **${selectedVideo.title}**...`),
                    ],
                  });
                  
                  try {
                    await distube.play(channel, selectedVideo.url, {
                      member: interaction.member,
                      textChannel: interaction.channel,
                      timeout: 60000,
                    });
                  } catch (playError) {
                    if (playError.errorCode === 'VOICE_CONNECT_FAILED') {
                      console.log('Voice connect failed, attempting to rejoin...');
                      await new Promise(resolve => setTimeout(resolve, 2000)); 
                      await distube.voices.join(channel);
                      await new Promise(resolve => setTimeout(resolve, 2000)); 
                      await distube.play(channel, selectedVideo.url, {
                        member: interaction.member,
                        textChannel: interaction.channel,
                        timeout: 60000,
                      });
                    } else {
                      throw playError; 
                    }
                  }
                  
                  const successMessage = await queueMessage.edit({
                    embeds: [
                      new EmbedBuilder()
                        .setColor('#00FF00')
                        .setDescription(`✅ Successfully queued: **${selectedVideo.title}**`),
                    ],
                  });
                  
                  // Auto-delete success message after 3 seconds
                  this.autoDeleteMessage(successMessage);
                } else {
                  const errorMessage = await interaction.followUp({
                    embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 The selected song could not be found.')],
                  });
                  this.autoDeleteMessage(errorMessage);
                }
              } catch (error) {
                console.error('Play Error:', error);
                const errorMessage = await interaction.followUp({
                  embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 An error occurred while trying to play the song.')],
                });
                this.autoDeleteMessage(errorMessage);
              }

              // Auto-delete the search results message after selection
              this.autoDeleteMessage(sentMessage);
              collector.stop();
            });

            collector.on('end', async collected => {
              if (!collected.size) {
                const timeoutRow = new ActionRowBuilder().addComponents(
                  row1.components.map(button => 
                    ButtonBuilder.from(button).setDisabled(true)
                  )
                );
                
                await sentMessage.edit({
                  embeds: [embed],
                  components: [timeoutRow]
                });
                
                const timeoutMessage = await interaction.followUp({
                  embeds: [new EmbedBuilder().setColor('#FFFFFF').setDescription('⚠️ You didn\'t select any song in time.')],
                });
                
                // Auto-delete both messages after timeout
                this.autoDeleteMessage(sentMessage);
                this.autoDeleteMessage(timeoutMessage);
              }
            });

          } else if (subcommand === 'url') {
            const queueMessage = await interaction.followUp({
              embeds: [
                new EmbedBuilder()
                  .setColor('#FF00FF')
                  .setDescription(`🎶 Loading song from URL...`),
              ],
            });

            try {
              await distube.play(channel, query, {
                member: interaction.member,
                textChannel: interaction.channel,
                timeout: 60000,
              });

              const successMessage = await queueMessage.edit({
                embeds: [
                  new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`✅ Successfully loaded song from URL!`),
                ],
              });
              this.autoDeleteMessage(successMessage);
            } catch (error) {
              console.error('URL Play Error:', error);
              const errorMessage = await queueMessage.edit({
                embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Failed to load song from URL. Please check if the URL is valid.')],
              });
              this.autoDeleteMessage(errorMessage);
            }
          }
          break;

        case 'pause':
          if (!queue) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (queue.paused) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('⏸️ The song is already paused.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.pause(interaction.guild.id);
          const pauseMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#FFA500').setDescription('⏸️ Paused the current song.')],
          });
          this.autoDeleteMessage(pauseMessage);
          break;

        case 'resume':
          if (!queue) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (!queue.paused) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('▶️ The song is not paused.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.resume(interaction.guild.id);
          const resumeMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#00FF00').setDescription('▶️ Resumed the current song.')],
          });
          this.autoDeleteMessage(resumeMessage);
          break;

        case 'skip':
          if (!queue || queue.songs.length === 0) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (queue.songs.length === 1) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 No more songs in the queue to skip to.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          const skippedSong = queue.songs[0];
          distube.skip(interaction.guild.id);
          const skipMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`⏭️ Skipped: **${skippedSong.name}**`)],
          });
          this.autoDeleteMessage(skipMessage);
          break;

        case 'stop':
          if (!queue) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.stop(interaction.guild.id);
          const stopMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#FF0000').setDescription('⏹️ Stopped playing and cleared the queue.')],
          });
          this.autoDeleteMessage(stopMessage);
          break;

        case 'loop':
          if (!queue) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          const mode = parseInt(interaction.options.getString('mode'));
          distube.setRepeatMode(interaction.guild.id, mode);
          const loopMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`🔁 Loop mode set to: **${this.getLoopModeText(mode)}**`)],
          });
          this.autoDeleteMessage(loopMessage);
          break;

        case 'volume':
          if (!queue) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Nothing is currently playing.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          const volume = interaction.options.getInteger('level');
          distube.setVolume(interaction.guild.id, volume);
          const volumeMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`🔊 Volume set to **${volume}%**`)],
          });
          this.autoDeleteMessage(volumeMessage);
          break;

        case 'shuffle':
          if (!queue || queue.songs.length <= 2) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Need at least 2 songs in queue to shuffle.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          distube.shuffle(interaction.guild.id);
          const shuffleMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#00FF00').setDescription('🔀 Shuffled the queue!')],
          });
          this.autoDeleteMessage(shuffleMessage);
          break;

        case 'remove':
          if (!queue || queue.songs.length <= 1) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 No songs in queue to remove.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          const position = interaction.options.getInteger('position');
          if (position === 1) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Cannot remove the currently playing song. Use skip instead.')],
            });
            this.autoDeleteMessage(message);
            return;
          }
          if (position > queue.songs.length) {
            const message = await interaction.followUp({
              embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription(`🚫 Position ${position} doesn't exist in queue.`)],
            });
            this.autoDeleteMessage(message);
            return;
          }
          const removedSong = queue.songs[position - 1];
          queue.songs.splice(position - 1, 1);
          const removeMessage = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#00FF00').setDescription(`🗑️ Removed: **${removedSong.name}** from position ${position}`)],
          });
          this.autoDeleteMessage(removeMessage);
          break;

        default:
          const message = await interaction.followUp({
            embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 Unknown command.')],
          });
          this.autoDeleteMessage(message);
          break;
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = await interaction.followUp({
        embeds: [new EmbedBuilder().setColor('#FFFF00').setDescription('🚫 An error occurred while processing your request.')],
      });
      this.autoDeleteMessage(errorMessage);
    }
  },

  getLoopModeText(mode) {
    switch (mode) {
      case 0: return 'Off';
      case 1: return 'Song';
      case 2: return 'Queue';
      default: return 'Unknown';
    }
  },
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