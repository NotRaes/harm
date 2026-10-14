const path = require('path');
const fs = require('fs');
const {
    EmbedBuilder,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} = require('discord.js');
const config = require('../../config');
const color = config.colors.c;

/*
 *  Discord Components V2 Fluent Builder — Harm
 *  fluent builder for modern Components V2 containers with automatic EmbedBuilder fallback.
 */
class V2Builder {
    constructor({ accent = 0x2b2d31 } = {}) {
        this.accent = typeof accent === 'string' ? parseInt(accent.replace('#', ''), 16) : accent;
        this.elements = [];
        this.actionRows = [];
        this.files = [];
        this._header = null;
        this._banner = null;
    }

    setAccent(accentColor) {
        this.accent = typeof accentColor === 'string' ? parseInt(accentColor.replace('#', ''), 16) : accentColor;
        return this;
    }

    setHeader(title, subtitle = null, url = null, thumbnail = null) {
        this._header = { title, subtitle, url, thumbnail };
        return this;
    }

    addText(content) {
        if (!content) return this;
        const text = Array.isArray(content) ? content.join('\n') : String(content);
        this.elements.push({ type: 'text', text });
        return this;
    }

    addSubtext(lines) {
        if (!lines) return this;
        const arr = Array.isArray(lines) ? lines : [lines];
        const text = arr.map(l => l.startsWith('-# ') ? l : `-# ${l}`).join('\n');
        this.elements.push({ type: 'text', text });
        return this;
    }

    addCode(language, code) {
        this.elements.push({ type: 'text', text: `\`\`\`${language}\n${code}\n\`\`\`` });
        return this;
    }

    addSection(content, thumbnail = null) {
        const text = Array.isArray(content) ? content.join('\n') : String(content);
        this.elements.push({ type: 'section', text, thumbnail });
        return this;
    }

    addDivider(spacing = SeparatorSpacingSize.Small) {
        this.elements.push({ type: 'divider', spacing });
        return this;
    }

    setBanner(urlOrAttachment, position = 'bottom') {
        if (!urlOrAttachment) return this;
        if (typeof urlOrAttachment === 'string') {
            this._banner = urlOrAttachment;
        } else if (urlOrAttachment.name) {
            this._banner = `attachment://${urlOrAttachment.name}`;
            this.addFile(urlOrAttachment);
        }
        this._bannerPosition = position;
        return this;
    }

    addFile(attachment) {
        if (attachment) this.files.push(attachment);
        return this;
    }

    addRow(...components) {
        if (!components.length) return this;
        const row = new ActionRowBuilder();
        for (const c of components) {
            if (Array.isArray(c)) row.addComponents(...c);
            else row.addComponents(c);
        }
        this.actionRows.push(row);
        return this;
    }

    addButton({ label, style = ButtonStyle.Secondary, customId, url, emoji, disabled = false }) {
        const btn = new ButtonBuilder().setStyle(style).setDisabled(disabled);
        if (label) btn.setLabel(label);
        if (customId) btn.setCustomId(customId);
        if (url) {
            btn.setURL(url);
            btn.setStyle(ButtonStyle.Link);
        }
        if (emoji) btn.setEmoji(emoji);

        let lastRow = this.actionRows[this.actionRows.length - 1];
        if (!lastRow || lastRow.components.length >= 5 || lastRow.components[0]?.data?.type === 3) {
            lastRow = new ActionRowBuilder();
            this.actionRows.push(lastRow);
        }
        lastRow.addComponents(btn);
        return this;
    }

    addSelect({ customId, placeholder = 'choose an option...', options = [] }) {
        const menu = new StringSelectMenuBuilder()
            .setCustomId(customId)
            .setPlaceholder(placeholder);

        for (const opt of options) {
            const o = new StringSelectMenuOptionBuilder()
                .setLabel(opt.label)
                .setValue(opt.value);
            if (opt.description) o.setDescription(opt.description);
            if (opt.emoji) o.setEmoji(opt.emoji);
            if (opt.default) o.setDefault(opt.default);
            menu.addOptions(o);
        }

        const row = new ActionRowBuilder().addComponents(menu);
        this.actionRows.push(row);
        return this;
    }

