const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    MessageFlags,
    AttachmentBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');
const { renderFakeMessage } = require('../../structures/utils/helpers/fakemessage.js');
const { renderQuote } = require('../../structures/utils/helpers/quote.js');

class GenerateCommand {
    constructor() {
        this.name = 'generate';
        this.aliases = ['gen'];
        this.description = 'interactive studio for fake discord messages and editorial quotes.';
        this.syntax = ',generate <message|quote> [arguments]';
        this.example = ',generate message hello world';
        this.category = 'utility';
        this.cooldown = 3;
        this.subcommands = ['message', 'quote'];
        this.subcommandDetails = {
            message: {
                description: 'interactive fake discord message studio with live customization and single-image export.',
                syntax: ',generate message [text|@user]',
                example: ',generate message hello world'
            },
            quote: {
                description: 'film noir editorial quote card with customizable styles and single-image export.',
                syntax: ',generate quote [@user] [text]',
                example: ',generate quote @user look at this'
            }
        };
    }

    async resolveTargetUser(message, arg) {
        if (message.mentions?.users?.size > 0) {
            return message.mentions.users.first();
        }
        if (arg) {
            const cleanId = arg.replace(/[<@!>]/g, '').trim();
            if (/^\d{17,20}$/.test(cleanId)) {
                try {
                    return await message.client.users.fetch(cleanId);
                } catch (_) {}
            }
            if (message.client.db?.resolveUserOrProfile) {
                try {
                    const resolved = await message.client.db.resolveUserOrProfile(cleanId, message.client);
                    if (resolved?.user) return resolved.user;
                } catch (_) {}
            }
        }
        return null;
    }

    async execute(message, args, commandName) {
        const invoked = (commandName || '').toLowerCase();
        const sub = (args?.[0] || '').toLowerCase();

        // 1. Check for replied message
        let repliedMsg = null;
        if (message.reference?.messageId) {
            try {
                repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            } catch (_) {}
        }

        // 2. Route subcommands
        if (sub === 'message' || sub === 'msg' || sub === 'fakemessage' || sub === 'fm') {
            return await this.startMessageStudio(message, args.slice(1), repliedMsg);
        }

        if (sub === 'quote' || sub === 'q') {
            return await this.startQuoteStudio(message, args.slice(1), repliedMsg);
        }

        // If user replied to a message, launch quote studio on it
        if (repliedMsg) {
            return await this.startQuoteStudio(message, args, repliedMsg);
        }

        // If text was passed without a subcommand, default to message studio
        if (args && args.length > 0) {
            return await this.startMessageStudio(message, args, repliedMsg);
        }

        // If no subcommands or arguments provided, display clean help POV guide
        return await build.help(message, this);
    }

    // ──────────────────────── MESSAGE STUDIO ────────────────────────
    async startMessageStudio(message, args = [], repliedMsg = null) {
        let targetUser = null;
        let textArgs = [...args];

        if (textArgs.length > 0) {
            const resolved = await this.resolveTargetUser(message, textArgs[0]);
            if (resolved) {
                targetUser = resolved;
                textArgs.shift();
            }
        }

        if (!targetUser && repliedMsg) targetUser = repliedMsg.author;
        if (!targetUser) targetUser = message.author;

        let initialText = textArgs.join(' ').trim();
        if (!initialText && repliedMsg?.content) initialText = repliedMsg.content;
        if (!initialText) initialText = 'hello from harm.';

        let initialImage = null;
        if (message.attachments?.size > 0) {
            initialImage = message.attachments.first()?.url;
        } else if (repliedMsg?.attachments?.size > 0) {
            initialImage = repliedMsg.attachments.first()?.url;
        }

        const state = {
            text: initialText,
            user: targetUser,
            theme: 'dark',
            font: 'Inter',
            mentionHighlight: false,
            useUsername: false,
            reactions: '',
            imageUrl: initialImage,
            isBot: targetUser.bot || false,
            badge: targetUser.bot ? 'bot' : 'none',
            clanTag: null
        };

        const renderBuffer = async () => {
            return await renderFakeMessage({
                text: state.text,
                avatarUrl: state.user.displayAvatarURL({ extension: 'png', size: 256 }),
                displayName: state.user.displayName || state.user.username,
                username: state.user.username,
                isBot: state.isBot,
                theme: state.theme,
                displayFont: state.font,
                imageUrl: state.imageUrl,
                mentionHighlight: state.mentionHighlight,
                reactions: state.reactions,
                useUsername: state.useUsername,
                hideClanTags: false,
                clanTag: state.clanTag
            });
        };

        // Welcome DM Inspired Aesthetic Components V2 Layout
        const buildUI = (avatarUrl) => {
            const container = new ContainerBuilder();
            container.setAccentColor(0x2b2d31);

            const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';
            const brandEmoji = config.emojis?.harm || '<:harmsdio:1556221836507742278>';

            // Section with right-aligned Avatar Thumbnail Accessory
            const headerSection = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### [harm message studio](${supportUrl})\n` +
                        `-# craft authentic fake discord messages with realistic client typography.\n\n` +
                        `-# **target:** <@${state.user.id}> · **theme:** \`${state.theme}\` · **font:** \`${state.font.toLowerCase()}\`\n` +
                        `-# **parameters:** mention \`${state.mentionHighlight ? 'on' : 'off'}\` · handle \`${state.useUsername ? 'username' : 'display'}\` · tag \`${state.badge}\` · reaction \`${state.reactions ? 'heart' : 'none'}\`\n` +
                        `-# customize settings below or click **done** to export the clean attachment.\n-# ${'\u2800'.repeat(44)}`
                    )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(avatarUrl)
                );
            container.addSectionComponents(headerSection);

            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://message.png'))
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

