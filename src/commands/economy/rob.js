const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class RobCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'rob';
        this.aliases = ['steal'];
        this.description = 'attempt to steal cash from an exposed user wallet.';
        this.syntax = ',rob <@user>';
        this.example = ',rob @user';
        this.category = 'economy';
        this.cooldown = 180; // 3 minutes
        this.permissions = [];
        this.extraArguments = 'locked debit cards and deposited bank funds are immune to robbery.';
    }

    async execute(message, args) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        if (!args || args.length === 0) {
            return build.help(message, this);
        }

        const target = (message.mentions?.users?.first ? message.mentions.users.first() : (message.mentions?.users instanceof Map ? message.mentions.users.values().next().value : null)) || await message.client.users.fetch(args[0]).catch(() => null);
        if (!target) {
            return build.help(message, this);
        }

        if (target.id === message.author.id) {
            return message.reply({ embeds: [build.warn(message.author, 'you cannot rob yourself.')] });
        }

        if (target.bot) {
            return message.reply({ embeds: [build.warn(message.author, 'you cannot rob a bot.')] });
        }

        const robberEco = await db.getEconomy(message.guild.id, message.author.id);
        const minRobberCash = 250;
        if (robberEco.wallet < minRobberCash) {
            return message.reply({
                embeds: [build.deny(message.author, `you need at least **$${minRobberCash.toLocaleString()}** in your wallet in case you get caught.`)]
            });
        }

        const targetEco = await db.getEconomy(message.guild.id, target.id);
        const minTargetCash = 500;
        if (targetEco.wallet < minTargetCash) {
            return message.reply({
                embeds: [build.warn(message.author, `<@${target.id}> only has **$${targetEco.wallet.toLocaleString()}** in their wallet. not worth the risk.`)]
            });
        }

        // Card Lock Defense Check
        const targetCard = await db.getCard(message.guild.id, target.id);
        if (targetCard && targetCard.is_locked) {
            return message.reply({
                embeds: [build.warn(message.author, `<@${target.id}>'s debit card is locked and their balance is secured. you couldn't access their funds.`)]
            });
        }

        // Padlock Defense Check
        const padlockCount = await db.getItem(message.guild.id, target.id, 'padlock');
        if (padlockCount > 0) {
            await db.removeItem(message.guild.id, target.id, 'padlock', 1);
            return message.reply({
                embeds: [build.warn(message.author, `<@${target.id}>'s wallet had a **padlock** attached! your pick snapped and the padlock was destroyed.`)]
            });
        }

        // 50% chance of success
        const success = Math.random() < 0.50;

        if (success) {
            // Steal between 20% and 45% of target's wallet
            const percent = (Math.floor(Math.random() * 26) + 20) / 100;
            const stolen = Math.max(100, Math.floor(targetEco.wallet * percent));

            await db.addWallet(message.guild.id, target.id, -stolen);
            await db.addWallet(message.guild.id, message.author.id, stolen);

            const targetName = (target.username || target.tag || target.id).toLowerCase();
            const authorName = (message.author.username || message.author.tag || message.author.id).toLowerCase();

            await db.recordTransaction(message.guild.id, message.author.id, 'rob_success', stolen, `robbed ${targetName}`);
            await db.recordTransaction(message.guild.id, target.id, 'rob_victim', stolen, `robbed by ${authorName}`);

            return message.reply({
                embeds: [build.approved(message.author, `you successfully snatched **$${stolen.toLocaleString()}** from <@${target.id}>'s wallet!`)]
            });
        } else {
            // Caught red-handed! Pay a fine to the target
            const finePercent = (Math.floor(Math.random() * 16) + 15) / 100;
            const fine = Math.max(150, Math.min(robberEco.wallet, Math.floor(robberEco.wallet * finePercent)));

            await db.addWallet(message.guild.id, message.author.id, -fine);
            await db.addWallet(message.guild.id, target.id, fine);

            const targetName = (target.username || target.tag || target.id).toLowerCase();
            const authorName = (message.author.username || message.author.tag || message.author.id).toLowerCase();

            await db.recordTransaction(message.guild.id, message.author.id, 'rob_caught', fine, `caught robbing ${targetName}`);
            await db.recordTransaction(message.guild.id, target.id, 'rob_compensation', fine, `compensation from ${authorName}`);

            return message.reply({
                embeds: [build.deny(message.author, `you were caught red-handed trying to rob <@${target.id}>! you paid them **$${fine.toLocaleString()}** in damages.`)]
            });
        }
    }
}

module.exports = RobCommand;
