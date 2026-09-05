const { ActivityType } = require('discord.js');
const { botStatusCollection } = require('../mongodb');
const colors = require('../UI/colors/colors');
const config = require('../config');
const { restorePersistentVoices } = require('../utils/voiceKeepAlive');

module.exports = {
    name: 'clientReady',
    once: true,
    async execute(client) {
    

        let defaultIndex = 0;
        let customIndex = 0;
        let currentInterval = 10000; 

        async function getCustomStatus() {
            const statusDoc = await botStatusCollection.findOne({});
            if (!statusDoc || !statusDoc.useCustom || !statusDoc.customRotation || statusDoc.customRotation.length === 0) {
                return null;
            }

       
            if (statusDoc.interval) {
                currentInterval = statusDoc.interval * 1000;
            }

          
            const status = statusDoc.customRotation[customIndex];
            customIndex = (customIndex + 1) % statusDoc.customRotation.length;

    
            const placeholders = {
                '{members}': client.guilds.cache.reduce((a, g) => a + g.memberCount, 0),
                '{servers}': client.guilds.cache.size,
                '{channels}': client.channels.cache.size,
            };

            const resolvedActivity = Object.entries(placeholders).reduce(
                (text, [key, val]) => text.replace(new RegExp(key, 'g'), val),
                status.activity
            );

            const activity = {
                name: resolvedActivity,
                type: ActivityType[status.type],
            };

            if (status.type === 'Streaming' && status.url) {
                activity.url = status.url;
            }

            return { activity, status: status.status };
        }

        async function getCurrentSongActivity() {
            try {
             
                if (!client.riffy || !client.riffy.players) return null;

                const activePlayers = Array.from(client.riffy.players.values()).filter(p => p.playing);
                if (!activePlayers.length) return null;

                const player = activePlayers[0];
                if (!player.current?.info?.title) return null;

                return {
                    name: `🎸 ${player.current.info.title}`,
                    type: ActivityType.Playing
                };
            } catch (err) {
                console.warn(`[STATUS] Error while checking song activity: ${err.message}`);
                return null;
            }
        }

        async function updateStatus() {
         
            const customStatus = await getCustomStatus();
            
            if (customStatus) {
                client.user.setPresence({
                    activities: [customStatus.activity],
                    status: customStatus.activity.type === ActivityType.Streaming ? undefined : customStatus.status
                });
                console.log(`${colors.cyan}[STATUS]${colors.reset} Using custom status: ${customStatus.activity.name}`);
                return;
            }

           
            if (config.status.songStatus) {
                const songActivity = await getCurrentSongActivity();
                if (songActivity) {
                    client.user.setActivity(songActivity);
                    //console.log(`${colors.cyan}[STATUS]${colors.reset} Using song status: ${songActivity.name}`);
                    return;
                }
            }

           
            const next = config.status.rotateDefault[defaultIndex % config.status.rotateDefault.length];
            client.user.setPresence({
                activities: [next],
                status: next.type === ActivityType.Streaming ? undefined : 'online'
            });
            //console.log(`${colors.cyan}[STATUS]${colors.reset} Using default status: ${next.name}`);
            defaultIndex++;
        }

        
        client.invites = new Map();
        for (const [guildId, guild] of client.guilds.cache) {
            try {
                await new Promise(res => setTimeout(res, 500));
                const invites = await guild.invites.fetch();
                client.invites.set(
                    guildId,
                    new Map(invites.map(inv => [
                        inv.code,
                        {
                            inviterId: inv.inviter?.id || null,
                            uses: inv.uses
                        }
                    ]))
                );
            } catch (err) {
                //console.warn(`❌ Failed to fetch invites for ${guild.name}: ${err.message}`);
            }
        }

      
        updateStatus();
        
      
        async function checkAndUpdateInterval() {
            const statusDoc = await botStatusCollection.findOne({});
            const newInterval = statusDoc?.interval ? statusDoc.interval * 1000 : 10000;
            
            if (newInterval !== currentInterval) {
                console.log(`${colors.cyan}[STATUS]${colors.reset} Updating interval to ${newInterval / 1000} seconds`);
                currentInterval = newInterval;
            }
            
          
            setTimeout(() => {
                updateStatus().then(() => checkAndUpdateInterval());
            }, currentInterval);
        }
        
       
        checkAndUpdateInterval();

        try {
            const restoredVoices = await restorePersistentVoices(client);
            console.log(`${colors.cyan}[VOICE 24/7]${colors.reset} Restored ${restoredVoices} persistent voice connection(s)`);
        } catch (error) {
            console.warn(`${colors.yellow}[VOICE 24/7]${colors.reset} Could not restore persistent voice connections: ${error.message}`);
        }

        console.log('\x1b[31m[ CORE ]\x1b[0m \x1b[32m%s\x1b[0m', 'Bot Activity Cycle Running ✅');
    }
};
