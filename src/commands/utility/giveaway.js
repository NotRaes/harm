const { PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags, EmbedBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');
const GiveawayHelper = require('../../structures/utils/helpers/giveaway.js');

class GiveawayCommand {
    constructor() {
        this.name = 'giveaway';
        this.aliases = [
            'gw', 'giveaways',
            'gstart', 'gwstart', 'gcreate',
            'gcancel', 'gwcancel',
            'gedit', 'gwedit',
            'gend', 'gwend',
            'gentries', 'gwentries',
            'gimage', 'gwimage',
            'glist', 'gwlist',
            'greq', 'gwreq', 'grequirement',
            'greroll', 'gwreroll'
        ];
        this.description = 'timed giveaways with requirements and rerolls.';
        this.syntax = ',giveaway <start|cancel|edit|end|entries|image|list|requirement|reroll> [arguments]';
        this.example = ',giveaway start 10m 1 nitro';
        this.category = 'utility';
        this.cooldown = 3;

        this.subcommands = [
            'giveaway start <duration> <winners> <prize>',
            'giveaway cancel [message_id]',
            'giveaway edit <message_id> <prize|+duration>',
            'giveaway end [message_id]',
            'giveaway entries [message_id]',
            'giveaway image [message_id] [image]',
            'giveaway list',
            'giveaway requirement <message_id> <role|boost|age> [value]',
            'giveaway reroll [message_id]'
        ];

        this.subcommandDetails = {
            start: {
                description: 'start a timed giveaway in the current channel.',
                syntax: ',giveaway start <duration> <winners> <prize>',
                example: ',gstart 10m 1 nitro'
            },
            cancel: {
                description: 'cancel without drawing anyone.',
                syntax: ',giveaway cancel [message_id]',
                example: ',gcancel'
            },
            edit: {
                description: 'change the prize or add time to an active giveaway.',
                syntax: ',giveaway edit <message_id> <prize|+duration>',
                example: ',gedit 123456789012345678 +10m'
            },
            end: {
                description: 'end a giveaway now and draw winners immediately.',
                syntax: ',giveaway end [message_id]',
                example: ',gend'
            },
            entries: {
                description: 'who has entered a giveaway.',
                syntax: ',giveaway entries [message_id]',
                example: ',gentries'
            },
            image: {
                description: 'add a banner to a giveaway — attach it or give a link.',
                syntax: ',giveaway image [message_id] [image]',
                example: ',gimage https://example.com/banner.png'
            },
            list: {
                description: 'every giveaway still running in this server.',
                syntax: ',giveaway list',
                example: ',glist'
            },
            requirement: {
                description: 'restrict who can enter the next giveaway.',
                syntax: ',giveaway requirement <message_id> <role|boost|age> [value]',
                example: ',greq role @VIP'
            },
            reroll: {
                description: 'draw a new winner from previous entries.',
                syntax: ',giveaway reroll [message_id]',
                example: ',greroll'
            }
        };
    }

    async resolveGiveawayTarget(message, args, { activeOnly = false, endedOnly = false } = {}) {
        const db = message.client.db;
        let gw = null;
        let remaining = args ? [...args] : [];
        const firstArg = remaining[0];

        // 1. Target by replied message
        if (message.reference?.messageId) {
            gw = await db.getGiveawayByMessageId(message.reference.messageId);
            if (gw) return { gw, remainingArgs: remaining };
        }

        // 2. Target by Discord message link URL
        if (firstArg && /discord\.com\/channels\/\d+\/\d+\/(\d+)/.test(firstArg)) {
            const matched = firstArg.match(/discord\.com\/channels\/\d+\/\d+\/(\d+)/)[1];
            gw = await db.getGiveawayByMessageId(matched);
            if (gw) {
                remaining.shift();
                return { gw, remainingArgs: remaining };
            }
        }

        // 3. Target by Snowflake Message ID
        if (firstArg && /^\d{17,20}$/.test(firstArg)) {
            gw = await db.getGiveawayByMessageId(firstArg);
            if (gw) {
                remaining.shift();
                return { gw, remainingArgs: remaining };
            }
        }

        // 4. Target by SQLite ID
        if (firstArg && /^\d{1,6}$/.test(firstArg)) {
            gw = await db.getGiveawayById(parseInt(firstArg, 10));
            if (gw) {
                remaining.shift();
                return { gw, remainingArgs: remaining };
            }
        }

        // 5. Default to the latest giveaway in this channel or server
        gw = await db.getLatestGiveaway(message.guild.id, message.channel.id, { activeOnly, endedOnly });
        return { gw, remainingArgs: remaining };
    }

    async execute(message, args, commandName) {
        if (!message.guild) {
            return message.reply(build.warnBox('nothing found', 'giveaways can only be managed in servers.'));
        }

        const db = message.client.db;
        if (!db) {
            return message.reply(build.denyBox('offline', 'database subsystem is currently offline.'));
        }

        const invoked = (commandName || '').toLowerCase();
        let sub = (args?.[0] || '').toLowerCase();
        let remainingArgs = args ? [...args] : [];

        // Route shortforms
        if (['gstart', 'gwstart', 'gcreate'].includes(invoked)) {
            sub = 'start';
        } else if (['gcancel', 'gwcancel'].includes(invoked)) {
            sub = 'cancel';
        } else if (['gedit', 'gwedit'].includes(invoked)) {
            sub = 'edit';
        } else if (['gend', 'gwend'].includes(invoked)) {
            sub = 'end';
        } else if (['gentries', 'gwentries'].includes(invoked)) {
            sub = 'entries';
        } else if (['gimage', 'gwimage'].includes(invoked)) {
            sub = 'image';
        } else if (['glist', 'gwlist'].includes(invoked)) {
            sub = 'list';
        } else if (['greq', 'gwreq', 'grequirement'].includes(invoked)) {
            sub = 'requirement';
        } else if (['greroll', 'gwreroll'].includes(invoked)) {
            sub = 'reroll';
        } else if (this.subcommandDetails[sub]) {
            remainingArgs.shift();
        } else if (GiveawayHelper.parseDuration(sub)) {
            sub = 'start';
        }

        // If no subcommands or arguments specified, display interactive subcommands help
        if (!sub && (!args || args.length === 0)) {
            return await build.help(message, this);
        }

        const isOwner = config.owners?.includes(message.author.id);
        const hasModPerms = isOwner
            || message.member.permissions.has(PermissionFlagsBits.ManageGuild)
            || message.member.permissions.has(PermissionFlagsBits.ManageMessages);

        // ──────────────────────── LIST (everyone) ────────────────────────
        if (sub === 'list') {
            const active = await db.getActiveGiveaways(message.guild.id);
            if (!active.length) {
                return message.reply(build.warnBox('nothing found', 'no active giveaways currently running in this server.'));
            }

            const emojis = GiveawayHelper.getEmojis();
            const items = active.map((gw, idx) => {
                const endTimestamp = Math.floor(gw.ends_at / 1000);
                return `\`${idx + 1}.\` **${gw.prize}** in <#${gw.channel_id}>\n` +
                    `-# ends <t:${endTimestamp}:R> · **winners:** \`${gw.winners_count}\` · **id:** \`${gw.message_id}\``;
            });

            const bannerAttachment = build.getAssetAttachment('utility.png');
            const files = bannerAttachment ? [bannerAttachment] : [];

            const container = new ContainerBuilder()
                .setAccentColor(typeof config.colors?.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors?.c || 0x2b2d31))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### ${emojis.gift} active giveaways (${active.length})`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                )
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(items.join('\n\n'))
                );

            if (bannerAttachment) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(`attachment://${bannerAttachment.name}`)
                    )
                );
            }

            try {
                return await message.reply({ components: [container], files, flags: MessageFlags.IsComponentsV2 });
            } catch (_) {
                const embed = new EmbedBuilder()
                    .setColor(config.colors?.c || 0x2b2d31)
                    .setTitle('active giveaways')
                    .setDescription(items.join('\n\n'));
                if (bannerAttachment) embed.setImage(`attachment://${bannerAttachment.name}`);
                return await message.reply({ embeds: [embed], files });
            }
        }

        // ──────────────────────── ENTRIES (everyone) ────────────────────────
        if (sub === 'entries') {
            const { gw } = await this.resolveGiveawayTarget(message, remainingArgs);
            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no giveaway found in this channel. provide a valid message id.'));
            }

            const entries = await db.getGiveawayEntries(gw.id);
            if (!entries.length) {
                return message.reply(build.warnBox('nothing found', `no entries recorded for **${gw.prize}** yet.`));
            }

            const sample = entries.slice(0, 30).map(u => `<@${u}>`).join(', ');
            const remaining = entries.length - 30;
            const extra = remaining > 0 ? `\n-# *+${remaining} more participants*` : '';

            const container = new ContainerBuilder()
                .setAccentColor(typeof config.colors?.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors?.c || 0x2b2d31))
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`### entries for ${gw.prize} (${entries.length})\n${sample}${extra}`)
                );

            try {
                return await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            } catch (_) {
                return await message.reply({
                    embeds: [new EmbedBuilder().setColor(config.colors?.c || 0x2b2d31).setDescription(`### entries (${entries.length})\n${sample}${extra}`)]
                });
            }
        }

        // Mod permission required for administrative subcommands
        if (!hasModPerms) {
            return message.reply(build.denyBox('permission denied', 'you need `manage_messages` permission to configure giveaways.'));
        }

        // ──────────────────────── CANCEL ────────────────────────
        if (sub === 'cancel') {
            const { gw } = await this.resolveGiveawayTarget(message, remainingArgs, { activeOnly: true });
            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no active giveaway found to cancel.'));
            }
            if (gw.ended || gw.cancelled) {
                return message.reply(build.warnBox('already ended', 'this giveaway has already concluded.'));
            }

            await GiveawayHelper.cancelGiveaway(message.client, gw);
            return message.reply(build.approvedBox('cancelled', `giveaway for **${gw.prize}** has been cancelled without drawing winners.`));
        }

        // ──────────────────────── END ────────────────────────
        if (sub === 'end') {
            const { gw } = await this.resolveGiveawayTarget(message, remainingArgs, { activeOnly: true });
            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no active giveaway found to end.'));
            }
            if (gw.ended) {
                return message.reply(build.warnBox('already ended', 'this giveaway has already ended.'));
            }

            await GiveawayHelper.endGiveaway(message.client, gw);
            return message.reply(build.approvedBox('concluded', `giveaway for **${gw.prize}** has been concluded.`));
        }

        // ──────────────────────── REROLL ────────────────────────
        if (sub === 'reroll') {
            const { gw } = await this.resolveGiveawayTarget(message, remainingArgs, { endedOnly: true });
            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no concluded giveaway found to reroll.'));
            }

            const newWinners = await GiveawayHelper.rerollGiveaway(message.client, gw);
            if (!newWinners || !newWinners.length) {
                return message.reply(build.warnBox('nothing found', 'no entries available to reroll.'));
            }
            return message.reply(build.approvedBox('rerolled', `rerolled winner(s) for **${gw.prize}**.`));
        }

        // ──────────────────────── EDIT ────────────────────────
        if (sub === 'edit') {
            const { gw, remainingArgs: finalArgs } = await this.resolveGiveawayTarget(message, remainingArgs, { activeOnly: true });
            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no active giveaway found to edit.'));
            }

            const editVal = finalArgs.join(' ').trim();
            if (!editVal) {
                return message.reply(build.warnBox('missing parameter', 'specify a new prize or additional time (e.g. `+10m` or `2x nitro`).'));
            }

            // Check if adding time (+10m, +1h, etc.)
            if (editVal.startsWith('+')) {
                const addSeconds = GiveawayHelper.parseDuration(editVal.slice(1));
                if (!addSeconds) {
                    return message.reply(build.warnBox('invalid format', 'invalid duration format. use e.g. `+10m`, `+1h`, `+1d`.'));
                }
                const newEndsAt = gw.ends_at + (addSeconds * 1000);
                await db.updateGiveawayEndsAt(gw.id, newEndsAt);
                gw.ends_at = newEndsAt;

                const entriesCount = await db.getGiveawayEntriesCount(gw.id);
                const payload = GiveawayHelper.buildPayload(gw, entriesCount, false);
                try {
                    const channel = await message.client.channels.fetch(gw.channel_id).catch(() => null);
                    const gwMsg = await channel?.messages.fetch(gw.message_id).catch(() => null);
                    if (gwMsg) await gwMsg.edit(payload.componentsV2);
                } catch (_) {}

                return message.reply(build.approvedBox('duration extended', `added \`${editVal.slice(1)}\` to giveaway for **${gw.prize}**.`));
            }

            // Otherwise update prize text
            await db.updateGiveawayPrize(gw.id, editVal);
            gw.prize = editVal;

            const entriesCount = await db.getGiveawayEntriesCount(gw.id);
            const payload = GiveawayHelper.buildPayload(gw, entriesCount, false);
            try {
                const channel = await message.client.channels.fetch(gw.channel_id).catch(() => null);
                const gwMsg = await channel?.messages.fetch(gw.message_id).catch(() => null);
                if (gwMsg) await gwMsg.edit(payload.componentsV2);
            } catch (_) {}

            return message.reply(build.approvedBox('prize updated', `prize updated to **${editVal}**.`));
        }

        // ──────────────────────── IMAGE ────────────────────────
        if (sub === 'image') {
            let imgUrl = message.attachments.first()?.url || null;
            const { gw, remainingArgs: finalArgs } = await this.resolveGiveawayTarget(message, remainingArgs, { activeOnly: true });

            if (!imgUrl && finalArgs.length > 0) {
                imgUrl = finalArgs[0];
            }

            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no active giveaway found. provide a valid message id.'));
            }

            if (!imgUrl) {
                return message.reply(build.warnBox('missing image', 'attach an image or provide an image url.'));
            }

            await db.updateGiveawayImage(gw.id, imgUrl);
            gw.image_url = imgUrl;

            const entriesCount = await db.getGiveawayEntriesCount(gw.id);
            const payload = GiveawayHelper.buildPayload(gw, entriesCount, false);
            try {
                const channel = await message.client.channels.fetch(gw.channel_id).catch(() => null);
                const gwMsg = await channel?.messages.fetch(gw.message_id).catch(() => null);
                if (gwMsg) await gwMsg.edit(payload.componentsV2);
            } catch (_) {}

            return message.reply(build.approvedBox('banner updated', `updated banner image for **${gw.prize}**.`));
        }

        // ──────────────────────── REQUIREMENT ────────────────────────
        if (sub === 'requirement') {
            const { gw, remainingArgs: reqArgs } = await this.resolveGiveawayTarget(message, remainingArgs, { activeOnly: true });

            if (!gw) {
                return message.reply(build.warnBox('nothing found', 'no active giveaway found to set requirements for.'));
            }

            const reqType = (reqArgs[0] || '').toLowerCase();
            const reqVal = reqArgs[1] || '';

            if (['none', 'clear', 'remove', 'reset'].includes(reqType)) {
                await db.updateGiveawayRequirement(gw.id, null);
                gw.requirement = null;

                const entriesCount = await db.getGiveawayEntriesCount(gw.id);
                const payload = GiveawayHelper.buildPayload(gw, entriesCount, false);
                try {
                    const channel = await message.client.channels.fetch(gw.channel_id).catch(() => null);
                    const gwMsg = await channel?.messages.fetch(gw.message_id).catch(() => null);
                    if (gwMsg) await gwMsg.edit(payload.componentsV2);
                } catch (_) {}

                return message.reply(build.approvedBox('requirement removed', `removed entry requirement for **${gw.prize}**.`));
            }

            let requirementObj = null;
            if (reqType === 'role') {
                const roleMention = message.mentions.roles.first();
                const roleId = roleMention?.id || reqVal.replace(/[<@&>]/g, '').trim();
                const role = message.guild.roles.cache.get(roleId);
                if (!role) {
                    return message.reply(build.warnBox('invalid role', 'provide a valid role mention or id.'));
                }
                requirementObj = { type: 'role', value: role.id, name: role.name };
            } else if (reqType === 'boost' || reqType === 'booster') {
                requirementObj = { type: 'boost' };
            } else if (reqType === 'age') {
                const days = parseInt(reqVal.replace(/\D/g, ''), 10);
                if (!days || days < 1) {
                    return message.reply(build.warnBox('invalid age', 'specify required account age in days (e.g. `age 7`).'));
                }
                requirementObj = { type: 'age', value: days };
            } else {
                return message.reply(build.warnBox('invalid format', 'use `,giveaway requirement <role|boost|age> [value]` or `,greq none`.'));
            }

            const reqJson = JSON.stringify(requirementObj);
            await db.updateGiveawayRequirement(gw.id, reqJson);
            gw.requirement = reqJson;

            const entriesCount = await db.getGiveawayEntriesCount(gw.id);
            const payload = GiveawayHelper.buildPayload(gw, entriesCount, false);
            try {
                const channel = await message.client.channels.fetch(gw.channel_id).catch(() => null);
                const gwMsg = await channel?.messages.fetch(gw.message_id).catch(() => null);
                if (gwMsg) await gwMsg.edit(payload.componentsV2);
            } catch (_) {}

            return message.reply(build.approvedBox('requirement updated', `set entry requirement for **${gw.prize}**.`));
        }

        // ──────────────────────── START ────────────────────────
        if (sub === 'start') {
            if (!remainingArgs.length) {
                return message.reply(build.warnBox('syntax guide', 'use `,gstart <duration> [winners] <prize>`.'));
            }

            const rawDuration = remainingArgs[0];
            const durationSec = GiveawayHelper.parseDuration(rawDuration);
            if (!durationSec) {
                return message.reply(build.warnBox('invalid duration', 'specify a valid time format like `10m`, `2h`, `1d`.'));
            }

            remainingArgs.shift();

            let winnersCount = 1;
            if (remainingArgs.length > 0 && /^\d+$/.test(remainingArgs[0])) {
                const parsedWinners = parseInt(remainingArgs[0], 10);
                if (parsedWinners > 0 && parsedWinners <= 50) {
                    winnersCount = parsedWinners;
                    remainingArgs.shift();
                }
            }

            const prize = remainingArgs.join(' ').trim();
            if (!prize) {
                return message.reply(build.warnBox('missing prize', 'specify what prize is being given away.'));
            }

            const endsAt = Date.now() + (durationSec * 1000);

            // Construct preview giveaway record
            const dummyGw = {
                id: 0,
                prize,
                host_id: message.author.id,
                winners_count: winnersCount,
                ends_at: endsAt,
                image_url: null,
                requirement: null
            };

            const payload = GiveawayHelper.buildPayload(dummyGw, 0, false);
            let sentMessage;
            try {
                sentMessage = await message.channel.send(payload.componentsV2);
            } catch (_) {
                sentMessage = await message.channel.send(payload.embedFallback);
            }

            // Save to SQLite
            const created = await db.createGiveaway({
                messageId: sentMessage.id,
                channelId: message.channel.id,
                guildId: message.guild.id,
                hostId: message.author.id,
                prize,
                winnersCount,
                endsAt
            });

            // Re-render button customId with actual SQLite giveaway ID
            if (created && created.id) {
                const updatedPayload = GiveawayHelper.buildPayload(created, 0, false);
                try {
                    await sentMessage.edit(updatedPayload.componentsV2);
                } catch (_) {
                    await sentMessage.edit(updatedPayload.embedFallback).catch(() => {});
                }
            }

            // Start global worker if not already running
            GiveawayHelper.startWorker(message.client);

            try {
                if (message.deletable) await message.delete().catch(() => {});
            } catch (_) {}

            return;
        }

        // Fallback: subcommands interactive help
        return await build.help(message, this);
    }
}

module.exports = GiveawayCommand;
