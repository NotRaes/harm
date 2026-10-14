const config = require('../config.js');
const build = require('../structures/utils/builder.js');

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const days = Math.floor(hr / 24);
  return `${days}d`;
}

class MessageCreateEvent {
  constructor(client) {
    this.name = 'messageCreate';
    this.once = false;
    this.client = client;
  }

  async execute(message) {
    if (!message || !message.author) return;
    if (message.author.id === this.client.user?.id) return;
    if (message.author.bot) return;

    // AFK System: check author return & mentions
    const db = this.client.db;
    if (db && typeof db.getAfk === 'function') {
      const authorAfk = db.getAfk(message.author.id);
      const prefix = (message.guild && db.getGuildPrefix) ? (db.getGuildPrefix(message.guild.id) || config.prefix || ',') : (config.prefix || ',');
      const isAfkCmd = message.content?.trim().toLowerCase().startsWith(`${prefix}afk`);

      if (authorAfk && !isAfkCmd && (Date.now() - authorAfk.timestamp > 3500)) {
        await db.removeAfk(message.author.id);
        const elapsed = Date.now() - authorAfk.timestamp;
        const timeStr = formatDuration(elapsed);
        message.reply({
          embeds: [build.approved(message.author, `welcome back, i removed your afk. (you were away for **${timeStr}**)`)]
        }).catch(() => {});
      }

      // Check if any mentioned users are AFK
      if (message.mentions?.users?.size > 0 && !message.content?.startsWith(prefix)) {
        for (const [userId, user] of message.mentions.users) {
          if (userId === message.author.id || user.bot) continue;
          const targetAfk = db.getAfk(userId);
          if (targetAfk) {
            const relTime = `<t:${Math.floor(targetAfk.timestamp / 1000)}:R>`;
            message.reply({
              embeds: [build.warn(user, `<@${userId}> is afk: **${targetAfk.reason}** — ${relTime}`)]
            }).catch(() => {});
            break;
          }
        }
      }
    }

    // Command handler dispatch (non-blocking for gateway loop)
    if (this.client.commandHandler && typeof this.client.commandHandler.handleMessage === 'function') {
      this.client.commandHandler.handleMessage(message).catch(err => {
        console.error('[messageCreate dispatch]', err);
      });
    }
  }
}

module.exports = MessageCreateEvent;
