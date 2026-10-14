const { PermissionFlagsBits, parseEmoji } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class StealCommand {
    constructor() {
        this.name = 'steal';
        this.aliases = [];
        this.description = 'steal and add emojis or stickers to this server.';
        this.syntax = ',steal <emoji|link|reply> [name]';
        this.example = ',steal <:harm:1556221836507742278> harm_icon';
        this.category = 'utility';
        this.permissions = ['ManageGuildExpressions'];
        this.cooldown = 3;
        this.subcommands = [
            'steal <emoji> [name]',
            'steal <emoji1> <emoji2> ...',
            'steal <url> <name>'
        ];
        this.subcommandDetails = {
            emoji: {
                description: 'add an emoji by providing its emote or mention.',
                syntax: ',steal <emoji> [name]',
                example: ',steal <:cat:123456789> my_cat'
            },
            multi: {
                description: 'batch steal multiple emojis at once.',
                syntax: ',steal <emoji1> <emoji2> <emoji3>',
                example: ',steal <:cat:123> <:dog:456>'
            },
            url: {
                description: 'add an emoji from an image url or attachment.',
                syntax: ',steal <url> <name>',
                example: ',steal https://i.imgur.com/example.png star'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const isOwner = config.owners?.includes(message.author.id);
        const hasPerms = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageGuildExpressions) || message.member?.permissions?.has(PermissionFlagsBits.ManageEmojisAndStickers);

        if (!hasPerms) {
            return message.reply(build.denyBox('permission denied', 'you need manage emojis and stickers permission to steal emojis.'));
        }

        const botMember = message.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageGuildExpressions) && !botMember.permissions.has(PermissionFlagsBits.ManageEmojisAndStickers)) {
            return message.reply(build.denyBox('missing permissions', 'harm requires `manage_emojis_and_stickers` permission to add emojis.'));
        }

        let targets = [];

        // 1. Check if replying to a message
        if (message.reference && message.reference.messageId) {
            try {
                const refMsg = await message.channel.messages.fetch(message.reference.messageId);
                // Check for custom emojis in referenced message
                if (refMsg.content) {
                    const matches = refMsg.content.matchAll(/<(a)?:([a-zA-Z0-9_]{2,32}):([0-9]{17,20})>/g);
                    for (const m of matches) {
                        const isAnimated = Boolean(m[1]);
                        const name = m[2];
                        const id = m[3];
                        targets.push({
                            name,
                            url: `https://cdn.discordapp.com/emojis/${id}.${isAnimated ? 'gif' : 'png'}`
                        });
                    }
                }
                // Check for stickers in referenced message
                if (refMsg.stickers && refMsg.stickers.size > 0) {
                    for (const s of refMsg.stickers.values()) {
                        targets.push({
                            name: s.name.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32),
                            url: s.url
                        });
                    }
                }
                // Check for attachments in referenced message
                if (refMsg.attachments && refMsg.attachments.size > 0 && targets.length === 0) {
                    const firstAtt = refMsg.attachments.first();
                    const cleanName = firstAtt.name ? firstAtt.name.split('.')[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) : 'emoji';
                    targets.push({
                        name: args[0] ? args[0].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32) : cleanName,
                        url: firstAtt.url
                    });
                }
            } catch (_) {}
        }

        // 2. Parse emojis from arguments if no targets resolved from reply
        if (targets.length === 0 && args && args.length > 0) {
            const rawContent = args.join(' ');
            const matches = Array.from(rawContent.matchAll(/<(a)?:([a-zA-Z0-9_]{2,32}):([0-9]{17,20})>/g));

            if (matches.length > 0) {
                // If only 1 emoji and a 2nd argument was specified, that 2nd arg is the custom name
                if (matches.length === 1 && args.length >= 2) {
                    const customName = args[1].replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
                    const isAnimated = Boolean(matches[0][1]);
                    const id = matches[0][3];
                    targets.push({
                        name: customName || matches[0][2],
                        url: `https://cdn.discordapp.com/emojis/${id}.${isAnimated ? 'gif' : 'png'}`
                    });
                } else {
                    for (const m of matches) {
                        const isAnimated = Boolean(m[1]);
                        const name = m[2];
                        const id = m[3];
                        targets.push({
                            name,
                            url: `https://cdn.discordapp.com/emojis/${id}.${isAnimated ? 'gif' : 'png'}`
                        });
                    }
                }
            } else if (args[0].startsWith('http://') || args[0].startsWith('https://')) {
                // URL input: ,steal <url> [name]
                const url = args[0];
                const customName = (args[1] || 'stolen_emoji').replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
                targets.push({ name: customName, url });
            }
        }

        // 3. Check for attachments on the current command message
        if (targets.length === 0 && message.attachments && message.attachments.size > 0) {
            const firstAtt = message.attachments.first();
            const customName = (args[0] || firstAtt.name.split('.')[0]).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
            targets.push({ name: customName, url: firstAtt.url });
        }

        if (targets.length === 0) {
            return message.reply(build.warnBox('provide an emoji, image url, or reply to a message containing emojis.'));
        }

        // Cap batch steal to 10 at once to avoid rate limits
        if (targets.length > 10) targets = targets.slice(0, 10);

        const added = [];
        const failed = [];

        for (const item of targets) {
            try {
                const created = await message.guild.emojis.create({
                    attachment: item.url,
                    name: item.name
                });
                added.push(created);
            } catch (err) {
                failed.push({ name: item.name, reason: err.message });
            }
        }

        if (added.length === 0) {
            const errMsg = failed[0]?.reason?.includes('Maximum number') ? 'server emoji limit has been reached.' : 'failed to add emoji. ensure the image format is valid.';
            return message.reply(build.denyBox(errMsg));
        }

        if (added.length === 1) {
            const e = added[0];
            return message.reply(build.approvedBox(`added emoji **${e.name}** ${e}`));
        }

        const emojiList = added.map(e => `${e}`).join(' ');
        return message.reply(build.approvedBox(`added \`${added.length}\` emojis: ${emojiList}`));
    }
}

module.exports = StealCommand;