            // Select Menu with NO "theme:" prefix, Discord-only themes, and custom emojis
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('msg_studio_options')
                .setPlaceholder('select theme, badge, or typography...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('discord dark')
                        .setValue('theme_dark')
                        .setDescription('standard dark mode palette (#313338)')
                        .setEmoji(config.emojis?.channels || '🖥️')
                        .setDefault(state.theme === 'dark'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('amoled black')
                        .setValue('theme_amoled')
                        .setDescription('pure midnight pitch black (#000000)')
                        .setEmoji(config.emojis?.ghostvc || '👻')
                        .setDefault(state.theme === 'amoled'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('bright light')
                        .setValue('theme_light')
                        .setDescription('clean bright discord light palette (#ffffff)')
                        .setEmoji(config.emojis?.revealvc || '☀️')
                        .setDefault(state.theme === 'light'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('bot tag: bot')
                        .setValue('badge_bot')
                        .setDescription('add discord standard bot tag')
                        .setEmoji(config.emojis?.roles || '🛡️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('bot tag: none')
                        .setValue('badge_none')
                        .setDescription('standard regular user appearance')
                        .setEmoji(config.emojis?.deny || '❌'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('typography: discord inter')
                        .setValue('font_Inter')
                        .setDescription('native clean gg sans / inter discord typography')
                        .setEmoji(config.emojis?.wand || '🪄'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('typography: modern sans')
                        .setValue('font_Montserrat')
                        .setDescription('geometric modern aesthetic typography')
                        .setEmoji(config.emojis?.idcard || '🪪'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('typography: terminal code')
                        .setValue('font_JetBrainsMono')
                        .setDescription('monospaced coding terminal typography')
                        .setEmoji(config.emojis?.channels || '💻')
                );

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);

            const buttonRow1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('msg_btn_mention')
                    .setLabel(state.mentionHighlight ? 'mention: on' : 'mention: off')
                    .setEmoji('🔔')
                    .setStyle(state.mentionHighlight ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('msg_btn_username')
                    .setLabel(state.useUsername ? 'name: handle' : 'name: display')
                    .setEmoji(config.emojis?.idcard || '🪪')
                    .setStyle(state.useUsername ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('msg_btn_reaction')
                    .setLabel(state.reactions ? 'reaction: on' : 'reaction: off')
                    .setEmoji('❤️')
                    .setStyle(state.reactions ? ButtonStyle.Primary : ButtonStyle.Secondary)
            );

            const buttonRow2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('msg_btn_text')
                    .setLabel('edit text')
                    .setEmoji('✏️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('msg_btn_finish')
                    .setLabel('done')
                    .setEmoji(config.emojis?.approve || '<:harm_tick:1558811267014066366>')
                    .setStyle(ButtonStyle.Secondary)
            );

            container.addActionRowComponents(selectRow, buttonRow1, buttonRow2);
            return container;
        };

        let initialBuf;
        try {
            initialBuf = await renderBuffer();
        } catch (err) {
            return message.reply(build.warnBox('render error', 'failed to generate fake message preview.'));
        }

        const userAvatar = state.user.displayAvatarURL({ extension: 'png', size: 256 });
        const file = new AttachmentBuilder(initialBuf, { name: 'message.png' });
        const container = buildUI(userAvatar);

        let replyMsg;
        try {
            replyMsg = await message.reply({
                components: [container],
                files: [file],
                allowedMentions: { repliedUser: false },
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            return message.reply({ files: [file], allowedMentions: { repliedUser: false } }).catch(() => {});
        }

        if (!replyMsg) return;

        const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: 'only the command author can control this menu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            collector.resetTimer?.();

            if (i.isStringSelectMenu() && i.customId === 'msg_studio_options') {
                const val = i.values[0];
                if (val.startsWith('theme_')) {
                    state.theme = val.replace('theme_', '');
                } else if (val.startsWith('font_')) {
                    state.font = val.replace('font_', '');
                } else if (val === 'badge_bot') {
                    state.isBot = true;
                    state.badge = 'bot';
                } else if (val === 'badge_none') {
                    state.isBot = false;
                    state.badge = 'none';
                }
            } else if (i.isButton()) {
                if (i.customId === 'msg_btn_mention') {
                    state.mentionHighlight = !state.mentionHighlight;
                } else if (i.customId === 'msg_btn_username') {
                    state.useUsername = !state.useUsername;
                } else if (i.customId === 'msg_btn_reaction') {
                    state.reactions = state.reactions ? '' : '❤️ 1';
                } else if (i.customId === 'msg_btn_finish') {
                    // WHEN DONE: ONLY edit to the raw image output, NOT in an embed!
                    collector.stop('done');
                    const finalBuf = await renderBuffer();
                    const finalFile = new AttachmentBuilder(finalBuf, { name: 'message.png' });
                    return await i.update({
                        content: null,
                        embeds: [],
                        components: [],
                        files: [finalFile],
                        flags: 0
                    }).catch(() => {});
                } else if (i.customId === 'msg_btn_text') {
                    const modalId = `modal_msg_${i.id}_${Date.now()}`;
                    const modal = new ModalBuilder()
                        .setCustomId(modalId)
                        .setTitle('edit message text');

                    const textInput = new TextInputBuilder()
                        .setCustomId('new_text')
                        .setLabel('message content')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(state.text || '')
                        .setMaxLength(1000)
                        .setRequired(true);

                    const rxInput = new TextInputBuilder()
                        .setCustomId('new_reactions')
                        .setLabel('reaction (optional, e.g. ❤️ 1 or 🔥 2)')
                        .setStyle(TextInputStyle.Short)
                        .setValue(state.reactions || '')
                        .setRequired(false);

                    modal.addComponents(
                        new ActionRowBuilder().addComponents(textInput),
                        new ActionRowBuilder().addComponents(rxInput)
                    );

                    await i.showModal(modal).catch(() => {});

                    try {
                        const submitted = await i.awaitModalSubmit({
                            filter: sm => sm.customId === modalId && sm.user.id === message.author.id,
                            time: 120000
                        });

                        collector.resetTimer?.();
                        const valText = submitted.fields.getTextInputValue('new_text');
                        const valRx = submitted.fields.getTextInputValue('new_reactions');

                        if (valText && valText.trim()) {
                            state.text = valText.trim();
                        }
                        state.reactions = valRx ? valRx.trim() : '';

                        const newBuf = await renderBuffer();
                        const newFile = new AttachmentBuilder(newBuf, { name: 'message.png' });
                        const updatedContainer = buildUI(userAvatar);

                        await submitted.update({
                            components: [updatedContainer],
                            files: [newFile],
                            flags: MessageFlags.IsComponentsV2
                        }).catch(() => {});
                    } catch (_) {
                        // User dismissed modal or timed out
                    }
                    return;
                }
            }

            const newBuf = await renderBuffer();
            const newFile = new AttachmentBuilder(newBuf, { name: 'message.png' });
            const updatedContainer = buildUI(userAvatar);

            await i.update({
                components: [updatedContainer],
                files: [newFile],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'done' || reason === 'deleted') return;
            const finalBuf = await renderBuffer();
            const finalFile = new AttachmentBuilder(finalBuf, { name: 'message.png' });
            await replyMsg.edit({
                content: null,
                embeds: [],
                components: [],
                files: [finalFile],
                flags: 0
            }).catch(() => {});
        });
    }

    // ──────────────────────── QUOTE STUDIO ────────────────────────
    async startQuoteStudio(message, args = [], repliedMsg = null) {
        let targetUser = null;
        let textArgs = [...args];

        if (textArgs.length > 0) {
            const resolved = await this.resolveTargetUser(message, textArgs[0]);
            if (resolved) {
                targetUser = resolved;
                textArgs.shift();
            }
        }

        if (!targetUser && repliedMsg) targetUser = repliedMsg.author;
        if (!targetUser) targetUser = message.author;

        let quoteText = textArgs.join(' ').trim();
        if (!quoteText && repliedMsg?.content) quoteText = repliedMsg.content;
        if (!quoteText) quoteText = 'hi';

        const state = {
            text: quoteText,
            user: targetUser,
            style: 'monochrome',
            font: 'ZenAntique',
            watermark: '• harm'
        };

        const renderBuffer = async () => {
            return await renderQuote({
                text: state.text,
                avatarUrl: state.user.displayAvatarURL({ extension: 'png', size: 1024 }),
                displayName: state.user.displayName || state.user.username,
                username: state.user.username,
                style: state.style,
                font: state.font,
                watermark: state.watermark
            });
        };

        // Welcome DM Inspired Aesthetic Components V2 Layout
        const buildUI = (avatarUrl) => {
            const container = new ContainerBuilder();
            container.setAccentColor(0x2b2d31);

            const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';

            const headerSection = new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `### [harm quote studio](${supportUrl})\n` +
                        `-# render high-contrast film noir editorial quote portraits with authentic typography.\n\n` +
                        `-# **author:** <@${state.user.id}> · **style:** \`${state.style}\` · **font:** \`${state.font.toLowerCase()}\`\n` +
                        `-# **watermark:** \`${state.watermark ? 'on' : 'off'}\`\n` +
                        `-# customize style below or click **done** to export the clean attachment.\n-# ${'\u2800'.repeat(44)}`
                    )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder().setURL(avatarUrl)
                );
            container.addSectionComponents(headerSection);

            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://quote.png'))
            );

            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

            // Select Menu with ONLY single default per category and custom emojis
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('quote_studio_style')
                .setPlaceholder('select editorial style or typography...')
                .addOptions(
                    new StringSelectMenuOptionBuilder()
                        .setLabel('dark monochrome')
                        .setValue('style_monochrome')
                        .setDescription('classic film noir high-contrast grayscale')
                        .setEmoji(config.emojis?.ghostvc || '🎬'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('harm burgundy')
                        .setValue('style_burgundy')
                        .setDescription('harm signature burgundy plum atmosphere')
                        .setEmoji(config.emojis?.harm || '<:harmsdio:1556221836507742278>'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('cinematic sepia')
                        .setValue('style_sepia')
                        .setDescription('warm vintage film portrait tone')
                        .setEmoji(config.emojis?.coin || '🎞️'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('natural color')
                        .setValue('style_color')
                        .setDescription('preserve original avatar color palette')
                        .setEmoji(config.emojis?.channels || '🎨'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('editorial serif')
                        .setValue('font_ZenAntique')
                        .setDescription('classic editorial serif typography')
                        .setEmoji(config.emojis?.crown || '👑'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('modern sans')
                        .setValue('font_Inter')
                        .setDescription('clean minimalist aesthetic typography')
                        .setEmoji(config.emojis?.idcard || '🪪'),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('terminal code')
                        .setValue('font_JetBrainsMono')
                        .setDescription('monospaced coding terminal typography')
                        .setEmoji(config.emojis?.boost || '💻')
                );

            const selectRow = new ActionRowBuilder().addComponents(selectMenu);

            // NO GREEN BUTTONS: All buttons use ButtonStyle.Secondary
            const buttonRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('quote_btn_watermark')
                    .setLabel(state.watermark ? 'watermark: on' : 'watermark: off')
                    .setEmoji(config.emojis?.harm || '<:harmsdio:1556221836507742278>')
                    .setStyle(state.watermark ? ButtonStyle.Primary : ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('quote_btn_text')
                    .setLabel('edit quote')
                    .setEmoji('✏️')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setCustomId('quote_btn_finish')
                    .setLabel('done')
                    .setEmoji(config.emojis?.approve || '<:harm_tick:1558811267014066366>')
                    .setStyle(ButtonStyle.Secondary)
            );

            container.addActionRowComponents(selectRow, buttonRow);
            return container;
        };

        let initialBuf;
        try {
            initialBuf = await renderBuffer();
        } catch (err) {
            return message.reply(build.warnBox('render error', 'failed to generate quote card preview.'));
        }

        const userAvatar = state.user.displayAvatarURL({ extension: 'png', size: 1024 });
        const file = new AttachmentBuilder(initialBuf, { name: 'quote.png' });
        const container = buildUI(userAvatar);

        let replyMsg;
        try {
            replyMsg = await message.reply({
                components: [container],
                files: [file],
                allowedMentions: { repliedUser: false },
                flags: MessageFlags.IsComponentsV2
            });
        } catch (err) {
            console.error('[quote studio reply error]:', err);
            return message.reply({ files: [file], allowedMentions: { repliedUser: false } }).catch(() => {});
        }

        if (!replyMsg) return;

        const collector = replyMsg.createMessageComponentCollector({ time: 120000 });

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: 'only the command author can control this menu.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            collector.resetTimer?.();

            if (i.isStringSelectMenu() && i.customId === 'quote_studio_style') {
                const val = i.values[0];
                if (val.startsWith('style_')) {
                    state.style = val.replace('style_', '');
                } else if (val.startsWith('font_')) {
                    state.font = val.replace('font_', '');
                }
            } else if (i.isButton()) {
                if (i.customId === 'quote_btn_watermark') {
                    state.watermark = state.watermark ? '' : '• harm';
                } else if (i.customId === 'quote_btn_finish') {
                    // WHEN DONE: ONLY edit to the raw image output, NOT in an embed!
                    collector.stop('done');
                    const finalBuf = await renderBuffer();
                    const finalFile = new AttachmentBuilder(finalBuf, { name: 'quote.png' });
                    return await i.update({
                        content: null,
                        embeds: [],
                        components: [],
                        files: [finalFile],
                        flags: 0
                    }).catch(() => {});
                } else if (i.customId === 'quote_btn_text') {
                    const modalId = `modal_quote_${i.id}_${Date.now()}`;
                    const modal = new ModalBuilder()
                        .setCustomId(modalId)
                        .setTitle('edit quote text');

                    const textInput = new TextInputBuilder()
                        .setCustomId('new_quote')
                        .setLabel('quote text')
                        .setStyle(TextInputStyle.Paragraph)
                        .setValue(state.text || '')
                        .setMaxLength(1000)
                        .setRequired(true);

                    modal.addComponents(new ActionRowBuilder().addComponents(textInput));

                    await i.showModal(modal).catch(() => {});

                    try {
                        const submitted = await i.awaitModalSubmit({
                            filter: sm => sm.customId === modalId && sm.user.id === message.author.id,
                            time: 120000
                        });

                        collector.resetTimer?.();
                        const valQuote = submitted.fields.getTextInputValue('new_quote');
                        if (valQuote && valQuote.trim()) {
                            state.text = valQuote.trim();
                        }

                        const newBuf = await renderBuffer();
                        const newFile = new AttachmentBuilder(newBuf, { name: 'quote.png' });
                        const updatedContainer = buildUI(userAvatar);

                        await submitted.update({
                            components: [updatedContainer],
                            files: [newFile],
                            flags: MessageFlags.IsComponentsV2
                        }).catch(() => {});
                    } catch (_) {
                        // User dismissed modal or timed out
                    }
                    return;
                }
            }

            const newBuf = await renderBuffer();
            const newFile = new AttachmentBuilder(newBuf, { name: 'quote.png' });
            const updatedContainer = buildUI(userAvatar);

            await i.update({
                components: [updatedContainer],
                files: [newFile],
                flags: MessageFlags.IsComponentsV2
            }).catch(() => {});
        });

        collector.on('end', async (_, reason) => {
            if (reason === 'done' || reason === 'deleted') return;
            const finalBuf = await renderBuffer();
            const finalFile = new AttachmentBuilder(finalBuf, { name: 'quote.png' });
            await replyMsg.edit({
                content: null,
                embeds: [],
                components: [],
                files: [finalFile],
                flags: 0
            }).catch(() => {});
        });
    }
}

module.exports = GenerateCommand;
