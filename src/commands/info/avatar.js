const {
    ContainerBuilder,
    TextDisplayBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    EmbedBuilder
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class AvatarCommand {
    constructor() {
        this.name = 'avatar';
        this.aliases = ['av', 'pfp'];
        this.description = "display a member's or server's profile avatar.";
        this.syntax = ',avatar [@user|uid|server|icon]';
        this.example = ',avatar @user';
        this.category = 'info';
        this.cooldown = 2;
    }

    async execute(message, args) {
        const db = message.client.db;
        const sub = (args?.[0] || '').toLowerCase();

        // 1. Server Icon
        if (sub === 'icon' || sub === 'guild') {
            if (!message.guild) {
                return message.reply(build.warnBox('nothing found', 'server icon is only available inside servers.'));
            }
            const iconUrl = message.guild.iconURL({ size: 2048 });
            if (!iconUrl) {
                return message.reply(build.warnBox('nothing found', `${message.guild.name} has no icon set.`));
            }
            const isAnimated = Boolean(message.guild.icon?.startsWith('a_'));
            const pngUrl = message.guild.iconURL({ extension: 'png', size: 2048 });
            const webpUrl = message.guild.iconURL({ extension: 'webp', size: 2048 });
            const gifUrl = isAnimated ? message.guild.iconURL({ extension: 'gif', size: 2048 }) : null;
            const displayUrl = gifUrl || pngUrl || iconUrl;

            const links = isAnimated
                ? `[gif](${gifUrl}) · [png](${pngUrl}) · [webp](${webpUrl})`
                : `[png](${pngUrl}) · [webp](${webpUrl})`;

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**${message.guild.name}'s icon**\n${links}`)
                )
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(displayUrl)
                    )
                );

            try {
                return await message.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (_) {
                const embed = new EmbedBuilder()
                    .setColor(config.colors.c || 0x2b2d31)
                    .setDescription(`**${message.guild.name}'s icon**\n${links}`)
                    .setImage(displayUrl);
                return await message.reply({ embeds: [embed] });
            }
        }

        // 2. Target Resolution (mentions, IDs, UIDs, author)
        let targetUser = message.author;
        let isServerAvatarRequested = false;

        const filteredArgs = [];
        if (args && args.length > 0) {
            for (const a of args) {
                if (a.toLowerCase() === 'server' || a.toLowerCase() === '-server' || a.toLowerCase() === 'guild') {
                    isServerAvatarRequested = true;
                } else {
                    filteredArgs.push(a);
                }
            }
        }

        if (filteredArgs.length > 0) {
            const raw = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null) || filteredArgs[0];
            const resolved = db ? await db.resolveUserOrProfile(raw) : null;
            if (resolved) {
                targetUser = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null)
                    || message.guild?.members?.cache?.get(resolved.userId)?.user
                    || message.client.users.cache.get(resolved.userId)
                    || await message.client.users.fetch(resolved.userId).catch(() => null);
            } else {
                const cleanId = String(filteredArgs[0]).replace(/[<@!>]/g, '');
                targetUser = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null)
                    || message.guild?.members?.cache?.get(cleanId)?.user
                    || message.client.users.cache.get(cleanId)
                    || await message.client.users.fetch(cleanId).catch(() => null);
            }
        }

        if (!targetUser) {
            return message.reply(build.warnBox('nothing found', 'user could not be found.'));
        }

        // 3. Server Avatar Mode
        if (isServerAvatarRequested) {
            const member = message.guild?.members?.cache?.get(targetUser.id)
                || (typeof message.guild?.members?.fetch === 'function' ? await message.guild.members.fetch(targetUser.id).catch(() => null) : null);

            if (!member?.avatar) {
                return message.reply(build.warnBox('nothing found', `${targetUser.username} has no server avatar set.`));
            }

            const isAnimated = member.avatar.startsWith('a_');
            const pngUrl = member.displayAvatarURL({ extension: 'png', size: 2048 });
            const webpUrl = member.displayAvatarURL({ extension: 'webp', size: 2048 });
            const gifUrl = isAnimated ? member.displayAvatarURL({ extension: 'gif', size: 2048 }) : null;
            const displayUrl = gifUrl || pngUrl;

            const links = isAnimated
                ? `[gif](${gifUrl}) · [png](${pngUrl}) · [webp](${webpUrl})`
                : `[png](${pngUrl}) · [webp](${webpUrl})`;

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**${targetUser.username}'s server avatar**\n${links}`)
                )
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(displayUrl)
                    )
                );

            try {
                return await message.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (_) {
                const embed = new EmbedBuilder()
                    .setColor(config.colors.c || 0x2b2d31)
                    .setDescription(`**${targetUser.username}'s server avatar**\n${links}`)
                    .setImage(displayUrl);
                return await message.reply({ embeds: [embed] });
            }
        }

        // 4. Global User Avatar
        const isAnimated = Boolean(targetUser.avatar?.startsWith('a_'));
        const pngUrl = targetUser.displayAvatarURL({ extension: 'png', size: 2048 });
        const webpUrl = targetUser.displayAvatarURL({ extension: 'webp', size: 2048 });
        const gifUrl = isAnimated ? targetUser.displayAvatarURL({ extension: 'gif', size: 2048 }) : null;
        const displayUrl = gifUrl || pngUrl;

        const links = isAnimated
            ? `[gif](${gifUrl}) · [png](${pngUrl}) · [webp](${webpUrl})`
            : `[png](${pngUrl}) · [webp](${webpUrl})`;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**${targetUser.username}'s avatar**\n${links}`)
            )
            .addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(displayUrl)
                )
            );

        try {
            return await message.reply({
                components: [container],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            const embed = new EmbedBuilder()
                .setColor(config.colors.c || 0x2b2d31)
                .setDescription(`**${targetUser.username}'s avatar**\n${links}`)
                .setImage(displayUrl);
            return await message.reply({ embeds: [embed] });
        }
    }
}

module.exports = AvatarCommand;
