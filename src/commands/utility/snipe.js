const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class SnipeCommand {
    constructor() {
        this.name = 'snipe';
        this.aliases = ['s', 'editsnipe', 'es', 'clearsnipe', 'cs'];
        this.description = 'retrieve recently deleted or edited messages in this channel.';
        this.syntax = ',snipe [edit|clear|list|enable|disable|index]';
        this.example = ',snipe';
        this.category = 'utility';
        this.cooldown = 2;
        this.subcommands = [
            'snipe [index]',
            'snipe edit [index]',
            'snipe clear',
            'snipe list',
            'snipe enable',
            'snipe disable'
        ];
        this.subcommandDetails = {
            message: {
                description: 'view a deleted message by index (1 to any number).',
                syntax: ',snipe [index]',
                example: ',snipe 2'
            },
            edit: {
                description: 'view an edited message before edits by index.',
                syntax: ',snipe edit [index]',
                example: ',snipe edit'
            },
            clear: {
                description: 'clear deleted and edited message history for this channel.',
                syntax: ',snipe clear',
                example: ',snipe clear'
            },
            list: {
                description: 'view an overview of recent deleted messages in this channel.',
                syntax: ',snipe list',
                example: ',snipe list'
            },
            enable: {
                description: 'allow message sniping in this server.',
                syntax: ',snipe enable',
                example: ',snipe enable'
            },
            disable: {
                description: 'prevent message sniping in this server.',
                syntax: ',snipe disable',
                example: ',snipe disable'
            }
        };
    }

    async execute(message, args, commandName) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const invoked = (commandName || '').toLowerCase();
        let sub = (args?.[0] || '').toLowerCase();
        const db = message.client.db;
        const isOwner = config.owners?.includes(message.author.id);

        // 1. Alias redirects
        if (invoked === 'editsnipe' || invoked === 'es') {
            sub = 'edit';
            args = args.slice(1);
        } else if (invoked === 'clearsnipe' || invoked === 'cs') {
            sub = 'clear';
            args = args.slice(1);
        }

        // ──────────────────────── 1. ENABLE / DISABLE TOGGLE ────────────────────────
        if (sub === 'enable' || sub === 'on' || sub === 'disable' || sub === 'off') {
            const hasModPerms = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageGuild);
            if (!hasModPerms) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to toggle snipe.'));
            }

            const newState = (sub === 'enable' || sub === 'on');
            if (db) await db.setSnipeEnabled(message.guild.id, newState);

            return message.reply({
                embeds: [build.approved(message.author, `snipe is now ${newState ? 'enabled' : 'disabled'}.`)]
            });
        }

        // ──────────────────────── 2. CHECK IF SNIPE IS ENABLED ────────────────────────
        const isEnabled = db ? db.isSnipeEnabled(message.guild.id) : true;
        if (!isEnabled) {
            return message.reply({
                embeds: [build.warn(message.author, 'snipe is currently disabled in this server.\n-# an administrator can run `,snipe enable` to allow it.')]
            });
        }

        // ──────────────────────── 3. CLEAR ────────────────────────
        if (sub === 'clear') {
            const hasPerms = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageMessages);
            if (!hasPerms) {
                return message.reply(build.denyBox('permission denied', 'you need manage messages permission to clear snipes.'));
            }

            if (message.client.snipes) message.client.snipes.delete(message.channel.id);
            if (message.client.editSnipes) message.client.editSnipes.delete(message.channel.id);

            return message.reply({
                embeds: [build.approved(message.author, 'cleared all snipes for this channel.')]
            });
        }

        // ──────────────────────── 4. LIST ────────────────────────
        if (sub === 'list') {
            const snipes = message.client.snipes?.get(message.channel.id) || [];
            if (snipes.length === 0) {
                return message.reply({
                    embeds: [build.warn(message.author, 'no deleted messages found in this channel.')]
                });
            }

            const lines = snipes.slice(0, 15).map((s, idx) => {
                const authorTag = s.author?.tag || 'unknown';
                const relTime = `<t:${Math.floor(s.deletedAt / 1000)}:R>`;
                const snippet = s.content ? (s.content.length > 30 ? `${s.content.slice(0, 30)}...` : s.content) : '[attachment/media]';
                return `\`${idx + 1}.\` **${authorTag}** — "${snippet}" (${relTime})`;
            });

            const embed = new EmbedBuilder()
                .setColor(config.colors.c || 0x2b2d31)
                .setDescription(
                    `### [deleted messages](${config.supportInvite || 'https://discord.gg/eqwcPU2mfS'})\n` +
                    `-# ${snipes.length} cached in <#${message.channel.id}>\n\n` +
                    lines.join('\n')
                );

            return message.reply({ embeds: [embed] });
        }

        // ──────────────────────── 5. EDIT SNIPE ────────────────────────
        if (sub === 'edit') {
            const edits = message.client.editSnipes?.get(message.channel.id) || [];
            if (edits.length === 0) {
                return message.reply({
                    embeds: [build.warn(message.author, 'no edited messages found in this channel.')]
                });
            }

            let index = 1;
            if (args[1] && !isNaN(parseInt(args[1], 10))) {
                index = parseInt(args[1], 10);
            }

            if (index < 1) {
                return message.reply({
                    embeds: [build.warn(message.author, 'index must be 1 or higher.')]
                });
            }

            if (index > edits.length) {
                return message.reply({
                    embeds: [build.warn(message.author, `only \`${edits.length}\` edited messages are cached for this channel.`)]
                });
            }

            const targetEdit = edits[index - 1];
            const author = targetEdit.author;
            const authorText = author ? author.tag : 'unknown user';
            const authorAvatar = author?.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0.png';
            const editedTime = `<t:${Math.floor(targetEdit.editedAt / 1000)}:R>`;

            const embed = new EmbedBuilder()
                .setColor(config.colors.c || 0x2b2d31)
                .setAuthor({ name: authorText, iconURL: authorAvatar })
                .setDescription(
                    `**before:**\n${targetEdit.oldContent}\n\n` +
                    `**after:**\n${targetEdit.newContent}\n\n` +
                    `-# edited ${editedTime} • entry \`${index}\` of \`${edits.length}\``
                );

            return message.reply({ embeds: [embed] });
        }

        // ──────────────────────── 6. DELETE SNIPE (DEFAULT, ARBITRARY / INF INDEX) ────────────────────────
        let index = 1;
        if (sub && !isNaN(parseInt(sub, 10))) {
            index = parseInt(sub, 10);
        }

        const snipes = message.client.snipes?.get(message.channel.id) || [];
        if (snipes.length === 0) {
            return message.reply({
                embeds: [build.warn(message.author, 'no deleted messages found in this channel.')]
            });
        }

        if (index < 1) {
            return message.reply({
                embeds: [build.warn(message.author, 'index must be 1 or higher.')]
            });
        }

        if (index > snipes.length) {
            return message.reply({
                embeds: [build.warn(message.author, `only \`${snipes.length}\` deleted messages are cached for this channel.`)]
            });
        }

        const target = snipes[index - 1];
        const author = target.author;
        const authorText = author ? author.tag : 'unknown user';
        const authorAvatar = author?.avatarURL || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const deletedTime = `<t:${Math.floor(target.deletedAt / 1000)}:R>`;

        const descParts = [];
        if (target.content) {
            descParts.push(target.content);
        }

        if (target.stickers && target.stickers.length > 0) {
            descParts.push(`\n*sticker: ${target.stickers[0].name}*`);
        }

        descParts.push(`\n-# deleted ${deletedTime} • entry \`${index}\` of \`${snipes.length}\``);

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || 0x2b2d31)
            .setAuthor({ name: authorText, iconURL: authorAvatar })
            .setDescription(descParts.join('\n'));

        // If an attachment was an image, display it
        if (target.attachments && target.attachments.length > 0) {
            const firstImg = target.attachments.find(a => a.contentType?.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(a.url));
            if (firstImg) {
                embed.setImage(firstImg.proxyURL || firstImg.url);
            }
        }

        return message.reply({ embeds: [embed] });
    }
}

module.exports = SnipeCommand;
