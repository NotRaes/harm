const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

const COOLDOWN_SECONDS = 15 * 60; // 15 minutes

const EXP_THRESHOLDS = [0, 100, 250, 500, 1000];
const LEVEL_MULTIPLIERS = [1.00, 1.25, 1.55, 1.90, 2.30];

const WORK_ROLES = {
    hustler: {
        id: 'hustler',
        title: 'street hustler',
        roleName: 'Street Hustler',
        requiredShifts: 0,
        baseMin: 500,
        baseMax: 850,
        description: 'run street errands, flip thrifted gear, and hustle odd gigs.',
        ranks: ['novice flipper', 'street hustler', 'urban vendor', 'neighborhood plug', 'syndicate boss']
    },
    barista: {
        id: 'barista',
        title: 'cafe barista',
        roleName: 'Cafe Barista',
        requiredShifts: 0,
        baseMin: 650,
        baseMax: 950,
        description: 'pull espresso shots, craft pour-overs, and manage morning rushes.',
        ranks: ['bar trainee', 'line barista', 'latte artist', 'head roaster', 'cafe owner']
    },
    mod: {
        id: 'mod',
        title: 'discord mod',
        roleName: 'Discord Mod',
        requiredShifts: 10,
        baseMin: 900,
        baseMax: 1350,
        description: 'moderate chat rooms, ban raid bots, and manage permissions.',
        ranks: ['chat trial', 'junior mod', 'senior mod', 'head admin', 'community manager']
    },
    dev: {
        id: 'dev',
        title: 'software dev',
        roleName: 'Software Dev',
        requiredShifts: 25,
        baseMin: 1250,
        baseMax: 1900,
        description: 'squash memory leaks, build backend APIs, and ship microservices.',
        ranks: ['junior scripter', 'frontend dev', 'backend engineer', 'tech lead', 'chief technology officer']
    },
    trader: {
        id: 'trader',
        title: 'quant trader',
        roleName: 'Quant Trader',
        requiredShifts: 50,
        baseMin: 1600,
        baseMax: 2500,
        description: 'execute algorithmic arbitrage, balance liquidity, and manage portfolios.',
        ranks: ['floor clerk', 'quant analyst', 'desk trader', 'portfolio manager', 'hedge fund partner']
    },
    doctor: {
        id: 'doctor',
        title: 'surgeon',
        roleName: 'Surgeon',
        requiredShifts: 100,
        baseMin: 2200,
        baseMax: 3500,
        description: 'perform complex surgeries, emergency trauma triage, and save lives.',
        ranks: ['resident intern', 'clinical surgeon', 'chief physician', 'neurosurgeon', 'medical director']
    }
};

// Aliases
WORK_ROLES.developer = WORK_ROLES.dev;
WORK_ROLES.engineer = WORK_ROLES.dev;
WORK_ROLES.coder = WORK_ROLES.dev;
WORK_ROLES.moderator = WORK_ROLES.mod;
WORK_ROLES.admin = WORK_ROLES.mod;
WORK_ROLES.surgeon = WORK_ROLES.doctor;
WORK_ROLES.medic = WORK_ROLES.doctor;
WORK_ROLES.cook = WORK_ROLES.barista;
WORK_ROLES.street = WORK_ROLES.hustler;

function resolveRole(key) {
    if (!key) return WORK_ROLES.hustler;
    const clean = key.toLowerCase();
    return WORK_ROLES[clean] || WORK_ROLES.hustler;
}

function getLevelFromExp(exp) {
    if (exp >= 1000) return 5;
    if (exp >= 500) return 4;
    if (exp >= 250) return 3;
    if (exp >= 100) return 2;
    return 1;
}

function makeExpBar(exp, level) {
    if (level >= 5) return '`[██████████]` *(max rank)*';
    const currentBase = EXP_THRESHOLDS[level - 1];
    const target = EXP_THRESHOLDS[level];
    const range = target - currentBase;
    const progress = Math.max(0, Math.min(range, exp - currentBase));
    const filled = Math.round((progress / range) * 10);
    const empty = 10 - filled;
    return `\`[${'█'.repeat(filled)}${'░'.repeat(empty)}]\` *(${exp}/${target} exp)*`;
}

class WorkCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'work';
        this.aliases = ['job', 'shift'];
        this.description = 'clock into your career shift to earn wages and climb the corporate ladder.';
        this.syntax = ',work [roles|apply|profile]';
        this.example = ',work | ,work roles | ,work apply dev';
        this.category = 'economy';
        this.cooldown = 2;
        this.permissions = [];
        this.subcommands = [
            'work',
            'work roles',
            'work apply <role>',
            'work profile [@user]'
        ];
        this.extraArguments = 'subcommands: roles, apply, profile.';
        this.subcommandDetails = {
            roles: {
                description: 'view all available work roles, shift requirements, and wage scales.',
                syntax: ',work roles',
                example: ',work roles'
            },
            apply: {
                description: 'apply and switch to an unlocked career role.',
                syntax: ',work apply <role>',
                example: ',work apply dev'
            },
            profile: {
                description: 'view your career statistics, rank, level, and active streak.',
                syntax: ',work profile [@user]',
                example: ',work profile'
            }
        };
    }

    async execute(message, args) {
        const db = message.client.db;
        if (!db) {
            return message.reply({ embeds: [build.deny(message.author, 'database is not initialized.')] });
        }

        const sub = (args[0] || '').toLowerCase();

        if (sub === 'roles' || sub === 'list' || sub === 'jobs') {
            return this.sendRolesList(message);
        }

        if (sub === 'apply' || sub === 'switch') {
            return this.applyRole(message, args[1]);
        }

        if (sub === 'profile' || sub === 'dossier' || sub === 'stats') {
            let target = message.author;
            if (args[1]) {
                const mention = message.mentions.users.first();
                if (mention) target = mention;
                else {
                    const fetched = await message.client.users.fetch(args[1]).catch(() => null);
                    if (fetched) target = fetched;
                }
            }
            return this.sendProfile(message, target);
        }

        // Default 1-click work shift
        return this.clockIn(message);
    }

    async clockIn(message) {
        const db = message.client.db;
        const work = await db.getWork(message.guild.id, message.author.id);
        const now = Math.floor(Date.now() / 1000);
        const elapsed = now - (work.last_work || 0);

        // Cooldown check
        if (elapsed < COOLDOWN_SECONDS) {
            const nextTimestamp = (work.last_work || 0) + COOLDOWN_SECONDS;
            return message.reply({
                embeds: [build.warn(message.author, `your shift cooldown is active. next shift opens <t:${nextTimestamp}:R> (<t:${nextTimestamp}:t>).`)]
            });
        }

        const role = resolveRole(work.career);
        const isConsecutive = (now - (work.last_work || 0)) < (12 * 3600);
        const newStreak = isConsecutive ? ((work.work_streak || 0) + 1) : 1;
        const streakBonusPercent = Math.min(40, (newStreak - 1) * 4);
        const levelMultiplier = LEVEL_MULTIPLIERS[(work.level || 1) - 1] || 1.0;
        const base = Math.floor(Math.random() * (role.baseMax - role.baseMin + 1)) + role.baseMin;

        // 20% chance of high-performance tip
        const isTip = Math.random() < 0.20;
        const tipBonus = isTip ? Math.floor(base * 0.25) : 0;
        const finalEarnings = Math.floor((base * levelMultiplier) * (1 + (streakBonusPercent / 100))) + tipBonus;

        const expGained = Math.floor(Math.random() * 16) + 20;
        const newExp = (work.exp || 0) + expGained;
        const newLevel = getLevelFromExp(newExp);
        const didLevelUp = newLevel > (work.level || 1);

        // Save shift
        await db.saveWorkShift(message.guild.id, message.author.id, {
            career: role.id,
            level: newLevel,
            exp: newExp,
            earned: finalEarnings,
            lastWork: now,
            workStreak: newStreak
        });

        await db.addWallet(message.guild.id, message.author.id, finalEarnings);
        await db.recordTransaction(message.guild.id, message.author.id, 'work', finalEarnings, `shift wage: ${role.title}`);

        const rankTitle = role.ranks[newLevel - 1] || role.ranks[0];
        const nextTimestamp = now + COOLDOWN_SECONDS;

        // Auto Discord Role assignment if role exists in guild
        let roleAwardedText = '';
        try {
            if (message.guild?.members?.me?.permissions?.has('ManageRoles')) {
                const targetRoleName = role.roleName;
                const guildRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === targetRoleName.toLowerCase());
                if (guildRole && message.member && !message.member.roles.cache.has(guildRole.id)) {
                    await message.member.roles.add(guildRole).catch(() => {});
                    roleAwardedText = `\n-# **server role assigned:** <@&${guildRole.id}>!`;
                }
            }
        } catch {}

        const e = config.emojis || {};
        const authorAvatar = message.author.displayAvatarURL({ dynamic: true, size: 1024 });

        const desc = [
            `${e.leftwing || '✦'} **shift complete — ${role.title}** ${e.rightwing || '✦'}`,
            `*${role.description}*\n`,
            `**wage earned** · \`+$${finalEarnings.toLocaleString()}\`${isTip ? ` *(+$${tipBonus} tip)*` : ''}`,
            `**rank** · \`${rankTitle}\` *(level ${newLevel})* · **streak** · \`${newStreak}\` shifts *(+${streakBonusPercent}%)*`,
            `**progress** · ${makeExpBar(newExp, newLevel)}`,
            `**next shift** · ready <t:${nextTimestamp}:R> (<t:${nextTimestamp}:t>)${roleAwardedText}${didLevelUp ? `\n-# **promoted!** you are now a \`${rankTitle}\`!` : ''}`
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setThumbnail(authorAvatar)
            .setDescription(desc);

        return message.reply({ embeds: [embed] });
    }

    async sendRolesList(message) {
        const db = message.client.db;
        const work = await db.getWork(message.guild.id, message.author.id);
        const completed = work.shifts_completed || 0;

        const roleKeys = ['hustler', 'barista', 'mod', 'dev', 'trader', 'doctor'];
        const lines = roleKeys.map((key, idx) => {
            const r = WORK_ROLES[key];
            const isUnlocked = completed >= r.requiredShifts;
            const isCurrent = (work.career || 'hustler').toLowerCase() === r.id;
            const badge = isCurrent ? '`[active]` ' : (isUnlocked ? '`[unlocked]` ' : `\`[req: ${r.requiredShifts} shifts]\` `);

            return `\`${idx + 1}.\` **${r.title}** (\`${r.id}\`) ${badge}\n` +
                   `-# wage: \`$${r.baseMin} - $${r.baseMax}\` · *${r.description}*`;
        });

        const desc = [
            `${config.emojis.leftwing || '✦'} **available career roles** ${config.emojis.rightwing || '✦'}`,
            `-# complete shifts to unlock higher-tier roles and bigger paychecks.\n`,
            `**shifts completed:** \`${completed}\` shifts\n`,
            ...lines,
            '',
            `-# to apply for an unlocked role: \`${config.prefix}work apply <role_id>\``
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setDescription(desc);

        return message.reply({ embeds: [embed] });
    }

    async applyRole(message, roleArg) {
        if (!roleArg) {
            return message.reply({
                embeds: [build.warn(message.author, `specify the role to apply for. syntax: \`${config.prefix}work apply <role>\` (check \`${config.prefix}work roles\`)`)]
            });
        }

        const role = resolveRole(roleArg);
        if (!role) {
            return message.reply({
                embeds: [build.warn(message.author, `unknown role \`${roleArg}\`. check \`${config.prefix}work roles\`.`)]
            });
        }

        const db = message.client.db;
        const work = await db.getWork(message.guild.id, message.author.id);

        if ((work.career || 'hustler').toLowerCase() === role.id) {
            return message.reply({
                embeds: [build.warn(message.author, `you are already employed as a **${role.title}**.`)]
            });
        }

        const completed = work.shifts_completed || 0;
        if (completed < role.requiredShifts) {
            return message.reply({
                embeds: [build.deny(message.author, `you need **${role.requiredShifts}** completed shifts to apply for **${role.title}** (you currently have **${completed}**).`)]
            });
        }

        await db.setWorkCareer(message.guild.id, message.author.id, role.id);

        // Check if guild has corresponding role to assign
        let roleText = '';
        try {
            if (message.guild?.members?.me?.permissions?.has('ManageRoles')) {
                const guildRole = message.guild.roles.cache.find(r => r.name.toLowerCase() === role.roleName.toLowerCase());
                if (guildRole && message.member && !message.member.roles.cache.has(guildRole.id)) {
                    await message.member.roles.add(guildRole).catch(() => {});
                    roleText = ` server role <@&${guildRole.id}> assigned.`;
                }
            }
        } catch {}

        return message.reply({
            embeds: [build.approved(message.author, `successfully enrolled as **${role.title}**.${roleText} clock in with \`${config.prefix}work\`!`)]
        });
    }

    async sendProfile(message, targetUser) {
        const db = message.client.db;
        const work = await db.getWork(message.guild.id, targetUser.id);
        const eco = await db.getEconomy(message.guild.id, targetUser.id);
        const role = resolveRole(work.career);
        const rankTitle = role.ranks[(work.level || 1) - 1] || role.ranks[0];

        const targetAvatar = targetUser.displayAvatarURL({ dynamic: true, size: 1024 });

        const desc = [
            `${config.emojis.leftwing || '✦'} **career profile — ${targetUser.username.toLowerCase()}** ${config.emojis.rightwing || '✦'}`,
            `*${role.description}*\n`,
            `**active role** · \`${role.title}\``,
            `**rank** · \`${rankTitle}\` *(level ${work.level || 1})*`,
            `**progress** · ${makeExpBar(work.exp || 0, work.level || 1)}`,
            `**shifts completed** · \`${work.shifts_completed || 0}\` shifts`,
            `**current streak** · \`${work.work_streak || 0}\` shifts`,
            `**total career earned** · \`$${(work.total_earned || 0).toLocaleString()}\``,
            `**liquid wallet** · \`$${(eco.wallet || 0).toLocaleString()}\``
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(config.colors.c || '#2b2d31')
            .setThumbnail(targetAvatar)
            .setDescription(desc);

        return message.reply({ embeds: [embed] });
    }
}

module.exports = WorkCommand;
