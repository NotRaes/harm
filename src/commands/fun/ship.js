const { AttachmentBuilder } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const {
    renderShipCard,
    generateShipName,
    calculateShipPercent,
    getShipComment
} = require('../../structures/utils/helpers/ship.js');

class ShipCommand {
    constructor() {
        this.name = 'ship';
        this.aliases = [];
        this.description = 'calculate love compatibility and ship two users with an aesthetic card.';
        this.syntax = ',ship [@user1] [@user2]';
        this.example = ',ship @user1 @user2';
        this.category = 'fun';
        this.cooldown = 3;
    }

    async resolveTarget(message, input) {
        if (!input) return null;

        // 1. Mention check
        const mentionMatch = input.match(/^<@!?(\d+)>$/);
        const userId = mentionMatch ? mentionMatch[1] : (/^\d{17,20}$/.test(input) ? input : null);

        if (userId) {
            try {
                const user = await message.client.users.fetch(userId);
                if (user) {
                    return {
                        id: user.id,
                        name: user.displayName || user.username,
                        avatar: user.displayAvatarURL({ extension: 'png', size: 256 })
                    };
                }
            } catch (_) {}
        }

        // 2. Guild member name/nick search
        if (message.guild) {
            const query = input.toLowerCase();
            const member = message.guild.members.cache.find(m =>
                m.user.username.toLowerCase() === query ||
                m.displayName.toLowerCase() === query
            );
            if (member) {
                return {
                    id: member.user.id,
                    name: member.displayName || member.user.username,
                    avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 })
                };
            }
        }

        // 3. Fallback to raw string / fictional entity
        return {
            id: input.toLowerCase(),
            name: input,
            avatar: null
        };
    }

    async execute(message, args) {
        let target1 = null;
        let target2 = null;

        if (!args || args.length === 0) {
            // Ship author with a random member in the server
            target1 = {
                id: message.author.id,
                name: message.member?.displayName || message.author.displayName || message.author.username,
                avatar: message.author.displayAvatarURL({ extension: 'png', size: 256 })
            };

            const candidates = message.guild?.members.cache.filter(m => !m.user.bot && m.id !== message.author.id);
            if (candidates && candidates.size > 0) {
                const randomMember = candidates.random();
                target2 = {
                    id: randomMember.user.id,
                    name: randomMember.displayName || randomMember.user.username,
                    avatar: randomMember.user.displayAvatarURL({ extension: 'png', size: 256 })
                };
            } else {
                return message.reply(build.warnBox('invalid parameter', 'specify at least one user to ship with.'));
            }
        } else if (args.length === 1) {
            // Ship author with specified target
            target1 = {
                id: message.author.id,
                name: message.member?.displayName || message.author.displayName || message.author.username,
                avatar: message.author.displayAvatarURL({ extension: 'png', size: 256 })
            };
            target2 = await this.resolveTarget(message, args[0]);
        } else {
            // Ship two specified targets
            target1 = await this.resolveTarget(message, args[0]);
            target2 = await this.resolveTarget(message, args[1]);
        }

        if (!target1 || !target2) {
            return message.reply(build.warnBox('invalid parameter', 'specify valid users or names to ship.'));
        }

        const name1 = target1.name.toLowerCase();
        const name2 = target2.name.toLowerCase();
        const percent = calculateShipPercent();
        const shipName = generateShipName(name1, name2);
        const comment = getShipComment(percent);

        try {
            const buffer = await renderShipCard({
                name1,
                name2,
                avatarUrl1: target1.avatar,
                avatarUrl2: target2.avatar,
                percent,
                shipName,
                comment
            });

            const attachment = new AttachmentBuilder(buffer, { name: 'ship.png' });

            return await message.reply({
                content: `${name1} 💞 ${name2} -> **${shipName}** • ${percent}%`,
                files: [attachment],
                allowedMentions: { repliedUser: false }
            });
        } catch (err) {
            console.error('[ship command error]:', err);
            return message.reply(build.warnBox('error', 'failed to generate the ship card. please try again.'));
        }
    }
}

module.exports = ShipCommand;
