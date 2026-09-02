const { PermissionFlagsBits } = require('discord.js');

module.exports = {
    async execute(message, args) {
        const hasPermission =
            message.member.permissions.has(PermissionFlagsBits.ManageMessages) ||
            message.member.permissions.has(PermissionFlagsBits.Administrator);

        if (!hasPermission) {
            const reply = await message.reply('❌ You need the **Manage Messages** permission to use this command.');
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        const amount = Number(args[0]);
        if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
            const reply = await message.reply(
                `❌ Please provide a number between **1 and 100**.\nExample: \`.purge 100\``
            );
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        const botMember = message.guild.members.me;
        if (!botMember?.permissionsIn(message.channel).has(PermissionFlagsBits.ManageMessages)) {
            const reply = await message.reply('❌ I need the **Manage Messages** permission in this channel.');
            setTimeout(() => reply.delete().catch(() => {}), 5000);
            return;
        }

        try {
            const messages = await message.channel.messages.fetch({ limit: amount });
            const recentMessages = messages.filter(
                msg => Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000
            );

            if (recentMessages.size === 0) {
                const reply = await message.reply('❌ No recent messages were found to purge.');
                setTimeout(() => reply.delete().catch(() => {}), 5000);
                return;
            }

            const deleted = await message.channel.bulkDelete(recentMessages.first(amount), true);
            const result = await message.channel.send(`🧹 Deleted **${deleted.size}** message${deleted.size === 1 ? '' : 's'}.`);
            setTimeout(() => result.delete().catch(() => {}), 5000);
        } catch (error) {
            console.error('Prefix purge error:', error);
            const reply = await message.reply(
                '❌ Purge failed. Check that I have **Manage Messages** permission and that the messages are less than 14 days old.'
            );
            setTimeout(() => reply.delete().catch(() => {}), 7000);
        }
    }
};