const {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    EmbedBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder
} = require('discord.js');
const config = require('../../../config.js');

function parseDuration(input) {
    if (!input) return null;
    let totalSeconds = 0;
    const regex = /(\d+)\s*(mo|months?|w|weeks?|d|days?|h|hrs?|hours?|m|mins?|minutes?|s|secs?|seconds?)/gi;
    let match;
    let found = false;
    while ((match = regex.exec(input)) !== null) {
        found = true;
        const val = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        if (unit.startsWith('mo')) totalSeconds += val * 2592000;
        else if (unit.startsWith('w')) totalSeconds += val * 604800;
        else if (unit.startsWith('d')) totalSeconds += val * 86400;
        else if (unit.startsWith('h')) totalSeconds += val * 3600;
        else if (unit.startsWith('m')) totalSeconds += val * 60;
        else if (unit.startsWith('s')) totalSeconds += val;
    }
    if (!found) {
        const num = parseInt(input, 10);
        if (!isNaN(num) && num > 0) totalSeconds = num * 60;
    }
    return totalSeconds > 0 ? totalSeconds : null;
}

class GiveawayHelper {
    static getEmojis() {
        return {
            gift: config.emojis?.gw_gift || config.emojis?.gift || '<:gift:1558198880296898630>',
            crown: config.emojis?.gw_crown || config.emojis?.crown || '<:gw_crown:1558198883883028621>',
            entries: config.emojis?.gw_entries || config.emojis?.entries || '<:entries:1558198887599050882>',
            trophy: config.emojis?.gw_trophy || config.emojis?.trophy || '<:trophy:1558198891248095366>',
            cheers: config.emojis?.gw_cheers || config.emojis?.cheers || '<:cheers:1558198895190741013>'
        };
    }

