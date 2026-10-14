const { PermissionFlagsBits } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

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

class PurgeCommand {
    constructor() {
        this.name = 'purge';
        this.aliases = ['c', 'clear'];
        this.description = 'bulk delete messages from this channel with advanced filters.';
        this.syntax = ',purge <amount|user|bots|images|links|contains> [args]';
        this.example = ',purge 50';
        this.category = 'utility';
        this.permissions = ['ManageMessages'];
        this.cooldown = 2;
        this.subcommands = [
            'purge <amount>',
            'purge @user [amount]',
            'purge bots [amount]',
            'purge humans [amount]',
            'purge images [amount]',
            'purge links [amount]',
            'purge contains <text> [amount]',
            'purge pins [amount]'
        ];
        this.subcommandDetails = {
            amount: {
                description: 'bulk delete the most recent messages (up to 1,000).',
                syntax: ',purge <amount>',
                example: ',purge 25'
            },
            user: {
                description: 'delete recent messages sent by a specific user.',
                syntax: ',purge @user [amount]',
                example: ',purge @user 50'
            },
            bots: {
                description: 'delete recent messages sent by bot accounts.',
                syntax: ',purge bots [amount]',
                example: ',purge bots 30'
            },
            humans: {
                description: 'delete recent messages sent by human members.',
                syntax: ',purge humans [amount]',
                example: ',purge humans 50'
            },
            images: {
                description: 'delete messages containing attachments or media links.',
                syntax: ',purge images [amount]',
                example: ',purge images 25'
            },
            links: {
                description: 'delete messages containing urls or discord invites.',
                syntax: ',purge links [amount]',
                example: ',purge links 30'
            },
            contains: {
                description: 'delete messages containing specific text or keywords.',
                syntax: ',purge contains <text> [amount]',
                example: ',purge contains discord.gg 20'
            },
            pins: {
                description: 'bulk delete pinned messages in this channel.',
                syntax: ',purge pins [amount]',
                example: ',purge pins 10'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const isOwner = config.owners?.includes(message.author.id) || message.guild.ownerId === message.author.id;
        const hasPerms = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageMessages);
        if (!hasPerms) {
            return message.reply(build.denyBox('permission denied', 'you need manage messages permissions to use purge.'));
        }

        const botMember = message.guild.members.me;
        if (!botMember?.permissionsIn(message.channel)?.has(PermissionFlagsBits.ManageMessages)) {
            return message.reply(build.denyBox('permission denied', 'i need manage messages permissions in this channel.'));
        }

        if (!args || args.length === 0) {
            return build.help(message, this);
        }

        const startTime = Date.now();
        const sub = (args[0] || '').toLowerCase();
        let targetCount = 100;
        let filterFn = () => true;
        let isPinsCommand = false;

        // ──────────────────────── 1. PARSE CRITERIA ────────────────────────
        if (!isNaN(parseInt(sub, 10))) {
            // Direct number: ,purge 50
            targetCount = parseInt(sub, 10);
            filterFn = () => true;
        } else if (sub === 'bots' || sub === 'bot') {
            targetCount = args[1] && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : 50;
            filterFn = (m) => m.author?.bot;
        } else if (sub === 'humans' || sub === 'human' || sub === 'users') {
            targetCount = args[1] && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : 50;
            filterFn = (m) => !m.author?.bot;
        } else if (sub === 'images' || sub === 'image' || sub === 'media' || sub === 'attachments' || sub === 'files') {
            targetCount = args[1] && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : 50;
            filterFn = (m) => m.attachments?.size > 0 || /\.(png|jpe?g|gif|webp|mp4|mov|webm)/i.test(m.content || '');
        } else if (sub === 'links' || sub === 'link' || sub === 'urls' || sub === 'url') {
            targetCount = args[1] && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : 50;
            filterFn = (m) => /https?:\/\/|discord\.(gg|com\/invite)/i.test(m.content || '');
        } else if (sub === 'pins' || sub === 'pin') {
            isPinsCommand = true;
            targetCount = args[1] && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : 50;
            filterFn = (m) => m.pinned;
        } else if (sub === 'contains' || sub === 'match') {
            const restArgs = args.slice(1);
            if (restArgs.length === 0) {
                return message.reply(build.warnBox('specify text or a keyword to filter messages by.'));
            }
            let query = restArgs.join(' ');
            const lastWord = restArgs[restArgs.length - 1];
            if (restArgs.length > 1 && !isNaN(parseInt(lastWord, 10))) {
                targetCount = parseInt(lastWord, 10);
                query = restArgs.slice(0, -1).join(' ');
            } else {
                targetCount = 50;
            }
            const lowerQuery = query.toLowerCase();
            filterFn = (m) => (m.content || '').toLowerCase().includes(lowerQuery);
        } else {
            // Check for user mention or user id: ,purge @user [amount]
            const targetMember = await resolveMember(message.guild, args[0], message);
            if (targetMember) {
                targetCount = args[1] && !isNaN(parseInt(args[1], 10)) ? parseInt(args[1], 10) : 50;
                filterFn = (m) => m.author?.id === targetMember.id;
            } else {
                return build.help(message, this);
            }
        }

        // Clamp targetCount between 1 and 1000
        if (targetCount < 1) targetCount = 1;
        if (targetCount > 1000) targetCount = 1000;

        // Delete the invocation message so it doesn't skew count
        await message.delete().catch(() => {});

        // ──────────────────────── 2. FETCH & FILTER MESSAGES ────────────────────────
        const toDelete = [];
        let lastId = null;
        const fourteenDaysAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

        while (toDelete.length < targetCount) {
            const remaining = targetCount - toDelete.length;
            const fetchLimit = Math.min(100, Math.max(20, remaining > 50 ? 100 : remaining * 2));
            const fetchOptions = { limit: fetchLimit };
            if (lastId) fetchOptions.before = lastId;

            const fetched = await message.channel.messages.fetch(fetchOptions).catch(() => null);
            if (!fetched || fetched.size === 0) break;

            lastId = fetched.last()?.id;

            for (const msg of fetched.values()) {
                // Bulk delete cannot delete messages older than 14 days
                if (msg.createdTimestamp < fourteenDaysAgo) {
                    break;
                }

                // Preserve pinned messages unless explicitly running ,purge pins
                if (msg.pinned && !isPinsCommand) continue;

                if (filterFn(msg)) {
                    toDelete.push(msg);
                    if (toDelete.length >= targetCount) break;
                }
            }

            if (fetched.size < fetchLimit) break;
            if (fetched.last()?.createdTimestamp < fourteenDaysAgo) break;
        }

        if (toDelete.length === 0) {
            const warnNotice = await message.channel.send({
                embeds: [build.warn(message.author, 'no messages found matching your criteria.')]
            }).catch(() => null);
            if (warnNotice) {
                setTimeout(() => warnNotice.delete().catch(() => {}), 3500);
            }
            return;
        }

        // ──────────────────────── 3. BULK DELETE IN CHUNKS ────────────────────────
        let deletedTotal = 0;
        for (let i = 0; i < toDelete.length; i += 100) {
            const chunk = toDelete.slice(i, i + 100);
            const res = await message.channel.bulkDelete(chunk, true).catch(() => null);
            if (res) {
                deletedTotal += res.size;
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const confirmNotice = await message.channel.send({
            embeds: [build.approved(message.author, `cleared \`${deletedTotal}\` message${deletedTotal === 1 ? '' : 's'} in <#${message.channel.id}> · \`${elapsed}s\``)]
        }).catch(() => null);

        if (confirmNotice) {
            setTimeout(() => {
                confirmNotice.delete().catch(() => {});
            }, 3500);
        }
    }
}

module.exports = PurgeCommand;
