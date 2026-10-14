const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class PayCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'pay';
        this.aliases = ['transfer', 'give'];
        this.description = 'transfer coins to another user or directly to a 16-digit card number.';
        this.syntax = ',pay <@user|card number> <amount> [cvv]';
        this.example = ',pay @user 250 | ,pay card 4532 9936 1555 2554 500';
        this.category = 'economy';
        this.cooldown = 3;
        this.permissions = [];
        this.extraArguments = 'high-value transfers ($5,000+) require your 3-digit cvv authorization code.';
    }

    async execute(message, args) {
        if (!args || args.length < 2) {
            return build.help(message, this);
        }

        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        const e = config.emojis || {};
        const color = config.colors.c || '#2b2d31';
        const cardIcon = e.card ? `${e.card} ` : '';
        const coin = e.coin ? `${e.coin} ` : '';
        const isInvulnerable = message.client.invulnerableUsers?.has(message.author.id);

        // Sender card verification & lock checks
        const senderCard = await db.getCard(message.guild.id, message.author.id);
        if (!senderCard || !senderCard.is_open) {
            return message.reply({
                embeds: [build.deny(message.author, `you do not have an open bank account. use \`${config.prefix}open card\` first.`)]
            });
        }

        if (senderCard.is_locked && !isInvulnerable) {
            return message.reply({
                embeds: [build.deny(message.author, `your card is locked. use \`${config.prefix}card unlock\` to resume transactions.`)]
            });
        }

        // B2 24-Hour Card Lock Cycle Check
        const now = Math.floor(Date.now() / 1000);
        const unlockedDuration = now - (senderCard.unlocked_at || senderCard.opened_at || now);
        if (!isInvulnerable && unlockedDuration >= 86400) {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(
                    `${e.leftwing || '✦'} **card security expired** ${e.rightwing || '✦'}\n\n` +
                    `*your card security session has expired.*\n\n` +
                    `your card must be locked every 24 hours to secure your balance.\n` +
                    `use \`${config.prefix}card lock\` to secure your card before initiating transactions.`
                );
            return message.reply({ embeds: [embed] });
        }

        // Parse target & amount
        let target = null;
        let isCardTransfer = false;
        let targetCardNumber = null;
        let rawAmount = null;
        let providedCvv = null;

        const firstArg = args[0].toLowerCase();
        if (firstArg === 'card') {
            // e.g. ,pay card 4532 9936 1555 2554 500 [cvv] OR ,pay card 4532993615552554 500 [cvv]
            if (args[1] && /^\d{16}$/.test(args[1].replace(/[\s-]/g, ''))) {
                const cardNum = args[1].replace(/[\s-]/g, '');
                rawAmount = args[2];
                providedCvv = args[3];
                const cardRow = await db.getCardByNumber(message.guild.id, cardNum);
                if (!cardRow) {
                    return message.reply({ embeds: [build.deny(message.author, 'no registered bank card found with those digits.')] });
                }
                target = await message.client.users.fetch(cardRow.user_id).catch(() => null);
                isCardTransfer = true;
                targetCardNumber = cardRow.card_number;
            } else if (args.length >= 6 && /^\d{16}$/.test(args.slice(1, 5).join(''))) {
                const cardNum = args.slice(1, 5).join('');
                rawAmount = args[5];
                providedCvv = args[6];
                const cardRow = await db.getCardByNumber(message.guild.id, cardNum);
                if (!cardRow) {
                    return message.reply({ embeds: [build.deny(message.author, 'no registered bank card found with those digits.')] });
                }
                target = await message.client.users.fetch(cardRow.user_id).catch(() => null);
                isCardTransfer = true;
                targetCardNumber = cardRow.card_number;
            } else {
                return build.help(message, this);
            }
        } else if (/^\d{16}$/.test(args[0].replace(/[\s-]/g, ''))) {
            // e.g. ,pay 4532993615552554 500 [cvv]
            const cardNum = args[0].replace(/[\s-]/g, '');
            rawAmount = args[1];
            providedCvv = args[2];
            const cardRow = await db.getCardByNumber(message.guild.id, cardNum);
            if (!cardRow) {
                return message.reply({ embeds: [build.deny(message.author, 'no registered bank card found with those digits.')] });
            }
            target = await message.client.users.fetch(cardRow.user_id).catch(() => null);
            isCardTransfer = true;
            targetCardNumber = cardRow.card_number;
        } else if (args.length >= 5 && /^\d{16}$/.test(args.slice(0, 4).join(''))) {
            // e.g. ,pay 4532 9936 1555 2554 500 [cvv]
            const cardNum = args.slice(0, 4).join('');
            rawAmount = args[4];
            providedCvv = args[5];
            const cardRow = await db.getCardByNumber(message.guild.id, cardNum);
            if (!cardRow) {
                return message.reply({ embeds: [build.deny(message.author, 'no registered bank card found with those digits.')] });
            }
            target = await message.client.users.fetch(cardRow.user_id).catch(() => null);
            isCardTransfer = true;
            targetCardNumber = cardRow.card_number;
        } else {
            // Standard mention or user ID
            target = message.mentions.users.first() || await message.client.users.fetch(args[0]).catch(() => null);
            rawAmount = args[1];
            providedCvv = args[2];
        }

        if (!target) {
            return build.help(message, this);
        }

        if (target.id === message.author.id) {
            return message.reply({ embeds: [build.warn(message.author, 'you cannot pay yourself.')] });
        }

        if (target.bot) {
            return message.reply({ embeds: [build.warn(message.author, 'you cannot pay a bot.')] });
        }

        // Target card verification
        const targetCard = await db.getCard(message.guild.id, target.id);
        if (!targetCard || !targetCard.is_open) {
            return message.reply({
                embeds: [build.deny(message.author, `<@${target.id}> does not have an open bank account.`)]
            });
        }

        const eco = await db.getEconomy(message.guild.id, message.author.id);
        let amount = 0;
        const normalizedRawAmount = (rawAmount || '').toLowerCase();

        if (normalizedRawAmount === 'all' || normalizedRawAmount === 'max') {
            amount = eco.wallet;
        } else {
            amount = parseInt(normalizedRawAmount, 10);
        }

        if (isNaN(amount) || amount <= 0) {
            return build.help(message, this);
        }

        if (eco.wallet < amount) {
            return message.reply({
                embeds: [build.deny(message.author, `insufficient funds. you have **$${eco.wallet.toLocaleString()}**.`)]
            });
        }

        // B1: High-Value CVV Confirmation ($5,000+)
        const requiresCvv = amount >= 5000 && !isInvulnerable;

        const executeTransfer = async (replyMsg = null, interaction = null) => {
            const currentEco = await db.getEconomy(message.guild.id, message.author.id);
            if (currentEco.wallet < amount) {
                const err = build.deny(message.author, `insufficient funds. you have **$${currentEco.wallet.toLocaleString()}**.`);
                if (interaction) return interaction.reply({ embeds: [err], ephemeral: true });
                return message.reply({ embeds: [err] });
            }

            const res = await db.transferWallet(message.guild.id, message.author.id, target.id, amount);
            if (!res.success) {
                const err = build.deny(message.author, 'transfer failed.');
                if (interaction) return interaction.reply({ embeds: [err], ephemeral: true });
                return message.reply({ embeds: [err] });
            }

            const senderDesc = isCardTransfer
                ? `card payment to **** ${targetCardNumber.slice(-4)}`
                : `sent to ${target.username.toLowerCase()}`;
            const targetDesc = isCardTransfer
                ? `anonymous card deposit from **** ${senderCard.card_number.slice(-4)}`
                : `received from ${message.author.username.toLowerCase()}`;

            await db.recordTransaction(message.guild.id, message.author.id, 'transfer_out', amount, senderDesc);
            await db.recordTransaction(message.guild.id, target.id, 'transfer_in', amount, targetDesc);

            const destinationLine = isCardTransfer
                ? `${cardIcon}**destination:** \`**** **** **** ${targetCardNumber.slice(-4)}\``
                : `**recipient:** <@${target.id}>`;

            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(
                    `${e.leftwing || '✦'} **transfer complete** ${e.rightwing || '✦'}\n` +
                    `*${isCardTransfer ? 'anonymous card transfer processed.' : 'funds successfully transferred.'}*\n\n` +
                    `${coin}**amount:** \`$${amount.toLocaleString()}\`\n` +
                    `${destinationLine}`
                );

            const dismissBtn = new ButtonBuilder()
                .setCustomId(`pay_del_${Date.now()}`)
                .setStyle(ButtonStyle.Secondary);
            if (e.cancel || e.deny) {
                dismissBtn.setEmoji(e.cancel || e.deny);
            } else {
                dismissBtn.setLabel('dismiss');
            }

            const row = new ActionRowBuilder().addComponents(dismissBtn);

            let sent;
            if (interaction) {
                await interaction.update({ embeds: [embed], components: [row] });
                sent = await interaction.fetchReply();
            } else if (replyMsg) {
                await replyMsg.edit({ embeds: [embed], components: [row] });
                sent = replyMsg;
            } else {
                sent = await message.reply({ embeds: [embed], components: [row] });
            }

            const col = sent.createMessageComponentCollector({
                filter: i => i.customId.startsWith('pay_del_') && i.user.id === message.author.id,
                time: 30000,
                max: 1
            });
            col.on('collect', async () => sent.delete().catch(() => {}));
            return sent;
        };

        if (requiresCvv) {
            // Check if CVV was provided in arguments
            if (providedCvv && String(providedCvv).trim() === String(senderCard.cvv).trim()) {
                return executeTransfer();
            }

            if (providedCvv && String(providedCvv).trim() !== String(senderCard.cvv).trim()) {
                return message.reply({
                    embeds: [build.deny(message.author, 'authorization failed. invalid cvv security code.')]
                });
            }

            // Prompt interactive modal authorization
            const authEmbed = new EmbedBuilder()
                .setColor(color)
                .setDescription(
                    `${e.leftwing || '✦'} **security authorization required** ${e.rightwing || '✦'}\n` +
                    `*high-value transfer of **$${amount.toLocaleString()}** requires authorization.*\n\n` +
                    `${cardIcon}click below to enter your 3-digit CVV security code.`
                );

            const ts = Date.now();
            const authBtn = new ButtonBuilder()
                .setCustomId(`pay_auth_${ts}`)
                .setLabel('authorize with cvv')
                .setStyle(ButtonStyle.Secondary);
            if (e.card) authBtn.setEmoji(e.card);

            const cancelBtn = new ButtonBuilder()
                .setCustomId(`pay_cancel_${ts}`)
                .setStyle(ButtonStyle.Secondary);
            if (e.cancel || e.deny) {
                cancelBtn.setEmoji(e.cancel || e.deny);
            } else {
                cancelBtn.setLabel('cancel');
            }

            const authRow = new ActionRowBuilder().addComponents(authBtn, cancelBtn);

            const promptMsg = await message.reply({ embeds: [authEmbed], components: [authRow] });

            const btnCollector = promptMsg.createMessageComponentCollector({
                filter: i => (i.customId === `pay_auth_${ts}` || i.customId === `pay_cancel_${ts}`) && i.user.id === message.author.id,
                time: 60000,
                max: 1
            });

            btnCollector.on('collect', async (btnInt) => {
                if (btnInt.customId === `pay_cancel_${ts}`) {
                    return promptMsg.delete().catch(() => {});
                }

                // Show CVV input modal
                const modal = new ModalBuilder()
                    .setCustomId(`modal_cvv_${ts}`)
                    .setTitle('cvv authorization');

                const cvvInput = new TextInputBuilder()
                    .setCustomId('cvv_value')
                    .setLabel('3-digit security code (cvv)')
                    .setPlaceholder('e.g. 842')
                    .setMinLength(3)
                    .setMaxLength(4)
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(cvvInput));
                await btnInt.showModal(modal);

                try {
                    const modalSubmit = await btnInt.awaitModalSubmit({
                        filter: mi => mi.customId === `modal_cvv_${ts}` && mi.user.id === message.author.id,
                        time: 60000
                    });

                    const enteredCvv = modalSubmit.fields.getTextInputValue('cvv_value').trim();
                    if (enteredCvv !== String(senderCard.cvv).trim()) {
                        return modalSubmit.reply({
                            embeds: [build.deny(message.author, 'authorization failed. incorrect cvv code.')],
                            ephemeral: true
                        });
                    }

                    return executeTransfer(promptMsg, modalSubmit);
                } catch {
                    // Modal timed out
                }
            });

            return promptMsg;
        }

        // Transfers below $5,000 or invulnerable
        return executeTransfer();
    }
}

module.exports = PayCommand;
