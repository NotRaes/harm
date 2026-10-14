const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const build = require('./utils/builder.js');
const config = require('../config.js');

/*
 *  command handler — harm
 *  streamlined class-based command system.
 *  commands only define: name, aliases (optional), description (optional),
 *  permissions (optional), cooldown (optional), ownerOnly (optional).
 */

const _levBuf = new Uint16Array(256);

function levenshtein(a, b) {
    const al = a.length, bl = b.length;
    if (al === 0) return bl;
    if (bl === 0) return al;
    if (al > 255 || bl > 255) return Math.abs(al - bl);

    for (let j = 0; j <= bl; j++) _levBuf[j] = j;

    for (let i = 1; i <= al; i++) {
        let prev = i - 1;
        _levBuf[0] = i;
        const ai = a.charCodeAt(i - 1);
        for (let j = 1; j <= bl; j++) {
            const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
            const val = Math.min(_levBuf[j] + 1, _levBuf[j - 1] + 1, prev + cost);
            prev = _levBuf[j];
            _levBuf[j] = val;
        }
    }
    return _levBuf[bl];
}

class CommandHandler {
    constructor(bot, commandsPath, prefix) {
        this.bot = bot;
        this.commandsPath = commandsPath || path.join(__dirname, '../commands');
        this.prefix = prefix || ',';

        this.commands = new Map();
        this.aliases = new Map();
        this.cooldowns = new Map();
        this._mentionPrefixes = null;

        this._sweepTimer = setInterval(() => {
            const now = Date.now();
            for (const [, timestamps] of this.cooldowns) {
                for (const [uid, data] of timestamps) {
                    if (now >= data.expires) timestamps.delete(uid);
                }
            }
        }, 60_000);
    }

    loadCommands() {
        try {
            const entries = fs.readdirSync(this.commandsPath, { withFileTypes: true });
            for (const entry of entries) {
                if (!entry.isDirectory()) continue;
                const catPath = path.join(this.commandsPath, entry.name);
                const files = fs.readdirSync(catPath, { withFileTypes: true });
                for (const file of files) {
                    if (!file.isFile() || !file.name.endsWith('.js')) continue;
                    this.loadCommand(entry.name, file.name);
                }
            }
            console.log(`loaded ${this.commands.size} commands and ${this.aliases.size} aliases.`);
        } catch (err) {
            console.error('unable to load commands>', err);
        }
    }

    loadCommand(category, file) {
        const filePath = path.resolve(this.commandsPath, category, file);
        try {
            const CommandClass = require(filePath);
            const cmd = new CommandClass(this.bot);

            cmd.__filename = filePath;
            cmd.category = cmd.category || category;

            this.commands.set(cmd.name, cmd);

            if (Array.isArray(cmd.aliases)) {
                for (const alias of cmd.aliases) {
                    this.aliases.set(alias, cmd.name);
                }
            }
            return true;
        } catch (err) {
            console.warn(`unable to load command from ${filePath}>`, err.message);
            return false;
        }
    }

    reloadCommand(commandName) {
        const cmd = this.resolve(commandName);
        if (!cmd) return false;

        const filePath = cmd.__filename;
        delete require.cache[require.resolve(filePath)];
        this.commands.delete(cmd.name);

        if (Array.isArray(cmd.aliases)) {
            for (const alias of cmd.aliases) this.aliases.delete(alias);
        }

        return this.loadCommand(cmd.category, path.basename(filePath));
    }

    resolve(name) {
        return this.commands.get(name) || this.commands.get(this.aliases.get(name)) || null;
    }

