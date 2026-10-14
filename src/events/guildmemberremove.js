class GuildMemberRemoveEvent {
    constructor(client) {
        this.name = 'guildMemberRemove';
        this.once = false;
        this.client = client;
    }

    async execute(member) {
        if (!member || !member.guild || member.user?.bot) return;
        const db = this.client.db;
        if (db) {
            await db.recordGuildMovement(member.guild.id, 'leave').catch(() => {});
            await db.recordInviteLeave(member.guild.id, member.id).catch(() => {});
        }
    }
}

module.exports = GuildMemberRemoveEvent;
