const { PermissionsBitField } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class PrefixCommand {
    constructor() {
        this.name = 'prefix';
        this.aliases = ['setprefix'];
        this.description = 'customize the server prefix or reset it to default.';
        this.syntax = ',prefix <set|reset> [value]';
        this.example = ',prefix set !';
        this.category = 'utility';
        this.permissions = ['ManageGuild'];
        this.cooldown = 3;
        this.subcommands = ['prefix set <new>', 'prefix reset'];
        this.subcommandDetails = {
            set: {
                description: 'customize the server prefix.',
                syntax: ',prefix set <new>',
                example: ',prefix set !'
            },
            reset: {
                description: 'reset the server prefix back to default.',
                syntax: ',prefix reset',
                example: ',prefix reset'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('nothing found', 'this command must be used in a server.'));
        }

        const db = message.client.db;
        const currentPrefix = (db && await db.getGuildPrefix(message.guild.id)) || config.prefix || ',';

        if (!args || args.length === 0) {
            return message.reply(build.noticeBox('warn', 'prefix', `current server prefix is \`${currentPrefix}\`. use \`${currentPrefix}prefix set <new>\` to change.`));
        }

        const isOwner = config.owners?.includes(message.author.id);
        const hasPerm = isOwner || message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild);

        if (!hasPerm) {
            return message.reply(build.denyBox('permission denied', 'you need manage server permissions to modify the prefix.'));
        }

        let firstArg = args[0].trim();
        let targetPrefix = firstArg;

        if (firstArg.toLowerCase() === 'set') {
            if (args.length < 2) {
                return message.reply(build.warnBox('missing prefix', 'specify the new prefix to set.'));
            }
            targetPrefix = args[1].trim();
        }

        if (targetPrefix.toLowerCase() === 'reset' || targetPrefix.toLowerCase() === 'default') {
            if (db) await db.setGuildPrefix(message.guild.id, config.prefix || ',');
            return message.reply(build.approvedBox('prefix reset', `server prefix has been reset to \`${config.prefix || ','}\`.`));
        }

        if (targetPrefix.length > 5) {
            return message.reply(build.warnBox('invalid prefix', 'prefix cannot exceed 5 characters.'));
        }

        if (/\s/.test(targetPrefix)) {
            return message.reply(build.warnBox('invalid prefix', 'prefix cannot contain whitespace.'));
        }

        if (db) {
            await db.setGuildPrefix(message.guild.id, targetPrefix);
        }

        return message.reply(build.approvedBox('prefix updated', `server prefix has been changed to \`${targetPrefix}\`.`));
    }
}

module.exports = PrefixCommand;
