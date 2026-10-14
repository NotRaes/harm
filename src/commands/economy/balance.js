const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const path = require('path');
const fs = require('fs');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class BalanceCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'balance';
        this.aliases = ['bal', 'wallet', 'credits'];
        this.description = 'check your current wallet and bank balance.';
        this.syntax = ',balance [@user]';
        this.example = ',balance';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.extraArguments = 'leave blank to view your own balance or mention someone.';
    }

    async execute(message, args) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        let target = message.author;
        if (args && args.length > 0) {
            const mention = message.mentions.users.first();
            if (mention) {
                target = mention;
            } else {
                const fetched = await message.client.users.fetch(args[0]).catch(() => null);
                if (fetched) target = fetched;
            }
        }

        const color = config.colors.c || '#2b2d31';
        const e = config.emojis;

        // Check if bank account is open
        const hasCard = await db.hasCard(message.guild.id, target.id);
        if (!hasCard) {
            const embed = new EmbedBuilder()
                .setColor(color)
                .setDescription(`<@${target.id}>: you do not have an open bank account use open card first`);
            return message.reply({ embeds: [embed] });
        }

        const eco = await db.getEconomy(message.guild.id, target.id);
        const card = await db.getCard(message.guild.id, target.id) || {};
        const wallet = eco.wallet || 0;
        const bank = eco.bank || 0;
        const total = wallet + bank;
        const capacity = card.bank_capacity || 25000;
        const earned = card.earned_all_time || (total > 0 ? total : 1000);
        const streak = eco.streak || 0;
        const rank = await db.getEconomyRank(message.guild.id, target.id);

        const targetAvatar = target.displayAvatarURL({ size: 1024, dynamic: true });

        const crown = e.crown ? `${e.crown} ` : '';

        const description = [
            `${e.leftwing || '✦'} **balance** ${e.rightwing || '✦'}`,
            '',
            `**wallet** \`$${wallet.toLocaleString()}\``,
            `**bank** \`$${bank.toLocaleString()}\` · capacity \`$${capacity.toLocaleString()}\``,
            `**total** \`$${total.toLocaleString()}\``,
            '',
            `${crown}**rank** \`#${rank}\` in the server`,
            `**earned all time** \`$${earned.toLocaleString()}\``,
            `**daily streak** \`${streak} days\``
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(color)
            .setThumbnail(targetAvatar)
            .setDescription(description);

        const cardDetailsBtn = new ButtonBuilder()
            .setCustomId('bal_card_details')
            .setLabel('card details')
            .setStyle(ButtonStyle.Secondary);
        if (e.card) cardDetailsBtn.setEmoji(e.card);

        const dismissBtn = new ButtonBuilder()
            .setCustomId('bal_del')
            .setStyle(ButtonStyle.Secondary);
        if (e.cancel || e.deny) {
            dismissBtn.setEmoji(e.cancel || e.deny);
        } else {
            dismissBtn.setLabel('dismiss');
        }

        const row = new ActionRowBuilder().addComponents(cardDetailsBtn, dismissBtn);

        const sent = await message.reply({ embeds: [embed], components: [row] });

        const col = sent.createMessageComponentCollector({
            filter: i => i.user.id === message.author.id,
            time: 30000
        });

        col.on('collect', async (i) => {
            if (i.customId === 'bal_del') {
                col.stop();
                return sent.delete().catch(() => {});
            }

            if (i.customId === 'bal_card_details') {
                const cardData = await db.getCard(message.guild.id, target.id) || {};
                const lastFour = cardData.card_number ? cardData.card_number.slice(-4) : '••••';
                const status = cardData.locked ? 'frozen' : 'active';
                const tier = cardData.tier || 'standard';

                return i.reply({
                    content: `card: \`•••• •••• •••• ${lastFour}\` · status: \`${status}\` · tier: \`${tier}\` · capacity: \`$${capacity.toLocaleString()}\``,
                    ephemeral: true
                }).catch(() => {});
            }
        });

        col.on('end', (_, reason) => {
            if (reason === 'deleted') return;
        });

        return sent;
    }
}

module.exports = BalanceCommand;
