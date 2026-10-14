const {
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class NukeCommand {
    constructor() {
        this.name = 'nuke';
        this.aliases = [];
        this.description = 'clone and clear all messages in this channel with identical permissions.';
        this.syntax = ',nuke [enable|disable]';
        this.example = ',nuke';
        this.category = 'utility';
        this.permissions = ['ManageChannels'];
        this.cooldown = 5;
        this.subcommands = [
            'nuke',
            'nuke enable',
            'nuke disable'
        ];
        this.subcommandDetails = {
            execute: {
                description: 'recreate the channel with identical permissions and wipe messages.',
                syntax: ',nuke',
                example: ',nuke'
            },
            enable: {
                description: 'allow the nuke command to be used in this server (server owner only).',
                syntax: ',nuke enable',
                example: ',nuke enable'
            },
            disable: {
                description: 'prevent the nuke command from being used in this server (server owner only).',
                syntax: ',nuke disable',
                example: ',nuke disable'
            }
        };
    }

    async execute(message, args) {
        if (!message.guild) {
            return message.reply(build.warnBox('this command can only be used in servers.'));
        }

        const isOwner = config.owners?.includes(message.author.id);
        const sub = (args?.[0] || '').toLowerCase();
        const db = message.client.db;

        // ──────────────────────── 1. ENABLE / DISABLE TOGGLE ────────────────────────
        if (sub === 'enable' || sub === 'on' || sub === 'disable' || sub === 'off') {
            const isGuildOwner = message.guild.ownerId === message.author.id || isOwner;
            if (!isGuildOwner) {
                return message.reply(build.denyBox('permission denied', 'only the server owner can enable or disable nuke.'));
            }

            const newState = (sub === 'enable' || sub === 'on');
            if (db) await db.setNukeEnabled(message.guild.id, newState);

            return message.reply({
                embeds: [build.approved(message.author, `nuke is now ${newState ? 'enabled' : 'disabled'}.`)]
            });
        }

        // ──────────────────────── 2. CHECK IF NUKE IS ENABLED ────────────────────────
        const isEnabled = db ? db.isNukeEnabled(message.guild.id) : false;
        if (!isEnabled) {
            return message.reply({
                embeds: [build.warn(message.author, 'nuke is currently disabled in this server.\n-# the server owner can run `,nuke enable` to allow it.')]
            });
        }

        // ──────────────────────── 3. PERMISSION CHECKS ────────────────────────
        const hasChannelPerms = isOwner || message.member?.permissions?.has(PermissionFlagsBits.ManageChannels);
        if (!hasChannelPerms) {
            return message.reply(build.denyBox('permission denied', 'you need manage channels permission to nuke this channel.'));
        }

        const botMember = message.guild.members.me;
        if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return message.reply(build.denyBox('missing permissions', 'harm requires `manage_channels` permission to clone and delete channels.'));
        }

        const channel = message.channel;
        if (channel.isThread()) {
            return message.reply(build.warnBox('threads cannot be nuked with this command.'));
        }

        // ──────────────────────── 4. INSTANT NUKE EXECUTION (NO SAFETY PROMPT) ────────────────────────
        const oldPosition = channel.position;
        const parentId = channel.parentId;

        try {
            // A. Clone channel preserving all permissions, topic, nsfw, rate limits
            const newChannel = await channel.clone({
                name: channel.name,
                permissionOverwrites: channel.permissionOverwrites.cache,
                topic: channel.topic,
                nsfw: channel.nsfw,
                parent: parentId || undefined,
                bitrate: channel.bitrate,
                userLimit: channel.userLimit,
                rateLimitPerUser: channel.rateLimitPerUser,
                reason: `channel nuked by ${message.author.tag} (${message.author.id})`
            });

            // B. Set identical channel position
            await newChannel.setPosition(oldPosition).catch(() => {});

            // C. Delete old channel
            await channel.delete(`channel nuked by ${message.author.tag}`).catch(() => {});

            // D. Send clean aesthetic nuke notice in the new channel
            const approveEmoji = config.emojis?.approve || '<:harm_tick:1558811267014066366>';
            const nukeEmbed = new EmbedBuilder()
                .setColor(config.colors.c || 0x2b2d31)
                .setDescription(`${approveEmoji} first! channel was nuked by <@${message.author.id}>.`)
                .setImage('https://media.tenor.com/giN8525b-pAAAAAC/explosion-boom.gif');

            await newChannel.send({ embeds: [nukeEmbed] }).catch(() => {});
        } catch (err) {
            console.error('[nuke command error]:', err);
        }
    }
}

module.exports = NukeCommand;
