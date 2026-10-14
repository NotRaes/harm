const { EmbedBuilder } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

const SHOP_ITEMS = {
    padlock: {
        id: 'padlock',
        name: 'padlock',
        price: 2500,
        description: 'one-time wallet latch. breaks to block a robbery attempt even if your debit card is unlocked.',
        type: 'passive'
    },
    energy_drink: {
        id: 'energy_drink',
        name: 'energy drink',
        price: 1500,
        description: 'high-voltage caffeine shot. instantly clears your work shift cooldown so you can clock in again.',
        type: 'usable',
        use: async (db, guildId, userId) => {
            await db.setWorkLastWork(guildId, userId, 0);
            return 'slammed an energy drink — your **work shift cooldown** has been instantly reset.';
        }
    },
    fake_id: {
        id: 'fake_id',
        name: 'fake id',
        price: 3000,
        description: 'counterfeit state identity. automatically pardons police fines when caught attempting a crime.',
        type: 'passive'
    },
    black_card: {
        id: 'black_card',
        name: 'black card',
        price: 25000,
        description: 'prestigious titanium card tier upgrade. permanently increases your debit card bank capacity to $100,000.',
        type: 'usable',
        use: async (db, guildId, userId) => {
            await db.openCard(guildId, userId);
            await db.db.run(
                "UPDATE user_cards SET tier = 'black', bank_capacity = 100000 WHERE guild_id = ? AND user_id = ?",
                [guildId, userId]
            );
            return 'unlocked the **black card** tier. bank capacity permanently upgraded to **$100,000**.';
        }
    }
};

// Aliases for convenience
SHOP_ITEMS.lock = SHOP_ITEMS.padlock;
SHOP_ITEMS.drink = SHOP_ITEMS.energy_drink;
SHOP_ITEMS.energy = SHOP_ITEMS.energy_drink;
SHOP_ITEMS.fakeid = SHOP_ITEMS.fake_id;
SHOP_ITEMS.blackcard = SHOP_ITEMS.black_card;

class ShopCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'shop';
        this.aliases = ['market', 'store', 'buy'];
        this.description = 'browse and purchase utility tools and black market gear.';
        this.syntax = ',shop [buy <item> [amount]|use <item>|inventory]';
        this.example = ',shop | ,shop buy padlock | ,shop use energy_drink';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.subcommands = [
            'shop',
            'shop buy <item> [amount]',
            'shop use <item>',
            'shop inventory'
        ];
        this.extraArguments = 'subcommands: buy, use, inventory.';
        this.subcommandDetails = {
            buy: {
                description: 'purchase an item from the black market.',
                syntax: ',shop buy <item> [amount]',
                example: ',shop buy padlock'
            },
            use: {
                description: 'activate a consumable item from your inventory.',
                syntax: ',shop use <item>',
                example: ',shop use energy_drink'
            },
            inventory: {
                description: 'view your purchased items and gear.',
                syntax: ',shop inventory',
                example: ',shop inventory'
            }
        };
    }

    async execute(message, args) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        // Support invoking directly as ",buy"
        const isInvokedAsBuy = (message.content || '').trim().toLowerCase().startsWith(config.prefix + 'buy');
        if (isInvokedAsBuy) {
            const itemArg = args[0];
            const amountArg = args[1] || 1;
            return this.buyItem(message, itemArg, amountArg);
        }

        const sub = (args[0] || '').toLowerCase();

        if (sub === 'buy') {
            return this.buyItem(message, args[1], args[2] || 1);
        }

        if (sub === 'use') {
            return this.useItem(message, args[1]);
        }

        if (sub === 'inventory' || sub === 'inv' || sub === 'items') {
            return this.sendInventory(message);
        }

        // Default: display shop catalog
        return this.sendCatalog(message);
    }

    async sendCatalog(message) {
        const distinctKeys = ['padlock', 'energy_drink', 'fake_id', 'black_card'];
        const lines = distinctKeys.map((key, idx) => {
            const item = SHOP_ITEMS[key];
            const typeTag = item.type === 'usable' ? '`[usable]`' : '`[passive]`';
            return `\`${idx + 1}.\` **${item.name}** ─ \`$${item.price.toLocaleString()}\` ${typeTag}\n` +
                   `-# *${item.description}*`;
        });

        const desc = [
            `${config.emojis.leftwing || '✦'} **black market shop** ${config.emojis.rightwing || '✦'}`,
            `*curated street tools and account enhancements.*\n`,
            ...lines,
            '',
            `-# purchase: \`${config.prefix}shop buy <item_id> [amount]\` · use: \`${config.prefix}shop use <item_id>\``
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setDescription(desc);

        return message.reply({ embeds: [embed] });
    }

    async buyItem(message, itemArg, amountArg) {
        if (!itemArg) {
            return message.reply({
                embeds: [build.warn(message.author, `specify the item to purchase. syntax: \`${config.prefix}shop buy <item> [amount]\``)]
            });
        }

        const cleanKey = itemArg.toLowerCase().replace(/[\s-]/g, '_');
        const item = SHOP_ITEMS[cleanKey];
        if (!item) {
            return message.reply({
                embeds: [build.warn(message.author, `unknown item \`${itemArg}\`. check \`${config.prefix}shop\`.`)]
            });
        }

        const count = Math.max(1, parseInt(amountArg, 10) || 1);
        const totalCost = item.price * count;

        const db = message.client.db;
        const eco = await db.getEconomy(message.guild.id, message.author.id);

        if (eco.wallet < totalCost) {
            return message.reply({
                embeds: [build.deny(message.author, `insufficient wallet cash. purchasing \`${count}x ${item.name}\` requires **$${totalCost.toLocaleString()}** (you have **$${eco.wallet.toLocaleString()}**).`)]
            });
        }

        await db.addWallet(message.guild.id, message.author.id, -totalCost);
        await db.addItem(message.guild.id, message.author.id, item.id, count);
        await db.recordTransaction(message.guild.id, message.author.id, 'shop_buy', totalCost, `purchased ${count}x ${item.name}`);

        return message.reply({
            embeds: [build.approved(message.author, `purchased **${count}x ${item.name}** for **$${totalCost.toLocaleString()}**. check \`${config.prefix}shop inventory\`.`)]
        });
    }

    async useItem(message, itemArg) {
        if (!itemArg) {
            return message.reply({
                embeds: [build.warn(message.author, `specify the item to use. syntax: \`${config.prefix}shop use <item>\``)]
            });
        }

        const cleanKey = itemArg.toLowerCase().replace(/[\s-]/g, '_');
        const item = SHOP_ITEMS[cleanKey];
        if (!item) {
            return message.reply({
                embeds: [build.warn(message.author, `unknown item \`${itemArg}\`. check \`${config.prefix}shop\`.`)]
            });
        }

        if (item.type !== 'usable' || !item.use) {
            return message.reply({
                embeds: [build.warn(message.author, `**${item.name}** is a passive protection item and activates automatically when needed.`)]
            });
        }

        const db = message.client.db;
        const owned = await db.getItem(message.guild.id, message.author.id, item.id);
        if (owned <= 0) {
            return message.reply({
                embeds: [build.deny(message.author, `you do not have any **${item.name}** in your inventory.`)]
            });
        }

        await db.removeItem(message.guild.id, message.author.id, item.id, 1);
        const resultText = await item.use(db, message.guild.id, message.author.id);

        return message.reply({
            embeds: [build.approved(message.author, resultText)]
        });
    }

    async sendInventory(message) {
        const db = message.client.db;
        const items = await db.getInventory(message.guild.id, message.author.id);

        if (!items || items.length === 0) {
            return message.reply({
                embeds: [build.warn(message.author, `your inventory is empty. browse available tools with \`${config.prefix}shop\`.`)]
            });
        }

        const lines = items.map(i => {
            const item = SHOP_ITEMS[i.item_id] || { name: i.item_id.replace(/_/g, ' '), description: 'stored asset' };
            return `• **${item.name}** \`x${i.amount}\` — *${item.description}*`;
        });

        const desc = [
            `${config.emojis.leftwing || '✦'} **inventory — ${message.author.username.toLowerCase()}** ${config.emojis.rightwing || '✦'}`,
            `*active tools and stored assets.*\n`,
            ...lines,
            '',
            `-# use consumables: \`${config.prefix}shop use <item_id>\``
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setDescription(desc);

        return message.reply({ embeds: [embed] });
    }
}

module.exports = ShopCommand;
