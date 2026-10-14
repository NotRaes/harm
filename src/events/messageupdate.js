class MessageUpdateEvent {
    constructor(client) {
        this.name = 'messageUpdate';
        this.once = false;
        this.client = client;
    }

    async execute(oldMessage, newMessage) {
        if (!oldMessage || !newMessage || !newMessage.channelId) return;
        if (newMessage.author?.bot) return;
        if (this.client.db && newMessage.guildId && !this.client.db.isSnipeEnabled(newMessage.guildId)) return;
        if (!oldMessage.content || !newMessage.content) return;
        if (oldMessage.content === newMessage.content) return;

        if (!this.client.editSnipes) this.client.editSnipes = new Map();

        const channelEdits = this.client.editSnipes.get(newMessage.channelId) || [];

        const editData = {
            oldContent: oldMessage.content,
            newContent: newMessage.content,
            author: newMessage.author ? {
                id: newMessage.author.id,
                tag: newMessage.author.tag,
                username: newMessage.author.username,
                avatarURL: newMessage.author.displayAvatarURL({ dynamic: true, size: 512 })
            } : null,
            createdAt: oldMessage.createdTimestamp || Date.now(),
            editedAt: newMessage.editedTimestamp || Date.now()
        };

        channelEdits.unshift(editData);
        if (channelEdits.length > 500) channelEdits.pop();

        this.client.editSnipes.set(newMessage.channelId, channelEdits);
    }
}

module.exports = MessageUpdateEvent;
