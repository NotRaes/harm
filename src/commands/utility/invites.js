const {
    EmbedBuilder,
    PermissionFlagsBits
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class InvitesCommand {
    constructor() {
        this.name = 'invites';
        this.aliases = ['invs', 'invitations'];
        this.description = 'check invite statistics, joins, leaves, and leaderboard.';
        this.syntax = ',invites [top|add|remove|reset] [@user] [amount]';
        this.example = ',invites @user';
        this.category = 'utility';
        this.cooldown = 3;
        this.subcommands = ['invites top', 'invites add <@user> <amount>', 'invites remove <@user> <amount>', 'invites reset <@user>'];
        this.subcommandDetails = {
            top: {
                description: 'view the top inviters leaderboard.',
                syntax: ',invites top',
                example: ',invites top'
            },
            add: {
                description: 'add bonus invites to a member.',
                syntax: ',invites add <@user> <amount>',
                example: ',invites add @user 5'
            },
            remove: {
                description: 'remove bonus invites from a member.',
                syntax: ',invites remove <@user> <amount>',
                example: ',invites remove @user 2'
            },
            reset: {
                description: "reset a member's bonus invites.",
                syntax: ',invites reset <@user>',
                example: ',invites reset @user'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('nothing found', 'invites can only be viewed in servers.'));
        }

        const db = message.client.db;
        const guildId = message.guild.id;

        if (!db) {
            return message.reply(build.denyBox('offline', 'database subsystem is currently offline.'));
        }

        const sub = (args[0] || '').toLowerCase();
        const e = config.emojis || {};

        // 1. LEADERBOARD / TOP
        if (sub === 'top' || sub === 'lb' || sub === 'leaderboard') {
            const topList = await db.getTopInviters(guildId, 10);
            if (!topList.length) {
                return message.reply(build.warnBox('nothing found', 'no invite data recorded in this server yet.'));
            }

            const lines = [];
            for (let i = 0; i < topList.length; i++) {
                const item = topList[i];
                lines.push(
                    `\`${i + 1}.\` <@${item.user_id}> ─ \`${item.total} invites\`\n` +
                    `+${item.joins} joined · -${item.leaves} left · ~${item.fakes} fake · +${item.bonus} bonus`
                );
            }

            const client = message.client;
            const botAvatar = client.user?.displayAvatarURL({ size: 1024 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const guildIcon = message.guild.iconURL({ size: 1024 }) || botAvatar;

            const description = [
                `${e.leftwing || '✦'} **invite leaderboard** ${e.rightwing || '✦'}`,
                '',
                ...lines
            ].join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(config.colors.c || '#2b2d31')
                .setThumbnail(guildIcon)
                .setDescription(description);

            return message.reply({ embeds: [embed] });
        }

        // 2. ADD BONUS INVITES
        if (sub === 'add' || sub === 'bonus') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.owners.includes(message.author.id)) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to add bonus invites.'));
            }

            const rawId = args[1]?.replace(/[<@!>]/g, '');
            const targetUser = message.mentions?.users?.first() ||
                (rawId && (message.client.users.cache.get(rawId) || await message.client.users.fetch(rawId).catch(() => null)));
            const amount = parseInt(args[2], 10);

            if (!targetUser || isNaN(amount) || amount <= 0) {
                return message.reply(build.warnBox('syntax guide', 'syntax: `,invites add @user <amount>`'));
            }

            const newBonus = await db.adjustBonusInvites(guildId, targetUser.id, amount);
            return message.reply(build.approvedBox('bonus added', `added \`${amount}\` bonus invites to <@${targetUser.id}>. total bonus: \`${newBonus}\`.`));
        }

        // 3. REMOVE BONUS INVITES
        if (sub === 'remove' || sub === 'sub' || sub === 'deduct') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.owners.includes(message.author.id)) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to remove bonus invites.'));
            }

            const rawId = args[1]?.replace(/[<@!>]/g, '');
            const targetUser = message.mentions?.users?.first() ||
                (rawId && (message.client.users.cache.get(rawId) || await message.client.users.fetch(rawId).catch(() => null)));
            const amount = parseInt(args[2], 10);

            if (!targetUser || isNaN(amount) || amount <= 0) {
                return message.reply(build.warnBox('syntax guide', 'syntax: `,invites remove @user <amount>`'));
            }

            const newBonus = await db.adjustBonusInvites(guildId, targetUser.id, -amount);
            return message.reply(build.approvedBox('bonus deducted', `deducted \`${amount}\` bonus invites from <@${targetUser.id}>. total bonus: \`${newBonus}\`.`));
        }

        // 4. RESET INVITES
        if (sub === 'reset' || sub === 'clear') {
            if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !config.owners.includes(message.author.id)) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to reset invites.'));
            }

            const rawId = args[1]?.replace(/[<@!>]/g, '');
            const targetUser = message.mentions?.users?.first() ||
                (rawId && (message.client.users.cache.get(rawId) || await message.client.users.fetch(rawId).catch(() => null)));

            if (targetUser) {
                await db.resetUserInvites(guildId, targetUser.id);
                return message.reply(build.approvedBox('invites reset', `reset all invite data for <@${targetUser.id}>.`));
            } else if (args[1]?.toLowerCase() === 'all' || args[1]?.toLowerCase() === 'server') {
                await db.resetGuildInvites(guildId);
                return message.reply(build.approvedBox('invites reset', 'reset all invite data for this entire server.'));
            } else {
                return message.reply(build.warnBox('syntax guide', 'syntax: `,invites reset @user` or `,invites reset all`'));
            }
        }

        // 5. VIEW USER INVITES (DEFAULT)
        const rawTargetId = args[0]?.replace(/[<@!>]/g, '');
        const targetUser = message.mentions?.users?.first() ||
            (rawTargetId && (message.client.users.cache.get(rawTargetId) || await message.client.users.fetch(rawTargetId).catch(() => null))) ||
            message.author;

        const data = await db.getUserInvites(guildId, targetUser.id);

        const description = [
            `${e.leftwing || '✦'} **invites** ${e.rightwing || '✦'}`,
            `*invitation tracking and referral metrics.*`,
            '',
            `**user** <@${targetUser.id}>`,
            `**total invites** \`${data.total}\``,
            `**joined** \`+${data.joins}\` · **left** \`-${data.leaves}\``,
            `**fake** \`${data.fakes}\` · **bonus** \`${data.bonus}\``
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setThumbnail(targetUser.displayAvatarURL({ size: 1024, dynamic: true }))
            .setDescription(description);

        return message.reply({ embeds: [embed] });
    }
}

module.exports = InvitesCommand;
