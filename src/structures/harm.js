const { Client: DiscordClient, GatewayIntentBits, Partials, Options } = require('discord.js');
const path = require('path');
const CommandHandler = require('./command');
const EventHandler = require('./event');
const DatabaseManager = require('./utils/helpers/database.js');
const start = require('./utils/helpers/start.js');

class harm {
    constructor(config) {
        this.config = config;
        this.prefix = config.prefix || ",";
        this.colors = config.colors || {};

        this.client = new DiscordClient({
            failIfNotExists: false,
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.GuildPresences,
                GatewayIntentBits.GuildVoiceStates
            ],
            partials: [
                Partials.User,
                Partials.Message,
                Partials.GuildMember,
                Partials.Channel
            ],
            makeCache: Options.cacheWithLimits({
                ...Options.DefaultMakeCacheSettings,
                MessageManager: 50,
                GuildMemberManager: {
                    maxSize: 2000,
                    keepOverLimit: (member) => member.id === member.client?.user?.id
                },
                UserManager: {
                    maxSize: 2000,
                    keepOverLimit: (user) => user.id === user.client?.user?.id
                },
                // disable caches we never read
                ReactionManager: 0,
                GuildScheduledEventManager: 0,
                StageInstanceManager: 0,
                ThreadManager: 0,
                AutoModerationRuleManager: 0
            }),
            sweepers: {
                messages: {
                    interval: 120,
                    lifetime: 120
                },
                users: {
                    interval: 300,
                    filter: () => (user) => user.id !== user.client?.user?.id && !user.bot
                },
                guildMembers: {
                    interval: 300,
                    filter: () => (member) => member.id !== member.client?.user?.id
                }
            },
            allowedMentions: {
                parse: ['users'],
                repliedUser: false
            },
            presence: {
                activities: this.config.presence?.activities?.length ? [this.config.presence.activities[0]] : [],
                status: this.config.presence?.status || 'online'
            },
            rest: {
                offset: 50,
                retries: 2,
                globalRequestsPerSecond: 50
            }
        });

        this.client.snipes = new Map();
        this.client.editSnipes = new Map();

        this.client.rest.on('rateLimited', (info) => {
            console.warn(`[rest] rate limited — ${info.timeToReset}ms cooldown`);
        });

        this.client.db = new DatabaseManager();

        this.commandHandler = new CommandHandler(
            this.client,
            path.join(__dirname, '../commands'),
            this.prefix
        );

        this.client.commandHandler = this.commandHandler;

        this.eventHandler = new EventHandler(
            this.client,
            path.join(__dirname, '../events')
        );

        this.client.harm = this;
        this.client.kyoto = this;

        this.presenceInterval = null;

        const stopBot = async () => {
            console.log('shutting down...');
            if (this.presenceInterval) clearInterval(this.presenceInterval);
            if (this.guardianInterval) clearInterval(this.guardianInterval);
            if (this.voiceCleanerInterval) clearInterval(this.voiceCleanerInterval);
            this.client.destroy();
            process.exit(0);
        };
        process.on('SIGINT', stopBot);
        process.on('SIGTERM', stopBot);

        this.client.on('error', (error) => {
            console.error('[client]', error.message);
        });

        this.client.invites = new Map();

        this.client.once('clientReady', async () => {
            this.startPresenceRotator();
            this.startHeartbeatGuardian();
            const GiveawayHelper = require('./utils/helpers/giveaway.js');
            GiveawayHelper.startWorker(this.client);
            const VoiceCleanerWorker = require('./utils/workers/voicecleaner.js');
            this.voiceCleanerInterval = VoiceCleanerWorker.start(this.client);

            // cache guild invites in parallel (not sequential)
            const fetchPromises = [];
            for (const guild of this.client.guilds.cache.values()) {
                if (guild.members?.me?.permissions?.has('ManageGuild')) {
                    fetchPromises.push(
                        guild.invites.fetch().then(invs => {
                            const codeMap = new Map();
                            for (const [code, inv] of invs) codeMap.set(code, inv.uses || 0);
                            this.client.invites.set(guild.id, codeMap);
                        }).catch(() => {})
                    );
                }
            }
            // fire all at once, don't block one-by-one
            await Promise.allSettled(fetchPromises);

            if (this.startInstance && process.stdin.isTTY) {
                this.startInstance.attachClient(this.client);
            } else {
                console.log(`logged in as ${this.client.user?.tag}`);
            }
        });
    }

    startPresenceRotator() {
        if (this.presenceInterval) {
            clearInterval(this.presenceInterval);
            this.presenceInterval = null;
        }

        const presenceConfig = this.config.presence;
        if (!presenceConfig || !Array.isArray(presenceConfig.activities) || presenceConfig.activities.length === 0) {
            return;
        }

        const activities = presenceConfig.activities;
        let currentIndex = 0;

        // pre-cache user count, update every rotation instead of computing per-call
        let cachedUserCount = 0;

        const updateActivity = () => {
            if (!this.client.isReady() || !this.client.user) return;

            const rawAct = activities[currentIndex];
            currentIndex = (currentIndex + 1) % activities.length;

            // recalculate user count lazily each rotation
            cachedUserCount = this.client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);

            const format = (str) => {
                if (!str || typeof str !== 'string') return str;
                return str
                    .replace(/{prefix}/g, this.prefix || ',')
                    .replace(/{guilds}/g, this.client.guilds.cache.size.toLocaleString())
                    .replace(/{users}/g, cachedUserCount.toLocaleString())
                    .replace(/{channels}/g, this.client.channels.cache.size.toLocaleString());
            };

            const activityData = {
                name: format(rawAct.name || rawAct.state || ''),
                type: rawAct.type ?? 0
            };

            if (rawAct.url) activityData.url = rawAct.url;
            if (rawAct.state) activityData.state = format(rawAct.state);
            if (activityData.type === 4 && !activityData.state) activityData.state = activityData.name;

            try {
                this.client.user.setPresence({
                    activities: [activityData],
                    status: rawAct.status || presenceConfig.status || 'online'
                });
            } catch (_) {}
        };

        updateActivity();

        if (activities.length > 1) {
            const intervalMs = Math.max(presenceConfig.interval || 15000, 10000);
            this.presenceInterval = setInterval(updateActivity, intervalMs);
        }
    }

    startHeartbeatGuardian() {
        if (this.guardianInterval) clearInterval(this.guardianInterval);

        this.guardianInterval = setInterval(() => {
            if (!this.client.isReady()) return;
            if (this.client.ws.ping === -1) {
                console.warn('[heartbeat] connection stalled, attempting repair...');
                try { this.client.ws.destroy(); } catch (_) {}
            }
        }, 60_000);
    }

    async init() {
        try {
            this.startInstance = start.init();
            await this.client.db.init();
            this.commandHandler.loadCommands();
            this.eventHandler.loadEvents();
            await this.client.login(this.config.token);
        } catch (err) {
            console.error(`failed> ${err.message}`);
            process.exit(1);
        }
    }
}

module.exports = { harm, kyoto: harm };
