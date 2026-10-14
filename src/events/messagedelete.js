class MessageDeleteEvent {
    constructor(client) {
        this.name = 'messageDelete';
        this.once = false;
        this.client = client;
    }

    async execute(message) {
        if (!message || !message.channelId) return;
        if (message.author?.bot) return;
        if (this.client.db && message.guildId && !this.client.db.isSnipeEnabled(message.guildId)) return;
        // Don't snipe empty non-attachment messages
        if (!message.content && (!message.attachments || message.attachments.size === 0) && (!message.stickers || message.stickers.size === 0)) return;

        if (!this.client.snipes) this.client.snipes = new Map();

        const channelSnipes = this.client.snipes.get(message.channelId) || [];

        const snipeData = {
            content: message.content || null,
            author: message.author ? {
                id: message.author.id,
                tag: message.author.tag,
                username: message.author.username,
                avatarURL: message.author.displayAvatarURL({ dynamic: true, size: 512 })
            } : null,
            attachments: message.attachments ? Array.from(message.attachments.values()).map(a => ({
                url: a.url,
                proxyURL: a.proxyURL,
                name: a.name,
                contentType: a.contentType
            })) : [],
            stickers: message.stickers ? Array.from(message.stickers.values()).map(s => ({
                id: s.id,
                name: s.name,
                url: s.url
            })) : [],
            createdAt: message.createdTimestamp || Date.now(),
            deletedAt: Date.now()
        };

        channelSnipes.unshift(snipeData);
        if (channelSnipes.length > 500) channelSnipes.pop();

        this.client.snipes.set(message.channelId, channelSnipes);
    }
}

module.exports = MessageDeleteEvent;
