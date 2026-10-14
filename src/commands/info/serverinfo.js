const { ChannelType } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

const VERIFICATION_MAP = {
    0: 'none',
    1: 'low',
    2: 'medium',
    3: 'high',
    4: 'highest'
};

class ServerInfoCommand {
    constructor() {
        this.name = 'serverinfo';
        this.aliases = ['si', 'guildinfo'];
        this.description = 'display server information and metrics.';
        this.cooldown = 2;
    }

    async execute(message, args) {
        const guild = message.guild;
        if (!guild) {
            return message.reply(build.warnBox('nothing found', 'this command must be used in a server.'));
        }

        const createdTs = Math.floor(guild.createdTimestamp / 1000);
        const joinedTs = guild.joinedTimestamp ? Math.floor(guild.joinedTimestamp / 1000) : null;
        const totalMembers = guild.memberCount;

        // Members breakdown
        const cachedMembers = guild.members.cache;
        const bots = cachedMembers.filter(m => m.user?.bot).size;
        const humans = Math.max(0, totalMembers - bots);
        const online = cachedMembers.filter(m => m.presence && m.presence.status !== 'offline').size;

        // Channels breakdown
        const channels = guild.channels.cache;
        const textCount = channels.filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement).size;
        const voiceCount = channels.filter(c => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice).size;
        const categoryCount = channels.filter(c => c.type === ChannelType.GuildCategory).size;
        const totalChannels = channels.filter(c => c.type !== ChannelType.GuildCategory).size;

        // Roles & Security
        const rolesCount = Math.max(0, guild.roles.cache.size - 1);
        const verifLevel = VERIFICATION_MAP[guild.verificationLevel] || 'None';
        const boostTier = guild.premiumTier || 0;
        const boosts = guild.premiumSubscriptionCount || 0;
        const vanity = guild.vanityURLCode ? `discord.gg/${guild.vanityURLCode}` : 'none';
        const emojisCount = guild.emojis.cache.size;
        const stickersCount = guild.stickers.cache.size;

        // Movement from database
        let movement = { todayJoins: 0, todayLeaves: 0, weekJoins: 0, weekLeaves: 0 };
        if (message.client.db?.getGuildMovement) {
            movement = await message.client.db.getGuildMovement(guild.id);
        }

        const todayNet = movement.todayJoins - movement.todayLeaves;
        const weekNet = movement.weekJoins - movement.weekLeaves;

        // Emojis from config with clean unicode fallbacks
        const eCalendar = config.emojis?.calendar || '🗓️';
        const eIdcard = config.emojis?.idcard || '🪪';
        const eMembers = config.emojis?.members || '👥';
        const eChannels = config.emojis?.channels || '🖥️';
        const eRoles = config.emojis?.roles || '🛡️';

        const lines = [
            `**owner** <@${guild.ownerId}>`,
            `${eCalendar} **created** <t:${createdTs}:D>`,
            `${eIdcard} **id** \`${guild.id}\``,
            `${eMembers} **members · ${totalMembers}** ${humans} people · ${bots} bots · ${online} online\n`,
            `**recent movement**`,
            `today: **+${movement.todayJoins}** joined, **-${movement.todayLeaves}** left (net ${todayNet >= 0 ? '+' : ''}${todayNet})`,
            `this week: **+${movement.weekJoins}** joined, **-${movement.weekLeaves}** left (net ${weekNet >= 0 ? '+' : ''}${weekNet})\n`,
            `${eChannels} **channels · ${totalChannels}** ${textCount} text · ${voiceCount} voice · ${categoryCount} categories`,
            `${eRoles} **roles** ${rolesCount}`,
            `**emojis** ${emojisCount} · ${stickersCount} stickers`,
            `**boosts** ${boosts} · tier ${boostTier}`,
            `**verification** ${(verifLevel || 'none').toLowerCase()}`,
            `**vanity** ${vanity.toLowerCase()}`
        ];

        if (joinedTs) {
            lines.push(`\n-# movement counts start from when harm joined · <t:${joinedTs}:R>`);
        }

        const bannerAttachment = build.getAssetAttachment('info.png');
        const card = new build.V2()
            .setHeader(guild.name.toLowerCase())
            .addDivider()
            .addText(lines.join('\n'));

        if (bannerAttachment) {
            card.setBanner(bannerAttachment);
        }

        return await card.send(message);
    }
}

module.exports = ServerInfoCommand;
