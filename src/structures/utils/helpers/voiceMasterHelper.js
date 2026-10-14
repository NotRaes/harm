const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    UserSelectMenuBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    MessageFlags,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    PermissionFlagsBits
} = require('discord.js');
const build = require('../builder.js');
const config = require('../../../config.js');

class VoiceMasterHelper {
    static getEmojis() {
        const e = config.emojis || {};
        return {
            lockvc: e.lockvc || '🔒',
            unlockvc: e.unlockvc || '🔓',
            ghostvc: e.ghostvc || '👻',
            revealvc: e.revealvc || '👁️',
            claimvc: e.claimvc || '🎙️',
            renamevc: e.renamevc || '✏️',
            limitvc: e.limitvc || '👥',
            permitvc: e.permitvc || '👤',
            rejectvc: e.rejectvc || '🚫',
            transfervc: e.transfervc || '🔄',
            infovc: e.infovc || 'ℹ️',
            deletevc: e.deletevc || '🗑️'
        };
    }

    /**
     * Builds the permanent Voice Controls Interface card posted into #voice-controls
     */
    static buildInterfacePayload(guild) {
        const e = VoiceMasterHelper.getEmojis();
        const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';
        const bannerAttachment = build.getAssetAttachment('voicemaster.png');
        const files = bannerAttachment ? [bannerAttachment] : [];

        // 1. Header & Actions guide (The 10 core controls from original design)
        const textContent = [
            `### [voice controls](${supportUrl})`,
            `these act on the temporary channel you are in. the owner, and anyone they permit, can use them.\n`,
            `${e.lockvc} — \`lock\` the voice channel`,
            `${e.unlockvc} — \`unlock\` the voice channel`,
            `${e.ghostvc} — \`ghost\` lock and hide it at once`,
            `${e.revealvc} — \`reveal\` show it in the channel list`,
            `${e.claimvc} — \`claim\` a channel whose owner left`,
            `${e.renamevc} — \`rename\` the voice channel`,
            `${e.limitvc} — \`limit\` how many people fit`,
            `${e.permitvc} — \`permit\` one person in`,
            `${e.rejectvc} — \`reject\` someone and block them`,
            `${e.transfervc} — \`transfer\` the channel to someone in it`
        ].join('\n');

        // 2. Action Buttons (2 balanced rows of 5 buttons each)
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vm_lock').setEmoji(e.lockvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_unlock').setEmoji(e.unlockvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_ghost').setEmoji(e.ghostvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_reveal').setEmoji(e.revealvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_claim').setEmoji(e.claimvc).setStyle(ButtonStyle.Secondary)
        );

        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('vm_rename').setEmoji(e.renamevc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_limit').setEmoji(e.limitvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_permit').setEmoji(e.permitvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_reject').setEmoji(e.rejectvc).setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId('vm_transfer').setEmoji(e.transfervc).setStyle(ButtonStyle.Secondary)
        );

