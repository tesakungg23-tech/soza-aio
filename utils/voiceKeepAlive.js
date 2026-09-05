const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    entersState,
    NoSubscriberBehavior,
    StreamType,
    VoiceConnectionStatus
} = require('@discordjs/voice');
const { Readable } = require('node:stream');
const VoicePresence = require('../models/voicePresence/VoicePresence');

const sessions = new Map();
const clientsWithVoiceWatchdog = new WeakSet();
const SILENCE_FRAME = Buffer.from([0xf8, 0xff, 0xfe]);

function isUsableVoiceChannel(channel) {
    return Boolean(channel && typeof channel.isVoiceBased === 'function' && channel.isVoiceBased());
}

function clearSessionTimers(session) {
    if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
    }

    if (session.guardTimer) {
        clearInterval(session.guardTimer);
        session.guardTimer = null;
    }
}

function createSilentKeepAlive() {
    const stream = Readable.from((async function* generateSilence() {
        while (true) {
            yield SILENCE_FRAME;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
    })());
    const player = createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Play }
    });
    const resource = createAudioResource(stream, { inputType: StreamType.Opus });

    player.play(resource);
    return { player, stream };
}

function stopSilentKeepAlive(session) {
    if (session.keepAlive?.player) {
        session.keepAlive.player.stop(true);
    }

    if (session.keepAlive?.stream && !session.keepAlive.stream.destroyed) {
        session.keepAlive.stream.destroy();
    }

    session.keepAlive = null;
}

function attachClientVoiceWatchdog(client) {
    if (clientsWithVoiceWatchdog.has(client)) return;

    clientsWithVoiceWatchdog.add(client);
    client.on('voiceStateUpdate', (oldState, newState) => {
        if (newState.id !== client.user?.id) return;

        const session = sessions.get(newState.guild.id);
        if (!session || session.intentional) return;

        if (newState.channelId !== session.channelId) {
            console.warn(
                `[VOICE 24/7] Bot left the saved voice channel in guild ${session.guildId}; scheduling reconnect`
            );
            scheduleReconnect(client, session);
        }
    });
}

function startSessionGuard(client, session) {
    session.guardTimer = setInterval(() => {
        if (
            session.intentional ||
            sessions.get(session.guildId) !== session ||
            session.reconnecting
        ) {
            return;
        }

        const guild = client.guilds.cache.get(session.guildId);
        const botMember = guild?.members.me;
        if (!botMember) return;

        const botChannelId = botMember.voice.channelId;

        if (botChannelId !== session.channelId) {
            scheduleReconnect(client, session);
        }
    }, 10000);
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
        stopSilentKeepAlive(session);
        if (previousConnection && previousConnection.state.status !== VoiceConnectionStatus.Destroyed) {
            previousConnection.destroy();
        }

        const connection = joinVoiceChannel({
            channelId: channel.id,
            guildId: guild.id,
            adapterCreator: guild.voiceAdapterCreator,
            selfDeaf: true,
            // Send only silent Opus frames; there is no audible playback.
            selfMute: false
        });

        session.connection = connection;
        session.keepAlive = createSilentKeepAlive();
        connection.subscribe(session.keepAlive.player);
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
        clearSessionTimers(currentSession);
        stopSilentKeepAlive(currentSession);
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
        clearSessionTimers(currentSession);
        stopSilentKeepAlive(currentSession);
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
        // Send only silent Opus frames; there is no audible playback.
        selfMute: false
    });

    const session = {
        guildId,
        channelId: channel.id,
        connection,
        keepAlive: createSilentKeepAlive(),
        reconnectTimer: null,
        guardTimer: null,
        reconnecting: false,
        intentional: false,
        requestedBy
    };

    sessions.set(guildId, session);
    connection.subscribe(session.keepAlive.player);
    attachClientVoiceWatchdog(client);
    attachConnectionWatchdog(client, session, connection);
    startSessionGuard(client, session);

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
        clearSessionTimers(session);
        stopSilentKeepAlive(session);
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