    static buildPayload(gw, entriesCount = 0, ended = false) {
        const emojis = GiveawayHelper.getEmojis();
        const endTimestamp = Math.floor(gw.ends_at / 1000);

        let timeLine;
        if (gw.cancelled) {
            timeLine = 'Cancelled by host · no winners drawn';
        } else if (ended || gw.ended) {
            timeLine = `Ended <t:${endTimestamp}:R> · <t:${endTimestamp}:f>`;
        } else {
            timeLine = `Ends <t:${endTimestamp}:R> · <t:${endTimestamp}:f>`;
        }

        let reqText = '';
        if (gw.requirement) {
            try {
                const reqObj = typeof gw.requirement === 'string' ? JSON.parse(gw.requirement) : gw.requirement;
                if (reqObj.type === 'role') {
                    reqText = `\n🔒 **Requirement:** <@&${reqObj.value}>`;
                } else if (reqObj.type === 'boost') {
                    reqText = '\n🔒 **Requirement:** Server Booster';
                } else if (reqObj.type === 'age') {
                    reqText = `\n🔒 **Requirement:** Account age ${reqObj.value}d+`;
                }
            } catch (_) {}
        }

        const bodyContent = `${timeLine}\n\n` +
            `${emojis.crown} **Hosted by:** <@${gw.host_id}>\n` +
            `${emojis.entries} **Entries:** ${entriesCount}\n` +
            `${emojis.trophy} **Winners:** ${gw.winners_count || 1}${reqText}`;

        const enterButton = new ButtonBuilder()
            .setCustomId(`gw_enter_${gw.id}`)
            .setLabel(`Enter (${entriesCount})`)
            .setEmoji('1558198880296898630')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(Boolean(ended || gw.ended || gw.cancelled));

        const viewButton = new ButtonBuilder()
            .setCustomId(`gw_view_${gw.id}`)
            .setLabel('View entries')
            .setStyle(ButtonStyle.Secondary);

        const row = new ActionRowBuilder().addComponents(enterButton, viewButton);

        const container = new ContainerBuilder()
            .setAccentColor(typeof config.colors?.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors?.c || 0x2b2d31))
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`### ${emojis.gift} ${gw.prize}`)
            )
            .addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(bodyContent)
            );

        if (gw.image_url) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(gw.image_url)
                )
            );
        }

        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );
        container.addActionRowComponents(row);

        const fallbackEmbed = new EmbedBuilder()
            .setColor(config.colors?.c || 0x2b2d31)
            .setTitle(`${gw.prize}`)
            .setDescription(bodyContent);

        if (gw.image_url) {
            fallbackEmbed.setImage(gw.image_url);
        }

        return {
            componentsV2: {
                components: [container],
                flags: MessageFlags.IsComponentsV2
            },
            embedFallback: {
                embeds: [fallbackEmbed],
                components: [row]
            }
        };
    }

    static async endGiveaway(client, gw) {
        if (!client.db || !gw || gw.ended) return null;

        const entries = await client.db.getGiveawayEntries(gw.id);
        const winnersCount = Math.max(1, gw.winners_count || 1);
        const winners = [];

        if (entries.length > 0) {
            const shuffled = [...entries].sort(() => 0.5 - Math.random());
            for (let i = 0; i < Math.min(winnersCount, shuffled.length); i++) {
                winners.push(shuffled[i]);
            }
        }

        await client.db.endGiveaway(gw.id, winners);
        gw.ended = 1;

        // Fetch channel and message to edit and announce
        try {
            const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
            if (!channel) return winners;

            const message = await channel.messages.fetch(gw.message_id).catch(() => null);
            const emojis = GiveawayHelper.getEmojis();

            if (message) {
                const payload = GiveawayHelper.buildPayload(gw, entries.length, true);
                try {
                    await message.edit(payload.componentsV2);
                } catch (_) {
                    await message.edit(payload.embedFallback).catch(() => null);
                }

                // Announce winner
                let winText;
                if (winners.length === 1) {
                    winText = `${emojis.cheers} <@${winners[0]}> won **${gw.prize}**!`;
                } else if (winners.length > 1) {
                    const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
                    winText = `${emojis.cheers} ${winnerMentions} won **${gw.prize}**!`;
                } else {
                    winText = `${emojis.cheers} no entries were submitted for **${gw.prize}**!`;
                }

                const winContainer = new ContainerBuilder()
                    .setAccentColor(typeof config.colors?.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors?.c || 0x2b2d31))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(winText)
                    );

                try {
                    await message.reply({
                        components: [winContainer],
                        flags: MessageFlags.IsComponentsV2
                    });
                } catch (_) {
                    const winEmbed = new EmbedBuilder()
                        .setColor(config.colors?.c || 0x2b2d31)
                        .setDescription(winText);
                    await message.reply({ embeds: [winEmbed] }).catch(() => null);
                }
            }
        } catch (err) {
            console.error('[GiveawayHelper.endGiveaway]', err);
        }

        return winners;
    }

    static async cancelGiveaway(client, gw) {
        if (!client.db || !gw) return false;
        await client.db.cancelGiveaway(gw.id);
        gw.ended = 1;
        gw.cancelled = 1;

        try {
            const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(gw.message_id).catch(() => null);
                if (message) {
                    const entriesCount = await client.db.getGiveawayEntriesCount(gw.id);
                    const payload = GiveawayHelper.buildPayload(gw, entriesCount, true);
                    try {
                        await message.edit(payload.componentsV2);
                    } catch (_) {
                        await message.edit(payload.embedFallback).catch(() => null);
                    }
                }
            }
        } catch (err) {
            console.error('[GiveawayHelper.cancelGiveaway]', err);
        }
        return true;
    }

    static async rerollGiveaway(client, gw) {
        if (!client.db || !gw) return null;
        const entries = await client.db.getGiveawayEntries(gw.id);
        if (!entries.length) return [];

        const winnersCount = Math.max(1, gw.winners_count || 1);
        const shuffled = [...entries].sort(() => 0.5 - Math.random());
        const newWinners = shuffled.slice(0, Math.min(winnersCount, shuffled.length));

        await client.db.endGiveaway(gw.id, newWinners);

        try {
            const channel = await client.channels.fetch(gw.channel_id).catch(() => null);
            if (channel) {
                const message = await channel.messages.fetch(gw.message_id).catch(() => null);
                const emojis = GiveawayHelper.getEmojis();
                const winnerMentions = newWinners.map(w => `<@${w}>`).join(', ');
                const winText = `${emojis.cheers} rerolled: ${winnerMentions} won **${gw.prize}**!`;

                const winContainer = new ContainerBuilder()
                    .setAccentColor(typeof config.colors?.c === 'string' ? parseInt(config.colors.c.replace('#', ''), 16) : (config.colors?.c || 0x2b2d31))
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(winText)
                    );

                if (message) {
                    try {
                        await message.reply({ components: [winContainer], flags: MessageFlags.IsComponentsV2 });
                    } catch (_) {
                        await message.reply({ embeds: [new EmbedBuilder().setColor(config.colors?.c || 0x2b2d31).setDescription(winText)] });
                    }
                } else {
                    await channel.send({ components: [winContainer], flags: MessageFlags.IsComponentsV2 });
                }
            }
        } catch (err) {
            console.error('[GiveawayHelper.rerollGiveaway]', err);
        }

        return newWinners;
    }

    static startWorker(client) {
        if (client._giveawayWorkerInterval) return;

        client._giveawayWorkerInterval = setInterval(async () => {
            if (!client.db) return;
            try {
                const active = await client.db.getActiveGiveaways();
                const now = Date.now();
                for (const gw of active) {
                    if (gw.ends_at <= now) {
                        await GiveawayHelper.endGiveaway(client, gw);
                    }
                }
            } catch (err) {
                console.error('[giveawayWorker]', err.message);
            }
        }, 5000);
    }

    static async handleInteraction(interaction) {
        if (!interaction.isButton()) return;
        const customId = interaction.customId;
        if (!customId.startsWith('gw_enter_') && !customId.startsWith('gw_view_')) return;

        const db = interaction.client.db;
        if (!db) {
            return interaction.reply({ content: 'database subsystem offline.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        let gw = null;
        if (interaction.message?.id) {
            gw = await db.getGiveawayByMessageId(interaction.message.id);
        }

        if (!gw) {
            const rawId = customId.replace(/^(gw_enter_|gw_view_)/, '').split('_')[0];
            const giveawayId = parseInt(rawId, 10);
            if (giveawayId && giveawayId > 0) {
                gw = await db.getGiveawayById(giveawayId);
            }
        }

        if (!gw) {
            return interaction.reply({ content: 'this giveaway no longer exists.', flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        if (customId.startsWith('gw_enter_')) {
            if (gw.ended || gw.cancelled) {
                return interaction.reply({ content: 'this giveaway has concluded.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }

            // Check requirement if set
            if (gw.requirement) {
                try {
                    const reqObj = typeof gw.requirement === 'string' ? JSON.parse(gw.requirement) : gw.requirement;
                    if (reqObj.type === 'role') {
                        const member = interaction.member || await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                        if (!member || !member.roles.cache.has(reqObj.value)) {
                            return interaction.reply({
                                content: `you need the <@&${reqObj.value}> role to enter this giveaway.`,
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    } else if (reqObj.type === 'boost') {
                        const member = interaction.member || await interaction.guild?.members.fetch(interaction.user.id).catch(() => null);
                        if (!member || !member.premiumSince) {
                            return interaction.reply({
                                content: 'you must be a server booster to enter this giveaway.',
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    } else if (reqObj.type === 'age') {
                        const minDays = parseInt(reqObj.value, 10) || 1;
                        const ageMs = Date.now() - interaction.user.createdTimestamp;
                        const ageDays = ageMs / (1000 * 60 * 60 * 24);
                        if (ageDays < minDays) {
                            return interaction.reply({
                                content: `your account must be at least ${minDays} days old to enter this giveaway.`,
                                flags: MessageFlags.Ephemeral
                            }).catch(() => {});
                        }
                    }
                } catch (_) {}
            }

            const hasEntered = await db.hasUserEnteredGiveaway(gw.id, interaction.user.id);
            let responseText = '';

            if (hasEntered) {
                await db.removeGiveawayEntry(gw.id, interaction.user.id);
                responseText = `you left the giveaway for **${gw.prize}**.`;
            } else {
                await db.addGiveawayEntry(gw.id, interaction.user.id);
                responseText = `you entered the giveaway for **${gw.prize}**!`;
            }

            const newCount = await db.getGiveawayEntriesCount(gw.id);
            const payload = GiveawayHelper.buildPayload(gw, newCount, false);

            try {
                await interaction.update(payload.componentsV2);
            } catch (_) {
                await interaction.update(payload.embedFallback).catch(() => {});
            }

            return interaction.followUp({ content: responseText, flags: MessageFlags.Ephemeral }).catch(() => {});
        }

        if (customId.startsWith('gw_view_')) {
            const entries = await db.getGiveawayEntries(gw.id);
            if (!entries.length) {
                return interaction.reply({ content: 'no entries submitted yet.', flags: MessageFlags.Ephemeral }).catch(() => {});
            }
            const sample = entries.slice(0, 40).map(u => `<@${u}>`).join(', ');
            const remaining = entries.length - 40;
            const extra = remaining > 0 ? ` *+${remaining} more*` : '';
            return interaction.reply({
                content: `### entries (${entries.length})\n${sample}${extra}`,
                flags: MessageFlags.Ephemeral
            }).catch(() => {});
        }
    }
}

GiveawayHelper.parseDuration = parseDuration;

module.exports = GiveawayHelper;
