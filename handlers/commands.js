const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

module.exports = async (client, config, colors) => {
    const commandsPath = path.join(__dirname, '../commands');
    const commandFolders = fs.readdirSync(commandsPath);
    const enabledCommandFolders = commandFolders.filter(folder => config.categories[folder]);

    const commands = [];

    for (const folder of enabledCommandFolders) {
        const commandFiles = fs.readdirSync(path.join(commandsPath, folder)).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(path.join(commandsPath, folder, file));
            client.commands.set(command.data.name, command);
            commands.push(command.data.toJSON());
        }
    }

    const token = process.env.TOKEN || config.token;
    if (!token) {
        throw new Error('TOKEN is missing. Add TOKEN to the Railway service variables.');
    }

    const rest = new REST({ version: '10' }).setToken(token);
    const applicationId = client.application?.id || client.user.id;
    const guildId = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
    const commandRoute = guildId
        ? Routes.applicationGuildCommands(applicationId, guildId)
        : Routes.applicationCommands(applicationId);
    const registrationScope = guildId
        ? `server ${guildId}`
        : 'global (may take up to an hour to appear)';

    try {
        const registeredCommands = await rest.get(commandRoute);

        console.log('\n' + '─'.repeat(40));
        console.log(`${colors.yellow}${colors.bright}⚡ SLASH COMMANDS${colors.reset}`);
        console.log('─'.repeat(40));
        console.log(`${colors.cyan}[ SCOPE  ]${colors.reset} Registering commands for ${registrationScope}`);

        if (registeredCommands.length !== commands.length) {
            console.log(`${colors.red}[ LOADER ]${colors.reset} ${colors.green}Loading Slash Commands 🛠️${colors.reset}`);
        }

        await rest.put(
            commandRoute,
            { body: commands }
        );

        console.log(`${colors.red}[ LOADER ]${colors.reset} ${colors.green}Successfully loaded ${commands.length} slash commands ✅${colors.reset}`);
    } catch (error) {
        console.log(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}Slash command registration failed: ${error.message}${colors.reset}`);
        throw error;
    }
};
