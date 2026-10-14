const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

function resolveRole(guild, query) {
    if (!query) return null;
    const clean = query.trim();
    const mentionMatch = clean.match(/^<@&(\d{17,20})>$/);
    if (mentionMatch) return guild.roles.cache.get(mentionMatch[1]) || null;
    if (/^\d{17,20}$/.test(clean)) return guild.roles.cache.get(clean) || null;
    const lower = clean.toLowerCase();
    const exact = guild.roles.cache.find(r => r.name.toLowerCase() === lower);
    if (exact) return exact;
    const starts = guild.roles.cache.find(r => r.name.toLowerCase().startsWith(lower));
    if (starts) return starts;
    return guild.roles.cache.find(r => r.name.toLowerCase().includes(lower)) || null;
}

class AutoroleCommand {
    constructor() {
        this.name = 'autorole';
        this.aliases = ['ar'];
        this.description = 'automatically assign roles to members or bots upon joining.';
        this.syntax = ',autorole <add|remove|list|clear|bots> [role]';
        this.example = ',autorole add Member';
        this.category = 'utility';
        this.permissions = ['ManageRoles'];
        this.cooldown = 3;
        this.subcommands = [
            'autorole add <role>',
            'autorole bots <role>',
            'autorole remove <role>',
            'autorole list',
            'autorole clear'
        ];
        this.subcommandDetails = {
            add: {
                description: 'add an autorole given to all joining human members.',
                syntax: ',autorole add <role>',
                example: ',autorole add Member'
            },
            bots: {
                description: 'add an autorole given to all joining bot members.',
                syntax: ',autorole bots <role>',
                example: ',autorole bots Bots'
            },
            remove: {
                description: 'remove an existing role from the autoroles list.',
                syntax: ',autorole remove <role>',
                example: ',autorole remove Member'
            },
            list: {
                description: 'view all configured autoroles for this server.',
                syntax: ',autorole list',
                example: ',autorole list'
            },
            clear: {
                description: 'remove all autoroles for this server.',
                syntax: ',autorole clear',
                example: ',autorole clear'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const isOwner = config.owners?.includes(message.author.id) || message.guild.ownerId === message.author.id;
        const hasPerms = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageRoles);
        if (!hasPerms) {
            return message.reply(build.denyBox('permission denied', 'you need manage roles permissions to configure autoroles.'));
        }

        const botMember = message.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply(build.denyBox('permission denied', 'i need manage roles permissions to assign autoroles.'));
        }

        const db = message.client.db;
        if (!db) {
            return message.reply(build.denyBox('offline', 'database subsystem is currently offline.'));
        }

        const sub = (args?.[0] || '').toLowerCase();
        const roleQuery = args.slice(1).join(' ').trim();

        // ──────────────────────── 1. LIST ────────────────────────
        if (sub === 'list' || sub === 'show' || sub === '') {
            const list = db.getAutoroles(message.guild.id);
            if (!list || list.length === 0) {
                return message.reply({
                    embeds: [build.warn(message.author, 'no autoroles configured in this server.\n-# use `,autorole add <role>` to set one.')]
                });
            }

            const humanRoles = list.filter(r => r.targetType !== 'bots');
            const botRoles = list.filter(r => r.targetType === 'bots');

            const humanFormatted = humanRoles.length > 0
                ? humanRoles.map(r => message.guild.roles.cache.has(r.roleId) ? `<@&${r.roleId}>` : `\`deleted-role (${r.roleId})\``).join(' · ')
                : '*none configured*';

            const botFormatted = botRoles.length > 0
                ? botRoles.map(r => message.guild.roles.cache.has(r.roleId) ? `<@&${r.roleId}>` : `\`deleted-role (${r.roleId})\``).join(' · ')
                : '*none configured*';

            const embed = new EmbedBuilder()
                .setColor(config.colors.c || 0x2b2d31)
                .setDescription(
                    `### [autoroles](${config.supportInvite || 'https://discord.gg/eqwcPU2mfS'})\n` +
                    `-# automatic role assignments for joining members.\n\n` +
                    `**humans**\n${humanFormatted}\n\n` +
                    `**bots**\n${botFormatted}\n\n` +
                    `-# total: \`${list.length}\` configured • \`,autorole add <role>\``
                );

            return message.reply({ embeds: [embed] });
        }

        // ──────────────────────── 2. CLEAR ────────────────────────
        if (sub === 'clear' || sub === 'reset') {
            await db.clearAutoroles(message.guild.id);
            return message.reply({
                embeds: [build.approved(message.author, 'cleared all configured autoroles.')]
            });
        }

        // ──────────────────────── 3. ADD / BOT / BOTS ────────────────────────
        if (sub === 'add' || sub === 'bot' || sub === 'bots') {
            if (!roleQuery) {
                return message.reply(build.warnBox('provide a role name, id, or mention to add as an autorole.'));
            }

            const role = resolveRole(message.guild, roleQuery);
            if (!role) {
                return message.reply({
                    embeds: [build.warn(message.author, `could not find a role matching \`${roleQuery}\`.`)]
                });
            }

            if (role.id === message.guild.id) {
                return message.reply({
                    embeds: [build.deny(message.author, 'cannot assign the @everyone role as an autorole.')]
                });
            }

            if (role.managed) {
                return message.reply({
                    embeds: [build.deny(message.author, 'cannot assign an integration or managed role as an autorole.')]
                });
            }

            const botHighest = botMember.roles.highest.position;
            if (role.position >= botHighest) {
                return message.reply({
                    embeds: [build.deny(message.author, 'that role is higher than or equal to my highest role.')]
                });
            }

            const memberHighest = message.member.roles.highest.position;
            if (!isOwner && role.position >= memberHighest) {
                return message.reply({
                    embeds: [build.deny(message.author, 'that role is higher than or equal to your highest role.')]
                });
            }

            const targetType = (sub === 'bot' || sub === 'bots') ? 'bots' : 'humans';
            const currentList = db.getAutoroles(message.guild.id);
            const alreadyExists = currentList.some(r => r.roleId === role.id && r.targetType === targetType);
            if (alreadyExists) {
                return message.reply({
                    embeds: [build.warn(message.author, `<@&${role.id}> is already an autorole for **${targetType}**.`)]
                });
            }

            await db.addAutorole(message.guild.id, role.id, targetType);
            return message.reply({
                embeds: [build.approved(message.author, `added <@&${role.id}> to **${targetType}** autoroles.`)]
            });
        }

        // ──────────────────────── 4. REMOVE ────────────────────────
        if (sub === 'remove' || sub === 'delete' || sub === 'del' || sub === 'rem') {
            if (!roleQuery) {
                return message.reply(build.warnBox('provide a role name, id, or mention to remove from autoroles.'));
            }

            const role = resolveRole(message.guild, roleQuery);
            const roleIdToRemove = role ? role.id : roleQuery.replace(/[<@&>]/g, '').trim();

            const removed = await db.removeAutorole(message.guild.id, roleIdToRemove);
            if (!removed) {
                return message.reply({
                    embeds: [build.warn(message.author, `that role is not in the server autoroles list.`)]
                });
            }

            return message.reply({
                embeds: [build.approved(message.author, `removed <@&${roleIdToRemove}> from autoroles.`)]
            });
        }

        // Unknown subcommand -> show help
        return build.help(message, this);
    }
}

module.exports = AutoroleCommand;
