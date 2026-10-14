const build = require('../../structures/utils/builder.js');

class AfkCommand {
    constructor() {
        this.name = 'afk';
        this.aliases = [];
        this.description = 'set your afk status to alert members when you are mentioned.';
        this.syntax = ',afk [reason]';
        this.example = ',afk studying for exams';
        this.category = 'utility';
        this.cooldown = 3;
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const db = message.client.db;
        if (!db) {
            return message.reply(build.denyBox('offline', 'database subsystem is currently offline.'));
        }

        const rawReason = args && args.length > 0 ? args.join(' ').trim() : 'afk';
        const cleanReason = rawReason.slice(0, 100);

        await db.setAfk(message.author.id, cleanReason, message.guild.id);

        return message.reply({
            embeds: [build.approved(message.author, `you are now afk: **${cleanReason}**`)]
        });
    }
}

module.exports = AfkCommand;
