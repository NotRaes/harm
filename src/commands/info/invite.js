const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class InviteCommand {
    constructor() {
        this.name = 'invite';
        this.aliases = ['inv', 'botinvite', 'addbot'];
        this.description = 'get the invite link to add harm to your server.';
        this.cooldown = 2;
    }

    async execute(message, args) {
        const client = message.client;
        const clientId = client.user?.id || config.clientId || '1490995846626545674';
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}`;
        const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';

        const guildPrefix = (message.guild && client.db)
            ? (client.db.getGuildPrefix(message.guild.id) || config.prefix)
            : config.prefix;

        const bannerAttachment = build.getAssetAttachment('banner.png');
        const files = bannerAttachment ? [bannerAttachment] : [];

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('invite harm')
                .setEmoji(config.emojis?.harm || '<:harmsdio:1556221836507742278>')
                .setURL(inviteUrl),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('join discord')
                .setEmoji('<:discord_logo:1529300434374758481>')
                .setURL(supportUrl)
        );

        const botAvatar = client.user?.displayAvatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

        try {
            const container = new ContainerBuilder();
            container.setAccentColor(0x2b2d31);

            const section = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### [invite **harm**](${inviteUrl})\n` +
                        `-# authorize harm to elevate your server with high-fidelity music, dynamic voicemaster, economy, and utility.\n\n` +
                        `-# **quickstart**:\n` +
                        `-# \`${guildPrefix}help\` — list of all available commands\n` +
                        `-# \`${guildPrefix}prefix <new>\` — customize the server prefix\n` +
                        `-# **note:** **you** or *others* can also mention <@${clientId}> at any time if they forget the prefix.`
                    )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(botAvatar)
                );
            container.addSectionComponents(section);

            if (bannerAttachment) {
                const mediaGallery = new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://banner.png')
                );
                container.addMediaGalleryComponents(mediaGallery);
            }

            container
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addActionRowComponents(row);

            return await message.reply({
                components: [container],
                files,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            const fallbackEmbed = new EmbedBuilder()
                .setColor(config.colors.c || '#2b2d31')
                .setThumbnail(botAvatar)
                .setDescription(
                    `### [invite **harm**](${inviteUrl})\n` +
                    `-# authorize harm to elevate your server with high-fidelity music, dynamic voicemaster, economy, and utility.\n\n` +
                    `-# **quickstart**:\n` +
                    `-# \`${guildPrefix}help\` — list of all available commands\n` +
                    `-# \`${guildPrefix}prefix <new>\` — customize the server prefix\n` +
                    `-# **note:** **you** or *others* can also mention <@${clientId}> at any time if they forget the prefix.`
                );

            if (bannerAttachment) {
                fallbackEmbed.setImage('attachment://banner.png');
            }

            return await message.reply({
                embeds: [fallbackEmbed],
                components: [row],
                files
            }).catch(() => {});
        }
    }
}

module.exports = InviteCommand;
