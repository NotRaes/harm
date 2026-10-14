const {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    EmbedBuilder
} = require('discord.js');
const build = require('../builder.js');
const config = require('../../../config.js');

const ITEMS = {
    // Tools
    fishing_rod: { id: 'fishing_rod', name: 'fishing rod', emoji: '🎣', price: 500, type: 'tool', description: 'basic rod to catch freshwater and exotic fish.' },
    pickaxe: { id: 'pickaxe', name: 'iron pickaxe', emoji: '⛏️', price: 800, type: 'tool', description: 'sturdy iron pickaxe to mine cavern ores.' },
    hunting_rifle: { id: 'hunting_rifle', name: 'hunting rifle', emoji: '🏹', price: 1000, type: 'tool', description: 'precision rifle for forest wildlife.' },
    shovel: { id: 'shovel', name: 'trench shovel', emoji: '🦯', price: 400, type: 'tool', description: 'metal spade to unearth hidden relics and fossils.' },

    // Defenses & Buffs
    padlock: { id: 'padlock', name: 'padlock', emoji: '🔒', price: 1200, type: 'defense', usable: true, description: 'protects your wallet from 1 rob attempt.' },
    luck_charm: { id: 'luck_charm', name: 'luck charm', emoji: '🍀', price: 2500, type: 'buff', usable: true, duration: 3600, description: 'boosts gambling & job payouts for 1 hour.' },
    energy_drink: { id: 'energy_drink', name: 'energy drink', emoji: '⚡', price: 800, type: 'buff', usable: true, duration: 1800, description: 'cuts job cooldowns in half for 30 minutes.' },
    fake_id: { id: 'fake_id', name: 'fake id', emoji: '💳', price: 1500, type: 'buff', usable: true, duration: 3600, description: 'reduces police fine chance during crimes.' },

    // Fish Loot
    common_fish: { id: 'common_fish', name: 'common fish', emoji: '🐟', sell: 50, type: 'loot', description: 'freshwater trout.' },
    rare_fish: { id: 'rare_fish', name: 'rare fish', emoji: '🐠', sell: 250, type: 'loot', description: 'tropical angel fish.' },
    exotic_fish: { id: 'exotic_fish', name: 'exotic fish', emoji: '🐡', sell: 1200, type: 'loot', description: 'rare glowing pufferfish.' },
    golden_fish: { id: 'golden_fish', name: 'golden fish', emoji: '✨🐟', sell: 5000, type: 'loot', description: 'rare gilded fish.' },

    // Mining Loot
    iron_ore: { id: 'iron_ore', name: 'iron ore', emoji: '🪨', sell: 80, type: 'loot', description: 'raw iron ore chunks.' },
    gold_ore: { id: 'gold_ore', name: 'gold ore', emoji: '🧈', sell: 300, type: 'loot', description: 'glittering gold veins.' },
    diamond: { id: 'diamond', name: 'diamond', emoji: '💎', sell: 1500, type: 'loot', description: 'sparkling pure diamond.' },
    emerald: { id: 'emerald', name: 'emerald', emoji: '❇️', sell: 3500, type: 'loot', description: 'deep green royal gem.' },
    obsidian: { id: 'obsidian', name: 'obsidian', emoji: '🔮', sell: 8000, type: 'loot', description: 'dense volcanic dark glass.' },

    // Hunting Loot
    rabbit_pelt: { id: 'rabbit_pelt', name: 'rabbit pelt', emoji: '🐇', sell: 60, type: 'loot', description: 'soft white fur.' },
    deer_antler: { id: 'deer_antler', name: 'deer antler', emoji: '🦌', sell: 320, type: 'loot', description: 'trophy antlers.' },
    bear_pelt: { id: 'bear_pelt', name: 'bear pelt', emoji: '🐻', sell: 1400, type: 'loot', description: 'heavy grizzly pelt.' },
    dragon_scale: { id: 'dragon_scale', name: 'dragon scale', emoji: '🐉', sell: 9500, type: 'loot', description: 'ancient impenetrable reptile scale.' },

    // Digging Loot
    dirt: { id: 'dirt', name: 'clump of dirt', emoji: '🟤', sell: 5, type: 'loot', description: 'just damp soil.' },
    ancient_coin: { id: 'ancient_coin', name: 'ancient coin', emoji: '🪙', sell: 200, type: 'loot', description: 'dusty imperial coin.' },
    fossil: { id: 'fossil', name: 'fossil', emoji: '🦴', sell: 900, type: 'loot', description: 'prehistoric bone fragment.' },
    relic: { id: 'relic', name: 'relic', emoji: '🏺', sell: 4500, type: 'loot', description: 'museum-grade golden artifact.' },

    // Luxury / Flex Items
    ring: { id: 'ring', name: 'diamond ring', emoji: '💍', price: 20000, sell: 10000, type: 'luxury', description: 'sparkling diamond ring for flex.' },
    sports_car: { id: 'sports_car', name: 'sports car', emoji: '🏎️', price: 100000, sell: 50000, type: 'luxury', description: 'sleek exotic supercar.' },
    yacht: { id: 'yacht', name: 'superyacht', emoji: '🛥️', price: 350000, sell: 175000, type: 'luxury', description: 'luxury private superyacht.' },
    penthouse: { id: 'penthouse', name: 'penthouse', emoji: '🏢', price: 1500000, sell: 750000, type: 'luxury', description: 'skyline luxury high-rise property.' },

    // Lootboxes & Crates
    common_box: { id: 'common_box', name: 'common crate', emoji: '📦', price: 1500, type: 'box', usable: true, description: 'starter supply crate with coins and basic materials.' },
    meme_box: { id: 'meme_box', name: 'meme crate', emoji: '🎁', price: 4500, type: 'box', usable: true, description: 'dank crate containing meme items, buffs, and coins.' },
    gold_box: { id: 'gold_box', name: 'gold crate', emoji: '🧰', price: 15000, type: 'box', usable: true, description: 'high-tier vault crate with rare ores, rings, and fortune.' },
    god_box: { id: 'god_box', name: 'god box', emoji: '✨📦', price: 75000, type: 'box', usable: true, description: 'ultimate high-tier crate with immense payouts and trophies.' },

    // Pet Supplies
    pet_food: { id: 'pet_food', name: 'pet kibble', emoji: '🍖', price: 200, type: 'pet_item', usable: true, description: 'nutritious chow to feed and replenish pet hunger.' },
    pet_collar: { id: 'pet_collar', name: 'spiked collar', emoji: '📿', price: 2000, type: 'pet_item', description: 'boosts pet attack power and guard defense against robbers.' },

    // Social, Streaks & Special Gear
    marriage_ring: { id: 'marriage_ring', name: 'wedding ring', emoji: '💍', price: 30000, type: 'social', description: 'required to propose and marry another member.' },
    streak_freeze: { id: 'streak_freeze', name: 'streak freeze', emoji: '🧊', price: 5000, type: 'buff', usable: true, description: 'safeguards your daily streak if you miss a day.' },
    compass: { id: 'compass', name: 'astral compass', emoji: '🧭', price: 3500, type: 'tool', description: 'essential navigation gear for adventures.' },
    space_suit: { id: 'space_suit', name: 'hazard suit', emoji: '🥼', price: 8000, type: 'tool', description: 'protects against hazards during high-risk expeditions.' },
    camera: { id: 'camera', name: '4k camera', emoji: '📹', price: 6000, type: 'tool', description: 'boosts viewer retention and live stream donations.' },

    // Crafted Masterpieces & Trophies
    dragon_shield: { id: 'dragon_shield', name: 'dragon shield', emoji: '🛡️', sell: 40000, type: 'trophy', description: 'forged from 10 dragon scales and obsidian.' },
    aquarium: { id: 'aquarium', name: 'neon aquarium', emoji: '🫧', sell: 25000, type: 'trophy', description: 'exquisite tank showcasing rare exotic specimens.' },
    crown: { id: 'crown', name: 'imperial crown', emoji: '👑', sell: 150000, type: 'trophy', description: 'ornate crown adorned with flawless diamonds.' }
};

