class GuildMemberAddEvent {
    constructor(client) {
        this.name = 'guildMemberAdd';
        this.once = false;
        this.client = client;
    }

    async execute(member) {
        if (!member || !member.guild) return;
        const guild = member.guild;
        const db = this.client.db;
        const isBot = Boolean(member.user?.bot);

        // 1. Autorole assignment
        if (db) {
            try {
                const autoroles = db.getAutoroles(guild.id);
                if (autoroles && autoroles.length > 0 && guild.members?.me?.permissions?.has('ManageRoles')) {
                    const botHighest = guild.members.me.roles.highest.position;
                    const rolesToAdd = autoroles
                        .filter(ar => {
                            if (ar.targetType === 'all') return true;
                            if (ar.targetType === 'bots') return isBot;
                            return !isBot;
                        })
                        .map(ar => ar.roleId)
                        .filter(rId => {
                            const r = guild.roles.cache.get(rId);
                            return r && r.position < botHighest && !r.managed;
                        });

                    if (rolesToAdd.length > 0) {
                        await member.roles.add(rolesToAdd, 'harm autorole').catch(() => {});
                    }
                }
            } catch (_) {}
        }

        if (isBot) return;

        if (db) {
            await db.recordGuildMovement(guild.id, 'join').catch(() => {});
        }

        if (!guild.members?.me?.permissions?.has('ManageGuild')) return;

        try {
            const currentInvites = await guild.invites.fetch().catch(() => null);
            if (!currentInvites) return;

            const cached = this.client.invites?.get(guild.id) || new Map();
            let usedInvite = null;
            let inviter = null;

            for (const [code, inv] of currentInvites) {
                const prev = cached.get(code) || 0;
                if (inv.uses > prev) {
                    usedInvite = inv;
                    inviter = inv.inviter;
                    break;
                }
            }

            const updatedMap = new Map();
            for (const [code, inv] of currentInvites) {
                updatedMap.set(code, inv.uses || 0);
            }
            if (!this.client.invites) this.client.invites = new Map();
            this.client.invites.set(guild.id, updatedMap);

            if (inviter && inviter.id !== member.id && db) {
                const isFake = (Date.now() - member.user.createdTimestamp) < (24 * 60 * 60 * 1000);
                await db.recordInviteJoin(guild.id, member.id, inviter.id, usedInvite?.code, isFake);
            }
        } catch (_) {}
    }
}

module.exports = GuildMemberAddEvent;
