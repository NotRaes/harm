const {
    AuditLogEvent,
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
const build = require('../structures/utils/builder.js');
const config = require('../config.js');

class GuildCreateEvent {
    constructor(client) {
        this.name = 'guildCreate';
        this.once = false;
        this.client = client;
    }

    async execute(guild) {
        if (!guild || !guild.available) return;

        const recipients = new Map();

        // 1. Resolve who added the bot via audit log
        try {
            if (guild.members?.me?.permissions?.has('ViewAuditLog')) {
                const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 }).catch(() => null);
                const entry = logs?.entries?.first();
                if (entry && entry.target?.id === this.client.user?.id && entry.executor && !entry.executor.bot) {
                    recipients.set(entry.executor.id, entry.executor);
                }
            }
        } catch (_) {}

        // 2. Resolve guild owner
        try {
            const ownerMember = await guild.fetchOwner().catch(() => null);
            if (ownerMember?.user && !ownerMember.user.bot) {
                recipients.set(ownerMember.user.id, ownerMember.user);
            } else if (guild.ownerId) {
                const ownerUser = await this.client.users.fetch(guild.ownerId).catch(() => null);
                if (ownerUser && !ownerUser.bot) {
                    recipients.set(ownerUser.id, ownerUser);
                }
            }
        } catch (_) {}

        // 3. Deliver Components V2 Welcome DM sequence
        for (const user of recipients.values()) {
            await this.deliverWelcomeSequence(user).catch(() => {});
        }
    }

    async deliverWelcomeSequence(user) {
        if (!user) return false;
        const p = config.prefix || ',';
        const clientId = this.client?.user?.id || config.clientId || '1490995846626545674';
        const inviteUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}`;
        const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';

        // Container 1: Identity & Quickstart
        const bannerAttachment = build.getAssetAttachment('banner.png');
        const container1 = new ContainerBuilder();
        container1.setAccentColor(0x2b2d31);

        if (bannerAttachment) {
            container1.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://banner.png')
                )
            );
        }

        container1
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### [welcome to **harm**!](${supportUrl})\n` +
                    `-# thanks for adding harm to your server! your members can now use all of harm's commands with the \`${p}\` prefix — no setup needed.`
                )
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `-# **quickstart**:\n` +
                    `-# \`${p}help\` — list of all available commands\n` +
                    `-# \`${p}invite\` — bot invite link and support server\n` +
                    `-# \`${p}invites\` — track referrals and invitation stats\n` +
                    `-# **note:** **you** or *others* can also mention <@${clientId}> at any time if they forget the prefix.`
                )
            );

        try {
            await user.send({
                components: [container1],
                files: bannerAttachment ? [bannerAttachment] : [],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            return false; // DMs locked or blocked
        }

        // Calm cadence delay
        await new Promise(r => setTimeout(r, 600));

        // Container 2: Community & Freebies CTA
        const giveawaysAttachment = build.getAssetAttachment('giveaways.png');
        const duckAttachment = build.getAssetAttachment('duck_phone.png');
        const files2 = [];
        if (giveawaysAttachment) files2.push(giveawaysAttachment);
        if (duckAttachment) files2.push(duckAttachment);

        const container2 = new ContainerBuilder();
        container2.setAccentColor(0x2b2d31);

        if (giveawaysAttachment) {
            container2.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://giveaways.png')
                )
            );
        }

        container2.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

        const premEmoji = config.emojis?.premium || '<:harm_premium:1558810882795114536>';
        const promoSection = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### do you like freebies?\n` +
                    `-# we often drop **harm premium** ${premEmoji} codes and **giveaways** on our [**discord**](${supportUrl}).\n` +
                    `-# you also get commands like \`${p}gen fm\` for **free** by joining the server.\n\n` +
                    `-# don't miss out on **extra goodies**!`
                )
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder().setURL('attachment://duck_phone.png')
            );
        container2.addSectionComponents(promoSection);

        container2.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

        const promoRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('join discord')
                .setEmoji('<:discord_logo:1529300434374758481>')
                .setURL(supportUrl),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('invite harm')
                .setEmoji(config.emojis?.harm || '<:harmsdio:1556221836507742278>')
                .setURL(inviteUrl)
        );
        container2.addActionRowComponents(promoRow);

        try {
            await user.send({
                components: [container2],
                files: files2,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {}

        return true;
    }
}

module.exports = GuildCreateEvent;