class EconomyHelper {
    static get ITEMS() {
        return ITEMS;
    }

    static getItem(id) {
        if (!id) return null;
        const clean = String(id).toLowerCase().replace(/\s+/g, '_');
        if (ITEMS[clean]) return ITEMS[clean];
        return Object.values(ITEMS).find(i => i.name.toLowerCase() === clean.replace(/_/g, ' ') || i.id.toLowerCase() === clean);
    }

    static formatCoins(amount) {
        const val = Math.max(0, parseInt(amount, 10) || 0);
        return `\`${val.toLocaleString('en-US')}\` coins`;
    }

    static formatRawCoins(amount) {
        const val = parseInt(amount, 10) || 0;
        return `\`${val.toLocaleString('en-US')}\``;
    }

    static parseAmount(str, maxAmount = 0) {
        if (!str) return null;
        const s = String(str).toLowerCase().trim();
        if (s === 'all' || s === 'max') return maxAmount;
        if (s === 'half') return Math.floor(maxAmount / 2);

        // Check for k / m / b suffixes
        const match = s.match(/^(\d+(\.\d+)?)\s*([kmb])?$/i);
        if (!match) return null;

        let num = parseFloat(match[1]);
        const suffix = match[3]?.toLowerCase();
        if (suffix === 'k') num *= 1000;
        else if (suffix === 'm') num *= 1000000;
        else if (suffix === 'b') num *= 1000000000;

        num = Math.floor(num);
        if (isNaN(num) || num <= 0) return null;
        return num;
    }

