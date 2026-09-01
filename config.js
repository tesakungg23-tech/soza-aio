const { ActivityType } = require('discord.js');

module.exports = {
  ownerId: '1004206704994566164',
  status: {
    rotateDefault: [
      { name: 'soza', type: ActivityType.Streaming, url: 'https://www.twitch.tv/glaceytt' },
    ],
    songStatus: true
  },
  spotifyClientId: process.env.SPOTIFY_CLIENT_ID || "",
  spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
}