    toContainer() {
        const container = new ContainerBuilder();
        if (this.accent !== null && this.accent !== undefined) {
            container.setAccentColor(this.accent);
        }

        if (this._banner && this._bannerPosition === 'top') {
            const gallery = new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(this._banner)
            );
            container.addMediaGalleryComponents(gallery);
        }

        if (this._header) {
            const { title, subtitle, url, thumbnail } = this._header;
            const heading = url ? `### [${title}](${url})` : `### ${title}`;
            const headerContent = subtitle ? `${heading}\n-# ${subtitle}` : heading;

            if (thumbnail) {
                container.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent))
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail))
                );
            } else {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent));
            }
        }

        for (const el of this.elements) {
            if (el.type === 'text') {
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(el.text));
            } else if (el.type === 'section') {
                const sec = new SectionBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(el.text)
                );
                if (el.thumbnail) {
                    sec.setThumbnailAccessory(new ThumbnailBuilder().setURL(el.thumbnail));
                }
                container.addSectionComponents(sec);
            } else if (el.type === 'divider') {
                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(el.spacing || SeparatorSpacingSize.Small)
                );
            }
        }

        if (this._banner && this._bannerPosition !== 'top') {
            const gallery = new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(this._banner)
            );
            container.addMediaGalleryComponents(gallery);
        }

        if (this.actionRows.length > 0) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );
            for (const row of this.actionRows) {
                container.addActionRowComponents(row);
            }
        }

        return container;
    }

    toEmbed() {
        const embed = new EmbedBuilder().setColor(this.accent || config.colors.c || 0x2b2d31);
        const parts = [];

        if (this._header) {
            const { title, subtitle, url } = this._header;
            const heading = url ? `### [${title}](${url})` : `### ${title}`;
            parts.push(subtitle ? `${heading}\n-# ${subtitle}` : heading);
            if (this._header.thumbnail) embed.setThumbnail(this._header.thumbnail);
        }

        for (const el of this.elements) {
            if (el.type === 'text' || el.type === 'section') {
                parts.push(el.text);
            }
        }

        if (parts.length > 0) embed.setDescription(parts.join('\n\n'));
        if (this._banner) embed.setImage(this._banner);

        return embed;
    }

    toPayload() {
        return {
            components: [this.toContainer()],
            files: this.files,
            allowedMentions: { repliedUser: false },
            flags: MessageFlags.IsComponentsV2
        };
    }

    async send(target, { reply = true } = {}) {
        try {
            const payload = this.toPayload();
            if (reply && typeof target.reply === 'function') {
                return await target.reply(payload);
            }
            if (typeof target.send === 'function') {
                return await target.send(payload);
            }
            if (typeof target.channel?.send === 'function') {
                return await target.channel.send(payload);
            }
        } catch (_) {
            const fallbackEmbed = this.toEmbed();
            const fallbackPayload = {
                embeds: [fallbackEmbed],
                components: this.actionRows,
                files: this.files,
                allowedMentions: { repliedUser: false }
            };
            if (reply && typeof target.reply === 'function') {
                return await target.reply(fallbackPayload).catch(() => {});
            }
            if (typeof target.send === 'function') {
                return await target.send(fallbackPayload).catch(() => {});
            }
            if (typeof target.channel?.send === 'function') {
                return await target.channel.send(fallbackPayload).catch(() => {});
            }
        }
    }
}

class build {
    constructor() {
        this.embed = new EmbedBuilder().setColor(color);
        this.sections = [];
    }

    setStyledAuthor(title, iconURL = null) {

        this.embed.setAuthor({
            name: title,
            iconURL: iconURL || null
        });
        return this;
    }

    addSection(content, addSpacing = true) {
        if (addSpacing && this.sections.length > 0) {
            this.sections.push('');
        }

        if (Array.isArray(content)) {
            this.sections.push(...content.map(line => `${line}`));
        } else {
            this.sections.push(`${content}`);
        }
        return this;
    }

