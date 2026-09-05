const {
    joinVoiceChannel,
    entersState,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const VoicePresence = require('../models/voicePresence/VoicePresence');

const sessions = new Map();

function isUsableVoiceChannel(channel) {
    return Boolean(channel && typeof channel.isVoiceBased === 'function' && channel.isVoiceBased());
}

function attachConnectionWatchdog(client, session, connection) {
    connection.on('stateChange', (oldState, newState) => {
        if (sessions.get(session.guildId) !== session || session.intentional) return;

        if (
            newState.status === VoiceConnectionStatus.Disconnected ||
            newState.status === VoiceConnectionStatus.Destroyed
        ) {
            scheduleReconnect(client, session);
        }
    });

    connection.on('error', (error) => {
        console.warn(`[VOICE 24/7] Connection error in guild ${session.guildId}: ${error.message}`);
        scheduleReconnect(client, session);
    });
}

function scheduleReconnect(client, session, delay = 1500) {
    if (
        session.intentional ||
        session.reconnectTimer ||
        session.reconnecting ||
        sessions.get(session.guildId) !== session
    ) {
        return;
    }

    session.reconnectTimer = setTimeout(async () => {
        session.reconnectTimer = null;
        await reconnectSession(client, session);
    }, delay);
}

async function reconnectSession(client, session) {
    if (
        session.intentional ||
        sessions.get(session.guildId) !== session ||
        session.reconnecting
    ) {
        return;
    }

    session.reconnecting = true;

    try {
        const guild = client.guilds.cache.get(session.guildId);
        const channel = guild?.channels.cache.get(session.channelId);

        if (!guild || !isUsableVoiceChannel(channel)) {
            console.warn(`[VOICE 24/7] Saved channel unavailable for guild ${session.guildId}`);
            session.reconnecting = false;
            scheduleReconnect(client, session, 10000);
            return;
        }

        const previousConnection = session.connection;
        session.connection = null;
        if (previousConnection && previousConnection.state.status !== VoiceConnectionStatus.Destroyed) {
            previousConnection.destroy();
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            selfMute: true
        });

        session.connection = connection;
        attachConnectionWatchdog(client, session, connection);
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
        console.log(`[VOICE 24/7] Reconnected to ${channel.name} in ${guild.name}`);
    } catch (error) {
        console.warn(`[VOICE 24/7] Reconnect failed for guild ${session.guildId}: ${error.message}`);
        if (session.connection && session.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            session.connection.destroy();
        }
        session.connection = null;
        session.reconnecting = false;
        scheduleReconnect(client, session, 5000);
    } finally {
        session.reconnecting = false;
    }
}

async function joinPersistentVoice(client, channel, { persist = true, requestedBy = null } = {}) {
    if (!isUsableVoiceChannel(channel)) {
        throw new Error('The selected channel is not a voice channel.');
    }

    const guildId = channel.guild.id;
    const currentSession = sessions.get(guildId);

    if (currentSession && currentSession.channelId !== channel.id) {
        currentSession.intentional = true;
        if (currentSession.reconnectTimer) clearTimeout(currentSession.reconnectTimer);
        if (currentSession.connection && currentSession.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            currentSession.connection.destroy();
        }
        sessions.delete(guildId);
    }

    if (
        currentSession &&
        currentSession.channelId === channel.id &&
        currentSession.connection &&
        currentSession.connection.state.status !== VoiceConnectionStatus.Disconnected &&
        currentSession.connection.state.status !== VoiceConnectionStatus.Destroyed
    ) {
        await entersState(currentSession.connection, VoiceConnectionStatus.Ready, 30000);
        return { connection: currentSession.connection, alreadyConnected: true };
    }

    // The old session may still be tracked after Discord reports a
    // disconnect. Remove it before creating the replacement so its pending
    // reconnect timer cannot race the new /join request.
    if (currentSession) {
        currentSession.intentional = true;
        if (currentSession.reconnectTimer) clearTimeout(currentSession.reconnectTimer);
        if (currentSession.connection && currentSession.connection.state.status !== VoiceConnectionStatus.Destroyed) {
            currentSession.connection.destroy();
        }
        sessions.delete(guildId);
    }

    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: true
    });

    const session = {
        guildId,
        channelId: channel.id,
        connection,
        reconnectTimer: null,
        reconnecting: false,
        intentional: false,
        requestedBy
    };

    sessions.set(guildId, session);
    attachConnectionWatchdog(client, session, connection);

    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);

        if (persist) {
            await VoicePresence.findOneAndUpdate(
                { guildId },
                {
                    guildId,
                    channelId: channel.id,
                    enabled: true,
                    requestedBy
                },
                { upsert: true, setDefaultsOnInsert: true }
            );
        }

        return { connection, alreadyConnected: false };
    } catch (error) {
        session.intentional = true;
        connection.destroy();
        sessions.delete(guildId);
        throw error;
    }
}

async function restorePersistentVoices(client) {
    const savedSessions = await VoicePresence.find({ enabled: true }).lean();
    let restored = 0;

    for (const savedSession of savedSessions) {
        const guild = client.guilds.cache.get(savedSession.guildId);
        const channel = guild?.channels.cache.get(savedSession.channelId);

        if (!guild || !isUsableVoiceChannel(channel)) {
            console.warn(`[VOICE 24/7] Could not restore guild ${savedSession.guildId}; channel is unavailable.`);
            continue;
        }

        try {
            await joinPersistentVoice(client, channel, {
                persist: false,
                requestedBy: savedSession.requestedBy || null
            });
            restored += 1;
        } catch (error) {
            console.warn(`[VOICE 24/7] Restore failed for ${guild.name}: ${error.message}`);
        }
    }

    return restored;
}

module.exports = {
    joinPersistentVoice,
    restorePersistentVoices
};