
const fs = require('fs');
const path = require('path');

const legacyNode = {
    name: "GlaceYT",
    password: "glace",
    host: "de-01.strixnodes.com",
    port: 2010,
    secure: false
};

function loadNodes() {
    const nodesFile = process.env.LAVALINK_NODES_FILE?.trim()
        || path.join(__dirname, 'lavalink', 'nodes.json');

    try {
        const parsed = JSON.parse(fs.readFileSync(nodesFile, 'utf8'));
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch (error) {
        console.warn(`[Lavalink] Could not load ${nodesFile}: ${error.message}`);
    }

    return [legacyNode];
}

const nodes = loadNodes();

module.exports = {
    enabled: true,
    lavalink: {
        nodes,
        defaultSearchPlatform: process.env.LAVALINK_SEARCH_PLATFORM || "ytmsearch",
        restVersion: "v4"
    }
};




