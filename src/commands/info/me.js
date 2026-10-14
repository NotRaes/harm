const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ThumbnailBuilder,
    MessageFlags,
    EmbedBuilder
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class MeCommand {
    constructor() {
        this.name = 'me';
        this.aliases = ['profile', 'tier', 'premium'];
        this.description = 'check your unique harm uid and premium membership tier.';
        this.syntax = ',me [@user|uuid|userid]';
        this.example = ',me 0';
        this.category = 'info';
        this.cooldown = 2;
    }

    async execute(message, args) {
        const db = message.client.db;
        const isCallerOwner = config.owners?.includes(message.author.id);
        const sub = args?.[0]?.toLowerCase();

        // Owner Premium Management: ,me grant <user|uid> [days] / ,me revoke <user|uid>
        if (sub === 'grant' || sub === 'add' || sub === 'give') {
            if (!isCallerOwner) {
                return message.reply(build.denyBox('permission denied', 'only bot developers can manage premium tiers.'));
            }
            const targetInput = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null) || args[1];
            if (!targetInput) {
                return message.reply(build.warnBox('invalid parameter', 'specify a valid user mention, user id, or uid to grant premium.'));
            }
            let resolved = db ? await db.resolveUserOrProfile(targetInput) : null;
            if (!resolved) {
                const cleanId = String(targetInput?.id || targetInput).replace(/[<@!>]/g, '').trim();
                if (/^\d{17,20}$/.test(cleanId)) {
                    const createdProfile = await db.ensureUserProfile(cleanId);
                    if (createdProfile) resolved = { userId: cleanId, profile: createdProfile };
                }
            }
            if (!resolved) {
                return message.reply(build.warnBox('nothing found', 'could not find a user or profile with that id/uid.'));
            }

            let durationSeconds = null;
            if (args[2]) {
                const cleanDays = String(args[2]).toLowerCase().replace(/d(ays?)?$/i, '');
                if (cleanDays !== 'lifetime' && cleanDays !== 'perm' && cleanDays !== 'permanent') {
                    const parsedDays = parseInt(cleanDays, 10);
                    if (!isNaN(parsedDays) && parsedDays > 0) durationSeconds = parsedDays * 86400;
                }
            }

            if (db) await db.setUserPremium(resolved.userId, 'premium', durationSeconds);
            const durationText = durationSeconds ? `for \`${Math.round(durationSeconds / 86400)} days\`` : '`lifetime`';
            return message.reply(build.approvedBox('tier granted', `granted **harm premium** to <@${resolved.userId}> (uid \`${resolved.profile.uid}\`, ${durationText}).`));
        }

        if (sub === 'revoke' || sub === 'remove' || sub === 'take') {
            if (!isCallerOwner) {
                return message.reply(build.denyBox('permission denied', 'only bot developers can manage premium tiers.'));
            }
            const targetInput = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null) || args[1];
            if (!targetInput) {
                return message.reply(build.warnBox('invalid parameter', 'specify a valid user mention, user id, or uid to revoke premium.'));
            }
            const resolved = db ? await db.resolveUserOrProfile(targetInput) : null;
            if (!resolved) {
                return message.reply(build.warnBox('nothing found', 'could not find a user or profile with that id/uid.'));
            }

            if (db) await db.revokeUserPremium(resolved.userId);
            return message.reply(build.approvedBox('tier revoked', `revoked **harm premium** from <@${resolved.userId}> (uid \`${resolved.profile.uid}\`).`));
        }

        let targetUser = message.author;
        let profile = null;

        if (args && args.length > 0) {
            const rawInput = args.join(' ').trim();
            const cleanInput = rawInput.replace(/^(uuid|uid)[:\s]*/i, '').trim();

            const mention = (typeof message.mentions?.users?.first === 'function' ? message.mentions.users.first() : null);

            if (mention) {
                targetUser = mention;
                if (!targetUser.bot) {
                    profile = db ? await db.getUserProfile(targetUser.id) : null;
                }
            } else if (cleanInput === '' || cleanInput.toLowerCase() === 'me') {
                targetUser = message.author;
                profile = db ? await db.ensureUserProfile(targetUser.id) : null;
            } else if (/^\d{1,10}$/.test(cleanInput)) {
                // UID search
                profile = db ? await db.getUserProfileByUid(cleanInput) : null;
                if (profile) {
                    targetUser = message.guild?.members?.cache?.get(profile.user_id)?.user
                        || message.client.users.cache.get(profile.user_id)
                        || await message.client.users.fetch(profile.user_id).catch(() => null)
                        || {
                            id: profile.user_id,
                            username: `uid_${profile.uid}`,
                            displayAvatarURL: () => message.client.user?.displayAvatarURL({ size: 1024, dynamic: true }) || ''
                        };
                } else {
                    return message.reply(build.warnBox('nothing found', 'could not find a user or profile with that uid.'));
                }
            } else if (/^\d{17,20}$/.test(cleanInput)) {
                // Snowflake ID search
                const fetched = await message.client.users.fetch(cleanInput).catch(() => null);
                if (fetched) {
                    targetUser = fetched;
                    if (!targetUser.bot) {
                        profile = db ? await db.getUserProfile(fetched.id) : null;
                    }
                } else {
                    return message.reply(build.warnBox('nothing found', 'could not find a user with that id.'));
                }
            } else {
                return message.reply(build.warnBox('nothing found', 'could not find a user or profile with that id/uuid.'));
            }
        } else {
            targetUser = message.author;
            profile = db ? await db.ensureUserProfile(targetUser.id) : null;
        }

        // Dedicated Bot Profile Card
        if (targetUser.bot) {
            const displayName = (targetUser.globalName || targetUser.displayName || targetUser.username || 'bot').toLowerCase();
            const username = targetUser.username.toLowerCase();
            const userLink = `https://discord.com/users/${targetUser.id}`;
            const avatar = typeof targetUser.displayAvatarURL === 'function'
                ? targetUser.displayAvatarURL({ size: 1024, dynamic: true })
                : (message.client.user?.displayAvatarURL({ size: 1024, dynamic: true }) || '');
            const bannerAttachment = build.getAssetAttachment('banner.png');
            const files = bannerAttachment ? [bannerAttachment] : [];

            const botContent = [
                `### [${displayName}](${userLink})`,
                `-# [@${username}](${userLink}) · \`${targetUser.id}\`\n`,
                `-# **type:** \`application bot\` · **status:** \`unsupported\``,
                `-# bots are not humans and cannot hold harm memberships or profiles.`
            ].join('\n');

            const container = new ContainerBuilder();
            container.setAccentColor(typeof config.colors.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors.c || 0x2b2d31));

            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(botContent))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));

            container.addSectionComponents(section);

            if (bannerAttachment) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(`attachment://${bannerAttachment.name}`)
                    )
                );
            }

            try {
                return await message.reply({
                    components: [container],
                    files,
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (_) {
                const fallbackEmbed = new EmbedBuilder()
                    .setColor(config.colors.c || 0x2b2d31)
                    .setThumbnail(avatar)
                    .setDescription(botContent);
                if (bannerAttachment) fallbackEmbed.setImage(`attachment://${bannerAttachment.name}`);
                return await message.reply({
                    embeds: [fallbackEmbed],
                    files
                }).catch(() => {});
            }
        }

        // Human target without profile check
        if (!profile) {
            if (targetUser.id === message.author.id) {
                profile = db ? await db.ensureUserProfile(targetUser.id) : { uid: 1, tier: 'standard' };
            } else {
                return message.reply(build.warnBox('nothing found', `<@${targetUser.id}> has not used harm yet and has no registered profile.`));
            }
        }

        const isOwner = config.owners?.includes(targetUser.id);
        const standardEmoji = config.emojis?.standard || '<:harm_standard:1558811340385026119>';
        const premiumEmoji = config.emojis?.premium || '<:harm_premium:1558810882795114536>';
        const ownerEmoji = config.emojis?.crown || '<:gw_crown:1558198883883028621>';

        const now = Math.floor(Date.now() / 1000);

        let hasActivePremium = false;
        if (profile.tier === 'premium') {
            if (!profile.premium_expires || profile.premium_expires > now) {
                hasActivePremium = true;
            } else {
                if (db) {
                    await db.run(
                        'UPDATE user_profiles SET tier = ?, premium_since = NULL, premium_expires = NULL WHERE user_id = ?',
                        ['standard', targetUser.id]
                    ).catch(() => {});
                }
                profile.tier = 'standard';
                profile.premium_since = null;
                profile.premium_expires = null;
            }
        } else if (profile.tier && profile.tier !== 'standard' && !isOwner) {
            hasActivePremium = true;
        }

        let tierEmoji = standardEmoji;
        let tierLabel = 'standard';
        let tierStatus = 'unactive';
        let perksText = 'standard limits';

        if (isOwner) {
            tierEmoji = ownerEmoji;
            tierLabel = 'owner';
            tierStatus = 'lifetime';
            perksText = 'developer · unlimited access';
        } else if (hasActivePremium) {
            tierEmoji = premiumEmoji;
            tierLabel = 'premium';
            tierStatus = profile.premium_expires ? `expires <t:${profile.premium_expires}:R>` : 'lifetime';
            perksText = 'zero cooldowns · all commands unlocked';
        } else {
            tierEmoji = standardEmoji;
            tierLabel = 'standard';
            tierStatus = 'unactive';
            perksText = 'standard limits';
        }

        const avatar = typeof targetUser.displayAvatarURL === 'function'
            ? targetUser.displayAvatarURL({ size: 1024, dynamic: true })
            : (message.client.user?.displayAvatarURL({ size: 1024, dynamic: true }) || '');

        const displayName = (targetUser.globalName || targetUser.displayName || targetUser.username || 'user').toLowerCase();
        const username = targetUser.username.toLowerCase();
        const userLink = `https://discord.com/users/${targetUser.id}`;

        const lines = [
            `### [${displayName}](${userLink})`,
            `-# [@${username}](${userLink}) · \`${targetUser.id}\`\n`,
            `-# **uuid:** \`${profile.uid}\` · **tier:** ${tierEmoji} \`${tierLabel}\``,
            `-# **status:** \`${tierStatus}\` · **perks:** \`${perksText}\``
        ];

        if (isOwner || (hasActivePremium && profile.premium_since)) {
            const regTs = profile.premium_since || (targetUser.createdTimestamp ? Math.floor(targetUser.createdTimestamp / 1000) : now);
            lines.push(`-# **registered:** <t:${regTs}:R>`);
        }

        const bodyContent = lines.join('\n');

        const bannerAttachment = isOwner
            ? (build.getAssetAttachment('owner.png') || build.getAssetAttachment('banner.png'))
            : build.getAssetAttachment('banner.png');
        const files = bannerAttachment ? [bannerAttachment] : [];

        // Components V2 Hero Card
        const container = new ContainerBuilder();
        container.setAccentColor(typeof config.colors.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors.c || 0x2b2d31));

        const section = new SectionBuilder()
            .addTextDisplayComponents(new TextDisplayBuilder().setContent(bodyContent))
            .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar));

        container.addSectionComponents(section);

        // Bottom-anchored glowing banner (direct bottom anchor, no buttons or divider below)
        if (bannerAttachment) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(`attachment://${bannerAttachment.name}`)
                )
            );
        }

        try {
            return await message.reply({
                components: [container],
                files,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            const fallbackEmbed = new EmbedBuilder()
                .setColor(config.colors.c || 0x2b2d31)
                .setThumbnail(avatar)
                .setDescription(bodyContent);
            if (bannerAttachment) fallbackEmbed.setImage(`attachment://${bannerAttachment.name}`);
            return await message.reply({
                embeds: [fallbackEmbed],
                files
            }).catch(() => {});
        }
    }
}

module.exports = MeCommand;
