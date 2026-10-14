const fs = require('fs');
const path = require('path');

class eventHandler {
    constructor(bot, eventsPath) {
        this.bot = bot;
        this.eventsPath = eventsPath;
    }

    loadEvents() {
        const categories = fs.readdirSync(this.eventsPath);
        for (const fileOrDir of categories) {
            const fullPath = path.join(this.eventsPath, fileOrDir);
            if (fs.statSync(fullPath).isDirectory()) continue;
            if (fileOrDir.endsWith('.js')) {
                const EventClass = require(path.resolve(fullPath));
                const event = new EventClass(this.bot);
                if (event.once) {
                    this.bot.once(event.name, async (...args) => {
                        try {
                            await event.execute(...args);
                        } catch (err) {
                            const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
                            if (errMsg && errMsg !== '{}') console.error(`• ERR: [Event: ${event.name}]`, errMsg);
                        }
                    });
                } else {
                    this.bot.on(event.name, async (...args) => {
                        try {
                            await event.execute(...args);
                        } catch (err) {
                            const errMsg = err instanceof Error ? err.message : JSON.stringify(err);
                            if (errMsg && errMsg !== '{}') console.error(`• ERR: [Event: ${event.name}]`, errMsg);
                        }
                    });
                }
            }
        }
    }
}

module.exports = eventHandler;