const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class WithdrawCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'withdraw';
        this.aliases = ['with'];
        this.description = 'withdraw coins from your bank account into your wallet.';
        this.syntax = ',withdraw <amount|all|half>';
        this.example = ',withdraw 2500 | ,withdraw all';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.extraArguments = 'keep coins in your bank to protect them against robbers.';
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
            amount = eco.bank;
        } else if (raw === 'half') {
            amount = Math.floor(eco.bank / 2);
        } else {
            amount = parseInt(raw.replace(/[\$,]/g, ''), 10);
        }

        if (isNaN(amount) || amount <= 0) {
            return build.help(message, this);
        }

        if (eco.bank < amount || eco.bank <= 0) {
            return message.reply({
                embeds: [build.deny(message.author, `insufficient bank funds. you have **$${eco.bank.toLocaleString()}** in your bank account.`)]
            });
        }

        const res = await db.withdraw(message.guild.id, message.author.id, amount);
        if (!res.success) {
            return message.reply({
                embeds: [build.deny(message.author, 'withdrawal failed.')]
            });
        }

        await db.recordTransaction(message.guild.id, message.author.id, 'withdraw', res.withdrawn, 'withdrawn from bank');

        return message.reply({
            embeds: [build.approved(message.author, `withdrew **$${res.withdrawn.toLocaleString()}** from your bank account.`)]
        });
    }
}

module.exports = WithdrawCommand;
