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

async function resolveMember(guild, query, message) {
    if (message.mentions?.members?.size > 0) {
        return message.mentions.members.first();
    }
    if (!query) return null;
    const clean = query.replace(/[<@!>]/g, '').trim();
    if (/^\d{17,20}$/.test(clean)) {
        try {
            return await guild.members.fetch(clean);
        } catch (_) {}
    }
    const lower = clean.toLowerCase();
    const found = guild.members.cache.find(m =>
        m.user.username.toLowerCase() === lower ||
        m.displayName.toLowerCase() === lower ||
        m.user.tag.toLowerCase() === lower
    );
    if (found) return found;
    return null;
}

class RoleCommand {
    constructor() {
        this.name = 'role';
        this.aliases = ['r'];
        this.description = 'assign, remove, create, or mass-toggle roles for members.';
        this.syntax = ',role <user|all|humans|bots|create|delete> [role]';
        this.example = ',role @user Member';
        this.category = 'utility';
        this.permissions = ['ManageRoles'];
        this.cooldown = 2;
        this.subcommands = [
            'role <user> <role>',
            'role add <user> <role>',
            'role remove <user> <role>',
            'role all <role>',
            'role humans <role>',
            'role bots <role>',
            'role create <name> [hex]',
            'role delete <role>'
        ];
        this.subcommandDetails = {
            toggle: {
                description: 'toggle a role on a member (adds if missing, removes if present).',
                syntax: ',role <user> <role>',
                example: ',role @user Member'
            },
            add: {
                description: 'grant a role to a member.',
                syntax: ',role add <user> <role>',
                example: ',role add @user VIP'
            },
            remove: {
                description: 'revoke a role from a member.',
                syntax: ',role remove <user> <role>',
                example: ',role remove @user VIP'
            },
            all: {
                description: 'mass toggle or assign a role to all server members.',
                syntax: ',role all <role>',
                example: ',role all Member'
            },
            humans: {
                description: 'mass toggle or assign a role to all human members.',
                syntax: ',role humans <role>',
                example: ',role humans Member'
            },
            bots: {
                description: 'mass toggle or assign a role to all bot accounts.',
                syntax: ',role bots <role>',
                example: ',role bots BotRole'
            },
            create: {
                description: 'create a new role with an optional hex color.',
                syntax: ',role create <name> [hex]',
                example: ',role create aesthetic #2b2d31'
            },
            delete: {
                description: 'delete an existing role from the server.',
                syntax: ',role delete <role>',
                example: ',role delete OldRole'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const isOwner = config.owners?.includes(message.author.id) || message.guild.ownerId === message.author.id;
        const hasManageRoles = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageRoles);
        if (!hasManageRoles) {
            return message.reply(build.denyBox('permission denied', 'you need manage roles permissions to use this command.'));
        }

        const botMember = message.guild.members.me;
        if (!botMember?.permissions?.has(PermissionFlagsBits.ManageRoles)) {
            return message.reply(build.denyBox('permission denied', 'i need manage roles permissions to manage roles.'));
        }

        if (!args || args.length === 0) {
            return build.help(message, this);
        }

        const sub = (args[0] || '').toLowerCase();
        const botHighest = botMember.roles.highest.position;
        const memberHighest = message.member.roles.highest.position;

        // ──────────────────────── 1. CREATE ROLE ────────────────────────
        if (sub === 'create' || sub === 'new') {
            const raw = args.slice(1).join(' ').trim();
            if (!raw) {
                return message.reply(build.warnBox('specify a name for the new role.'));
            }

            const parts = raw.split(/\s+/);
            const lastPart = parts[parts.length - 1];
            let hexColor = null;
            let roleName = raw;

            if (/^#?[0-9a-fA-F]{6}$/.test(lastPart)) {
                hexColor = lastPart.startsWith('#') ? lastPart : `#${lastPart}`;
                parts.pop();
                roleName = parts.join(' ').trim();
            }

            if (!roleName) roleName = 'new role';

            try {
                const newRole = await message.guild.roles.create({
                    name: roleName,
                    color: hexColor || undefined,
                    reason: `harm role create requested by ${message.author.tag}`
                });

                return message.reply({
                    embeds: [build.approved(message.author, `created role <@&${newRole.id}>.`)]
                });
            } catch (err) {
                return message.reply({
                    embeds: [build.deny(message.author, `failed to create role: ${err.message}`)]
                });
            }
        }

        // ──────────────────────── 2. DELETE ROLE ────────────────────────
        if (sub === 'delete' || sub === 'del') {
            const roleQuery = args.slice(1).join(' ').trim();
            if (!roleQuery) {
                return message.reply(build.warnBox('specify a role to delete.'));
            }

            const role = resolveRole(message.guild, roleQuery);
            if (!role) {
                return message.reply({
                    embeds: [build.warn(message.author, `could not find a role matching \`${roleQuery}\`.`)]
                });
            }

            if (role.id === message.guild.id) {
                return message.reply({
                    embeds: [build.deny(message.author, 'cannot delete the @everyone role.')]
                });
            }

            if (role.managed) {
                return message.reply({
                    embeds: [build.deny(message.author, 'cannot delete an integration managed role.')]
                });
            }

            if (role.position >= botHighest) {
                return message.reply({
                    embeds: [build.deny(message.author, 'that role is higher than or equal to my highest role.')]
                });
            }

            if (!isOwner && role.position >= memberHighest) {
                return message.reply({
                    embeds: [build.deny(message.author, 'that role is higher than or equal to your highest role.')]
                });
            }

            const deletedName = role.name;
            try {
                await role.delete(`harm role delete requested by ${message.author.tag}`);
                return message.reply({
                    embeds: [build.approved(message.author, `deleted role **${deletedName}**.`)]
                });
            } catch (err) {
                return message.reply({
                    embeds: [build.deny(message.author, `failed to delete role: ${err.message}`)]
                });
            }
        }

        // ──────────────────────── 3. MASS ROLES (ALL / HUMANS / BOTS) ────────────────────────
        if (sub === 'all' || sub === 'humans' || sub === 'human' || sub === 'bots' || sub === 'bot') {
            const hasAdmin = isOwner || message.member?.permissions?.has(PermissionFlagsBits.Administrator);
            if (!hasAdmin) {
                return message.reply(build.denyBox('permission denied', 'you need administrator permissions to run mass role operations.'));
            }

            const roleQuery = args.slice(1).join(' ').trim();
            if (!roleQuery) {
                return message.reply(build.warnBox(`specify a role to mass assign to ${sub}.`));
            }

            const role = resolveRole(message.guild, roleQuery);
            if (!role) {
                return message.reply({
                    embeds: [build.warn(message.author, `could not find a role matching \`${roleQuery}\`.`)]
                });
            }

            if (role.id === message.guild.id) {
                return message.reply({
                    embeds: [build.deny(message.author, 'cannot assign the @everyone role.')]
                });
            }

            if (role.managed) {
                return message.reply({
                    embeds: [build.deny(message.author, 'cannot assign managed integration roles.')]
                });
            }

            if (role.position >= botHighest) {
                return message.reply({
                    embeds: [build.deny(message.author, 'that role is higher than or equal to my highest role.')]
                });
            }

            if (!isOwner && role.position >= memberHighest) {
                return message.reply({
                    embeds: [build.deny(message.author, 'that role is higher than or equal to your highest role.')]
                });
            }

            await message.guild.members.fetch().catch(() => {});
            let targets = message.guild.members.cache;
            if (sub === 'humans' || sub === 'human') {
                targets = targets.filter(m => !m.user.bot);
            } else if (sub === 'bots' || sub === 'bot') {
                targets = targets.filter(m => m.user.bot);
            }

            if (targets.size === 0) {
                return message.reply({
                    embeds: [build.warn(message.author, `no matching members found for target \`${sub}\`.`)]
                });
            }

            const targetsWithoutRole = targets.filter(m => !m.roles.cache.has(role.id));
            const isAdding = targetsWithoutRole.size > 0;
            const targetList = isAdding ? targetsWithoutRole.values() : targets.filter(m => m.roles.cache.has(role.id)).values();
            const totalCount = isAdding ? targetsWithoutRole.size : targets.filter(m => m.roles.cache.has(role.id)).size;

            if (totalCount === 0) {
                return message.reply({
                    embeds: [build.warn(message.author, `no members need role updates for <@&${role.id}>.`)]
                });
            }

            const actionLabel = isAdding ? 'adding' : 'removing';
            const statusMsg = await message.reply({
                embeds: [build.approved(message.author, `${actionLabel} <@&${role.id}> for \`${totalCount}\` members...`)]
            });

            let completed = 0;
            for (const targetMember of targetList) {
                try {
                    if (isAdding) {
                        await targetMember.roles.add(role.id, `harm mass role by ${message.author.tag}`);
                    } else {
                        await targetMember.roles.remove(role.id, `harm mass role by ${message.author.tag}`);
                    }
                    completed++;
                } catch (_) {}
                // gentle pacing to respect rate limits
                if (completed % 10 === 0) {
                    await new Promise(r => setTimeout(r, 250));
                }
            }

            const pastLabel = isAdding ? 'added' : 'removed';
            const prep = isAdding ? 'to' : 'from';
            return statusMsg.edit({
                embeds: [build.approved(message.author, `successfully ${pastLabel} <@&${role.id}> ${prep} \`${completed}\` of \`${totalCount}\` members.`)]
            }).catch(() => {});
        }

        // ──────────────────────── 4. EXPLICIT ADD OR REMOVE ────────────────────────
        let explicitAction = null;
        let memberArg = null;
        let roleArg = null;

        if (sub === 'add' || sub === 'give') {
            explicitAction = 'add';
            memberArg = args[1];
            roleArg = args.slice(2).join(' ').trim();
        } else if (sub === 'remove' || sub === 'take') {
            explicitAction = 'remove';
            memberArg = args[1];
            roleArg = args.slice(2).join(' ').trim();
        } else {
            // Standard toggle: ,role @user <role>
            memberArg = args[0];
            roleArg = args.slice(1).join(' ').trim();
        }

        if (!memberArg || !roleArg) {
            return build.help(message, this);
        }

        const targetMember = await resolveMember(message.guild, memberArg, message);
        if (!targetMember) {
            return message.reply({
                embeds: [build.warn(message.author, `could not find member matching \`${memberArg}\`.`)]
            });
        }

        const role = resolveRole(message.guild, roleArg);
        if (!role) {
            return message.reply({
                embeds: [build.warn(message.author, `could not find a role matching \`${roleArg}\`.`)]
            });
        }

        if (role.id === message.guild.id) {
            return message.reply({
                embeds: [build.deny(message.author, 'cannot assign or remove the @everyone role.')]
            });
        }

        if (role.managed) {
            return message.reply({
                embeds: [build.deny(message.author, 'cannot modify an integration managed role.')]
            });
        }

        if (role.position >= botHighest) {
            return message.reply({
                embeds: [build.deny(message.author, 'that role is higher than or equal to my highest role.')]
            });
        }

        if (!isOwner && role.position >= memberHighest) {
            return message.reply({
                embeds: [build.deny(message.author, 'that role is higher than or equal to your highest role.')]
            });
        }

        // Target hierarchy check: invoker cannot modify roles of members ranked higher than them (unless owner)
        if (!isOwner && targetMember.id !== message.author.id && targetMember.roles.highest.position >= memberHighest) {
            return message.reply({
                embeds: [build.deny(message.author, 'you cannot modify roles for a member with equal or higher rank.')]
            });
        }

        const hasRole = targetMember.roles.cache.has(role.id);
        const shouldAdd = explicitAction === 'add' ? true : (explicitAction === 'remove' ? false : !hasRole);

        if (explicitAction === 'add' && hasRole) {
            return message.reply({
                embeds: [build.warn(message.author, `<@${targetMember.id}> already has the <@&${role.id}> role.`)]
            });
        }

        if (explicitAction === 'remove' && !hasRole) {
            return message.reply({
                embeds: [build.warn(message.author, `<@${targetMember.id}> does not have the <@&${role.id}> role.`)]
            });
        }

        try {
            if (shouldAdd) {
                await targetMember.roles.add(role.id, `harm role add by ${message.author.tag}`);
                return message.reply({
                    embeds: [build.approved(message.author, `added <@&${role.id}> to **${targetMember.user.tag}**.`)]
                });
            } else {
                await targetMember.roles.remove(role.id, `harm role remove by ${message.author.tag}`);
                return message.reply({
                    embeds: [build.approved(message.author, `removed <@&${role.id}> from **${targetMember.user.tag}**.`)]
                });
            }
        } catch (err) {
            return message.reply({
                embeds: [build.deny(message.author, `failed to update roles: ${err.message}`)]
            });
        }
    }
}

module.exports = RoleCommand;
