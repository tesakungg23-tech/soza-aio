const { PermissionFlagsBits } = require('discord.js');

const MAX_BITRATE_BY_TIER = {
    0: 96000,
    1: 128000,
    2: 256000,
    3: 384000
};

function getPremiumTierNumber(guild) {
    const tier = guild?.premiumTier;

    if (typeof tier === 'number') return tier;

    return {
        NONE: 0,
        TIER_1: 1,
        TIER_2: 2,
        TIER_3: 3
    }[tier] ?? 0;
}

async function maximizeVoiceChannelBitrate(channel) {
    if (!channel?.guild || typeof channel.setBitrate !== 'function') {
        return { changed: false, reason: 'unsupported-channel' };
    }

    const botMember = channel.guild.members.me;
    const permissions = botMember ? channel.permissionsFor(botMember) : null;

    if (!permissions?.has(PermissionFlagsBits.ManageChannels)) {
        return { changed: false, reason: 'missing-manage-channels' };
    }

    const maximumBitrate = MAX_BITRATE_BY_TIER[getPremiumTierNumber(channel.guild)] || 96000;
    if (channel.bitrate >= maximumBitrate) {
        return { changed: false, reason: 'already-maximized', bitrate: channel.bitrate };
    }

    try {
        await channel.setBitrate(
            maximumBitrate,
            'Optimize voice channel bitrate for music playback'
        );
        return { changed: true, bitrate: maximumBitrate };
    } catch (error) {
        console.warn(`[VOICE QUALITY] Could not update ${channel.name}: ${error.message}`);
        return { changed: false, reason: 'update-failed' };
    }
}

module.exports = { maximizeVoiceChannelBitrate };