    addTitledSection(title, items, titleEmoji = null) {
        const sectionTitle = titleEmoji ? `${titleEmoji} **${title}**` : `**${title}**`;
        this.addSection(sectionTitle, this.sections.length > 0);
        this.addSection('', false);

        if (Array.isArray(items)) {
            items.forEach(item => {
                this.sections.push(`${item}`);
            });
        }
        return this;
    }

    addTitledSectionClean(title, items, titleEmoji = null, compact = false, noSpacingBefore = false) {
        if (!noSpacingBefore && this.sections.length > 0) {
            this.sections.push('');
        }

        const sectionTitle = titleEmoji ? `${titleEmoji} ${title}` : title;
        this.sections.push(sectionTitle);

        if (!compact) {
            this.sections.push('');
        }

        if (Array.isArray(items)) {
            items.forEach(item => {
                this.sections.push(`${item}`);
            });
        }
        return this;
    }

    addStatus(label, value, emoji = null) {
        const statusEmoji = emoji;
        const statusLine = `${statusEmoji} **${label}:** \`${value}\``;
        this.sections.push(`${statusLine}`);
        return this;
    }

    addHighlight(text, emoji = null) {
        const highlight = emoji ? `${emoji} *${text}*` : `*${text}*`;
        this.sections.push(`${highlight}`);
        return this;
    }

    addSeparator() {
        this.sections.push('');
        return this;
    }

    setStyledFooter(text, iconURL = null) {

        this.embed.setFooter({
            text: text,
            iconURL: iconURL || null
        });
        return this;
    }

    addThumbnail(url) {
        if (url) this.embed.setThumbnail(url);
        return this;
    }

    setImage(url) {
        if (url) this.embed.setImage(url);
        return this;
    }

    addTimestamp() {
        this.embed.setTimestamp();
        return this;
    }

    build() {
        if (this.sections.length > 0) {
            this.embed.setDescription(this.sections.join('\n'));
        }
        return this.embed;
    }

