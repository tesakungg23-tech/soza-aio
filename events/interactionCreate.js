const { categories } = require('../config.json');
const lang = require('./loadLanguage');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const VerificationConfig = require('../models/gateVerification/verificationConfig');
const verificationCodes = new Map();
const SuggestionVote = require('../models/suggestions/SuggestionVote');
const Suggestion = require('../models/suggestions/Suggestion');
const truths = require('../data/truthordare/truth.json');
const dares = require('../data/truthordare/dare.json');
const DisabledCommand = require('../models/commands/DisabledCommands'); 

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
    
        if (interaction.isButton()) {
            const { customId, user } = interaction;
           
   
            if (interaction.customId === 'verify_button') {
              
                const verificationCode = Math.random().toString(36).slice(2, 8).toUpperCase();
                verificationCodes.set(interaction.user.id, verificationCode);

                const modal = new ModalBuilder()
                    .setCustomId('verify_modal')
                    .setTitle('Verification');

                const input = new TextInputBuilder()
                    .setCustomId('verify_input')
                    .setLabel(`Enter this code: ${verificationCode}`)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                const row = new ActionRowBuilder().addComponents(input);
                modal.addComponents(row);

                await interaction.showModal(modal);
            }
            if (customId.startsWith('tod_')) {
                await interaction.deferUpdate(); 
        
                let result;
        
                if (customId === 'tod_truth') {
                    result = `🧠 **Truth:** ${truths[Math.floor(Math.random() * truths.length)]}`;
                } else if (customId === 'tod_dare') {
                    result = `🔥 **Dare:** ${dares[Math.floor(Math.random() * dares.length)]}`;
                } else if (customId === 'tod_random') {
                    const pool = Math.random() < 0.5 ? truths : dares;
                    const label = pool === truths ? '🧠 **Truth:**' : '🔥 **Dare:**';
                    result = `${label} ${pool[Math.floor(Math.random() * pool.length)]}`;
                }
        
                const embed = new EmbedBuilder()
                    .setTitle('🎲 Your Truth or Dare!')
                    .setDescription(result)
                    .setColor('#00ccff')
                    .setFooter({ text: `${user.username} picked this`, iconURL: user.displayAvatarURL() })
                    .setTimestamp();
        
                const buttons = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('tod_truth')
                        .setLabel('Truth 🧠')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('tod_dare')
                        .setLabel('Dare 🔥')
                        .setStyle(ButtonStyle.Danger),
                    new ButtonBuilder()
                        .setCustomId('tod_random')
                        .setLabel('Random 🎲')
                        .setStyle(ButtonStyle.Secondary)
                );
        
             
                return interaction.channel.send({ embeds: [embed], components: [buttons] });
            }
            if (['suggestion_yes', 'suggestion_no'].includes(customId)) {
                const messageId = interaction.message.id;
                const voteType = customId === 'suggestion_yes' ? 'yes' : 'no';
                const userId = interaction.user.id;
            
                try {
                 
                    const suggestion = await Suggestion.findOne({ messageId });
                    if (!suggestion) {
                        return interaction.reply({ 
                            content: '❌ This suggestion no longer exists in the database.', 
                            ephemeral: true 
                        });
                    }
            
            
                    if (suggestion.status !== 'pending') {
                        return interaction.reply({ 
                            content: `❌ You cannot vote on a suggestion that is **${suggestion.status.toUpperCase()}**.`, 
                            ephemeral: true 
                        });
                    }
            
              
                    await SuggestionVote.findOneAndUpdate(
                        { messageId, userId },
                        { 
                            vote: voteType, 
                            votedAt: new Date() 
                        },
                        { upsert: true }
                    );
            
         
                    const allVotes = await SuggestionVote.find({ messageId });
                    const yesVotes = allVotes.filter(v => v.vote === 'yes').length;
                    const noVotes = allVotes.filter(v => v.vote === 'no').length;
            
                  
                    const originalEmbed = interaction.message.embeds[0];
                    const updatedEmbed = new EmbedBuilder()
                        .setTitle(originalEmbed.title)
                        .setDescription(originalEmbed.description)
                        .setColor(originalEmbed.color)
                        .addFields(
                            { name: 'Submitted by', value: originalEmbed.fields[0].value, inline: true },
                            { name: '👍 Yes Votes', value: `${yesVotes}`, inline: true },
                            { name: '👎 No Votes', value: `${noVotes}`, inline: true }
                        )
                        .setFooter({ text: originalEmbed.footer ? originalEmbed.footer.text : 'Status: PENDING' })
                        .setTimestamp(new Date(originalEmbed.timestamp));

            
                    await interaction.update({ embeds: [updatedEmbed] });
            
                    // Optional: Send ephemeral confirmation
                    // await interaction.followUp({ 
                    //     content: `✅ Your ${voteType === 'yes' ? 'Yes' : 'No'} vote has been recorded!`, 
                    //     ephemeral: true 
                    // });
            
                } catch (err) {
                    console.error('❌ Error handling suggestion vote:', err);
                    
                    if (interaction.deferred || interaction.replied) {
                        await interaction.followUp({ 
                            content: '⚠️ Could not register your vote. Please try again later.', 
                            ephemeral: true 
                        });
                    } else {
                        await interaction.reply({ 
                            content: '⚠️ Could not register your vote. Please try again later.', 
                            ephemeral: true 
                        });
                    }
                }
            }
        }

        if (interaction.customId === 'verify_modal') {
            const userId = interaction.user.id;
            const userInput = interaction.fields.getTextInputValue('verify_input');
            const correctCode = verificationCodes.get(userId);
        
            if (!correctCode) {
                return interaction.reply({ content: 'Verification expired! Click verify again.', ephemeral: true });
            }
        
            if (userInput !== correctCode) {
                return interaction.reply({ content: 'Verification failed! Try again.', ephemeral: true });
            }
        
            if (!interaction.guild) {
                return interaction.reply({ content: '❌ Verification must be completed in a server.', ephemeral: true });
            }
        
            const config = await VerificationConfig.findOne({ guildId: interaction.guild.id });
            if (!config) return;
        
            const member = interaction.guild.members.cache.get(userId);
            const unverifiedRole = interaction.guild.roles.cache.get(config.unverifiedRoleId);
            const verifiedRole = interaction.guild.roles.cache.get(config.verifiedRoleId);
        
            if (!verifiedRole) return interaction.reply({ content: '⚠️ Verified role not found.', ephemeral: true });
        
            if (unverifiedRole) {
                await member.roles.remove(unverifiedRole);
            }
            await member.roles.add(verifiedRole);
            verificationCodes.delete(userId);
        
            await interaction.reply({ content: '✅ Verification successful! You now have access to the server.', ephemeral: true });
            await member.send('🎉 You have been verified and can now access the server!');
        }

        if (!interaction.isCommand()) return;

        const command = client.commands.get(interaction.commandName);
        if (!command) return;
        
     
        const subcommandName = interaction.options.getSubcommand(false);
        const isDisabled = interaction.guild
            ? await DisabledCommand.findOne({
                guildId: interaction.guild.id,
                commandName: interaction.commandName,
                ...(subcommandName ? { subcommandName } : {})
            })
            : null;
        
        if (isDisabled) {
            try {
                await interaction.reply({
                    content: `❌ This command${subcommandName ? ` (${interaction.commandName} ${subcommandName})` : ''} is disabled in this server.`,
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Error sending disabled command reply:', replyError);
            }
            return;
        }
        
     
        const category = command.category || 'undefined';
        if (!categories[category]) {
            console.warn(`Command in category '${category}' is disabled.`);
            try {
                await interaction.reply({
                    content: lang.commandDisabled,
                    ephemeral: true
                });
            } catch (replyError) {
                console.error('Error when sending command disabled reply:', replyError);
            }
            return;
        }
        
   
        try {
            await command.execute(interaction, client);
        } catch (error) {
            if (error.code === 10062) return;
        
            if (error.message.includes('Interaction has already been acknowledged') ||
                error.message.includes('Unknown Message')) {
                console.warn('Interaction already replied or deferred error suppressed');
                return;
            }
        
            console.error(error);
        
            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: lang.error, ephemeral: true });
                }
            } catch (replyError) {
                if (replyError.message.includes('Interaction has already been acknowledged') ||
                    replyError.message.includes('Unknown interaction')) return;
        
                console.error('Error when sending error reply:', replyError);
            }
        }
        
    },
};
