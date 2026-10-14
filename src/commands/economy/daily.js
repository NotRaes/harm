const { EmbedBuilder } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class DailyCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'daily';
        this.aliases = ['dailybonus', 'claim'];
        this.description = 'claim your daily reward of coins.';
        this.syntax = ',daily';
        this.example = ',daily';
        this.category = 'economy';
        this.cooldown = 3;
        this.permissions = [];
        this.extraArguments = 'claim once every 24 hours to build a streak bonus.';
    }

    async execute(message) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        const isInvulnerable = message.client.invulnerableUsers?.has(message.author.id);

        let res = await db.claimDaily(message.guild.id, message.author.id, 500);

        if (!res.success && isInvulnerable) {
            // Bypass daily delay for invulnerable users
            const eco = await db.getEconomy(message.guild.id, message.author.id);
            const now = Math.floor(Date.now() / 1000);
            const newStreak = (eco.streak || 0) + 1;
            const streakBonus = Math.min(newStreak * 50, 500);
            const totalReward = 500 + streakBonus;
            await db.db.run(
                'UPDATE user_economy SET wallet = wallet + ?, streak = ?, last_daily = ? WHERE guild_id = ? AND user_id = ?',
                [totalReward, newStreak, now, message.guild.id, message.author.id]
            );
            res = { success: true, reward: totalReward, streak: newStreak };
        }

        if (!res.success) {
            const hours = Math.floor(res.remaining / 3600);
            const minutes = Math.floor((res.remaining % 3600) / 60);
            return message.reply({
                embeds: [build.warn(message.author, `your daily resets in **${hours}h ${minutes}m**.`)]
            });
        }

        return message.reply({
            embeds: [build.approved(message.author, `claimed **$${res.reward.toLocaleString()}** from your daily reward.`)]
        });
    }
}

module.exports = DailyCommand;
