const fs = require('fs');
const path = require('path');
const { DisTubeError } = require('distube');
const { YtDlpPlugin, json } = require('@distube/yt-dlp');

const cookiesPath = path.join(__dirname, 'cookies.txt');

class HighQualityYtDlpPlugin extends YtDlpPlugin {
    async getStreamURL(song) {
        if (!song.url) {
            throw new DisTubeError(
                'YTDLP_PLUGIN_INVALID_SONG',
                'Cannot get stream url from invalid song.'
            );
        }

        const flags = {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            preferFreeFormats: true,
            skipDownload: true,
            simulate: true,
            // Prefer YouTube's 48 kHz Opus stream before other audio formats.
            format: 'bestaudio[acodec=opus]/bestaudio',
            formatSort: 'abr,asr,quality'
        };

        if (fs.existsSync(cookiesPath)) {
            flags.cookies = cookiesPath;
        }

        const info = await json(song.url, flags).catch((error) => {
            throw new DisTubeError(
                'YTDLP_ERROR',
                `${error.stderr || error}`
            );
        });

        if (Array.isArray(info.entries)) {
            throw new DisTubeError(
                'YTDLP_PLUGIN_INVALID_SONG',
                'Cannot get stream URL of an entire playlist.'
            );
        }

        if (!info.url) {
            throw new DisTubeError(
                'YTDLP_ERROR',
                'The extractor did not return an audio stream URL.'
            );
        }

        return info.url;
    }
}

module.exports = { HighQualityYtDlpPlugin };