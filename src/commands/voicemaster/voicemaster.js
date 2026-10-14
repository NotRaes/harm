const {
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');
const VoiceMasterHelper = require('../../structures/utils/helpers/voiceMasterHelper.js');

class VoiceMasterCommand {
    constructor() {
        this.name = 'voicemaster';
        this.aliases = ['vm', 'voice'];
        this.description = 'dynamic join-to-create temporary voice channels.';
        this.syntax = ',voicemaster <setup|reset|interface|defaultname|defaultlimit> [arguments]';
        this.example = ',voicemaster setup';
        this.category = 'voicemaster';
        this.cooldown = 3;

        this.subcommands = [
            'voicemaster setup',
            'voicemaster reset',
            'voicemaster interface',
            'voicemaster defaultname [name]',
            'voicemaster defaultlimit [limit]'
        ];

        this.subcommandDetails = {
            setup: {
                description: 'create the join-to-create channel and control panel.',
                syntax: ',voicemaster setup',
                example: ',vm setup'
            },
            reset: {
                description: 'delete the setup and every active temporary channel.',
                syntax: ',voicemaster reset',
                example: ',vm reset'
            },
            interface: {
                description: 'post the control panel in this channel.',
                syntax: ',voicemaster interface',
                example: ',vm interface'
            },
            defaultname: {
                description: 'set the naming template for new channels.',
                syntax: ',voicemaster defaultname [template]',
                example: ',vm defaultname {user} lounge'
            },
            defaultlimit: {
                description: 'set the default user limit for new channels.',
                syntax: ',voicemaster defaultlimit [limit]',
                example: ',vm defaultlimit 5'
            }
        };
    }

    async execute(message, args, commandName) {
        if (!message.guild) {
            return message.reply(build.warnBox('nothing found', 'voicemaster can only be used in servers.'));
        }

        const db = message.client.db;
        if (!db) {
            return message.reply(build.denyBox('offline', 'database subsystem is currently offline.'));
        }

        const invoked = (commandName || '').toLowerCase();
        let sub = (args?.[0] || '').toLowerCase();
        let remainingArgs = args ? [...args] : [];

        if (this.subcommandDetails[sub]) {
            remainingArgs.shift();
        }

        // If no subcommands or arguments specified, display interactive help menu
        if (!sub && (!args || args.length === 0)) {
            return await build.help(message, this);
        }

        const isOwner = config.owners?.includes(message.author.id);
        const hasModPerms = isOwner || message.member.permissions.has(PermissionFlagsBits.ManageGuild);

        // ──────────────────────── 1. SETUP ────────────────────────
        if (sub === 'setup') {
            if (!hasModPerms) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to run voicemaster setup.'));
            }

            const botMember = message.guild.members.me;
            if (!botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
                return message.reply(build.denyBox('missing permissions', 'harm requires `manage_channels` permission to create voicemaster channels.'));
            }

            const existingSetup = await db.getVoiceMasterSetup(message.guild.id);
            if (existingSetup) {
                const j2cExists = message.guild.channels.cache.has(existingSetup.vc_id);
                const icExists = message.guild.channels.cache.has(existingSetup.interface_channel_id);
                const counterExists = existingSetup.counter_channel_id && message.guild.channels.cache.has(existingSetup.counter_channel_id);
                if (j2cExists || icExists || counterExists) {
                    return message.reply(build.warnBox('check the usage', 'voicemaster is already set up here.\nrun `,voicemaster reset` first if you want to rebuild it.'));
                }
            }

            try {
                // A. Create VoiceMaster Category
                const category = await message.guild.channels.create({
                    name: 'voice',
                    type: ChannelType.GuildCategory
                });

                // B. 1. Create Interface Text Channel
                const textChannel = await message.guild.channels.create({
                    name: 'interface',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: message.guild.roles.everyone.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                            deny: [PermissionFlagsBits.SendMessages]
                        },
                        {
                            id: botMember.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.SendMessages,
                                PermissionFlagsBits.EmbedLinks,
                                PermissionFlagsBits.AttachFiles,
                                PermissionFlagsBits.ManageMessages
                            ]
                        }
                    ]
                });

                // C. 2. Create Join to Create (j2c) Voice Channel
                const j2cChannel = await message.guild.channels.create({
                    name: 'j2c',
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 0,
                    permissionOverwrites: [
                        {
                            id: message.guild.roles.everyone.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.Connect,
                                PermissionFlagsBits.Speak
                            ]
                        }
                    ]
                });

                // D. 3. Create Active VCs Counter Channel (Unjoinable)
                const counterChannel = await message.guild.channels.create({
                    name: 'active vcs: 0',
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 0,
                    permissionOverwrites: [
                        {
                            id: message.guild.roles.everyone.id,
                            allow: [PermissionFlagsBits.ViewChannel],
                            deny: [PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]
                        },
                        {
                            id: botMember.id,
                            allow: [
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.ManageChannels
                            ],
                            deny: [PermissionFlagsBits.Connect]
                        }
                    ]
                });

                // E. Post the Persistent Interface into voice-controls
                const payload = VoiceMasterHelper.buildInterfacePayload(message.guild);
                let interfaceMsg;
                try {
                    interfaceMsg = await textChannel.send(payload.componentsV2);
                } catch (_) {
                    interfaceMsg = await textChannel.send(payload.embedFallback);
                }

                // F. Save Setup in Database
                await db.setVoiceMasterSetup(
                    message.guild.id,
                    j2cChannel.id,
                    category.id,
                    textChannel.id,
                    interfaceMsg.id,
                    null,
                    null,
                    counterChannel.id
                );

                return message.reply(build.approvedBox(`join <#${j2cChannel.id}> to get your own channel. controls are in <#${textChannel.id}>.`));
            } catch (err) {
                console.error('[voicemaster setup error]:', err);
                return message.reply(build.denyBox('setup failed', `failed to create channels: ${err.message}`));
            }
        }

        // ──────────────────────── 2. RESET ────────────────────────
        if (sub === 'reset') {
            if (!hasModPerms) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to reset voicemaster.'));
            }

            const setup = await db.getVoiceMasterSetup(message.guild.id);
            const activeVCs = await db.getAllActiveVCs(message.guild.id);

            let removedCount = 0;

            // Delete active temporary channels
            for (const avc of activeVCs) {
                const ch = message.guild.channels.cache.get(avc.channel_id);
                if (ch) {
                    await ch.delete('voicemaster reset').catch(() => {});
                    removedCount++;
                }
            }

            // Delete setup channels
            if (setup) {
                if (setup.interface_channel_id) {
                    const ic = message.guild.channels.cache.get(setup.interface_channel_id);
                    if (ic) await ic.delete('voicemaster reset').catch(() => {});
                }
                if (setup.vc_id) {
                    const vc = message.guild.channels.cache.get(setup.vc_id);
                    if (vc) await vc.delete('voicemaster reset').catch(() => {});
                }
                if (setup.counter_channel_id) {
                    const cc = message.guild.channels.cache.get(setup.counter_channel_id);
                    if (cc) await cc.delete('voicemaster reset').catch(() => {});
                }
                if (setup.category_id) {
                    const cat = message.guild.channels.cache.get(setup.category_id);
                    if (cat) await cat.delete('voicemaster reset').catch(() => {});
                }
            }

            await db.resetVoiceMaster(message.guild.id);

            return message.reply(build.approvedBox(`voicemaster is off. ${removedCount} temporary channels removed.`));
        }

        // ──────────────────────── 3. INTERFACE ────────────────────────
        if (sub === 'interface' || sub === 'panel') {
            if (!hasModPerms) {
                return message.reply(build.denyBox('permission denied', 'you need manage server permissions to post the voicemaster interface.'));
            }

            const payload = VoiceMasterHelper.buildInterfacePayload(message.guild);
            let sent;
            try {
                sent = await message.channel.send(payload.componentsV2);
            } catch (_) {
                sent = await message.channel.send(payload.embedFallback);
            }

            const setup = await db.getVoiceMasterSetup(message.guild.id);
            if (setup && sent) {
                await db.setVoiceMasterSetup(
                    message.guild.id,
                    setup.vc_id,
                    setup.category_id,
                    message.channel.id,
                    sent.id
                );
            }

            return message.reply(build.approvedBox(`posted voicemaster interface into <#${message.channel.id}>.`));
        }

        // ──────────────────────── 4. DEFAULTNAME ────────────────────────
        if (sub === 'defaultname' || sub === 'name') {
            const template = remainingArgs.join(' ').trim();

            if (!template) {
                await db.removeVCDefaultName(message.guild.id, message.author.id);
                return message.reply(build.approvedBox('reset your channel name template back to default.'));
            }

            if (template.length > 50) {
                return message.reply(build.warnBox('invalid template', 'channel name template must be 50 characters or less.'));
            }

            await db.setVCDefaultName(message.guild.id, message.author.id, template);
            return message.reply(build.approvedBox(`set your voice channel template to **${template}**.\n-# variables: \`{user}\`, \`{username}\``));
        }

        // ──────────────────────── 5. DEFAULTLIMIT ────────────────────────
        if (sub === 'defaultlimit' || sub === 'limit') {
            if (!remainingArgs.length) {
                return message.reply(build.warnBox('missing parameter', 'specify a limit between `0` (unlimited) and `99`.'));
            }

            const num = parseInt(remainingArgs[0], 10);
            if (isNaN(num) || num < 0 || num > 99) {
                return message.reply(build.warnBox('invalid limit', 'limit must be a number between `0` and `99`.'));
            }

            if (num === 0) {
                await db.removeVCDefaultLimit(message.guild.id, message.author.id);
                return message.reply(build.approvedBox('reset your default channel limit back to unlimited.'));
            } else {
                await db.setVCDefaultLimit(message.guild.id, message.author.id, num);
                return message.reply(build.approvedBox(`default user limit set to **${num}**.`));
            }
        }

        return await build.help(message, this);
    }
}

module.exports = VoiceMasterCommand;
