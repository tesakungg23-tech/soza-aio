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

const { SlashCommandBuilder } = require('@discordjs/builders');
const { 
    TextDisplayBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('../../config.json');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Displays the command list and bot information')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('Get detailed information about a specific command')
                .setRequired(false)
                .setAutocomplete(true)
        ),

    async autocomplete(interaction) {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const commands = this.getAllCommands();
        
        const filtered = commands
            .filter(cmd => cmd.name.toLowerCase().includes(focusedValue))
            .slice(0, 25)
            .map(cmd => ({
                name: `${cmd.name}${cmd.subcommands.length > 0 ? ` (${cmd.subcommands.length} sub)` : ''}`.substring(0, 100),
                value: cmd.name
            }));

        await interaction.respond(filtered);
    },

    getAllCommands() {
        const allCommands = [];
        const COMMANDS_DIR = path.join(__dirname, '../../commands');
        const EXCESS_COMMANDS_DIR = path.join(__dirname, '../../excesscommands');

        const readCmds = (basePath, configSet) => {
            for (const [category, enabled] of Object.entries(configSet)) {
                if (!enabled) continue;
                const categoryPath = path.join(basePath, category);
                
                if (!fs.existsSync(categoryPath)) continue;

                fs.readdirSync(categoryPath)
                    .filter(file => file.endsWith('.js'))
                    .forEach(file => {
                        try {
                            const cmd = require(path.join(categoryPath, file));
                            const subcommands = this.extractSubcommands(cmd);
                            allCommands.push({
                                name: cmd.data?.name || cmd.name || 'unnamed',
                                description: (cmd.data?.description || cmd.description || 'No description').substring(0, 100),
                                category,
                                subcommands,
                                type: basePath.includes('excesscommands') ? 'prefix' : 'slash'
                            });
                        } catch (err) {
                            console.error(`Error loading ${file}:`, err);
                        }
                    });
            }
        };

        readCmds(COMMANDS_DIR, config.categories);
        readCmds(EXCESS_COMMANDS_DIR, config.excessCommands);
        
        return allCommands;
    },

    extractSubcommands(cmd) {
        const subcommands = [];
        if (!cmd.data?.toJSON) return subcommands;

        const dataJSON = cmd.data.toJSON();
        if (!dataJSON.options || !Array.isArray(dataJSON.options)) return subcommands;

        for (const option of dataJSON.options) {
            if (option.type === 1) {
                subcommands.push({
                    name: option.name,
                    description: (option.description || 'No description').substring(0, 80),
                    type: 'subcommand'
                });
            } else if (option.type === 2 && option.options) {
                const groupSubs = option.options
                    .filter(opt => opt.type === 1)
                    .map(opt => ({
                        name: `${option.name} ${opt.name}`,
                        description: (opt.description || 'No description').substring(0, 80),
                        type: 'group'
                    }));
                subcommands.push(...groupSubs);
            }
        }
        return subcommands;
    },

    async execute(interaction) {
        await interaction.deferReply();

        const specificCommand = interaction.options.getString('command');

        if (specificCommand) {
            return this.showCommandDetails(interaction, specificCommand);
        }

        return this.showMainHelp(interaction);
    },

    async showCommandDetails(interaction, commandName) {
        const commands = this.getAllCommands();
        const cmd = commands.find(c => c.name.toLowerCase() === commandName.toLowerCase());

        if (!cmd) {
            const container = new ContainerBuilder().setAccentColor(0xff3860);
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ❌ Command Not Found\n\n` +
                    `The command \`${commandName}\` doesn't exist.\n` +
                    `Use \`/help\` to browse all commands.`
                )
            );
            
            const navRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`help_back_main`)
                    .setLabel('Back to Main Menu')
                    .setEmoji('🏠')
                    .setStyle(ButtonStyle.Primary)
            );
            
            return interaction.editReply({
                components: [container, navRow],
                flags: MessageFlags.IsComponentsV2
            });
        }

        const CATEGORY_ICONS = this.getCategoryIcons();
        const categoryIcon = CATEGORY_ICONS[cmd.category.toLowerCase()] || "📁";
        const prefix = cmd.type === 'slash' ? '/' : config.prefix || '!';

        const displayComponents = [];

        // Header Container
        const headerContainer = new ContainerBuilder().setAccentColor(0x5865F2);
        headerContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${categoryIcon} \`${prefix}${cmd.name}\`\n\n${cmd.description}`
            )
        );
        displayComponents.push(headerContainer);
        displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

        // Info Container
        const infoContainer = new ContainerBuilder().setAccentColor(0x5865F2);
        let infoText = `**Category:** ${cmd.category}\n**Type:** ${cmd.type === 'slash' ? 'Slash Command' : 'Prefix Command'}\n**Total Subcommands:** ${cmd.subcommands.length}`;
        infoContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(infoText)
        );
        displayComponents.push(infoContainer);

        // Subcommands with smart chunking
        if (cmd.subcommands.length > 0) {
            displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            
            const SUBS_PER_CONTAINER = 15;
            const totalContainers = Math.ceil(cmd.subcommands.length / SUBS_PER_CONTAINER);
            
            for (let i = 0; i < totalContainers; i++) {
                const start = i * SUBS_PER_CONTAINER;
                const end = Math.min(start + SUBS_PER_CONTAINER, cmd.subcommands.length);
                const containerSubs = cmd.subcommands.slice(start, end);
                
                const subContainer = new ContainerBuilder().setAccentColor(0x667eea);
                let subText = `**Subcommands (${start + 1}-${end} of ${cmd.subcommands.length}):**\n\n`;
                
                containerSubs.forEach((sub, idx) => {
                    const globalIdx = start + idx + 1;
                    subText += `**${globalIdx}.** \`${sub.name}\`\n${sub.description}\n\n`;
                });
                
                subContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(subText.trim())
                );
                displayComponents.push(subContainer);
                
                if (i < totalContainers - 1) {
                    displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                }
            }
        }

        // Footer
        displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
        const footerContainer = new ContainerBuilder().setAccentColor(0x95A5A6);
        footerContainer.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `💡 **Tip:** Use \`${prefix}${cmd.name} <subcommand>\` to execute`
            )
        );
        displayComponents.push(footerContainer);

        const navRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`help_back_main`)
                .setLabel('Back')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setLabel('Support')
                .setEmoji('💬')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg/xQF9f9yUEM')
        );

        const reply = await interaction.editReply({
            components: [...displayComponents, navRow],
            flags: MessageFlags.IsComponentsV2
        });

        this.setupCommandDetailsCollector(reply, interaction.user.id);
    },

    setupCommandDetailsCollector(message, userId) {
        const collector = message.createMessageComponentCollector({ 
            time: 300000,
            dispose: true 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== userId) {
                return i.reply({ 
                    content: '⚠️ This help menu can only be used by the command initiator.', 
                    ephemeral: true 
                });
            }

            if (i.customId === 'help_back_main') {
                await i.deferUpdate();
                return this.showMainHelp(i);
            }
        });

        collector.on('end', () => {
            message.edit({ components: [] }).catch(() => {});
        });
    },

    async showMainHelp(interaction) {
        const COMMANDS_DIR = path.join(__dirname, '../../commands');
        const EXCESS_COMMANDS_DIR = path.join(__dirname, '../../excesscommands');
        
        const slashCommands = this.readCommands(COMMANDS_DIR, config.categories, 'slash');
        const prefixCommands = this.readCommands(EXCESS_COMMANDS_DIR, config.excessCommands, 'prefix');

        // Create chunked pages based on total items (commands + subcommands)
        const chunkedPages = this.createChunkedPages(slashCommands, prefixCommands);

        const viewData = {
            currentPage: 0,
            currentMode: 'slash',
            slashCommands,
            prefixCommands,
            chunkedPages,
            userId: interaction.user.id
        };

        return this.renderHelpView(interaction, viewData);
    },

    createChunkedPages(slashCommands, prefixCommands) {
        const pages = { slash: [], prefix: [] };
        const MAX_ITEMS_PER_PAGE = 60; 

        for (const mode of ['slash', 'prefix']) {
            const commandSet = mode === 'slash' ? slashCommands : prefixCommands;
            
            for (const category in commandSet) {
                const commands = commandSet[category];
                const chunks = [];
                let currentChunk = [];
                let currentItemCount = 0;
                let chunkIndex = 1;

                for (const cmd of commands) {
                    const cmdItemCount = 1 + cmd.subcommands.length; 
                    
                 
                    if (currentItemCount + cmdItemCount > MAX_ITEMS_PER_PAGE && currentChunk.length > 0) {
                        chunks.push({
                            commands: currentChunk,
                            itemCount: currentItemCount,
                            chunkIndex: chunkIndex++
                        });
                        currentChunk = [];
                        currentItemCount = 0;
                    }
                    
                    currentChunk.push(cmd);
                    currentItemCount += cmdItemCount;
                }

                // Add the last chunk
                if (currentChunk.length > 0) {
                    chunks.push({
                        commands: currentChunk,
                        itemCount: currentItemCount,
                        chunkIndex: chunkIndex++
                    });
                }

                // Create pages from chunks
                if (chunks.length === 1) {
                    // No chunking needed
                    pages[mode].push({
                        category: category,
                        displayName: category,
                        commands: chunks[0].commands,
                        itemCount: chunks[0].itemCount,
                        isChunked: false
                    });
                } else {
                    // Multiple chunks needed
                    chunks.forEach((chunk, idx) => {
                        pages[mode].push({
                            category: category,
                            displayName: `${category} (Part ${idx + 1}/${chunks.length})`,
                            commands: chunk.commands,
                            itemCount: chunk.itemCount,
                            isChunked: true,
                            chunkIndex: idx + 1,
                            totalChunks: chunks.length
                        });
                    });
                }
            }
        }

        return pages;
    },

    readCommands(basePath, configSet, type) {
        const commandData = {};
        
        for (const [category, enabled] of Object.entries(configSet)) {
            if (!enabled) continue;
            
            const categoryPath = path.join(basePath, category);
            if (!fs.existsSync(categoryPath)) continue;

            const commands = fs.readdirSync(categoryPath)
                .filter(file => file.endsWith('.js'))
                .map(file => {
                    try {
                        const cmd = require(path.join(categoryPath, file));
                        const subcommands = this.extractSubcommands(cmd);
                        
                        return {
                            name: cmd.data?.name || cmd.name || 'unnamed',
                            description: (cmd.data?.description || cmd.description || 'No description').substring(0, 100),
                            subcommands,
                            type
                        };
                    } catch (error) {
                        console.error(`Error loading ${file}:`, error);
                        return null;
                    }
                })
                .filter(cmd => cmd !== null);

            if (commands.length > 0) {
                commandData[category] = commands;
            }
        }
        
        return commandData;
    },

    calculateStats(commandSet) {
        let masterCount = 0;
        let subCount = 0;
        
        for (const category in commandSet) {
            masterCount += commandSet[category].length;
            commandSet[category].forEach(cmd => {
                subCount += cmd.subcommands.length;
            });
        }
        
        return { masterCount, subCount, total: masterCount + subCount };
    },

    async renderHelpView(interaction, viewData, message = null) {
        const slashStats = this.calculateStats(viewData.slashCommands);
        const prefixStats = this.calculateStats(viewData.prefixCommands);
        const totalStats = {
            total: slashStats.total + prefixStats.total
        };

        const displayComponents = [];

        if (viewData.currentPage === 0) {
         
            const homeContainer = new ContainerBuilder().setAccentColor(0x667eea);
            
            homeContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ✨ ALL IN ONE BOT - @v 1.4.1.0\n` +
                      `## THE DISCORD OPERATING SYSTEM\n\n` +
                    `Your comprehensive Discord bot with **${totalStats.total.toLocaleString()}+ commands**`
                )
            );
            displayComponents.push(homeContainer);
            displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

            const statsContainer = new ContainerBuilder().setAccentColor(0x5865F2);
            statsContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**📊 Command Statistics**\n\n` +
                    `**Slash Commands:** ${slashStats.total} total\n` +
                    `├─ ${slashStats.masterCount} master commands\n` +
                    `└─ ${slashStats.subCount} subcommands\n\n` +
                    `**Prefix Commands:** ${prefixStats.total} total\n` +
                    `├─ ${prefixStats.masterCount} master commands\n` +
                    `└─ ${prefixStats.subCount} subcommands\n\n` +
                    `**Total Pages:** ${viewData.chunkedPages[viewData.currentMode].length}`
                )
            );
            displayComponents.push(statsContainer);
            displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

      
            const navContainer = new ContainerBuilder().setAccentColor(0x57F287);
            navContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**🎯 How to Navigate**\n\n` +
                    `🔽 **Dropdown:** Select category/part (max 30 items/page)\n` +
                    `⬅️➡️ **Arrows:** Navigate pages\n` +
                    `🏠 **Home:** Return to main menu\n` +
                    `🔄 **Mode:** Toggle Slash/Prefix\n` +
                    `📋 **Details:** \`/help command:<name>\``
                )
            );
            displayComponents.push(navContainer);
            displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

      
            const footerContainer = new ContainerBuilder().setAccentColor(0xFEE75C);
            footerContainer.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `💡 **Tip:** Categories are auto-split to show max 30 items per page!`
                )
            );
            displayComponents.push(footerContainer);

        } else {
           
            const pageIndex = viewData.currentPage - 1;
            const pages = viewData.chunkedPages[viewData.currentMode];
            
            if (pageIndex < pages.length) {
                const pageData = pages[pageIndex];
                const CATEGORY_ICONS = this.getCategoryIcons();
                const categoryIcon = CATEGORY_ICONS[pageData.category.toLowerCase()] || "📁";
                const prefix = viewData.currentMode === 'slash' ? '/' : config.prefix || '!';
                
            
                const subCount = pageData.commands.reduce((acc, cmd) => acc + cmd.subcommands.length, 0);
                
                
                const headerContainer = new ContainerBuilder().setAccentColor(0x667eea);
                const headerText = pageData.isChunked 
                    ? `## ${categoryIcon} ${pageData.category.charAt(0).toUpperCase() + pageData.category.slice(1)} - Part ${pageData.chunkIndex}/${pageData.totalChunks}\n\n` +
                      `**${pageData.commands.length}** commands • **${subCount}** subcommands • **${pageData.itemCount}** total items`
                    : `## ${categoryIcon} ${pageData.category.charAt(0).toUpperCase() + pageData.category.slice(1)}\n\n` +
                      `**${pageData.commands.length}** commands • **${subCount}** subcommands • **${pageData.itemCount}** total items`;
                
                headerContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(headerText)
                );
                displayComponents.push(headerContainer);
                displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

          
                let currentText = '';
                
                for (let cmdIdx = 0; cmdIdx < pageData.commands.length; cmdIdx++) {
                    const cmd = pageData.commands[cmdIdx];
                    let cmdText = `**${cmdIdx + 1}.** \`${prefix}${cmd.name}\`\n${cmd.description}`;
                    
                    if (cmd.subcommands.length > 0) {
                        cmdText += `\n**└─ ${cmd.subcommands.length} subcommand${cmd.subcommands.length > 1 ? 's' : ''}:**\n`;
                        
                      
                        cmd.subcommands.forEach((sub, subIdx) => {
                            cmdText += `\n   **${subIdx + 1}.** \`${sub.name}\`\n   ${sub.description}`;
                        });
                    }
                    cmdText += '\n\n';
                    currentText += cmdText;
                }

               
                const cmdContainer = new ContainerBuilder().setAccentColor(0x5865F2);
                cmdContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(currentText.trim())
                );
                displayComponents.push(cmdContainer);
                displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));

           
                const footerContainer = new ContainerBuilder().setAccentColor(0x95A5A6);
                footerContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pageData.isChunked 
                            ? `✅ **Part ${pageData.chunkIndex}/${pageData.totalChunks}** • ${pageData.itemCount} items shown\n\nUse dropdown/arrows to view other parts.`
                            : `✅ **All ${pageData.itemCount} items shown**\n\nUse \`/help command:<name>\` for focused view.`
                    )
                );
                displayComponents.push(footerContainer);
                displayComponents.push(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                                const developerContainer = new ContainerBuilder().setAccentColor(0x828b);
                developerContainer.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        pageData.isChunked 
                            ? `Developed By GlaceYT • https://glaceyt.com`
                            : `Developed By GlaceYT • https://glaceyt.com`
                    )
                );
                displayComponents.push(developerContainer);
            }
        }

        const interactionComponents = this.createHelpComponents(viewData);

        await this.sleep(100);

        if (message) {
            await message.edit({
                components: [...displayComponents, ...interactionComponents],
                flags: MessageFlags.IsComponentsV2
            });
        } else {
            const reply = await interaction.editReply({
                components: [...displayComponents, ...interactionComponents],
                flags: MessageFlags.IsComponentsV2
            });
            this.setupMainCollector(reply, viewData);
        }
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },

    createHelpComponents(viewData) {
        const pages = viewData.chunkedPages[viewData.currentMode];
        const totalPages = pages.length + 1;

        // Dropdown
        const selectOptions = [
            {
                label: 'Home',
                emoji: '🏠',
                value: 'page_0',
                description: 'Main menu with statistics',
                default: viewData.currentPage === 0
            }
        ];

        const CATEGORY_ICONS = this.getCategoryIcons();
        pages.slice(0, 24).forEach((pageData, idx) => {
            const icon = CATEGORY_ICONS[pageData.category.toLowerCase()] || "📁";
            const subCount = pageData.commands.reduce((acc, cmd) => acc + cmd.subcommands.length, 0);
            
            selectOptions.push({
                label: pageData.displayName.charAt(0).toUpperCase() + pageData.displayName.slice(1),
                value: `page_${idx + 1}`,
                description: `${pageData.commands.length} cmds, ${subCount} subs (${pageData.itemCount} items)`,
                emoji: icon,
                default: viewData.currentPage === idx + 1
            });
        });

        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId(`help_select`)
                .setPlaceholder('📋 Select a category or part...')
                .addOptions(selectOptions)
        );

        // Navigation Buttons
        const navButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`help_prev`)
                .setLabel('Previous')
                .setEmoji('⬅️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(viewData.currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`help_home`)
                .setLabel('Home')
                .setEmoji('🏠')
                .setStyle(ButtonStyle.Success)
                .setDisabled(viewData.currentPage === 0),
            new ButtonBuilder()
                .setCustomId(`help_next`)
                .setLabel('Next')
                .setEmoji('➡️')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(viewData.currentPage === totalPages - 1),
            new ButtonBuilder()
                .setCustomId(`help_mode`)
                .setLabel(viewData.currentMode === 'slash' ? 'Prefix Mode' : 'Slash Mode')
                .setEmoji('🔄')
                .setStyle(ButtonStyle.Secondary)
        );

        // Link Buttons
        const linkButtons = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Support Server')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg/xQF9f9yUEM'),
            new ButtonBuilder()
                .setLabel('GitHub')
                .setStyle(ButtonStyle.Link)
                .setURL('https://github.com/GlaceYT'),
            new ButtonBuilder()
                .setLabel('Documentation')
                .setStyle(ButtonStyle.Link)
                .setURL('https://glaceyt.com/discord/All-In-One-Documentation')
        );

        return [selectMenu, navButtons, linkButtons];
    },

    setupMainCollector(message, viewData) {
        const collector = message.createMessageComponentCollector({ 
            time: 300000,
            dispose: true 
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== viewData.userId) {
                return i.reply({ 
                    content: '⚠️ This help menu can only be used by the command initiator.', 
                    ephemeral: true 
                });
            }

            await i.deferUpdate();

            const pages = viewData.chunkedPages[viewData.currentMode];
            const totalPages = pages.length + 1;

            if (i.isStringSelectMenu() && i.customId === 'help_select') {
                viewData.currentPage = parseInt(i.values[0].split('_')[1]);
            } else if (i.isButton()) {
                switch (i.customId) {
                    case 'help_prev':
                        viewData.currentPage = Math.max(0, viewData.currentPage - 1);
                        break;
                    case 'help_home':
                        viewData.currentPage = 0;
                        break;
                    case 'help_next':
                        viewData.currentPage = Math.min(totalPages - 1, viewData.currentPage + 1);
                        break;
                    case 'help_mode':
                        viewData.currentMode = viewData.currentMode === 'slash' ? 'prefix' : 'slash';
                        viewData.currentPage = 0;
                        break;
                }
            }

            await this.sleep(150);
            await this.renderHelpView(i, viewData, i.message);
        });

        collector.on('end', () => {
            message.edit({ components: [] }).catch(() => {});
        });
    },

    getCategoryIcons() {
        return {
            utility: "🛠️", moderation: "🛡️", fun: "🎮", music: "🎵", lavalink: "🎵",
            economy: "💰", admin: "⚙️", info: "ℹ️", games: "🎲",
            settings: "🔧", misc: "📦", general: "📋", entertainment: "🎪",
            social: "👥", tools: "🔨", automation: "🤖", logging: "📝",
            verification: "✅", leveling: "📈", tickets: "🎫", giveaway: "🎁",
            reaction: "😀", welcome: "👋", voice: "🔊", search: "🔎",
            image: "🖼️", meme: "😂", anime: "🎌", minigames: "🎯",
            gambling: "🎰", shop: "🏪", stats: "📊", leaderboard: "🏆", more: "🔍"
        };
    }
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