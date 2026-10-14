const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class CoinflipCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'coinflip';
        this.aliases = ['cf', 'flip'];
        this.description = 'Flip a coin — heads or tails';
        this.syntax = ',coinflip <side> <bet>';
        this.example = ',coinflip heads 500 | tails all';
        this.category = 'economy';
        this.cooldown = 1;
        this.permissions = [];
        this.hideHint = true;
    }

    async execute(message, args) {
        if (!args || args.length < 2) {
            return build.help(message, this);
        }

        const rawSide = args[0].toLowerCase();
        let side = null;
        if (['heads', 'head', 'h'].includes(rawSide)) side = 'heads';
        else if (['tails', 'tail', 't'].includes(rawSide)) side = 'tails';

        if (!side) {
            return build.help(message, this);
        }

        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        // Card lock check
        const isInvulnerable = message.client.invulnerableUsers?.has(message.author.id);
        const hasCard = await db.hasCard(message.guild.id, message.author.id);
        if (hasCard && !isInvulnerable) {
            const card = await db.getCard(message.guild.id, message.author.id);
            if (card && card.is_locked) {
                return message.reply({ embeds: [build.deny(message.author, 'your card is locked. use `,card unlock` to resume transactions.')] });
            }

            // B2 24-Hour Card Lock Cycle Check
            const now = Math.floor(Date.now() / 1000);
            const unlockedDuration = now - (card?.unlocked_at || card?.opened_at || now);
            if (unlockedDuration >= 86400) {
                const embed = new EmbedBuilder()
                    .setColor(config.colors.c || '#2b2d31')
                    .setDescription(
                        `${config.emojis.leftwing || '✦'} **card security expired** ${config.emojis.rightwing || '✦'}\n\n` +
                        `*your card security session has expired.*\n\n` +
                        `your card must be locked every 24 hours to secure your balance.\n` +
                        `use \`${config.prefix}card lock\` to secure your card before playing.`
                    );
                return message.reply({ embeds: [embed] });
            }
        }

        const eco = await db.getEconomy(message.guild.id, message.author.id);
        const rawBet = args[1].toLowerCase();
        let bet = 0;

        if (rawBet === 'all' || rawBet === 'max') {
            bet = eco.wallet;
        } else if (rawBet === 'half') {
            bet = Math.floor(eco.wallet / 2);
        } else {
            bet = parseInt(rawBet, 10);
        }

        if (isNaN(bet) || bet <= 0) {
            return build.help(message, this);
        }

        if (eco.wallet < bet || eco.wallet <= 0) {
            return message.reply({
                embeds: [build.deny(message.author, `insufficient funds. your wallet balance: \`$${eco.wallet.toLocaleString()}\`.`)]
            });
        }

        return this.runFlip(message, side, bet);
    }

    async runFlip(message, side, bet, existingMsg = null, interaction = null) {
        const db = message.client.db;
        const eco = await db.getEconomy(message.guild.id, message.author.id);

        if (eco.wallet < bet || eco.wallet <= 0) {
            const errEmbed = build.deny(message.author, `insufficient funds. your wallet balance: \`$${eco.wallet.toLocaleString()}\`.`);
            if (interaction) {
                return interaction.reply({ embeds: [errEmbed], ephemeral: true });
            }
            return message.reply({ embeds: [errEmbed] });
        }

        const outcome = Math.random() < 0.5 ? 'heads' : 'tails';
        const won = (side === outcome);
        const delta = won ? bet : -bet;
        const updated = await db.addWallet(message.guild.id, message.author.id, delta);

        // Record transaction in card history
        if (db.recordTransaction) {
            await db.recordTransaction(
                message.guild.id,
                message.author.id,
                won ? 'coinflip_win' : 'coinflip_loss',
                bet,
                won ? 'Coinflip win' : 'Coinflip loss'
            ).catch(() => {});
        }

        const e = config.emojis || {};
        const botAvatar = (message.client?.user || message.guild?.members?.me?.user)?.displayAvatarURL({ size: 1024, dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
        const coinIcon = e.coin ? `${e.coin} ` : '';
        const crownIcon = e.crown ? `${e.crown} ` : '';

        const resultLine = `${coinIcon}**result** landed on **\`${outcome}\`**`;
        const callLine = won
            ? `${crownIcon}**won** +$${bet.toLocaleString()}`
            : `${crownIcon}**lost** -$${bet.toLocaleString()}`;
        const balanceLine = `**wallet** \`$${updated.wallet.toLocaleString()}\``;

        const embedColor = won ? (config.colors.c || '#2b2d31') : (config.colors.cc || '#ED4245');

        const embed = new EmbedBuilder()
            .setColor(embedColor)
            .setThumbnail(botAvatar)
            .setDescription(
                `${e.leftwing || '✦'} **coinflip — ${won ? 'victory' : 'defeat'}** ${e.rightwing || '✦'}\n` +
                `*${won ? 'the coin favored your prediction.' : 'the coin fell against you.'}*\n\n` +
                `${resultLine}\n` +
                `${callLine}\n` +
                `${balanceLine}`
            );

        const doubleBet = bet * 2;
        const canDouble = updated.wallet >= doubleBet;
        const canAgain = updated.wallet >= bet;

        const ts = Date.now();
        const flipAgainBtn = new ButtonBuilder()
            .setCustomId(`cf_again_${ts}`)
            .setLabel('flip again')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!canAgain);
        if (e.coin) flipAgainBtn.setEmoji(e.coin);

        const dismissBtn = new ButtonBuilder()
            .setCustomId(`cf_del_${ts}`)
            .setStyle(ButtonStyle.Secondary);
        if (e.cancel || e.deny) {
            dismissBtn.setEmoji(e.cancel || e.deny);
        } else {
            dismissBtn.setLabel('dismiss');
        }

        const actionRow = new ActionRowBuilder().addComponents(
            flipAgainBtn,
            new ButtonBuilder()
                .setCustomId(`cf_double_${ts}`)
                .setLabel(`double down ($${doubleBet.toLocaleString()})`)
                .setStyle(ButtonStyle.Danger)
                .setDisabled(!canDouble),
            dismissBtn
        );

        let sentMsg;
        if (interaction) {
            await interaction.update({ embeds: [embed], components: [actionRow] });
            sentMsg = await interaction.fetchReply();
        } else if (existingMsg) {
            await existingMsg.edit({ embeds: [embed], components: [actionRow] });
            sentMsg = existingMsg;
        } else {
            sentMsg = await message.reply({ embeds: [embed], components: [actionRow] });
        }

        const collector = sentMsg.createMessageComponentCollector({
            time: 30000
        });

        collector.on('collect', async i => {
            if (i.user.id !== message.author.id) {
                return i.reply({ content: 'only the coin flipper can use these controls.', ephemeral: true });
            }

            collector.stop('handled');

            if (i.customId.startsWith('cf_del_')) {
                return sentMsg.delete().catch(() => {});
            }

            if (i.customId.startsWith('cf_again_')) {
                return this.runFlip(message, side, bet, sentMsg, i);
            }

            if (i.customId.startsWith('cf_double_')) {
                return this.runFlip(message, side, doubleBet, sentMsg, i);
            }
        });
    }
}

module.exports = CoinflipCommand;
