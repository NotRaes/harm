const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

const COOLDOWN_SECONDS = 10 * 60; // 10 minutes

const SUCCESS_SCENARIOS = [
    'hacked an unattended crypto atm kiosk',
    'cloned an offshore debit card stripe',
    'counterfeited vip event backstage passes',
    'fenced stolen luxury timepieces in an alley',
    'intercepted an untracked courier drop',
    'skimmed fleet card numbers at the highway depot',
    'breached a luxury vehicle alarm and pulled the sound system',
    'swapped barcode tags on designer electronics'
];

const FAIL_SCENARIOS = [
    'tamper with a biometric storefront scanner',
    'pickpocket a plainclothes security officer',
    'siphon fuel behind the industrial warehouse',
    'skim credentials at an alarmed terminal',
    'fence contraband outside the central transit station'
];

class CrimeCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'crime';
        this.aliases = ['hustle', 'felony'];
        this.description = 'undertake high-risk street crimes for quick cash payouts.';
        this.syntax = ',crime';
        this.example = ',crime';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.extraArguments = 'high risk of fines if security catches you. a fake id from the shop protects you.';
    }

    async execute(message) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        const now = Math.floor(Date.now() / 1000);
        const lastCrime = await db.getEcoCooldown(message.guild.id, message.author.id, 'crime');

        if (lastCrime > 0) {
            const nextTimestamp = now + lastCrime;
            return message.reply({
                embeds: [build.warn(message.author, `the heat is still on. next crime opens <t:${nextTimestamp}:R> (<t:${nextTimestamp}:t>).`)]
            });
        }

        const eco = await db.getEconomy(message.guild.id, message.author.id);
        const minCash = 300;
        if (eco.wallet < minCash) {
            return message.reply({
                embeds: [build.deny(message.author, `you need at least **$${minCash.toLocaleString()}** in your wallet in case you get fined.`)]
            });
        }

        // Set 10-minute cooldown in economy_cooldowns
        await db.db.run(`
            INSERT INTO economy_cooldowns (guild_id, user_id, command, timestamp)
            VALUES (?, ?, 'crime', ?)
            ON CONFLICT(guild_id, user_id, command) DO UPDATE SET timestamp = excluded.timestamp
        `, [message.guild.id, message.author.id, now + COOLDOWN_SECONDS]);

        // 65% success rate
        const success = Math.random() < 0.65;

        if (success) {
            const reward = Math.floor(Math.random() * 1601) + 1200; // $1,200 - $2,800
            const scenario = SUCCESS_SCENARIOS[Math.floor(Math.random() * SUCCESS_SCENARIOS.length)];

            await db.addWallet(message.guild.id, message.author.id, reward);
            await db.recordTransaction(message.guild.id, message.author.id, 'crime_reward', reward, scenario);

            return message.reply({
                embeds: [build.approved(message.author, `you ${scenario}. pulled in **$${reward.toLocaleString()}** in cash.`)]
            });
        } else {
            const failScenario = FAIL_SCENARIOS[Math.floor(Math.random() * FAIL_SCENARIOS.length)];

            // Check if user has a fake id in inventory to shield fine
            const fakeIdCount = await db.getItem(message.guild.id, message.author.id, 'fake_id');
            if (fakeIdCount > 0) {
                await db.removeItem(message.guild.id, message.author.id, 'fake_id', 1);
                return message.reply({
                    embeds: [build.warn(message.author, `you were cornered attempting to ${failScenario}, but your **fake id** shielded you from police fines.`)]
                });
            }

            const fine = Math.min(eco.wallet, Math.floor(Math.random() * 501) + 400); // $400 - $900
            await db.addWallet(message.guild.id, message.author.id, -fine);
            await db.recordTransaction(message.guild.id, message.author.id, 'crime_fine', fine, 'police bail fine');

            return message.reply({
                embeds: [build.deny(message.author, `you were caught trying to ${failScenario}! paid a **$${fine.toLocaleString()}** fine to evade custody.`)]
            });
        }
    }
}

module.exports = CrimeCommand;
