const { DisTube } = require('distube');
const { HighQualityYtDlpPlugin } = require('../utils/highQualityYtdlpPlugin');
const { Dynamic } = require('musicard');
const musicIcons = require('../UI/icons/musicicons');
const { EmbedBuilder } = require('discord.js');
const data = require('../UI/banners/musicard');

module.exports = async (client) => {
  
    const distubeConfig = require('../utils/distubeConfig'); 
    
    
    client.distube = new DisTube(client, {
        ...distubeConfig.distubeOptions,
        plugins: [
            new HighQualityYtDlpPlugin({
                update: false, 
            })
        ],
    });

    
    client.musicMessages = new Map(); 
    
  
    const addMessageForCleanup = (guildId, message) => {
        if (!client.musicMessages.has(guildId)) {
            client.musicMessages.set(guildId, []);
        }
        client.musicMessages.get(guildId).push(message);
    };
    
  
    const cleanupMessages = async (guildId, delay = 0) => {
        const messages = client.musicMessages.get(guildId);
        if (!messages || messages.length === 0) return;
        
        if (delay > 0) {
            setTimeout(async () => {
                await performCleanup(guildId, messages);
            }, delay);
        } else {
            await performCleanup(guildId, messages);
        }
    };
    
  
    const performCleanup = async (guildId, messages) => {
      //   console.log(`Cleaning up ${messages.length} music messages for guild ${guildId}`);
        
        for (const message of messages) {
            try {
                if (message && !message.deleted) {
                    await message.delete();
                }
            } catch (error) {
                // err
            }
        }
        
       
        client.musicMessages.set(guildId, []);
    };

   
    client.playMusic = async (channel, query, options = {}) => {
        try {
         //    console.log(`Attempting to play: ${query} in channel: ${channel.name}`);
            
          
            const connection = await client.distube.voices.join(channel);
         //    console.log(`Successfully joined voice channel: ${channel.name}`);
            
        
            await new Promise(resolve => setTimeout(resolve, 500));
            
        
            const queue = await client.distube.play(channel, query, {
                textChannel: options.textChannel || null,
                member: options.member || null,
                ...options
            });
            
          //   console.log(`Successfully started playing: ${query}`);
            return queue;
            
        } catch (error) {
         //    console.error('Error in playMusic function:', error);
            
          
            if (error.message.includes('VOICE_CONNECT_FAILED') || error.message.includes('connection')) {
             //    console.log('Retrying connection...');
                try {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const connection = await client.distube.voices.join(channel);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    const queue = await client.distube.play(channel, query, {
                        textChannel: options.textChannel || null,
                        member: options.member || null,
                        ...options
                    });
                    
                  //   console.log(`Successfully played after retry: ${query}`);
                    return queue;
                    
                } catch (retryError) {
              //       console.error('Retry failed:', retryError);
                    throw retryError;
                }
            }
            throw error;
        }
    };

   
    client.distube.on('playSong', async (queue, song) => {
     //    console.log(`Now playing: ${song.name} in ${queue.voiceChannel?.name}`);
        

        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            try {
                const musicCard = await generateMusicCard(song);
                const embed = {
                    color: 0xDC92FF,
                    author: {
                        name: 'Now playing',
                        url: 'https://discord.gg/xQF9f9yUEM',
                        icon_url: musicIcons.playerIcon
                    },
                    description: `- Song name: **${song.name}** \n- Duration: **${song.formattedDuration}**\n- Requested by: ${song.user}`,
                    image: {
                        url: 'attachment://musicCard.png'
                    },
                    footer: {
                        text: 'Distube Player',
                        icon_url: musicIcons.footerIcon
                    },
                    timestamp: new Date().toISOString()
                };
                
                const message = await queue.textChannel.send({ 
                    embeds: [embed], 
                    files: [{ attachment: musicCard, name: 'musicCard.png' }] 
                });
                
             
                addMessageForCleanup(queue.voiceChannel.guild.id, message);
                
            } catch (error) {
             //    console.error('Error sending music card:', error);
                
           
                const fallbackEmbed = new EmbedBuilder()
                    .setColor(0xDC92FF)
                    .setAuthor({ name: 'Now playing', iconURL: musicIcons.playerIcon })
                    .setDescription(`🎶 **${song.name}**\n⏱️ Duration: **${song.formattedDuration}**\n👤 Requested by: ${song.user}`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                    .setTimestamp();
                    
                try {
                    const message = await queue.textChannel.send({ embeds: [fallbackEmbed] });
                    addMessageForCleanup(queue.voiceChannel.guild.id, message);
                } catch (err) {
                //     console.error('Error sending fallback embed:', err);
                }
            }
        }
    });

  
    client.distube.on('addSong', async (queue, song) => {
      //   console.log(`Added to queue: ${song.name}`);
        
        if (queue.textChannel) {
            try {
                const embed = new EmbedBuilder()
                    .setColor(0xDC92FF)
                    .setAuthor({ 
                        name: 'Song added successfully', 
                        iconURL: musicIcons.correctIcon, 
                        url: 'https://discord.gg/xQF9f9yUEM' 
                    })
                    .setDescription(`**${song.name}**\n- Duration: **${song.formattedDuration}**\n- Added by: ${song.user}`)
                    .setThumbnail(song.thumbnail)
                    .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                    .setTimestamp();

                const message = await queue.textChannel.send({ embeds: [embed] });
                addMessageForCleanup(queue.voiceChannel.guild.id, message);
                
              
                setTimeout(async () => {
                    try {
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    } catch (error) {
                        // err
                    }
                }, 5000);
                
            } catch (error) {
             //    console.error('Error sending add song message:', error);
            }
        }
    });

  
    client.distube.on('addList', async (queue, playlist) => {
      //   console.log(`Added playlist: ${playlist.name} with ${playlist.songs.length} songs`);
        
        if (queue.textChannel) {
            try {
                const embed = new EmbedBuilder()
                    .setColor(0xDC92FF)
                    .setAuthor({ 
                        name: 'Playlist added successfully', 
                        iconURL: musicIcons.correctIcon,
                        url: 'https://discord.gg/xQF9f9yUEM' 
                    })
                    .setDescription(`**${playlist.name}**\n- Songs: **${playlist.songs.length}**\n- Added by: ${playlist.user}`)
                    .setThumbnail(playlist.thumbnail)
                    .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                    .setTimestamp();
                    
                const message = await queue.textChannel.send({ embeds: [embed] });
                addMessageForCleanup(queue.voiceChannel.guild.id, message);
                
       
                setTimeout(async () => {
                    try {
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    } catch (error) {
                        // err
                    }
                }, 8000);
                
            } catch (error) {
            //     console.error('Error sending playlist message:', error);
            }
        }
    });


    client.distube.on('finish', async (queue) => {
      //   console.log(`Queue finished in ${queue.voiceChannel?.name}`);
        
       
        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            try {
                const embed = new EmbedBuilder()
                    .setColor(0xFF6B6B)
                    .setAuthor({ name: 'Queue finished', iconURL: musicIcons.playerIcon })
                    .setDescription('🏁 All songs have been played!')
                    .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                    .setTimestamp();
                    
                const message = await queue.textChannel.send({ embeds: [embed] });
                
            
                setTimeout(async () => {
                    try {
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    } catch (error) {
                        // err
                    }
                }, 5000);
                
            } catch (error) {
              //   console.error('Error sending finish message:', error);
            }
        }
    });

    
    client.distube.on('disconnect', async (queue) => {
       //  console.log(`Disconnected from ${queue.voiceChannel?.name}`);
        
   
        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFFE066)
                .setAuthor({ name: 'Disconnected', iconURL: musicIcons.playerIcon })
                .setDescription('👋 Disconnected from voice channel')
                .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                .setTimestamp();
                
            try {
                const message = await queue.textChannel.send({ embeds: [embed] });
                
          
                setTimeout(async () => {
                    try {
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    } catch (error) {
                        // err
                    }
                }, 3000);
                
            } catch (error) {
             //    console.error('Error sending disconnect message:', error);
            }
        }
    });


    client.distube.on('empty', async (queue) => {
       // console.log(`Voice channel ${queue.voiceChannel?.name} is empty`);
        
     
        if (queue.voiceChannel) {
            await cleanupMessages(queue.voiceChannel.guild.id);
        }
        
        if (queue.textChannel) {
            const embed = new EmbedBuilder()
                .setColor(0xFFE066)
                .setAuthor({ name: 'Voice channel empty', iconURL: musicIcons.playerIcon })
                .setDescription('👋 Left the voice channel due to inactivity')
                .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                .setTimestamp();
                
            try {
                const message = await queue.textChannel.send({ embeds: [embed] });
                
          
                setTimeout(async () => {
                    try {
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    } catch (error) {
                       // err
                    }
                }, 3000);
                
            } catch (error) {
              //   console.error('Error sending empty channel message:', error);
            }
        }
    });

    
    client.distube.on('error', async (channel, error) => {
      //   console.error('DisTube error:', error);
        
       
        if (channel && channel.guild) {
            await cleanupMessages(channel.guild.id);
        }
        
        if (channel && typeof channel.send === 'function') {
            const embed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setAuthor({ name: 'Error occurred', iconURL: musicIcons.playerIcon })
                .setDescription(`❌ **${error.message}**`)
                .setFooter({ text: 'Distube Player', iconURL: musicIcons.footerIcon })
                .setTimestamp();
                
            try {
                const message = await channel.send({ embeds: [embed] });
                
              
                setTimeout(async () => {
                    try {
                        if (message && !message.deleted) {
                            await message.delete();
                        }
                    } catch (error) {
                          // err
                    }
                }, 8000);
                
            } catch (err) {
              //   console.error('Error sending error message:', err);
            }
        }
    });
    

    client.cleanupMusicMessages = cleanupMessages;
    client.addMusicMessage = addMessageForCleanup;
    
   
    client.distube.on('debug', (message) => {
      //  console.log(`[DisTube Debug]: ${message}`);
    });

    //console.log('DisTube music player initialized successfully!');
};

async function generateMusicCard(song) {
    try {
        const randomIndex = Math.floor(Math.random() * data.backgroundImages.length);
        const backgroundImage = data.backgroundImages[randomIndex];

        return await Dynamic({
            thumbnailImage: song.thumbnail,
            name: song.name,
            author: song.formattedDuration,
            authorColor: "#FF7A00",
            progress: 50,
            imageDarkness: 60,
            backgroundImage: backgroundImage,
            nameColor: "#FFFFFF",
            progressColor: "#FF7A00",
            progressBarColor: "#5F2D00",
        });
    } catch (error) {
      //   console.error('Error generating music card:', error);
        throw error;
    }
}