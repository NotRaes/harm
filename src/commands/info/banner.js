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

class BannerCommand {
    constructor() {
        this.name = 'banner';
        this.aliases = ['b'];
        this.description = "display a member's or server's profile banner.";
        this.syntax = ',banner [@user|uid|server]';
        this.example = ',banner @user';
        this.category = 'info';
        this.cooldown = 2;
    }

    async execute(message, args) {
        const db = message.client.db;
        const sub = (args?.[0] || '').toLowerCase();

        // 1. Server Banner
        if (sub === 'server' || sub === 'guild') {
            if (!message.guild) {
                return message.reply(build.warnBox('nothing found', 'server banner is only available inside servers.'));
            }
            const bannerUrl = message.guild.bannerURL({ size: 2048 });
            if (!bannerUrl) {
                return message.reply(build.warnBox('nothing found', `${message.guild.name} has no banner set.`));
            }
            const pngUrl = message.guild.bannerURL({ extension: 'png', size: 2048 });
            const webpUrl = message.guild.bannerURL({ extension: 'webp', size: 2048 });
            const isAnimated = message.guild.banner?.startsWith('a_');
            const gifUrl = isAnimated ? message.guild.bannerURL({ extension: 'gif', size: 2048 }) : null;

            const links = isAnimated
                ? `[gif](${gifUrl}) · [png](${pngUrl}) · [webp](${webpUrl})`
                : `[png](${pngUrl}) · [webp](${webpUrl})`;

            const container = new ContainerBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**${message.guild.name}'s banner**\n${links}`)
                )
                .addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(gifUrl || pngUrl || bannerUrl)
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
                    .setDescription(`**${message.guild.name}'s banner**\n${links}`)
                    .setImage(gifUrl || pngUrl || bannerUrl);
                return await message.reply({ embeds: [embed] });
            }
        }

        // 2. User Banner Resolution
        let targetUser = message.author;

        if (args && args.length > 0) {
            const raw = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null) || args[0];
            const resolved = db ? await db.resolveUserOrProfile(raw) : null;
            if (resolved) {
                targetUser = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null)
                    || message.guild?.members?.cache?.get(resolved.userId)?.user
                    || message.client.users.cache.get(resolved.userId)
                    || await message.client.users.fetch(resolved.userId).catch(() => null);
            } else {
                const cleanId = String(args[0]).replace(/[<@!>]/g, '');
                targetUser = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null)
                    || message.guild?.members?.cache?.get(cleanId)?.user
                    || message.client.users.cache.get(cleanId)
                    || await message.client.users.fetch(cleanId).catch(() => null);
            }
        }

        if (!targetUser) {
            return message.reply(build.warnBox('nothing found', 'user could not be found.'));
        }

        // Force fetch to load banner hash from Discord REST
        const fetchedUser = await message.client.users.fetch(targetUser.id, { force: true }).catch(() => targetUser);

        if (!fetchedUser.banner) {
            return message.reply(build.warnBox('nothing found', `${targetUser.username} has no banner set.`));
        }

        const isAnimated = fetchedUser.banner.startsWith('a_');
        const pngUrl = fetchedUser.bannerURL({ extension: 'png', size: 2048 });
        const webpUrl = fetchedUser.bannerURL({ extension: 'webp', size: 2048 });
        const gifUrl = isAnimated ? fetchedUser.bannerURL({ extension: 'gif', size: 2048 }) : null;
        const displayUrl = gifUrl || pngUrl;

        const links = isAnimated
            ? `[gif](${gifUrl}) · [png](${pngUrl}) · [webp](${webpUrl})`
            : `[png](${pngUrl}) · [webp](${webpUrl})`;

        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`**${targetUser.username}'s banner**\n${links}`)
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
                .setDescription(`**${targetUser.username}'s banner**\n${links}`)
                .setImage(displayUrl);
            return await message.reply({ embeds: [embed] });
        }
    }
}

module.exports = BannerCommand;