    static async checkCooldown(db, guildId, userId, command, baseSeconds) {
        if (!db) return { onCooldown: false, remaining: 0 };
        // Check energy drink buff (cuts cooldown by 50%)
        const energyBuff = await db.getActiveItem(guildId, userId, 'energy_drink');
        const duration = energyBuff ? Math.max(1, Math.floor(baseSeconds / 2)) : baseSeconds;

        const remaining = await db.getEcoCooldown(guildId, userId, command);
        if (remaining > 0) {
            return {
                onCooldown: true,
                remaining,
                text: `please wait \`${remaining}s\` before using \`,${command}\` again.`
            };
        }
        return { onCooldown: false, remaining: 0, set: () => db.setEcoCooldown(guildId, userId, command, duration) };
    }

    static async sendEconomyNotice(message, type, title, text) {
        if (type === 'approve' || type === 'approved') {
            return message.reply(build.approvedBox(title, text));
        } else if (type === 'warn') {
            return message.reply(build.warnBox(title, text));
        } else {
            return message.reply(build.denyBox(title, text));
        }
    }

    static async sendEconomyCard(message, {
        title,
        lines = [],
        thumbnail = null,
        banner = 'economy.png',
        buttons = null,
        allowedMentions = { repliedUser: false }
    }) {
        const defaultBanner = banner || 'economy.png';
        const bannerAttachment = build.getAssetAttachment(defaultBanner) || build.getAssetAttachment('economy.png');
        const files = bannerAttachment ? [bannerAttachment] : [];

        const accentColor = typeof config.colors.c === 'string'
            ? parseInt(config.colors.c.replace('#', ''), 16)
            : (config.colors.c || 0x2b2d31);

        const bodyContent = Array.isArray(lines) ? lines.join('\n') : String(lines);

        const container = new ContainerBuilder();
        container.setAccentColor(accentColor);

        const section = new SectionBuilder().addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                (title ? `### ${title}\n` : '') + bodyContent
            )
        );

        if (thumbnail) {
            section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbnail));
        }

        container.addSectionComponents(section);

        // Bottom-anchored glowing banner
        if (bannerAttachment) {
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(`attachment://${bannerAttachment.name}`)
                )
            );
        }

        // Optional buttons action row with divider
        if (buttons) {
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );
            container.addActionRowComponents(buttons);
        }

        if (typeof message.update === 'function' && (message.isButton?.() || message.isStringSelectMenu?.())) {
            try {
                return await message.update({
                    components: [container],
                    files,
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (_) {
                const fallbackEmbed = new EmbedBuilder()
                    .setColor(config.colors.c || '#2b2d31')
                    .setDescription((title ? `### ${title}\n` : '') + bodyContent);

                if (thumbnail) fallbackEmbed.setThumbnail(thumbnail);
                if (bannerAttachment) fallbackEmbed.setImage(`attachment://${bannerAttachment.name}`);

                const payload = { embeds: [fallbackEmbed], files };
                if (buttons) payload.components = [buttons];
                return await message.update(payload).catch(() => {});
            }
        }

        try {
            return await message.reply({
                components: [container],
                files,
                allowedMentions,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            const fallbackEmbed = new EmbedBuilder()
                .setColor(config.colors.c || '#2b2d31')
                .setDescription((title ? `### ${title}\n` : '') + bodyContent);

            if (thumbnail) fallbackEmbed.setThumbnail(thumbnail);
            if (bannerAttachment) fallbackEmbed.setImage(`attachment://${bannerAttachment.name}`);

            const payload = {
                embeds: [fallbackEmbed],
                files,
                allowedMentions
            };
            if (buttons) payload.components = [buttons];

            return await message.reply(payload).catch(() => {});
        }
    }
}

module.exports = EconomyHelper;
