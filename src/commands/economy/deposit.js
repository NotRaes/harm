const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class DepositCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'deposit';
        this.aliases = ['dep'];
        this.description = 'deposit coins from your wallet into your secure bank account.';
        this.syntax = ',deposit <amount|all|half>';
        this.example = ',deposit 5000 | ,deposit all';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.extraArguments = 'bank funds cannot be stolen by robbers.';
    }

    async execute(message, args) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        if (!args || args.length === 0) {
            return build.help(message, this);
        }

        const eco = await db.getEconomy(message.guild.id, message.author.id);
        const raw = args[0].toLowerCase();
        let amount = 0;

        if (raw === 'all' || raw === 'max') {
            amount = eco.wallet;
        } else if (raw === 'half') {
            amount = Math.floor(eco.wallet / 2);
        } else {
            amount = parseInt(raw.replace(/[\$,]/g, ''), 10);
        }

        if (isNaN(amount) || amount <= 0) {
            return build.help(message, this);
        }

        if (eco.wallet < amount || eco.wallet <= 0) {
            return message.reply({
                embeds: [build.deny(message.author, `insufficient wallet funds. you have **$${eco.wallet.toLocaleString()}** in your pocket.`)]
            });
        }

        const res = await db.deposit(message.guild.id, message.author.id, amount);
        if (!res.success) {
            if (res.reason === 'full') {
                return message.reply({
                    embeds: [build.warn(message.author, `your bank account is at maximum capacity (**$${res.capacity.toLocaleString()}**).`)]
                });
            }
            return message.reply({
                embeds: [build.deny(message.author, 'deposit failed.')]
            });
        }

        await db.recordTransaction(message.guild.id, message.author.id, 'deposit', res.deposited, 'deposited to bank');

        const cappedNotice = res.capped
            ? ` *(capped: bank reached limit of $${res.newBank.toLocaleString()})*`
            : '';

        return message.reply({
            embeds: [build.approved(message.author, `deposited **$${res.deposited.toLocaleString()}** into your bank account.${cappedNotice}`)]
        });
    }
}

module.exports = DepositCommand;