        // 3. Components V2 Container with Bottom-Anchored Glowing Banner
        const container = new ContainerBuilder();
        container.setAccentColor(config.colors.c ? parseInt(config.colors.c.replace('#', ''), 16) : 0x2b2d31);

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(textContent));

        if (bannerAttachment) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL('attachment://voicemaster.png')
                )
            );
        }

        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

        container.addActionRowComponents(row1, row2);

        const componentsV2 = {
            components: [container],
            files,
            flags: MessageFlags.IsComponentsV2
        };

        const fallbackEmbed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setDescription(textContent);

        if (bannerAttachment) fallbackEmbed.setImage('attachment://voicemaster.png');

        const embedFallback = {
            embeds: [fallbackEmbed],
            components: [row1, row2],
            files
        };

        return { componentsV2, embedFallback };
    }

    /**
     * Resolves and verifies interaction context for any voicemaster button/select
     */
    static async resolveContext(interaction) {
        const member = interaction.member;
        const channel = member?.voice?.channel;

        if (!channel) {
            await interaction.reply({
                embeds: [build.warn(interaction.user, 'you must be connected to a voice channel to use this.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return null;
        }

        const db = interaction.client.db;
        if (!db) {
            await interaction.reply({
                embeds: [build.deny(interaction.user, 'database subsystem is currently offline.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return null;
        }

        const activeVC = await db.getActiveVC(channel.id);
        if (!activeVC) {
            await interaction.reply({
                embeds: [build.warn(interaction.user, 'you are not in a voicemaster temporary channel.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
            return null;
        }

        return { member, channel, activeVC, db };
    }

    /**
     * Main interaction router for all voicemaster buttons, modals, and select menus
     */
    static async handleInteraction(interaction) {
        const customId = interaction.customId || '';

        // Handle Select Menus (permit, reject, transfer)
        if (interaction.isUserSelectMenu()) {
            return await VoiceMasterHelper.handleSelectMenu(interaction);
        }

        // Handle Modals (rename, limit)
        if (interaction.isModalSubmit()) {
            return await VoiceMasterHelper.handleModalSubmit(interaction);
        }

        if (!interaction.isButton()) return;

        const ctx = await VoiceMasterHelper.resolveContext(interaction);
        if (!ctx) return;

        const { channel, activeVC, db } = ctx;
        const isOwner = activeVC.owner_id === interaction.user.id;
        const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        // 1. CLAIM (allowed when previous owner is not connected)
        if (customId === 'vm_claim') {
            if (isOwner) {
                return await interaction.reply({
                    embeds: [build.warn(interaction.user, 'you already own this voice channel.')],
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            const isPrevOwnerConnected = channel.members.has(activeVC.owner_id);
            if (isPrevOwnerConnected) {
                return await interaction.reply({
                    embeds: [build.warn(interaction.user, `the channel owner (<@${activeVC.owner_id}>) is still connected.`)],
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            await db.updateActiveVCOwner(channel.id, interaction.user.id);
            await channel.permissionOverwrites.edit(interaction.user.id, {
                ManageChannels: true,
                Connect: true,
                Speak: true,
                ViewChannel: true
            }).catch(() => {});

            return await interaction.reply({
                embeds: [build.approved(interaction.user, 'you have claimed ownership of this voice channel.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 2. INFO (viewable by anyone in the VC)
        if (customId === 'vm_info') {
            const isLocked = !channel.permissionsFor(interaction.guild.roles.everyone).has(PermissionFlagsBits.Connect);
            const isGhosted = !channel.permissionsFor(interaction.guild.roles.everyone).has(PermissionFlagsBits.ViewChannel);
            const limitText = channel.userLimit > 0 ? `${channel.userLimit}` : 'unlimited';
            const bitrateKbps = Math.round(channel.bitrate / 1000);

            const infoLines = [
                `### [channel telemetry](${config.supportInvite || 'https://discord.gg/eqwcPU2mfS'})`,
                `-# technical metrics for <#${channel.id}>\n`,
                `-# **owner:** <@${activeVC.owner_id}>`,
                `-# **members:** \`${channel.members.size}\` / \`${limitText}\``,
                `-# **bitrate:** \`${bitrateKbps} kbps\``,
                `-# **locked:** \`${isLocked ? 'yes' : 'no'}\``,
                `-# **ghosted:** \`${isGhosted ? 'yes' : 'no'}\``
            ].join('\n');

            return await interaction.reply({
                embeds: [new EmbedBuilder().setColor(config.colors.c || '#2b2d31').setDescription(infoLines)],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // All other actions require owner or channel manager permission
        if (!isOwner && !hasAdmin) {
            return await interaction.reply({
                embeds: [build.deny(interaction.user, 'only the channel owner can control this voice channel.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 3. LOCK
        if (customId === 'vm_lock') {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                Connect: false
            }).catch(() => {});
            return await interaction.reply({
                embeds: [build.approved(interaction.user, 'locked the voice channel.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 4. UNLOCK
        if (customId === 'vm_unlock') {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                Connect: null
            }).catch(() => {});
            return await interaction.reply({
                embeds: [build.approved(interaction.user, 'unlocked the voice channel.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 5. GHOST
        if (customId === 'vm_ghost') {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                ViewChannel: false,
                Connect: false
            }).catch(() => {});
            return await interaction.reply({
                embeds: [build.approved(interaction.user, 'ghosted the voice channel (locked & hidden).')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 6. REVEAL
        if (customId === 'vm_reveal') {
            await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                ViewChannel: null,
                Connect: null
            }).catch(() => {});
            return await interaction.reply({
                embeds: [build.approved(interaction.user, 'revealed the voice channel in the channel list.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 7. RENAME (Modal)
        if (customId === 'vm_rename') {
            const modal = new ModalBuilder()
                .setCustomId(`vm_modal_rename_${channel.id}`)
                .setTitle('rename voice channel');

            const textInput = new TextInputBuilder()
                .setCustomId('vm_name_input')
                .setLabel('channel name')
                .setStyle(TextInputStyle.Short)
                .setValue(channel.name || '')
                .setMaxLength(100)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(textInput));
            return await interaction.showModal(modal).catch(() => {});
        }

        // 8. LIMIT (Modal)
        if (customId === 'vm_limit') {
            const modal = new ModalBuilder()
                .setCustomId(`vm_modal_limit_${channel.id}`)
                .setTitle('set user limit');

            const textInput = new TextInputBuilder()
                .setCustomId('vm_limit_input')
                .setLabel('limit (0 for unlimited, 1-99)')
                .setStyle(TextInputStyle.Short)
                .setValue(String(channel.userLimit || 0))
                .setMaxLength(2)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(textInput));
            return await interaction.showModal(modal).catch(() => {});
        }

        // 9. PERMIT (User Select Menu)
        if (customId === 'vm_permit') {
            const select = new UserSelectMenuBuilder()
                .setCustomId(`vm_select_permit_${channel.id}`)
                .setPlaceholder('select a member to permit into your channel...')
                .setMaxValues(1);

            return await interaction.reply({
                content: '-# select a member to permit access:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 10. REJECT (User Select Menu)
        if (customId === 'vm_reject') {
            const select = new UserSelectMenuBuilder()
                .setCustomId(`vm_select_reject_${channel.id}`)
                .setPlaceholder('select a member to reject and block...')
                .setMaxValues(1);

            return await interaction.reply({
                content: '-# select a member to reject and disconnect:',
                components: [new ActionRowBuilder().addComponents(select)],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // 11. TRANSFER (Members in this VC only)
        if (customId === 'vm_transfer') {
            const otherMembers = channel.members.filter(m => m.id !== interaction.user.id && !m.user?.bot);
            if (otherMembers.size === 0) {
                return await interaction.reply({
                    embeds: [build.warn(interaction.user, 'there is no one else in your voice channel to transfer ownership to.')],
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            let selectRow;
            if (otherMembers.size <= 25) {
                const select = new StringSelectMenuBuilder()
                    .setCustomId(`vm_select_transfer_${channel.id}`)
                    .setPlaceholder('select a member in this vc to transfer to...')
                    .addOptions(
                        otherMembers.map(m =>
                            new StringSelectMenuOptionBuilder()
                                .setLabel((m.displayName || m.user.username).slice(0, 100))
                                .setDescription((m.user.tag || m.user.username).slice(0, 100))
                                .setValue(m.id)
                        )
                    );
                selectRow = new ActionRowBuilder().addComponents(select);
            } else {
                const select = new UserSelectMenuBuilder()
                    .setCustomId(`vm_select_transfer_${channel.id}`)
                    .setPlaceholder('select a member in this vc to transfer to...')
                    .setMaxValues(1);
                selectRow = new ActionRowBuilder().addComponents(select);
            }

            return await interaction.reply({
                content: '-# select a member in your voice channel to transfer ownership to:',
                components: [selectRow],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }

    /**
     * Handles UserSelectMenu responses for permit, reject, transfer
     */
    static async handleSelectMenu(interaction) {
        const customId = interaction.customId || '';
        const selectedId = interaction.values?.[0];
        if (!selectedId) return;

        const ctx = await VoiceMasterHelper.resolveContext(interaction);
        if (!ctx) return;

        const { channel, activeVC, db } = ctx;
        const isOwner = activeVC.owner_id === interaction.user.id;
        const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!isOwner && !hasAdmin) {
            return await interaction.update({
                content: null,
                embeds: [build.deny(interaction.user, 'only the channel owner can perform this action.')],
                components: []
            }).catch(() => {});
        }

        // Permit
        if (customId.startsWith('vm_select_permit_')) {
            await channel.permissionOverwrites.edit(selectedId, {
                Connect: true,
                ViewChannel: true
            }).catch(() => {});

            return await interaction.update({
                content: null,
                embeds: [build.approved(interaction.user, `permitted <@${selectedId}> into your channel.`)],
                components: []
            }).catch(() => {});
        }

        // Reject
        if (customId.startsWith('vm_select_reject_')) {
            if (selectedId === interaction.user.id) {
                return await interaction.update({
                    content: null,
                    embeds: [build.warn(interaction.user, 'you cannot reject yourself.')],
                    components: []
                }).catch(() => {});
            }

            await channel.permissionOverwrites.edit(selectedId, {
                Connect: false,
                ViewChannel: false
            }).catch(() => {});

            const targetMem = channel.members.get(selectedId);
            if (targetMem) {
                await targetMem.voice.disconnect('rejected by channel owner').catch(() => {});
            }

            return await interaction.update({
                content: null,
                embeds: [build.approved(interaction.user, `rejected and blocked <@${selectedId}> from your channel.`)],
                components: []
            }).catch(() => {});
        }

        // Transfer
        if (customId.startsWith('vm_select_transfer_')) {
            if (selectedId === interaction.user.id) {
                return await interaction.update({
                    content: null,
                    embeds: [build.warn(interaction.user, 'you are already the owner.')],
                    components: []
                }).catch(() => {});
            }

            const targetMember = channel.members.get(selectedId);
            if (!targetMember) {
                return await interaction.update({
                    content: null,
                    embeds: [build.warn(interaction.user, 'that member is not connected to this voice channel.')],
                    components: []
                }).catch(() => {});
            }

            if (targetMember.user?.bot) {
                return await interaction.update({
                    content: null,
                    embeds: [build.warn(interaction.user, 'cannot transfer ownership to a bot.')],
                    components: []
                }).catch(() => {});
            }

            await db.updateActiveVCOwner(channel.id, selectedId);
            await channel.permissionOverwrites.edit(selectedId, {
                ManageChannels: true,
                Connect: true,
                Speak: true,
                ViewChannel: true
            }).catch(() => {});

            // Clean up previous owner's elevated channel overwrite
            await channel.permissionOverwrites.delete(interaction.user.id).catch(() => {});

            return await interaction.update({
                content: null,
                embeds: [build.approved(interaction.user, `transferred ownership of this channel to <@${selectedId}>.`)],
                components: []
            }).catch(() => {});
        }
    }

    /**
     * Handles modal submissions for channel renaming and user limit
     */
    static async handleModalSubmit(interaction) {
        const customId = interaction.customId || '';
        const ctx = await VoiceMasterHelper.resolveContext(interaction);
        if (!ctx) return;

        const { channel, activeVC } = ctx;
        const isOwner = activeVC.owner_id === interaction.user.id;
        const hasAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageChannels);

        if (!isOwner && !hasAdmin) {
            return await interaction.reply({
                embeds: [build.deny(interaction.user, 'only the channel owner can modify this channel.')],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // Rename
        if (customId.startsWith('vm_modal_rename_')) {
            const rawName = interaction.fields.getTextInputValue('vm_name_input');
            const cleanName = (rawName || '').trim().slice(0, 100);

            if (!cleanName) {
                return await interaction.reply({
                    embeds: [build.warn(interaction.user, 'provide a valid channel name.')],
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            await channel.setName(cleanName).catch(() => {});
            return await interaction.reply({
                embeds: [build.approved(interaction.user, `renamed channel to **${cleanName}**`)],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }

        // Limit
        if (customId.startsWith('vm_modal_limit_')) {
            const rawLimit = interaction.fields.getTextInputValue('vm_limit_input');
            const num = parseInt(rawLimit.trim(), 10);

            if (isNaN(num) || num < 0 || num > 99) {
                return await interaction.reply({
                    embeds: [build.warn(interaction.user, 'limit must be a number between `0` and `99`.')],
                    flags: MessageFlags.Ephemeral
                }).catch(() => {});
            }

            await channel.setUserLimit(num).catch(() => {});
            const displayLimit = num === 0 ? 'unlimited' : `${num}`;
            return await interaction.reply({
                embeds: [build.approved(interaction.user, `set user limit to **${displayLimit}**`)],
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }

    /**
     * Updates the 'active vcs: n' counter voice channel
     */
    static async updateCounter(guild, db) {
        if (!guild || !db) return;
        try {
            const setup = await db.getVoiceMasterSetup(guild.id);
            if (!setup || !setup.counter_channel_id) return;
            let counterChannel = guild.channels.cache.get(setup.counter_channel_id);
            if (!counterChannel) {
                counterChannel = await guild.channels.fetch(setup.counter_channel_id).catch(() => null);
            }
            if (!counterChannel) return;

            const activeVCs = await db.getAllActiveVCs(guild.id);
            const count = Array.isArray(activeVCs) ? activeVCs.length : 0;
            const targetName = `active vcs: ${count}`;
            if (counterChannel.name !== targetName) {
                await counterChannel.setName(targetName).catch(() => {});
            }
        } catch (_) {}
    }
}

module.exports = VoiceMasterHelper;
