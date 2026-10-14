const { EmbedBuilder } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class LeaderboardCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'leaderboard';
        this.aliases = ['rich', 'baltop', 'top'];
        this.description = 'display the wealthiest members in the server.';
        this.syntax = ',leaderboard';
        this.example = ',leaderboard';
        this.category = 'economy';
        this.cooldown = 3;
        this.permissions = [];
        this.extraArguments = 'ranked by total net worth across wallet and bank balances.';
    }

    async execute(message) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        const rows = await db.getEconomyLeaderboard(message.guild.id, 10);

        if (!rows || rows.length === 0) {
            return message.reply({
                embeds: [build.warn(message.author, 'no economy accounts registered in this server yet.')]
            });
        }

        const e = config.emojis || {};
        const authorRank = await db.getEconomyRank(message.guild.id, message.author.id);

        const lines = rows.map((r, idx) => {
            const total = (r.total || (r.wallet + r.bank)).toLocaleString();
            const wallet = (r.wallet || 0).toLocaleString();
            const bank = (r.bank || 0).toLocaleString();

            return `\`${idx + 1}.\` <@${r.user_id}> ─ \`$${total}\`\n` +
                   `-# wallet \`$${wallet}\` · bank \`$${bank}\``;
        });

        const desc = [
            `${e.leftwing || '✦'} **wealth leaderboard** ${e.rightwing || '✦'}`,
            `*top accounts ranked by total net worth.*\n`,
            ...lines,
            '',
            `-# your ranking: \`#${authorRank}\` in the server.`
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setDescription(desc);

        return message.reply({ embeds: [embed] });
    }
}

module.exports = LeaderboardCommand;
