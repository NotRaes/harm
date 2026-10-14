const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class CardCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'card';
        this.aliases = ['open', 'bank', 'cards'];
        this.description = 'manage your virtual debit card and bank account.';
        this.syntax = ',card [lock|unlock|status|details|history|fraud|vanity|reroll|open]';
        this.example = ',card status';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.subcommands = [
            'card open',
            'card lock',
            'card unlock',
            'card status',
            'card details',
            'card history',
            'card fraud',
            'card vanity',
            'card reroll'
        ];
        this.extraArguments = 'subcommands: lock, unlock, status, details, history, fraud, vanity, reroll, open.';
        this.subcommandDetails = {
            open: {
                description: 'open and issue a virtual debit card connected to your balance.',
                syntax: ',card open',
                example: ',card open'
            },
            lock: {
                description: 'freeze and lock your debit card to prevent transfers and betting.',
                syntax: ',card lock',
                example: ',card lock'
            },
            unlock: {
                description: 'unlock and reactivate your debit card to resume transactions.',
                syntax: ',card unlock',
                example: ',card unlock'
            },
            status: {
                description: 'display your current card status and account limits.',
                syntax: ',card status',
                example: ',card status'
            },
            details: {
                description: 'view your debit card tier and account information.',
                syntax: ',card details',
                example: ',card details'
            },
            history: {
                description: 'review your recent debit card transactions and activity log.',
                syntax: ',card history',
                example: ',card history'
            },
            fraud: {
                description: 'report suspicious account activity and freeze unauthorized transactions.',
                syntax: ',card fraud',
                example: ',card fraud'
            },
            vanity: {
                description: 'customize your debit card design and personal tier styling.',
                syntax: ',card vanity [design]',
                example: ',card vanity obsidian'
            },
            reroll: {
                description: 'reissue and generate a new debit card number.',
                syntax: ',card reroll',
                example: ',card reroll'
            }
        };
    }

    async sendCardEmbed(message, description) {
        const color = config.colors.c || '#2b2d31';
        const userAvatar = message.author.displayAvatarURL({ size: 1024, dynamic: true });

        const embed = new EmbedBuilder()
            .setColor(color)
            .setThumbnail(userAvatar)
            .setDescription(description);

        const dismissBtn = new ButtonBuilder()
            .setCustomId('card_del')
            .setStyle(ButtonStyle.Secondary);
        if (config.emojis.cancel || config.emojis.deny) {
            dismissBtn.setEmoji(config.emojis.cancel || config.emojis.deny);
        } else {
            dismissBtn.setLabel('dismiss');
        }

        const row = new ActionRowBuilder().addComponents(dismissBtn);

        const sent = await message.reply({ embeds: [embed], components: [row] });
        const col = sent.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 30000
        });
        col.on('collect', async (i) => {
            if (i.customId === 'card_del') {
                col.stop();
                return sent.delete().catch(() => {});
            }
        });
        return sent;
    }

    getLockStatusText(card) {
        if (card.is_locked) return '`locked`';
        const now = Math.floor(Date.now() / 1000);
        const unlockedAt = card.unlocked_at || card.opened_at || now;
        const elapsed = now - unlockedAt;
        if (elapsed >= 86400) {
            return '`exposed (lock required)`';
        }
        const remaining = 86400 - elapsed;
        const hours = Math.floor(remaining / 3600);
        const mins = Math.floor((remaining % 3600) / 60);
        return `\`active (locks in ${hours}h ${mins}m)\``;
    }

    async execute(message, args) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        const color = config.colors.c || '#2b2d31';
        const e = config.emojis || {};
        const cardIcon = e.card ? `${e.card} ` : '';
        const coin = e.coin ? `${e.coin} ` : '$';
        const sub = (args[0] || '').toLowerCase();
        const sub2 = (args[1] || '').toLowerCase();

        // Handle invocation as ",open" or subcommand "open"
        const isInvokedAsOpen = (message.content || '').trim().toLowerCase().startsWith(config.prefix + 'open');
        if (isInvokedAsOpen) {
            if (!sub) {
                return message.reply({
                    embeds: [build.warn(message.author, `specify what to open. syntax: \`${config.prefix}open card\``)]
                });
            }
            if (sub !== 'card') {
                const isClose = sub.startsWith('ca') || sub.endsWith('ard') || sub === 'cadd';
                const suggestion = isClose ? ` did you mean \`${config.prefix}open card\`?` : '';
                return message.reply({
                    embeds: [build.warn(message.author, `unknown subcommand \`${sub}\`.${suggestion}`)]
                });
            }
            const result = await db.openCard(message.guild.id, message.author.id);
            if (!result.success && result.alreadyOpen) {
                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setDescription('your bank account is already open');
                return message.reply({ embeds: [embed] });
            }

            const userCard = await db.getCard(message.guild.id, message.author.id);
            const description = [
                `${e.leftwing || '✦'} **card** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **card number**`,
                `\`${userCard?.card_number || '4532 9936 1555 2554'}\``,
                '',
                `**security code (cvv)**`,
                `\`${userCard?.cvv || '842'}\``,
                '',
                `**status** ${this.getLockStatusText(userCard)}`,
                `**tier** \`${userCard?.tier || 'standard'}\``
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        if (sub === 'open' || (sub === 'card' && sub2 === 'open')) {
            const result = await db.openCard(message.guild.id, message.author.id);
            if (!result.success && result.alreadyOpen) {
                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setDescription('your bank account is already open');
                return message.reply({ embeds: [embed] });
            }

            const userCard = await db.getCard(message.guild.id, message.author.id);
            const description = [
                `${e.leftwing || '✦'} **card** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **card number**`,
                `\`${userCard?.card_number || '4532 9936 1555 2554'}\``,
                '',
                `**security code (cvv)**`,
                `\`${userCard?.cvv || '842'}\``,
                '',
                `**status** ${this.getLockStatusText(userCard)}`,
                `**tier** \`${userCard?.tier || 'standard'}\``
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        const hasCard = await db.hasCard(message.guild.id, message.author.id);

        const noCardReply = () => {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(`<@${message.author.id}>: you do not have an open bank account use open card first`);
            return message.reply({ embeds: [embed] });
        };

        const validSubcommands = ['lock', 'unlock', 'status', 'details', 'history', 'fraud', 'vanity', 'reroll'];
        if (sub && !validSubcommands.includes(sub)) {
            if (!hasCard) return noCardReply();

            const isCloseToCard = sub === 'cadd' || sub === 'car' || sub === 'crd';
            const suggestion = isCloseToCard ? ` did you mean \`${config.prefix}card open\`?` : '';
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(`<@${message.author.id}>: use card lock, card unlock, card status, card details, card history, card fraud, card vanity, or card reroll.${suggestion}`);
            return message.reply({ embeds: [embed] });
        }

        if (!hasCard) return noCardReply();

        const card = await db.getCard(message.guild.id, message.author.id);

        // Support member check
        const supportGuildId = config.supportGuildId || '1555845452790767677';
        let isSupportMember = false;
        const supportGuild = message.client.guilds.cache.get(supportGuildId) || await message.client.guilds.fetch(supportGuildId).catch(() => null);
        if (supportGuild) {
            const sMember = supportGuild.members.cache.get(message.author.id) || await supportGuild.members.fetch(message.author.id).catch(() => null);
            if (sMember) isSupportMember = true;
        }

        // Subcommands
        if (sub === 'lock') {
            if (card.is_locked) {
                return message.reply({ embeds: [build.warn(message.author, 'your card is already locked.')] });
            }
            await db.setCardLock(message.guild.id, message.author.id, true);
            return message.reply({ embeds: [build.approved(message.author, 'your card is now locked.')] });
        }

        if (sub === 'unlock') {
            if (!card.is_locked) {
                return message.reply({ embeds: [build.warn(message.author, 'your card is already unlocked.')] });
            }
            await db.setCardLock(message.guild.id, message.author.id, false);
            return message.reply({ embeds: [build.approved(message.author, 'your card is now unlocked.')] });
        }

        if (sub === 'status') {
            const description = [
                `${e.leftwing || '✦'} **card status** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **status** ${this.getLockStatusText(card)}`,
                `**tier** \`${card.tier || 'standard'}\``,
                '',
                `${coin} **bank capacity**`,
                `${coin} ${(card.bank_capacity || 25000).toLocaleString()}`,
                ...(isSupportMember ? ['', `**member badge** \`active (harm support)\``] : [])
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        if (sub === 'fraud') {
            const action = (args[1] || '').toLowerCase();

            // 1. Fraud Dispute Subcommand
            if (action === 'dispute') {
                const txIdStr = args[2];
                if (!txIdStr) {
                    const embed = new EmbedBuilder()
                        .setColor(color)
                        .setDescription(`specify the transaction id to dispute. syntax: \`${config.prefix}card fraud dispute <tx_id>\``);
                    return message.reply({ embeds: [embed] });
                }

                const txId = parseInt(txIdStr.replace('#', ''), 10);
                if (isNaN(txId)) {
                    return message.reply({ embeds: [build.warn(message.author, 'invalid transaction id.')] });
                }

                const tx = await db.getTransactionById(message.guild.id, message.author.id, txId);
                if (!tx) {
                    return message.reply({ embeds: [build.deny(message.author, `transaction \`#${txId}\` not found in your account history.`)] });
                }

                if (tx.type !== 'transfer_out') {
                    return message.reply({ embeds: [build.deny(message.author, 'only outgoing transfer transactions can be disputed.')] });
                }

                const now = Math.floor(Date.now() / 1000);
                const ageHours = (now - tx.timestamp) / 3600;
                if (ageHours > 48) {
                    return message.reply({ embeds: [build.deny(message.author, `transaction \`#${txId}\` exceeds the 48-hour dispute window.`)] });
                }

                const description = [
                    `${e.leftwing || '✦'} **fraud dispute registered** ${e.rightwing || '✦'}`,
                    '',
                    `${cardIcon} **dispute record** \`#${tx.id}\``,
                    `• **amount:** \`$${tx.amount.toLocaleString()}\``,
                    `• **details:** \`${tx.description || 'outgoing transfer'}\``,
                    `• **timestamp:** <t:${tx.timestamp}:R>`,
                    '',
                    `*audit record logged with harm bank. recommended: \`${config.prefix}card lock\` if compromised.*`
                ].join('\n');

                return this.sendCardEmbed(message, description);
            }

            // 2. Fraud Reissue Subcommand
            if (action === 'reissue') {
                const eco = await db.getEconomy(message.guild.id, message.author.id);
                const reissueFee = 1000;
                if (eco.wallet < reissueFee) {
                    return message.reply({
                        embeds: [build.deny(message.author, `emergency reissue requires a \`$${reissueFee.toLocaleString()}\` administrative fee.`)]
                    });
                }

                await db.addWallet(message.guild.id, message.author.id, -reissueFee);
                const reissued = await db.reissueCard(message.guild.id, message.author.id);
                await db.recordTransaction(message.guild.id, message.author.id, 'card_reissue', reissueFee, 'Emergency card reissue fee');

                const description = [
                    `${e.leftwing || '✦'} **card credentials reissued** ${e.rightwing || '✦'}`,
                    '',
                    `*previous card credentials have been permanently voided.*`,
                    '',
                    `${cardIcon} **new card number**`,
                    `\`${reissued.cardNumber}\``,
                    '',
                    `**new security code (cvv)**`,
                    `\`${reissued.cvv}\``,
                    '',
                    `**status** \`active (lock expires in 24h)\``,
                    `**tier** \`${card.tier || 'standard'}\``
                ].join('\n');

                return this.sendCardEmbed(message, description);
            }

            // 3. Default Fraud Security Diagnostic Scan
            await db.recordFraudCheck(message.guild.id, message.author.id);
            const now = Math.floor(Date.now() / 1000);
            const past24h = now - 86400;
            const recentTxs = await db.getRecentTransactions(message.guild.id, message.author.id, past24h);
            const outgoingTransfers = recentTxs.filter(t => t.type === 'transfer_out');

            const past15m = now - 900;
            const rapidTransfers = outgoingTransfers.filter(t => t.timestamp >= past15m);

            const isExposed = !card.is_locked && (now - (card.unlocked_at || card.opened_at || now)) >= 86400;
            const isRapidActivity = rapidTransfers.length >= 3;

            let fraudStatus = '`passed`';
            let statusNote = '*no suspicious activity or velocity anomalies detected.*';

            if (isExposed || isRapidActivity) {
                fraudStatus = '`alert`';
                if (isExposed && isRapidActivity) {
                    statusNote = '*alert: card unlocked > 24h and high outgoing velocity detected.*';
                } else if (isExposed) {
                    statusNote = '*warning: card unlocked > 24h without security cycle. lock required.*';
                } else {
                    statusNote = '*warning: rapid outgoing transfers detected in the last 15 minutes.*';
                }
            }

            const totalSent = outgoingTransfers.reduce((sum, t) => sum + (t.amount || 0), 0);

            const description = [
                `${e.leftwing || '✦'} **card fraud security audit** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **fraud detection**`,
                `status ${fraudStatus}`,
                '',
                `• **outgoing transfers (24h):** \`${outgoingTransfers.length}\` (\`$${totalSent.toLocaleString()}\`)`,
                `• **transfer velocity:** \`${rapidTransfers.length >= 3 ? 'high (flagged)' : 'normal'}\``,
                `• **security exposure:** \`${isExposed ? 'exposed (lock required)' : 'secure'}\``,
                '',
                statusNote,
                '',
                `*commands: \`${config.prefix}card fraud dispute <tx_id>\` • \`${config.prefix}card fraud reissue\`*`
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        if (sub === 'vanity') {
            const rawDigits = args.slice(1).join('').replace(/[\s-]/g, '');
            if (!rawDigits) {
                const embed = new EmbedBuilder()
                    .setColor(color)
                    .setDescription(`specify a 16-digit card number. syntax: \`${config.prefix}card vanity <16 digits>\` (cost: $5,000)`);
                return message.reply({ embeds: [embed] });
            }

            if (!/^\d{16}$/.test(rawDigits)) {
                return message.reply({ embeds: [build.warn(message.author, 'vanity card number must contain exactly 16 numeric digits.')] });
            }

            const vanityFormatted = `${rawDigits.slice(0, 4)} ${rawDigits.slice(4, 8)} ${rawDigits.slice(8, 12)} ${rawDigits.slice(12, 16)}`;

            const existingOwner = await db.getCardByNumber(message.guild.id, rawDigits);
            if (existingOwner && existingOwner.user_id !== message.author.id) {
                return message.reply({ embeds: [build.deny(message.author, 'that card number is already registered by another account.')] });
            }

            const eco = await db.getEconomy(message.guild.id, message.author.id);
            const vanityCost = 5000;
            if (eco.wallet < vanityCost) {
                return message.reply({ embeds: [build.deny(message.author, `vanity card customization requires **$${vanityCost.toLocaleString()}** in your wallet.`)] });
            }

            await db.addWallet(message.guild.id, message.author.id, -vanityCost);
            await db.updateCardNumber(message.guild.id, message.author.id, vanityFormatted);
            await db.recordTransaction(message.guild.id, message.author.id, 'card_vanity', vanityCost, 'vanity card customization');

            const description = [
                `${e.leftwing || '✦'} **vanity card bound** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **new card number**`,
                `\`${vanityFormatted}\``,
                '',
                `**security code (cvv)**`,
                `\`${card.cvv || '842'}\``,
                '',
                `**status** ${this.getLockStatusText(card)}`,
                `**tier** \`${card.tier || 'standard'}\``
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        if (sub === 'reroll') {
            const eco = await db.getEconomy(message.guild.id, message.author.id);
            const rerollCost = 2500;
            if (eco.wallet < rerollCost) {
                return message.reply({ embeds: [build.deny(message.author, `card reroll requires **$${rerollCost.toLocaleString()}** in your wallet.`)] });
            }

            await db.addWallet(message.guild.id, message.author.id, -rerollCost);
            const reissued = await db.reissueCard(message.guild.id, message.author.id);
            await db.recordTransaction(message.guild.id, message.author.id, 'card_reroll', rerollCost, 'card credential reroll');

            const freshCard = await db.getCard(message.guild.id, message.author.id);
            const description = [
                `${e.leftwing || '✦'} **card credentials rerolled** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **card number**`,
                `\`${reissued.cardNumber}\``,
                '',
                `**security code (cvv)**`,
                `\`${reissued.cvv}\``,
                '',
                `**status** ${this.getLockStatusText(freshCard)}`,
                `**tier** \`${freshCard?.tier || 'standard'}\``
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        if (sub === 'history') {
            const txs = await db.getTransactions(message.guild.id, message.author.id, 5);

            let txLines = [];
            if (!txs || txs.length === 0) {
                txLines = ['*no recent transactions recorded.*'];
            } else {
                for (const t of txs) {
                    txLines.push(`${coin} **${t.type}** (\`#${t.id}\`) ${coin} ${t.amount.toLocaleString()}`);
                    txLines.push(`<t:${t.timestamp}:R> • \`${t.description || 'n/a'}\``);
                    txLines.push('');
                }
                if (txLines.length > 0 && txLines[txLines.length - 1] === '') txLines.pop();
            }

            const description = [
                `${e.leftwing || '✦'} **card history** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **recent transactions**`,
                '',
                ...txLines
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }

        // Default: ",card" or ",card details"
        if (!sub || sub === 'details') {
            const description = [
                `${e.leftwing || '✦'} **card** ${e.rightwing || '✦'}`,
                '',
                `${cardIcon} **card number**`,
                `\`${card.card_number || '4532 9936 1555 2554'}\``,
                '',
                `**security code (cvv)**`,
                `\`${card.cvv || '842'}\``,
                '',
                `**status** ${this.getLockStatusText(card)}`,
                `**tier** \`${card.tier || 'standard'}\``
            ].join('\n');

            return this.sendCardEmbed(message, description);
        }
    }
}

module.exports = CardCommand;