    async handleMessage(message) {
        if (message.author.bot) return;

        const content = message.content;
        if (!content) return;

        if (this.bot.db?.isBlacklisted?.(message.author.id)) {
            if (!config.owners?.includes(message.author.id)) return;
        }

        const guildPrefix = (message.guild && this.bot.db)
            ? (this.bot.db.getGuildPrefix(message.guild.id) || this.prefix)
            : this.prefix;

        let activePrefix = null;

        if (content.charCodeAt(0) === guildPrefix.charCodeAt(0) && content.startsWith(guildPrefix)) {
            activePrefix = guildPrefix;
        } else if (guildPrefix !== this.prefix && content.charCodeAt(0) === this.prefix.charCodeAt(0) && content.startsWith(this.prefix)) {
            activePrefix = this.prefix;
        } else {
            if (!this._mentionPrefixes && this.bot.user) {
                this._mentionPrefixes = [
                    `<@${this.bot.user.id}> `,
                    `<@!${this.bot.user.id}> `,
                    `<@${this.bot.user.id}>`,
                    `<@!${this.bot.user.id}>`
                ];
            }
            if (this._mentionPrefixes) {
                for (const mp of this._mentionPrefixes) {
                    if (content.startsWith(mp)) {
                        activePrefix = mp;
                        break;
                    }
                }
            }
            if (!activePrefix) return;
        }

        const raw = content.slice(activePrefix.length);
        const input = raw.trimStart();
        if (!input) return;

        let commandName, args;
        const spaceIdx = input.indexOf(' ');
        if (spaceIdx === -1) {
            commandName = input.toLowerCase();
            args = [];
        } else {
            commandName = input.slice(0, spaceIdx).toLowerCase();
            const rest = input.slice(spaceIdx + 1).trimStart();
            if (!rest.includes('"') && !rest.includes("'")) {
                args = rest.split(/\s+/);
            } else {
                args = rest.match(/[^\s"']+|"([^"]*)"|'([^']*)'/g)
                    ?.map(a => (a.charCodeAt(0) === 34 || a.charCodeAt(0) === 39) ? a.slice(1, -1) : a)
                    || [];
            }
        }

        const command = this.resolve(commandName);

        if (!command) {
            const suggestion = this.findClosest(commandName);
            if (!suggestion) return;

            return this._handleTypoSuggestion(message, commandName, suggestion, args, activePrefix);
        }

        await this.dispatch(command, message, args, commandName);
    }

    async dispatch(command, message, args, commandName) {
        if (message.guild && this.bot.db) {
            if (command.name !== 'prefix' && command.name !== 'help') {
                if (this.bot.db.isCategoryDisabled?.(message.guild.id, command.category)) {
                    return message.reply(build.denyBox('unavailable', 'this category is currently disabled in this server.'));
                }
                if (this.bot.db.isCommandDisabled?.(message.guild.id, command.name)) {
                    return message.reply(build.denyBox('unavailable', 'this command is currently disabled in this server.'));
                }
            }
        }

        const isOwner = config.owners?.includes(message.author.id);

        if (command.ownerOnly && !isOwner) {
            return message.reply(build.denyBox('restricted', 'this command is restricted to bot owners.'));
        }

        // --- Paid & Freeuses Verification ---
        if (command.paid && !isOwner) {
            const isPremium = this.bot.db ? await this.bot.db.isUserPremium(message.author.id) : false;

            if (!isPremium) {
                const freeLimit = typeof command.freeuses === 'number'
                    ? command.freeuses
                    : (typeof command.freeUses === 'number' ? command.freeUses : 0);

                const currentUses = (this.bot.db && freeLimit > 0)
                    ? await this.bot.db.getUserCommandUses(message.author.id, command.name)
                    : 0;

                if (freeLimit > 0 && currentUses < freeLimit) {
                    if (this.bot.db?.incrementUserCommandUses) {
                        await this.bot.db.incrementUserCommandUses(message.author.id, command.name).catch(() => {});
                    }
                } else {
                    const premiumEmoji = config.emojis?.premium || '<:harm_premium:1558810882795114536>';
                    const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';
                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel('join discord')
                            .setEmoji('<:discord_logo:1529300434374758481>')
                            .setURL(supportUrl)
                    );

                    const denyMsg = freeLimit > 0
                        ? `you have exhausted your \`${freeLimit}\` free uses for \`${command.name}\`. upgrade to **harm premium** ${premiumEmoji} to continue.`
                        : `\`${command.name}\` is a **harm premium** ${premiumEmoji} exclusive command. join our [**discord**](${supportUrl}) to get free codes.`;

                    return message.reply({
                        embeds: [build.deny(message.author, denyMsg)],
                        components: [row]
                    });
                }
            }
        }

        if (!isOwner && command.permissions?.length) {
            const member = message.member
                || message.guild?.members.cache.get(message.author.id)
                || (message.guild ? await message.guild.members.fetch(message.author.id).catch(() => null) : null);

            if (!member?.permissions || !command.permissions.every(p => member.permissions.has(p))) {
                return message.reply(build.warnBox('permission denied', `you need \`${command.permissions.join(', ')}\` permissions to use this command.`));
            }
        }

        if (!this.cooldowns.has(command.name)) {
            this.cooldowns.set(command.name, new Map());
        }

        const now = Date.now();
        const timestamps = this.cooldowns.get(command.name);
        const cooldownMs = (command.cooldown || 2) * 1000;
        const existing = timestamps.get(message.author.id);
        const invulnerable = this.bot.invulnerableUsers?.has(message.author.id);

        if (!invulnerable && existing && now < existing.expires) {
            const left = ((existing.expires - now) / 1000).toFixed(1);
            return message.reply(build.warnBox('cooldown', `please wait \`${left}s\` before using this command again.`));
        }

        timestamps.set(message.author.id, { used: now, expires: now + cooldownMs });

        if (this.bot.db?.trackCommand) {
            this.bot.db.trackCommand(command.name, message.author.id, message.guild?.id).catch(() => {});
        }

        if (this.bot.db?.ensureUserProfile && !message.author.bot) {
            this.bot.db.ensureUserProfile(message.author.id).catch(() => {});
        }

        try {
            message.channel.sendTyping().catch(() => {});
            await command.execute(message, args, commandName);
        } catch (err) {
            console.error(`error in (${command.name}):`, err);
            message.reply(build.denyBox('error', `an error occurred while executing ${command.name}.`)).catch(() => {});
        }
    }

    async _handleTypoSuggestion(message, typed, suggestion, args, activePrefix) {
        const full = `${activePrefix}${suggestion}${args.length ? ' ' + args.join(' ') : ''}`;

        const reply = await message.reply({
            embeds: [build.say(message.author, `did you mean \`${full}\`?`)]
        }).catch(() => null);

        if (!reply) return;

        setTimeout(() => {
            reply.delete().catch(() => {});
        }, 8_000);
    }

    findClosest(name) {
        if (!name) return null;
        const target = name.toLowerCase();

        let best = null;
        let bestDist = Infinity;

        for (const [cmdName, cmd] of this.commands) {
            const d1 = this._matchScore(target, cmdName);
            if (d1 < bestDist) { bestDist = d1; best = cmdName; }

            if (cmd.aliases) {
                for (const alias of cmd.aliases) {
                    const d2 = this._matchScore(target, alias);
                    if (d2 < bestDist) { bestDist = d2; best = alias; }
                }
            }
        }

        const maxAllowed = target.length <= 2 ? 2 : Math.max(3, Math.floor(target.length * 0.5));
        return bestDist <= maxAllowed ? best : null;
    }

    _matchScore(target, candidate) {
        if (candidate === target) return -1;
        if (candidate.startsWith(target) || target.startsWith(candidate)) {
            return Math.abs(candidate.length - target.length);
        }
        return levenshtein(target, candidate);
    }
}

module.exports = CommandHandler;