    static panel({
        title,
        titleUrl = null,
        subtitle = null,
        thumbnail = null,
        accentColor = 0x2b2d31,
        sections = [],
        media = [],
        actionRows = []
    } = {}) {
        const container = new ContainerBuilder();
        if (accentColor !== null && accentColor !== undefined) {
            container.setAccentColor(accentColor);
        }

        if (title) {
            const heading = titleUrl ? `### [${title}](${titleUrl})` : `### ${title}`;
            const headerContent = subtitle ? `${heading}\n-# ${subtitle}` : heading;
            if (thumbnail) {
                const headerSection = new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(headerContent))
                    .setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
                container.addSectionComponents(headerSection);
            } else {
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(headerContent)
                );
            }
        }

        if (sections && Array.isArray(sections)) {
            for (const sec of sections) {
                if (!sec) continue;
                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );
                const content = Array.isArray(sec) ? sec.join('\n') : sec;
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(content)
                );
            }
        }

        if (media && Array.isArray(media) && media.length > 0) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );
            const mediaGallery = new MediaGalleryBuilder();
            for (const url of media) {
                if (url) mediaGallery.addItems(new MediaGalleryItemBuilder().setURL(url));
            }
            container.addMediaGalleryComponents(mediaGallery);
        }

        if (actionRows && Array.isArray(actionRows) && actionRows.length > 0) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );
            for (const row of actionRows) {
                container.addActionRowComponents(row);
            }
        }

        return container;
    }

    static async help(message, command) {
        const client = message.client || message.guild?.client;
        const prefix = (message.guild && client?.db) ? (client.db.getGuildPrefix(message.guild.id) || config.prefix || ',') : (config.prefix || ',');
        const botAvatar = (client?.user || message.guild?.members?.me?.user)?.displayAvatarURL({ size: 1024, dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const cmdName = command.name ? command.name.toLowerCase() : 'command';
        const title = cmdName.toLowerCase();
        const desc = command.description || 'no description provided.';

        const aliasesText = (command.aliases && command.aliases.length > 0)
            ? command.aliases.join(', ')
            : 'none';
        const permissionsText = (command.permissions && command.permissions.length > 0)
            ? command.permissions.map(p => p.toLowerCase()).join(', ')
            : 'none';

        const isCf = cmdName === 'coinflip' || cmdName === 'cf' || command.name === 'coinflip' || command.hideHint;
        const subcommands = Array.isArray(command.subcommands) ? command.subcommands.filter(Boolean) : [];
        const hasSubcommands = subcommands.length > 0;

        let syntaxText = command.syntax || `${prefix}${cmdName}`;
        if (!syntaxText.startsWith(prefix)) syntaxText = `${prefix}${syntaxText}`;

        let exampleText = command.example || syntaxText;
        if (!exampleText.startsWith(prefix)) exampleText = `${prefix}${exampleText}`;

        // Page count:
        // Page 0: Main command overview
        // Page 1: Subcommands list
        // Pages 2..(subcommands.length + 1): Individual subcommand details
        const totalPages = hasSubcommands ? (2 + subcommands.length) : 1;
        let currentPage = 0;
        let dropdownOpen = false;

        const cat = (command.category || 'help').toLowerCase();
        const bannerAttachment = build.getAssetAttachment(`${cat}.png`) || build.getAssetAttachment('help.png');
        const files = bannerAttachment ? [bannerAttachment] : [];

        const buildPageContainer = (pageIdx, showDropdown) => {
            const container = new ContainerBuilder();
            container.setAccentColor(0x2b2d31);

            if (pageIdx === 0) {
                // Page 1: Main command
                container.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## ${title.toLowerCase()}\n${desc.toLowerCase()}`)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar))
                );

                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );

                const premEmoji = config.emojis?.premium || '<:harm_premium:1558810882795114536>';
                const tierBadge = command.paid
                    ? ` • **tier:** premium ${premEmoji}${command.freeuses ? ` (${command.freeuses} free uses)` : ''}`
                    : '';

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**aliases:** ${aliasesText} • **permissions:** ${permissionsText}${tierBadge}`)
                );

                const ansiCode = `\`\`\`ansi\n\u001b[0;32msyntax:\u001b[0m  ${syntaxText}\n\u001b[0;31mexample:\u001b[0m ${exampleText}\n\`\`\``;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ansiCode));
            } else if (pageIdx === 1) {
                // Page 2: Subcommands list and info
                container.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## ${title.toLowerCase()} subcommands\nall available subcommands for ${cmdName}.`)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar))
                );

                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**total subcommands:** \`${subcommands.length}\` • **permissions:** ${permissionsText}`)
                );

                const formattedList = subcommands.map(s => {
                    const clean = s.replace(new RegExp('^' + cmdName + '\\s*', 'i'), '').trim();
                    return `  • ${prefix}${cmdName} ${clean}`;
                }).join('\n');

                const ansiCode = `\`\`\`ansi\n\u001b[0;32msyntax:\u001b[0m  ${prefix}${cmdName} <subcommand>\n\u001b[0;31msubcommands (${subcommands.length}):\u001b[0m\n${formattedList}\n\`\`\``;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ansiCode));
            } else {
                // Pages 3..N: Specific subcommand details
                const subIdx = pageIdx - 2;
                const rawSub = subcommands[subIdx];
                const cleanSub = rawSub.replace(new RegExp('^' + cmdName + '\\s*', 'i'), '').trim();
                const subTitle = `${title.toLowerCase()}: ${cleanSub.split(/\s+/)[0]}`;

                let subSyntax = `${prefix}${rawSub.startsWith(cmdName) ? rawSub : `${cmdName} ${cleanSub}`}`;
                let subExample = subSyntax;

                container.addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder().setContent(`## ${subTitle.toLowerCase()}\nsubcommand of ${cmdName.toLowerCase()}.`)
                        )
                        .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar))
                );

                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**command:** ${cmdName} • **subcommand:** \`${cleanSub.split(/\s+/)[0]}\``)
                );

                const ansiCode = `\`\`\`ansi\n\u001b[0;32msyntax:\u001b[0m  ${subSyntax}\n\u001b[0;31mexample:\u001b[0m ${subExample}\n\`\`\``;
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(ansiCode));

                container.addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );
                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`-# **subcommand ${subIdx + 1} of ${subcommands.length}** • parameters in \`<>\` are required, \`[]\` are optional.`)
                );
            }

            // Bottom-anchored Category Banner
            if (bannerAttachment) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(`attachment://${bannerAttachment.name}`)
                    )
                );
            }

            // Dropdown menu (if open)
            if (hasSubcommands && showDropdown) {
                const options = [
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`${title.toLowerCase()} (overview)`)
                        .setValue('page_0')
                        .setDescription('main command overview')
                        .setDefault(pageIdx === 0),
                    new StringSelectMenuOptionBuilder()
                        .setLabel('subcommands list')
                        .setValue('page_1')
                        .setDescription(`view all ${subcommands.length} subcommands`)
                        .setDefault(pageIdx === 1)
                ];

                subcommands.slice(0, 23).forEach((sub, idx) => {
                    const clean = sub.replace(new RegExp('^' + cmdName + '\\s*', 'i'), '').trim() || sub;
                    options.push(
                        new StringSelectMenuOptionBuilder()
                            .setLabel(clean.slice(0, 100))
                            .setValue(`page_${idx + 2}`)
                            .setDescription(`syntax and details for ${clean.split(/\s+/)[0]}`)
                            .setDefault(pageIdx === (idx + 2))
                    );
                });

                const menuRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('help_sub_select')
                        .setPlaceholder('choose a subcommand...')
                        .addOptions(options)
                );
                container.addActionRowComponents(menuRow);
            }

            // Buttons row
            if (hasSubcommands) {
                const navRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('help_prev')
                        .setEmoji(config.emojis.al)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('help_next')
                        .setEmoji(config.emojis.ar)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('help_dots')
                        .setEmoji(config.emojis.dots)
                        .setStyle(showDropdown ? ButtonStyle.Primary : ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId('help_close')
                        .setEmoji(config.emojis.cancel)
                        .setStyle(ButtonStyle.Secondary)
                );
                container.addActionRowComponents(navRow);
            }

            return container;
        };

        try {
            const initialContainer = buildPageContainer(currentPage, dropdownOpen);
            const replyMsg = await message.reply({
                components: [initialContainer],
                files,
                allowedMentions: { repliedUser: false },
                flags: MessageFlags.IsComponentsV2
            });

            const collector = replyMsg.createMessageComponentCollector({
                time: 30000
            });

            collector.on('collect', async i => {
                if (i.user.id !== message.author.id) {
                    return i.reply({ content: 'only the command author can control this menu.', flags: MessageFlags.Ephemeral }).catch(() => {});
                }

                if (i.customId === 'help_prev') {
                    currentPage = (currentPage - 1 + totalPages) % totalPages;
                } else if (i.customId === 'help_next') {
                    currentPage = (currentPage + 1) % totalPages;
                } else if (i.customId === 'help_dots') {
                    dropdownOpen = !dropdownOpen;
                } else if (i.customId === 'help_close') {
                    collector.stop('closed');
                    return replyMsg.delete().catch(() => {});
                } else if (i.isStringSelectMenu() && i.customId === 'help_sub_select') {
                    currentPage = parseInt(i.values[0].replace('page_', ''), 10) || 0;
                    dropdownOpen = false;
                }

                const updatedContainer = buildPageContainer(currentPage, dropdownOpen);
                await i.update({
                    components: [updatedContainer],
                    flags: MessageFlags.IsComponentsV2
                }).catch(() => {});
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'deleted' || reason === 'closed') return;
            });

            return replyMsg;
        } catch (err) {
            console.error('[build.help] Components V2 failed, falling back to embed:', err);
            let fallbackDesc = `## ${title.toLowerCase()}\n${desc.toLowerCase()}\n\n` +
                `**aliases:** ${aliasesText} • **permissions:** ${permissionsText}\n\n` +
                `\`\`\`ansi\n\u001b[0;32msyntax:\u001b[0m  ${syntaxText}\n\u001b[0;31mexample:\u001b[0m ${exampleText}\n\`\`\``;

            const embed = new EmbedBuilder()
                .setColor(config.colors.c)
                .setDescription(fallbackDesc);
            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }
    }

    static async helpSubcommand(message, command, subMatch) {
        const client = message.client || message.guild?.client;
        const prefix = (message.guild && client?.db) ? (client.db.getGuildPrefix(message.guild.id) || config.prefix || ',') : (config.prefix || ',');
        const botAvatar = (client?.user || message.guild?.members?.me?.user)?.displayAvatarURL({ size: 1024, dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

        const cmdName = command.name ? command.name.toLowerCase() : 'command';
        const cleanSub = subMatch.toLowerCase().startsWith(cmdName) ? subMatch.toLowerCase() : `${cmdName} ${subMatch.toLowerCase()}`;
        const subOnly = subMatch.toLowerCase().replace(new RegExp('^' + cmdName + '\\s*', 'i'), '').trim();
        const subTitle = `${cmdName} ${subOnly}`.trim();

        const details = command.subcommandDetails?.[subOnly] ||
                        command.subcommandDetails?.[cleanSub] ||
                        command.subcommandDescriptions?.[subOnly] ||
                        command.subcommandDescriptions?.[cleanSub];

        let desc = command.description || 'no description provided.';
        let syntax = `${prefix}${cleanSub}`;
        let example = `${prefix}${cleanSub}`;

        if (typeof details === 'string') {
            desc = details;
        } else if (details && typeof details === 'object') {
            if (details.description) desc = details.description;
            if (details.syntax) syntax = details.syntax;
            if (details.example) example = details.example;
        }

        const container = new ContainerBuilder();
        container.setAccentColor(0x2b2d31);

        const headerSection = new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`## ${subTitle.toLowerCase()}\n${desc.toLowerCase()}`)
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder().setURL(botAvatar)
            );
        container.addSectionComponents(headerSection);

        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

        const permissionsText = (command.permissions && command.permissions.length > 0)
            ? command.permissions.map(p => p.toLowerCase()).join(', ')
            : 'none';

        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**command:** ${cmdName} • **permissions:** ${permissionsText}`)
        );

        const ansiContent = `\`\`\`ansi\n\u001b[0;32msyntax:\u001b[0m  ${syntax}\n\u001b[0;31mexample:\u001b[0m ${example}\n\`\`\``;
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(ansiContent)
        );

        try {
            const replyMsg = await message.reply({
                components: [container],
                allowedMentions: { repliedUser: false },
                flags: MessageFlags.IsComponentsV2
            });
            return replyMsg;
        } catch (err) {
            console.error('[build.helpSubcommand] Components V2 failed, falling back to embed:', err);
            let fallbackDesc = `## ${subTitle.toLowerCase()}\n${desc.toLowerCase()}\n\n` +
                `**command:** ${cmdName} • **permissions:** ${permissionsText}\n\n` +
                ansiContent;

            const embed = new EmbedBuilder()
                .setColor(config.colors.c)
                .setDescription(fallbackDesc);
            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }
    }

    static deny(user, message) {
        let title = 'denied';
        let text = message;
        if (!message) {
            text = user;
        } else if (typeof user === 'string' && !user.startsWith('<@')) {
            title = user.toLowerCase();
        }
        const cleanText = (typeof text === 'string' && !text.startsWith('<') && !text.startsWith('http') && !text.startsWith('`'))
            ? (text.charAt(0).toLowerCase() + text.slice(1))
            : text;
        return new EmbedBuilder()
            .setDescription(`${config.emojis.deny} **${title.toLowerCase()}** — ${cleanText}`)
            .setColor(0x2b2d31);
    }

    static warn(user, message) {
        let title = 'warning';
        let text = message;
        if (!message) {
            text = user;
        } else if (typeof user === 'string' && !user.startsWith('<@')) {
            title = user.toLowerCase();
        }
        const cleanText = (typeof text === 'string' && !text.startsWith('<') && !text.startsWith('http') && !text.startsWith('`'))
            ? (text.charAt(0).toLowerCase() + text.slice(1))
            : text;
        return new EmbedBuilder()
            .setDescription(`${config.emojis.warn} **${title.toLowerCase()}** — ${cleanText}`)
            .setColor(0x2b2d31);
    }

    static approved(user, message) {
        let title = 'success';
        let text = message;
        if (!message) {
            text = user;
        } else if (typeof user === 'string' && !user.startsWith('<@')) {
            title = user.toLowerCase();
        }
        const cleanText = (typeof text === 'string' && !text.startsWith('<') && !text.startsWith('http') && !text.startsWith('`'))
            ? (text.charAt(0).toLowerCase() + text.slice(1))
            : text;
        return new EmbedBuilder()
            .setDescription(`${config.emojis.approve} **${title.toLowerCase()}** — ${cleanText}`)
            .setColor(0x2b2d31);
    }

    static say(user, message) {
        const desc = user ? `<@${user.id || user}>**:** ${message}` : message;
        return new EmbedBuilder()
            .setDescription(desc)
            .setColor(config.colors.c);
    }

    static warnBox(title, message) {
        return build.noticeBox('warn', title, message);
    }

    static denyBox(title, message) {
        return build.noticeBox('deny', title, message);
    }

    static approvedBox(title, message) {
        return build.noticeBox('approve', title, message);
    }

    static noticeBox(type, title, message) {
        let t = title;
        let m = message;
        if (m === undefined) {
            m = t;
            t = null;
        }
        const emoji = type === 'warn' ? (config.emojis?.warn || '<:harm_warn:1558811265097531412>')
            : type === 'deny' ? (config.emojis?.deny || '<:harm_deny:1558811268608167939>')
            : (config.emojis?.approve || '<:harm_tick:1558811267014066366>');
        const cleanTitle = t ? t.toLowerCase() : null;
        const cleanMsg = (typeof m === 'string' && !m.startsWith('<') && !m.startsWith('http') && !m.startsWith('`'))
            ? (m.charAt(0).toLowerCase() + m.slice(1))
            : m;
        const content = cleanTitle ? `${emoji} **${cleanTitle}** — ${cleanMsg}` : `${emoji} ${cleanMsg}`;
        const container = new ContainerBuilder();
        container.setAccentColor(0x2b2d31);
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        );
        return {
            components: [container],
            allowedMentions: { repliedUser: false },
            flags: MessageFlags.IsComponentsV2
        };
    }

    // resolved path cache — survives the entire process lifetime
    static _assetPathCache = new Map();

    static getAssetAttachment(filename) {
        // check memory cache first (zero disk I/O on subsequent calls)
        if (build._assetPathCache.has(filename)) {
            const cached = build._assetPathCache.get(filename);
            return cached ? new AttachmentBuilder(cached, { name: filename }) : null;
        }

        const candidatePaths = [
            path.resolve(__dirname, 'assets/on add', filename),
            path.resolve(__dirname, 'assets/banners', filename),
            path.resolve(__dirname, 'assets', filename),
            path.resolve(__dirname, '../../../assets/on add', filename),
            path.resolve(__dirname, '../../../assets/banners', filename),
            path.resolve(__dirname, '../../../../assets/on add', filename)
        ];
        for (const candidate of candidatePaths) {
            if (fs.existsSync(candidate)) {
                build._assetPathCache.set(filename, candidate);
                return new AttachmentBuilder(candidate, { name: filename });
            }
        }
        build._assetPathCache.set(filename, null);
        return null;
    }
}

build.V2 = V2Builder;
build.v2 = V2Builder;

module.exports = build;
