const path = require('path');
const fs = require('fs');

let DatabaseSync = null;
try {
    DatabaseSync = require('node:sqlite').DatabaseSync;
} catch (_) {}

class NodeSqliteAdapter {
    constructor(filePath) {
        this._db = new DatabaseSync(filePath);
        this._stmtCache = new Map();
    }

    _prepare(sql) {
        let stmt = this._stmtCache.get(sql);
        if (!stmt) {
            stmt = this._db.prepare(sql);
            if (this._stmtCache.size < 500) this._stmtCache.set(sql, stmt);
        }
        return stmt;
    }

    async run(sql, params) {
        const stmt = this._prepare(sql);
        const args = params === undefined ? [] : (Array.isArray(params) ? params : [params]);
        const res = stmt.run(...args);
        const lastID = res?.lastInsertRowid !== undefined ? Number(res.lastInsertRowid) : (res?.lastID ? Number(res.lastID) : 0);
        return {
            changes: res?.changes || 0,
            lastID,
            lastInsertRowid: res?.lastInsertRowid
        };
    }

    async get(sql, params) {
        const stmt = this._prepare(sql);
        if (params === undefined) return stmt.get();
        const args = Array.isArray(params) ? params : [params];
        return stmt.get(...args);
    }

    async all(sql, params) {
        const stmt = this._prepare(sql);
        if (params === undefined) return stmt.all();
        const args = Array.isArray(params) ? params : [params];
        return stmt.all(...args);
    }

    async exec(sql) {
        return this._db.exec(sql);
    }
}

class DatabaseManager {
    constructor() {
        this.db = null;
        this.guildSettingsCache = new Map();
        this.blacklistCache = new Set();
        this.voicemasterCache = new Map();
        this.afkCache = new Map();
        this.featureTogglesCache = new Map();
        this.autorolesCache = new Map();
    }

    async init() {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
        const dbFile = path.join(dataDir, 'cases.db');

        if (DatabaseSync) {
            this.db = new NodeSqliteAdapter(dbFile);
        } else {
            const sqlite3 = require('sqlite3');
            const { open } = require('sqlite');
            this.db = await open({
                filename: dbFile,
                driver: sqlite3.Database
            });
        }

        await this.db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA synchronous = NORMAL; PRAGMA cache_size = -64000; PRAGMA temp_store = MEMORY; PRAGMA mmap_size = 268435456;');
        await this._init();
        await this._loadGuildSettingsCache();
    }

    async _init() {
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS voicemaster_setup (
                guild_id TEXT PRIMARY KEY,
                vc_id TEXT NOT NULL,
                category_id TEXT NOT NULL,
                interface_channel_id TEXT,
                interface_msg_id TEXT,
                script TEXT,
                waiting_room_id TEXT,
                thread_count INTEGER DEFAULT 0,
                counter_channel_id TEXT
            );

            CREATE TABLE IF NOT EXISTS voicemaster_j2c (
                guild_id TEXT NOT NULL,
                vc_id TEXT PRIMARY KEY,
                category_id TEXT,
                name TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS voicemaster_active (
                channel_id TEXT PRIMARY KEY,
                owner_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                text_channel_id TEXT
            );

            CREATE TABLE IF NOT EXISTS voicemaster_default_names (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS voicemaster_default_limits (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                user_limit INTEGER NOT NULL,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS voicemaster_bans (
                guild_id TEXT NOT NULL,
                owner_id TEXT NOT NULL,
                banned_user_id TEXT NOT NULL,
                PRIMARY KEY (guild_id, owner_id, banned_user_id)
            );

            CREATE TABLE IF NOT EXISTS command_analytics (
                command_name TEXT NOT NULL,
                user_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS guild_settings (
                guild_id TEXT PRIMARY KEY,
                prefix TEXT,
                mod_log_channel_id TEXT,
                disabled_categories TEXT,
                disabled_commands TEXT
            );

            CREATE TABLE IF NOT EXISTS afk (
                user_id TEXT PRIMARY KEY,
                guild_id TEXT,
                reason TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS guild_feature_toggles (
                guild_id TEXT NOT NULL,
                feature TEXT NOT NULL,
                enabled INTEGER NOT NULL,
                PRIMARY KEY (guild_id, feature)
            );

            CREATE TABLE IF NOT EXISTS user_economy (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                wallet INTEGER DEFAULT 1000,
                bank INTEGER DEFAULT 0,
                last_daily INTEGER DEFAULT 0,
                last_weekly INTEGER DEFAULT 0,
                last_monthly INTEGER DEFAULT 0,
                streak INTEGER DEFAULT 0,
                vault INTEGER DEFAULT 0,
                bank_capacity INTEGER DEFAULT 25000,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS economy_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                type TEXT NOT NULL,
                amount INTEGER NOT NULL,
                description TEXT,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS user_cards (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                card_number TEXT NOT NULL,
                cvv TEXT NOT NULL,
                is_open INTEGER DEFAULT 1,
                is_locked INTEGER DEFAULT 0,
                opened_at INTEGER NOT NULL,
                unlocked_at INTEGER NOT NULL,
                tier TEXT DEFAULT 'standard',
                bank_capacity INTEGER DEFAULT 25000,
                earned_all_time INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS user_work (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                career TEXT DEFAULT 'engineer',
                level INTEGER DEFAULT 1,
                exp INTEGER DEFAULT 0,
                shifts_completed INTEGER DEFAULT 0,
                total_earned INTEGER DEFAULT 0,
                last_work INTEGER DEFAULT 0,
                work_streak INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS user_inventory (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                amount INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS economy_bounties (
                guild_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                setter_id TEXT NOT NULL,
                amount INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                PRIMARY KEY (guild_id, target_id)
            );

            CREATE TABLE IF NOT EXISTS economy_lottery (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                tickets INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS economy_cooldowns (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                command TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                PRIMARY KEY (guild_id, user_id, command)
            );

            CREATE TABLE IF NOT EXISTS economy_active_items (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                PRIMARY KEY (guild_id, user_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS user_pets (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                pet_type TEXT NOT NULL,
                pet_name TEXT NOT NULL,
                level INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                hunger INTEGER DEFAULT 100,
                hygiene INTEGER DEFAULT 100,
                energy INTEGER DEFAULT 100,
                loyalty INTEGER DEFAULT 100,
                last_fed INTEGER DEFAULT 0,
                last_washed INTEGER DEFAULT 0,
                last_played INTEGER DEFAULT 0,
                last_trained INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS user_marriages (
                guild_id TEXT NOT NULL,
                user1_id TEXT NOT NULL,
                user2_id TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                level INTEGER DEFAULT 1,
                PRIMARY KEY (guild_id, user1_id)
            );

            CREATE TABLE IF NOT EXISTS user_invites (
                guild_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                joins INTEGER DEFAULT 0,
                leaves INTEGER DEFAULT 0,
                fakes INTEGER DEFAULT 0,
                bonus INTEGER DEFAULT 0,
                PRIMARY KEY (guild_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS member_invites (
                guild_id TEXT NOT NULL,
                member_id TEXT NOT NULL,
                inviter_id TEXT NOT NULL,
                code TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                PRIMARY KEY (guild_id, member_id)
            );

            CREATE TABLE IF NOT EXISTS giveaways (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT UNIQUE NOT NULL,
                channel_id TEXT NOT NULL,
                guild_id TEXT NOT NULL,
                host_id TEXT NOT NULL,
                prize TEXT NOT NULL,
                winners_count INTEGER DEFAULT 1,
                ends_at INTEGER NOT NULL,
                ended INTEGER DEFAULT 0,
                cancelled INTEGER DEFAULT 0,
                image_url TEXT,
                requirement TEXT,
                winners TEXT,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS giveaway_entries (
                giveaway_id INTEGER NOT NULL,
                user_id TEXT NOT NULL,
                entered_at INTEGER NOT NULL,
                PRIMARY KEY (giveaway_id, user_id)
            );

            CREATE TABLE IF NOT EXISTS bot_blacklist (
                user_id TEXT PRIMARY KEY,
                reason TEXT,
                blacklisted_by TEXT,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS guild_movement (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                guild_id TEXT NOT NULL,
                type TEXT NOT NULL,
                timestamp INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS free_command_uses (
                user_id TEXT NOT NULL,
                command TEXT NOT NULL,
                uses INTEGER DEFAULT 0,
                PRIMARY KEY (user_id, command)
            );

            CREATE TABLE IF NOT EXISTS user_profiles (
                user_id TEXT PRIMARY KEY,
                uid INTEGER UNIQUE,
                tier TEXT DEFAULT 'standard',
                premium_since INTEGER,
                premium_expires INTEGER
            );

            CREATE TABLE IF NOT EXISTS guild_autoroles (
                guild_id TEXT NOT NULL,
                role_id TEXT NOT NULL,
                target_type TEXT DEFAULT 'humans',
                PRIMARY KEY (guild_id, role_id)
            );

            CREATE INDEX IF NOT EXISTS idx_cmd_analytics ON command_analytics (command_name, timestamp);
            CREATE INDEX IF NOT EXISTS idx_user_invites_guild ON user_invites (guild_id);
            CREATE INDEX IF NOT EXISTS idx_member_invites_inviter ON member_invites (guild_id, inviter_id);
            CREATE INDEX IF NOT EXISTS idx_guild_movement ON guild_movement (guild_id, timestamp);
        `);

        try { await this.db.run('ALTER TABLE voicemaster_setup ADD COLUMN counter_channel_id TEXT'); } catch (_) {}
        try { await this.db.run('ALTER TABLE voicemaster_setup ADD COLUMN thread_count INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE giveaways ADD COLUMN winners TEXT'); } catch (_) {}
        try { await this.db.run('ALTER TABLE giveaways ADD COLUMN image_url TEXT'); } catch (_) {}
        try { await this.db.run('ALTER TABLE giveaways ADD COLUMN requirement TEXT'); } catch (_) {}
        try { await this.db.run('ALTER TABLE giveaways ADD COLUMN cancelled INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_economy ADD COLUMN last_weekly INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_economy ADD COLUMN last_monthly INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_economy ADD COLUMN vault INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_economy ADD COLUMN bank_capacity INTEGER DEFAULT 25000'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_economy ADD COLUMN streak_freezes INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_economy ADD COLUMN prestige INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run("ALTER TABLE user_cards ADD COLUMN tier TEXT DEFAULT 'standard'"); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_cards ADD COLUMN bank_capacity INTEGER DEFAULT 25000'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_cards ADD COLUMN earned_all_time INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_cards ADD COLUMN unlocked_at INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_cards ADD COLUMN opened_at INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_work ADD COLUMN overtime_last INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_work ADD COLUMN strikes INTEGER DEFAULT 0'); } catch (_) {}
        try { await this.db.run('ALTER TABLE user_work ADD COLUMN stars INTEGER DEFAULT 5'); } catch (_) {}
    }

    // --- Analytics ---
    async trackCommand(commandName, userId, guildId) {
        if (!this.db) return;
        await this.db.run(
            'INSERT INTO command_analytics (command_name, user_id, guild_id, timestamp) VALUES (?, ?, ?, ?)',
            [commandName, userId, guildId, Math.floor(Date.now() / 1000)]
        ).catch(() => {});
    }

    // --- Guild Settings & Prefix ---
    async _loadGuildSettingsCache() {
        const rows = await this.db.all('SELECT * FROM guild_settings') || [];
        for (const row of rows) {
            this.guildSettingsCache.set(row.guild_id, {
                prefix: row.prefix || null,
                modLogChannelId: row.mod_log_channel_id || null,
                disabledCategories: row.disabled_categories ? JSON.parse(row.disabled_categories) : [],
                disabledCommands: row.disabled_commands ? JSON.parse(row.disabled_commands) : []
            });
        }

        const blRows = await this.db.all('SELECT user_id FROM bot_blacklist') || [];
        for (const bl of blRows) {
            this.blacklistCache.add(bl.user_id);
        }

        const vmRows = await this.db.all('SELECT * FROM voicemaster_setup') || [];
        for (const row of vmRows) {
            this.voicemasterCache.set(row.guild_id, row);
        }

        const afkRows = await this.db.all('SELECT * FROM afk') || [];
        for (const row of afkRows) {
            this.afkCache.set(row.user_id, {
                userId: row.user_id,
                guildId: row.guild_id,
                reason: row.reason,
                timestamp: row.timestamp
            });
        }

        const toggleRows = await this.db.all('SELECT * FROM guild_feature_toggles') || [];
        for (const row of toggleRows) {
            this.featureTogglesCache.set(`${row.guild_id}:${row.feature}`, Boolean(row.enabled));
        }

        const autoroleRows = await this.db.all('SELECT * FROM guild_autoroles') || [];
        for (const row of autoroleRows) {
            if (!this.autorolesCache.has(row.guild_id)) {
                this.autorolesCache.set(row.guild_id, []);
            }
            this.autorolesCache.get(row.guild_id).push({
                roleId: row.role_id,
                targetType: row.target_type || 'humans'
            });
        }
    }

    // --- Feature Toggles ---
    isFeatureEnabled(guildId, feature, defaultValue = true) {
        if (!guildId || !feature) return defaultValue;
        const key = `${guildId}:${feature}`;
        if (this.featureTogglesCache.has(key)) {
            return this.featureTogglesCache.get(key);
        }
        return defaultValue;
    }

    async setFeatureEnabled(guildId, feature, enabled) {
        if (!guildId || !feature) return;
        const key = `${guildId}:${feature}`;
        const val = enabled ? 1 : 0;
        this.featureTogglesCache.set(key, Boolean(val));
        if (!this.db) return;
        await this.db.run(
            'INSERT OR REPLACE INTO guild_feature_toggles (guild_id, feature, enabled) VALUES (?, ?, ?)',
            [guildId, feature, val]
        );
    }

    isNukeEnabled(guildId) {
        return this.isFeatureEnabled(guildId, 'nuke', false);
    }

    async setNukeEnabled(guildId, enabled) {
        return await this.setFeatureEnabled(guildId, 'nuke', enabled);
    }

    isSnipeEnabled(guildId) {
        return this.isFeatureEnabled(guildId, 'snipe', true);
    }

    async setSnipeEnabled(guildId, enabled) {
        return await this.setFeatureEnabled(guildId, 'snipe', enabled);
    }

    // --- Autorole System ---
    getAutoroles(guildId) {
        if (!guildId) return [];
        return this.autorolesCache.get(guildId) || [];
    }

    async addAutorole(guildId, roleId, targetType = 'humans') {
        if (!guildId || !roleId) return;
        const current = this.getAutoroles(guildId);
        const filtered = current.filter(r => r.roleId !== roleId);
        filtered.push({ roleId, targetType });
        this.autorolesCache.set(guildId, filtered);
        if (!this.db) return;
        await this.db.run(
            'INSERT OR REPLACE INTO guild_autoroles (guild_id, role_id, target_type) VALUES (?, ?, ?)',
            [guildId, roleId, targetType]
        );
    }

    async removeAutorole(guildId, roleId) {
        if (!guildId || !roleId) return false;
        const current = this.getAutoroles(guildId);
        const exists = current.some(r => r.roleId === roleId);
        if (!exists) return false;
        const filtered = current.filter(r => r.roleId !== roleId);
        this.autorolesCache.set(guildId, filtered);
        if (!this.db) return true;
        await this.db.run(
            'DELETE FROM guild_autoroles WHERE guild_id = ? AND role_id = ?',
            [guildId, roleId]
        );
        return true;
    }

    async clearAutoroles(guildId) {
        if (!guildId) return;
        this.autorolesCache.delete(guildId);
        if (!this.db) return;
        await this.db.run('DELETE FROM guild_autoroles WHERE guild_id = ?', [guildId]);
    }

    // --- AFK System ---
    async setAfk(userId, reason, guildId = null) {
        if (!this.db || !userId) return;
        const now = Date.now();
        await this.db.run(
            'INSERT OR REPLACE INTO afk (user_id, guild_id, reason, timestamp) VALUES (?, ?, ?, ?)',
            [userId, guildId, reason, now]
        );
        this.afkCache.set(userId, { userId, guildId, reason, timestamp: now });
    }

    getAfk(userId) {
        return this.afkCache.get(userId) || null;
    }

    async removeAfk(userId) {
        if (!this.db || !userId) return;
        this.afkCache.delete(userId);
        await this.db.run('DELETE FROM afk WHERE user_id = ?', [userId]);
    }

    // --- Blacklist System ---
    isBlacklisted(userId) {
        return this.blacklistCache.has(userId);
    }

    async addBlacklist(userId, reason, blacklistedBy) {
        this.blacklistCache.add(userId);
        if (!this.db) return;
        await this.db.run(
            'INSERT OR REPLACE INTO bot_blacklist (user_id, reason, blacklisted_by, timestamp) VALUES (?, ?, ?, ?)',
            [userId, reason, blacklistedBy, Math.floor(Date.now() / 1000)]
        );
    }

    async removeBlacklist(userId) {
        this.blacklistCache.delete(userId);
        if (!this.db) return;
        await this.db.run('DELETE FROM bot_blacklist WHERE user_id = ?', [userId]);
    }

    async getBlacklist() {
        if (!this.db) return [];
        return await this.db.all('SELECT * FROM bot_blacklist ORDER BY timestamp DESC') || [];
    }

    // --- Guild Settings & Prefix ---
    getGuildSettings(guildId) {
        return this.guildSettingsCache.get(guildId) || null;
    }

    getGuildPrefix(guildId) {
        const settings = this.guildSettingsCache.get(guildId);
        return settings ? settings.prefix : null;
    }

    async setGuildPrefix(guildId, prefix) {
        const current = this.guildSettingsCache.get(guildId) || {
            prefix: null,
            modLogChannelId: null,
            disabledCategories: [],
            disabledCommands: []
        };
        current.prefix = prefix;
        this.guildSettingsCache.set(guildId, current);

        if (!this.db) return;
        await this.db.run(
            'INSERT INTO guild_settings (guild_id, prefix) VALUES (?, ?) ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix',
            [guildId, prefix]
        );
    }

    async updateGuildSettings(guildId, updates = {}) {
        const current = this.guildSettingsCache.get(guildId) || {
            prefix: null,
            modLogChannelId: null,
            disabledCategories: [],
            disabledCommands: []
        };

        if (updates.prefix !== undefined) current.prefix = updates.prefix;
        if (updates.modLogChannelId !== undefined) current.modLogChannelId = updates.modLogChannelId;
        if (updates.disabledCategories !== undefined) current.disabledCategories = updates.disabledCategories;
        if (updates.disabledCommands !== undefined) current.disabledCommands = updates.disabledCommands;

        this.guildSettingsCache.set(guildId, current);

        if (!this.db) return;
        await this.db.run(`
            INSERT INTO guild_settings (guild_id, prefix, mod_log_channel_id, disabled_categories, disabled_commands)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET
                prefix = excluded.prefix,
                mod_log_channel_id = excluded.mod_log_channel_id,
                disabled_categories = excluded.disabled_categories,
                disabled_commands = excluded.disabled_commands
        `, [
            guildId,
            current.prefix,
            current.modLogChannelId,
            JSON.stringify(current.disabledCategories),
            JSON.stringify(current.disabledCommands)
        ]);
    }

    isCategoryDisabled(guildId, category) {
        if (!category) return false;
        const settings = this.guildSettingsCache.get(guildId);
        if (!settings || !Array.isArray(settings.disabledCategories)) return false;
        return settings.disabledCategories.includes(category.toLowerCase());
    }

    isCommandDisabled(guildId, commandName) {
        if (!commandName) return false;
        const settings = this.guildSettingsCache.get(guildId);
        if (!settings || !Array.isArray(settings.disabledCommands)) return false;
        return settings.disabledCommands.includes(commandName.toLowerCase());
    }

    // --- VoiceMaster System ---
    async setVoiceMasterSetup(guildId, vcId, categoryId, interfaceChannelId = null, interfaceMsgId = null, script = null, waitingRoomId = null, counterChannelId = null) {
        const existing = this.voicemasterCache.get(guildId);
        const resolvedCounterId = counterChannelId !== null ? counterChannelId : (existing?.counter_channel_id || null);

        this.voicemasterCache.set(guildId, {
            guild_id: guildId,
            vc_id: vcId,
            category_id: categoryId,
            interface_channel_id: interfaceChannelId,
            interface_msg_id: interfaceMsgId,
            script,
            waiting_room_id: waitingRoomId,
            thread_count: existing?.thread_count || 0,
            counter_channel_id: resolvedCounterId
        });

        await this.db.run(`
            INSERT OR REPLACE INTO voicemaster_setup
            (guild_id, vc_id, category_id, interface_channel_id, interface_msg_id, script, waiting_room_id, counter_channel_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [guildId, vcId, categoryId, interfaceChannelId, interfaceMsgId, script, waitingRoomId, resolvedCounterId]);
    }

    async setVoiceMasterCounterChannel(guildId, counterChannelId) {
        const setup = this.voicemasterCache.get(guildId);
        if (setup) setup.counter_channel_id = counterChannelId;
        await this.db.run('UPDATE voicemaster_setup SET counter_channel_id = ? WHERE guild_id = ?', [counterChannelId, guildId]);
    }

    async getVoiceMasterSetup(guildId) {
        if (this.voicemasterCache.has(guildId)) {
            return this.voicemasterCache.get(guildId);
        }
        const row = await this.db.get('SELECT * FROM voicemaster_setup WHERE guild_id = ?', [guildId]);
        if (row) {
            this.voicemasterCache.set(guildId, row);
            return row;
        }
        return null;
    }

    getVoiceMasterSetupSync(guildId) {
        return this.voicemasterCache.get(guildId) || null;
    }

    async incrementVoiceMasterThreadCount(guildId) {
        const setup = this.voicemasterCache.get(guildId);
        const newCount = ((setup?.thread_count || 0) + 1);
        if (setup) setup.thread_count = newCount;
        await this.db.run('UPDATE voicemaster_setup SET thread_count = thread_count + 1 WHERE guild_id = ?', [guildId]);
        return newCount;
    }

    async setVoiceMasterCategory(guildId, categoryId) {
        const setup = this.voicemasterCache.get(guildId);
        if (setup) setup.category_id = categoryId;
        await this.db.run('UPDATE voicemaster_setup SET category_id = ? WHERE guild_id = ?', [categoryId, guildId]);
    }

    async removeVoiceMasterSetup(guildId) {
        this.voicemasterCache.delete(guildId);
        await this.db.run('DELETE FROM voicemaster_setup WHERE guild_id = ?', [guildId]);
    }

    async resetAllVoiceMasterThreadCounts() {
        for (const [guildId, setup] of this.voicemasterCache.entries()) {
            setup.thread_count = 0;
        }
        await this.db.run('UPDATE voicemaster_setup SET thread_count = 0');
    }

    async addVoiceMasterJ2C(guildId, vcId, name) {
        await this.db.run(`
            INSERT OR REPLACE INTO voicemaster_j2c (guild_id, vc_id, name)
            VALUES (?, ?, ?)
        `, [guildId, vcId, name]);
    }

    async setVoiceMasterJ2CCategory(vcId, categoryId) {
        await this.db.run('UPDATE voicemaster_j2c SET category_id = ? WHERE vc_id = ?', [categoryId, vcId]);
    }

    async getVoiceMasterJ2Cs(guildId) {
        return await this.db.all('SELECT * FROM voicemaster_j2c WHERE guild_id = ?', [guildId]) || [];
    }

    async getVoiceMasterJ2C(vcId) {
        return await this.db.get('SELECT * FROM voicemaster_j2c WHERE vc_id = ?', [vcId]);
    }

    async removeVoiceMasterJ2C(vcId) {
        await this.db.run('DELETE FROM voicemaster_j2c WHERE vc_id = ?', [vcId]);
    }

    async addActiveVC(channelId, ownerId, guildId, textChannelId = null) {
        await this.db.run('INSERT OR REPLACE INTO voicemaster_active (channel_id, owner_id, guild_id, text_channel_id) VALUES (?, ?, ?, ?)', [channelId, ownerId, guildId, textChannelId]);
    }

    async getActiveVCByTextChannel(textChannelId) {
        return await this.db.get('SELECT * FROM voicemaster_active WHERE text_channel_id = ?', [textChannelId]);
    }

    async getActiveVC(channelId) {
        return await this.db.get('SELECT * FROM voicemaster_active WHERE channel_id = ?', [channelId]);
    }

    async getAllActiveVCs(guildId) {
        return await this.db.all('SELECT * FROM voicemaster_active WHERE guild_id = ?', [guildId]) || [];
    }

    async removeActiveVC(channelId) {
        await this.db.run('DELETE FROM voicemaster_active WHERE channel_id = ?', [channelId]);
    }

    async getActiveVCByOwner(ownerId, guildId) {
        return await this.db.get('SELECT * FROM voicemaster_active WHERE owner_id = ? AND guild_id = ?', [ownerId, guildId]);
    }

    async updateActiveVCOwner(channelId, newOwnerId) {
        await this.db.run('UPDATE voicemaster_active SET owner_id = ? WHERE channel_id = ?', [newOwnerId, channelId]);
    }

    async setVCDefaultName(guildId, userId, name) {
        await this.db.run('INSERT OR REPLACE INTO voicemaster_default_names (guild_id, user_id, name) VALUES (?, ?, ?)', [guildId, userId, name]);
    }

    async getVCDefaultName(guildId, userId) {
        const row = await this.db.get('SELECT name FROM voicemaster_default_names WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return row ? row.name : null;
    }

    async removeVCDefaultName(guildId, userId) {
        await this.db.run('DELETE FROM voicemaster_default_names WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    }

    async setVCDefaultLimit(guildId, userId, limit) {
        await this.db.run('INSERT OR REPLACE INTO voicemaster_default_limits (guild_id, user_id, user_limit) VALUES (?, ?, ?)', [guildId, userId, limit]);
    }

    async getVCDefaultLimit(guildId, userId) {
        const row = await this.db.get('SELECT user_limit FROM voicemaster_default_limits WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return row ? row.user_limit : null;
    }

    async removeVCDefaultLimit(guildId, userId) {
        await this.db.run('DELETE FROM voicemaster_default_limits WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    }

    async addVCBan(guildId, ownerId, bannedUserId) {
        await this.db.run('INSERT OR IGNORE INTO voicemaster_bans (guild_id, owner_id, banned_user_id) VALUES (?, ?, ?)', [guildId, ownerId, bannedUserId]);
    }

    async removeVCBan(guildId, ownerId, bannedUserId) {
        await this.db.run('DELETE FROM voicemaster_bans WHERE guild_id = ? AND owner_id = ? AND banned_user_id = ?', [guildId, ownerId, bannedUserId]);
    }

    async getVCBans(guildId, ownerId) {
        return await this.db.all('SELECT banned_user_id FROM voicemaster_bans WHERE guild_id = ? AND owner_id = ?', [guildId, ownerId]) || [];
    }

    async isVCBanned(guildId, ownerId, userId) {
        const row = await this.db.get('SELECT 1 FROM voicemaster_bans WHERE guild_id = ? AND owner_id = ? AND banned_user_id = ?', [guildId, ownerId, userId]);
        return !!row;
    }

    async resetVoiceMaster(guildId) {
        this.voicemasterCache.delete(guildId);
        await this.db.run('DELETE FROM voicemaster_setup WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM voicemaster_active WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM voicemaster_j2c WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM voicemaster_bans WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM voicemaster_default_names WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM voicemaster_default_limits WHERE guild_id = ?', [guildId]);
    }

    // --- Economy System ---
    async getEconomy(guildId, userId) {
        let row = await this.db.get('SELECT * FROM user_economy WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (!row) {
            await this.db.run(
                'INSERT INTO user_economy (guild_id, user_id, wallet, bank, last_daily, last_weekly, last_monthly, streak, vault, bank_capacity) VALUES (?, ?, 1000, 0, 0, 0, 0, 0, 0, 25000) ON CONFLICT(guild_id, user_id) DO NOTHING',
                [guildId, userId]
            );
            row = {
                guild_id: guildId,
                user_id: userId,
                wallet: 1000,
                bank: 0,
                last_daily: 0,
                last_weekly: 0,
                last_monthly: 0,
                streak: 0,
                vault: 0,
                bank_capacity: 25000
            };
        }
        if (row.bank_capacity === undefined || row.bank_capacity === null) row.bank_capacity = 25000;
        if (row.vault === undefined || row.vault === null) row.vault = 0;
        if (row.streak_freezes === undefined || row.streak_freezes === null) row.streak_freezes = 0;
        if (row.prestige === undefined || row.prestige === null) row.prestige = 0;
        return row;
    }

    async addWallet(guildId, userId, amount) {
        await this.getEconomy(guildId, userId);
        await this.db.run(
            'UPDATE user_economy SET wallet = MAX(0, wallet + ?) WHERE guild_id = ? AND user_id = ?',
            [amount, guildId, userId]
        );
        return await this.getEconomy(guildId, userId);
    }

    async setWallet(guildId, userId, amount) {
        await this.getEconomy(guildId, userId);
        await this.db.run(
            'UPDATE user_economy SET wallet = MAX(0, ?) WHERE guild_id = ? AND user_id = ?',
            [amount, guildId, userId]
        );
        return await this.getEconomy(guildId, userId);
    }

    async addBank(guildId, userId, amount) {
        await this.getEconomy(guildId, userId);
        await this.db.run(
            'UPDATE user_economy SET bank = MAX(0, bank + ?) WHERE guild_id = ? AND user_id = ?',
            [amount, guildId, userId]
        );
        return await this.getEconomy(guildId, userId);
    }

    async setBank(guildId, userId, amount) {
        await this.getEconomy(guildId, userId);
        await this.db.run(
            'UPDATE user_economy SET bank = MAX(0, ?) WHERE guild_id = ? AND user_id = ?',
            [amount, guildId, userId]
        );
        return await this.getEconomy(guildId, userId);
    }

    async deposit(guildId, userId, amount) {
        const eco = await this.getEconomy(guildId, userId);
        if (eco.wallet < amount) return { success: false, reason: 'insufficient' };
        const card = await this.getCard(guildId, userId);
        const cap = (card && card.bank_capacity) ? card.bank_capacity : (eco.bank_capacity || 25000);
        const availableSpace = Math.max(0, cap - eco.bank);
        if (availableSpace <= 0) return { success: false, reason: 'full', capacity: cap };
        const toDeposit = Math.min(amount, availableSpace);

        await this.db.run('UPDATE user_economy SET wallet = wallet - ?, bank = bank + ? WHERE guild_id = ? AND user_id = ?', [toDeposit, toDeposit, guildId, userId]);
        return { success: true, deposited: toDeposit, newWallet: eco.wallet - toDeposit, newBank: eco.bank + toDeposit, capped: toDeposit < amount };
    }

    async withdraw(guildId, userId, amount) {
        const eco = await this.getEconomy(guildId, userId);
        if (eco.bank < amount) return { success: false, reason: 'insufficient' };
        await this.db.run('UPDATE user_economy SET wallet = wallet + ?, bank = bank - ? WHERE guild_id = ? AND user_id = ?', [amount, amount, guildId, userId]);
        return { success: true, withdrawn: amount, newWallet: eco.wallet + amount, newBank: eco.bank - amount };
    }

    async depositVault(guildId, userId, amount) {
        const eco = await this.getEconomy(guildId, userId);
        if (eco.wallet < amount) return { success: false, reason: 'insufficient' };
        await this.db.run('UPDATE user_economy SET wallet = wallet - ?, vault = vault + ? WHERE guild_id = ? AND user_id = ?', [amount, amount, guildId, userId]);
        return { success: true, deposited: amount, newWallet: eco.wallet - amount, newVault: (eco.vault || 0) + amount };
    }

    async withdrawVault(guildId, userId, amount) {
        const eco = await this.getEconomy(guildId, userId);
        const vaultBal = eco.vault || 0;
        if (vaultBal < amount) return { success: false, reason: 'insufficient' };
        await this.db.run('UPDATE user_economy SET wallet = wallet + ?, vault = vault - ? WHERE guild_id = ? AND user_id = ?', [amount, amount, guildId, userId]);
        return { success: true, withdrawn: amount, newWallet: eco.wallet + amount, newVault: vaultBal - amount };
    }

    async upgradeBankCapacity(guildId, userId, cost, additionalCap) {
        const eco = await this.getEconomy(guildId, userId);
        if (eco.wallet < cost) return { success: false, reason: 'insufficient' };
        const newCap = (eco.bank_capacity || 25000) + additionalCap;
        await this.db.run('UPDATE user_economy SET wallet = wallet - ?, bank_capacity = ? WHERE guild_id = ? AND user_id = ?', [cost, newCap, guildId, userId]);
        return { success: true, newCapacity: newCap, remainingWallet: eco.wallet - cost };
    }

    async claimDaily(guildId, userId, amount = 750) {
        const user = await this.getEconomy(guildId, userId);
        const now = Math.floor(Date.now() / 1000);
        const oneDay = 86400;
        const twoDays = 172800;

        if (user.last_daily && (now - user.last_daily) < oneDay) {
            const remaining = oneDay - (now - user.last_daily);
            return { success: false, remaining };
        }

        let newStreak = 1;
        let streakFrozen = false;

        if (user.last_daily && (now - user.last_daily) < twoDays) {
            newStreak = (user.streak || 0) + 1;
        } else if (user.last_daily && (now - user.last_daily) >= twoDays && (user.streak_freezes || 0) > 0) {
            newStreak = (user.streak || 1) + 1;
            streakFrozen = true;
            await this.db.run('UPDATE user_economy SET streak_freezes = streak_freezes - 1 WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        }

        // Marriage bonus check
        const marriage = await this.getMarriage(guildId, userId);
        const marriageMultiplier = marriage ? 0.15 : 0;

        // Prestige multiplier check
        const prestigeMultiplier = (user.prestige || 0) * 0.20;

        const streakBonus = Math.min(newStreak * 75, 1500);
        let baseReward = amount + streakBonus;

        const bonusCoins = Math.floor(baseReward * (marriageMultiplier + prestigeMultiplier));
        const totalReward = baseReward + bonusCoins;

        await this.db.run(
            'UPDATE user_economy SET wallet = wallet + ?, streak = ?, last_daily = ? WHERE guild_id = ? AND user_id = ?',
            [totalReward, newStreak, now, guildId, userId]
        );

        return {
            success: true,
            reward: totalReward,
            streakBonus,
            streakFrozen,
            hasMarriage: Boolean(marriage),
            prestige: user.prestige || 0,
            streak: newStreak,
            totalWallet: user.wallet + totalReward
        };
    }

    async claimWeekly(guildId, userId, amount = 3500) {
        const user = await this.getEconomy(guildId, userId);
        const now = Math.floor(Date.now() / 1000);
        const sevenDays = 604800;

        if (user.last_weekly && (now - user.last_weekly) < sevenDays) {
            const remaining = sevenDays - (now - user.last_weekly);
            return { success: false, remaining };
        }

        await this.db.run(
            'UPDATE user_economy SET wallet = wallet + ?, last_weekly = ? WHERE guild_id = ? AND user_id = ?',
            [amount, now, guildId, userId]
        );

        return {
            success: true,
            reward: amount,
            totalWallet: user.wallet + amount
        };
    }

    async claimMonthly(guildId, userId, amount = 15000) {
        const user = await this.getEconomy(guildId, userId);
        const now = Math.floor(Date.now() / 1000);
        const thirtyDays = 2592000;

        if (user.last_monthly && (now - user.last_monthly) < thirtyDays) {
            const remaining = thirtyDays - (now - user.last_monthly);
            return { success: false, remaining };
        }

        await this.db.run(
            'UPDATE user_economy SET wallet = wallet + ?, last_monthly = ? WHERE guild_id = ? AND user_id = ?',
            [amount, now, guildId, userId]
        );

        return {
            success: true,
            reward: amount,
            totalWallet: user.wallet + amount
        };
    }

    async transferWallet(guildId, fromId, toId, amount) {
        const fromUser = await this.getEconomy(guildId, fromId);
        if (fromUser.wallet < amount) return { success: false, reason: 'insufficient' };

        await this.db.run('UPDATE user_economy SET wallet = wallet - ? WHERE guild_id = ? AND user_id = ?', [amount, guildId, fromId]);
        await this.db.run(
            'INSERT INTO user_economy (guild_id, user_id, wallet) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET wallet = wallet + excluded.wallet',
            [guildId, toId, amount]
        );
        return { success: true };
    }

    async getEconomyRank(guildId, userId) {
        const rows = await this.db.all('SELECT user_id, (wallet + bank + COALESCE(vault, 0)) AS total FROM user_economy WHERE guild_id = ? ORDER BY total DESC', [guildId]);
        if (!rows || rows.length === 0) return 1;
        const idx = rows.findIndex(r => r.user_id === userId);
        return idx !== -1 ? idx + 1 : rows.length + 1;
    }

    async getEconomyLeaderboard(guildId, limit = 10) {
        return await this.db.all(
            'SELECT user_id, wallet, bank, COALESCE(vault, 0) AS vault, (wallet + bank + COALESCE(vault, 0)) AS total FROM user_economy WHERE guild_id = ? ORDER BY total DESC LIMIT ?',
            [guildId, limit]
        ) || [];
    }

    async recordTransaction(guildId, userId, type, amount, description = '') {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(`
            INSERT INTO economy_transactions (guild_id, user_id, type, amount, description, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [guildId, userId, type, amount, description, now]);
    }

    async getTransactions(guildId, userId, limit = 5) {
        return await this.db.all(`
            SELECT * FROM economy_transactions
            WHERE guild_id = ? AND user_id = ?
            ORDER BY timestamp DESC LIMIT ?
        `, [guildId, userId, limit]) || [];
    }

    async getTransactionById(guildId, userId, txId) {
        if (!this.db || !guildId || !userId) return null;
        return await this.db.get(
            'SELECT * FROM economy_transactions WHERE guild_id = ? AND user_id = ? AND id = ?',
            [guildId, userId, txId]
        ) || null;
    }

    async getRecentTransactions(guildId, userId, sinceTimestamp) {
        if (!this.db || !guildId || !userId) return [];
        return await this.db.all(
            'SELECT * FROM economy_transactions WHERE guild_id = ? AND user_id = ? AND timestamp >= ? ORDER BY timestamp DESC',
            [guildId, userId, sinceTimestamp]
        ) || [];
    }

    async recordFraudCheck(guildId, userId) {
        return true;
    }

    // --- Card & Banking System ---
    _generateCardNumber() {
        let num = '4532';
        for (let i = 0; i < 12; i++) {
            num += Math.floor(Math.random() * 10).toString();
        }
        return `${num.slice(0, 4)} ${num.slice(4, 8)} ${num.slice(8, 12)} ${num.slice(12, 16)}`;
    }

    _generateCvv() {
        return Math.floor(100 + Math.random() * 900).toString();
    }

    async hasCard(guildId, userId) {
        if (!this.db || !guildId || !userId) return false;
        const row = await this.db.get('SELECT is_open FROM user_cards WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        return !!(row && row.is_open);
    }

    async getCard(guildId, userId) {
        if (!this.db || !guildId || !userId) return null;
        const row = await this.db.get('SELECT * FROM user_cards WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (!row) return null;
        return {
            ...row,
            is_open: !!row.is_open,
            is_locked: !!row.is_locked,
            locked: !!row.is_locked
        };
    }

    async openCard(guildId, userId) {
        if (!this.db || !guildId || !userId) return { success: false, alreadyOpen: false };
        const existing = await this.getCard(guildId, userId);
        if (existing && existing.is_open) {
            return { success: false, alreadyOpen: true };
        }
        const now = Math.floor(Date.now() / 1000);
        const cardNumber = this._generateCardNumber();
        const cvv = this._generateCvv();

        // Ensure user_economy exists
        await this.getEconomy(guildId, userId);

        await this.db.run(`
            INSERT INTO user_cards (guild_id, user_id, card_number, cvv, is_open, is_locked, opened_at, unlocked_at, tier, bank_capacity, earned_all_time)
            VALUES (?, ?, ?, ?, 1, 0, ?, ?, 'standard', 25000, 0)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET
                card_number = excluded.card_number,
                cvv = excluded.cvv,
                is_open = 1,
                is_locked = 0,
                opened_at = excluded.opened_at,
                unlocked_at = excluded.unlocked_at
        `, [guildId, userId, cardNumber, cvv, now, now]);

        return { success: true, alreadyOpen: false, cardNumber, cvv };
    }

    async setCardLock(guildId, userId, locked) {
        if (!this.db || !guildId || !userId) return false;
        const now = Math.floor(Date.now() / 1000);
        const lockVal = locked ? 1 : 0;
        if (!locked) {
            await this.db.run(
                'UPDATE user_cards SET is_locked = ?, unlocked_at = ? WHERE guild_id = ? AND user_id = ?',
                [lockVal, now, guildId, userId]
            );
        } else {
            await this.db.run(
                'UPDATE user_cards SET is_locked = ? WHERE guild_id = ? AND user_id = ?',
                [lockVal, guildId, userId]
            );
        }
        return true;
    }

    async reissueCard(guildId, userId) {
        if (!this.db || !guildId || !userId) return null;
        const now = Math.floor(Date.now() / 1000);
        const cardNumber = this._generateCardNumber();
        const cvv = this._generateCvv();
        await this.db.run(
            'UPDATE user_cards SET card_number = ?, cvv = ?, is_locked = 0, unlocked_at = ? WHERE guild_id = ? AND user_id = ?',
            [cardNumber, cvv, now, guildId, userId]
        );
        return { cardNumber, cvv };
    }

    async updateCardNumber(guildId, userId, newNumber) {
        if (!this.db || !guildId || !userId) return false;
        await this.db.run(
            'UPDATE user_cards SET card_number = ? WHERE guild_id = ? AND user_id = ?',
            [newNumber, guildId, userId]
        );
        return true;
    }

    async getCardByNumber(guildId, rawNumber) {
        if (!this.db || !guildId || !rawNumber) return null;
        const cleanNum = String(rawNumber).replace(/[\s-]/g, '');
        const rows = await this.db.all('SELECT * FROM user_cards WHERE guild_id = ?', [guildId]) || [];
        for (const row of rows) {
            if (row.card_number && row.card_number.replace(/[\s-]/g, '') === cleanNum) {
                return {
                    ...row,
                    is_open: !!row.is_open,
                    is_locked: !!row.is_locked,
                    locked: !!row.is_locked
                };
            }
        }
        return null;
    }

    // --- Work & Career Progression Engine ---
    async getWork(guildId, userId) {
        if (!this.db || !guildId || !userId) {
            return {
                guild_id: guildId,
                user_id: userId,
                career: 'engineer',
                level: 1,
                exp: 0,
                shifts_completed: 0,
                total_earned: 0,
                last_work: 0,
                work_streak: 0
            };
        }
        let row = await this.db.get('SELECT * FROM user_work WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (!row) {
            await this.db.run(
                'INSERT INTO user_work (guild_id, user_id, career, level, exp, shifts_completed, total_earned, last_work, work_streak) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [guildId, userId, 'engineer', 1, 0, 0, 0, 0, 0]
            );
            row = await this.db.get('SELECT * FROM user_work WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        }
        return row || {
            guild_id: guildId,
            user_id: userId,
            career: 'engineer',
            level: 1,
            exp: 0,
            shifts_completed: 0,
            total_earned: 0,
            last_work: 0,
            work_streak: 0
        };
    }

    async setWorkCareer(guildId, userId, careerId) {
        if (!this.db || !guildId || !userId) return false;
        await this.getWork(guildId, userId);
        await this.db.run(
            'UPDATE user_work SET career = ? WHERE guild_id = ? AND user_id = ?',
            [careerId, guildId, userId]
        );
        return true;
    }

    async saveWorkShift(guildId, userId, { career, level, exp, earned, lastWork, workStreak, strikes, overtimeLast }) {
        if (!this.db || !guildId || !userId) return false;
        await this.getWork(guildId, userId);
        const updates = ['career = ?', 'level = ?', 'exp = ?', 'shifts_completed = shifts_completed + 1', 'total_earned = total_earned + ?', 'last_work = ?', 'work_streak = ?'];
        const params = [career, level, exp, earned, lastWork, workStreak];
        if (strikes !== undefined) {
            updates.push('strikes = ?');
            params.push(strikes);
        }
        if (overtimeLast !== undefined) {
            updates.push('overtime_last = ?');
            params.push(overtimeLast);
        }
        params.push(guildId, userId);
        await this.db.run(`
            UPDATE user_work
            SET ${updates.join(', ')}
            WHERE guild_id = ? AND user_id = ?
        `, params);

        await this.db.run(`
            UPDATE user_cards
            SET earned_all_time = earned_all_time + ?
            WHERE guild_id = ? AND user_id = ?
        `, [earned, guildId, userId]);

        return true;
    }

    async setWorkLastWork(guildId, userId, lastWork) {
        if (!this.db || !guildId || !userId) return false;
        await this.getWork(guildId, userId);
        await this.db.run('UPDATE user_work SET last_work = ? WHERE guild_id = ? AND user_id = ?', [lastWork, guildId, userId]);
        return true;
    }

    async getWorkLeaderboard(guildId, limit = 10) {
        if (!this.db || !guildId) return [];
        return await this.db.all(`
            SELECT user_id, career, level, exp, shifts_completed, total_earned, work_streak, COALESCE(strikes, 0) AS strikes
            FROM user_work
            WHERE guild_id = ? AND shifts_completed > 0
            ORDER BY total_earned DESC LIMIT ?
        `, [guildId, limit]) || [];
    }

    // --- Inventory System ---
    async getInventory(guildId, userId) {
        return await this.db.all('SELECT item_id, amount FROM user_inventory WHERE guild_id = ? AND user_id = ? AND amount > 0 ORDER BY amount DESC', [guildId, userId]) || [];
    }

    async getItem(guildId, userId, itemId) {
        const row = await this.db.get('SELECT item_id, amount FROM user_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?', [guildId, userId, itemId]);
        return row ? row.amount : 0;
    }

    async addItem(guildId, userId, itemId, amount = 1) {
        await this.db.run(
            'INSERT INTO user_inventory (guild_id, user_id, item_id, amount) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET amount = amount + excluded.amount',
            [guildId, userId, itemId, amount]
        );
        return await this.getItem(guildId, userId, itemId);
    }

    async removeItem(guildId, userId, itemId, amount = 1) {
        const current = await this.getItem(guildId, userId, itemId);
        if (current < amount) return false;
        if (current === amount) {
            await this.db.run('DELETE FROM user_inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?', [guildId, userId, itemId]);
        } else {
            await this.db.run('UPDATE user_inventory SET amount = amount - ? WHERE guild_id = ? AND user_id = ? AND item_id = ?', [amount, guildId, userId, itemId]);
        }
        return true;
    }

    // --- Cooldowns ---
    async getEcoCooldown(guildId, userId, command) {
        const row = await this.db.get('SELECT timestamp FROM economy_cooldowns WHERE guild_id = ? AND user_id = ? AND command = ?', [guildId, userId, command]);
        if (!row) return 0;
        const now = Math.floor(Date.now() / 1000);
        return Math.max(0, row.timestamp - now);
    }

    async setEcoCooldown(guildId, userId, command, seconds) {
        const expireTs = Math.floor(Date.now() / 1000) + seconds;
        await this.db.run(
            'INSERT INTO economy_cooldowns (guild_id, user_id, command, timestamp) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id, user_id, command) DO UPDATE SET timestamp = excluded.timestamp',
            [guildId, userId, command, expireTs]
        );
    }

    // --- Active Item Buffs ---
    async getActiveItem(guildId, userId, itemId) {
        const row = await this.db.get('SELECT expires_at FROM economy_active_items WHERE guild_id = ? AND user_id = ? AND item_id = ?', [guildId, userId, itemId]);
        if (!row) return null;
        const now = Math.floor(Date.now() / 1000);
        if (row.expires_at <= now) {
            await this.db.run('DELETE FROM economy_active_items WHERE guild_id = ? AND user_id = ? AND item_id = ?', [guildId, userId, itemId]);
            return null;
        }
        return row.expires_at;
    }

    async setActiveItem(guildId, userId, itemId, durationSeconds) {
        const expiresAt = Math.floor(Date.now() / 1000) + durationSeconds;
        await this.db.run(
            'INSERT INTO economy_active_items (guild_id, user_id, item_id, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(guild_id, user_id, item_id) DO UPDATE SET expires_at = excluded.expires_at',
            [guildId, userId, itemId, expiresAt]
        );
    }

    async removeActiveItem(guildId, userId, itemId) {
        await this.db.run('DELETE FROM economy_active_items WHERE guild_id = ? AND user_id = ? AND item_id = ?', [guildId, userId, itemId]);
    }

    // --- Bounties ---
    async getBounty(guildId, targetId) {
        return await this.db.get('SELECT * FROM economy_bounties WHERE guild_id = ? AND target_id = ?', [guildId, targetId]);
    }

    async setBounty(guildId, targetId, setterId, amount) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(
            'INSERT INTO economy_bounties (guild_id, target_id, setter_id, amount, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(guild_id, target_id) DO UPDATE SET amount = amount + excluded.amount, setter_id = excluded.setter_id',
            [guildId, targetId, setterId, amount, now]
        );
    }

    async removeBounty(guildId, targetId) {
        await this.db.run('DELETE FROM economy_bounties WHERE guild_id = ? AND target_id = ?', [guildId, targetId]);
    }

    async getAllBounties(guildId) {
        return await this.db.all('SELECT * FROM economy_bounties WHERE guild_id = ? ORDER BY amount DESC', [guildId]) || [];
    }

    // --- Lottery Pool ---
    async getLotteryPool(guildId) {
        const rows = await this.db.all('SELECT user_id, tickets FROM economy_lottery WHERE guild_id = ?', [guildId]) || [];
        const totalTickets = rows.reduce((sum, r) => sum + r.tickets, 0);
        return { participants: rows, totalTickets, jackpot: totalTickets * 200 };
    }

    async buyLotteryTickets(guildId, userId, count) {
        await this.db.run(
            'INSERT INTO economy_lottery (guild_id, user_id, tickets) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET tickets = tickets + excluded.tickets',
            [guildId, userId, count]
        );
    }

    async drawLotteryWinner(guildId) {
        const pool = await this.getLotteryPool(guildId);
        if (pool.participants.length === 0 || pool.totalTickets === 0) return null;
        let rand = Math.floor(Math.random() * pool.totalTickets);
        let winnerId = null;
        for (const p of pool.participants) {
            if (rand < p.tickets) {
                winnerId = p.user_id;
                break;
            }
            rand -= p.tickets;
        }
        if (!winnerId) winnerId = pool.participants[0].user_id;
        await this.db.run('DELETE FROM economy_lottery WHERE guild_id = ?', [guildId]);
        return { winnerId, jackpot: pool.jackpot, totalTickets: pool.totalTickets };
    }

    // --- Admin Resets ---
    async resetUserEconomy(guildId, userId) {
        await this.db.run('DELETE FROM user_economy WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM user_inventory WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM economy_transactions WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM economy_cooldowns WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM economy_active_items WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM economy_bounties WHERE guild_id = ? AND (target_id = ? OR setter_id = ?)', [guildId, userId, userId]);
        await this.db.run('DELETE FROM user_cards WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM user_work WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    }

    // --- Pet System ---
    async getPet(guildId, userId) {
        const pet = await this.db.get('SELECT * FROM user_pets WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (!pet) return null;

        // Apply natural decay over time
        const now = Math.floor(Date.now() / 1000);
        const hoursPassed = pet.last_fed ? Math.floor((now - pet.last_fed) / 3600) : 0;
        if (hoursPassed > 0) {
            pet.hunger = Math.max(0, pet.hunger - (hoursPassed * 4));
            pet.hygiene = Math.max(0, pet.hygiene - (hoursPassed * 3));
            pet.energy = Math.min(100, pet.energy + (hoursPassed * 5));
        }
        return pet;
    }

    async adoptPet(guildId, userId, petType, petName) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(`
            INSERT INTO user_pets (guild_id, user_id, pet_type, pet_name, level, xp, hunger, hygiene, energy, loyalty, last_fed, last_washed, last_played, last_trained)
            VALUES (?, ?, ?, ?, 1, 0, 100, 100, 100, 100, ?, ?, ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET pet_type = excluded.pet_type, pet_name = excluded.pet_name, level = 1, xp = 0, hunger = 100, hygiene = 100, energy = 100, loyalty = 100
        `, [guildId, userId, petType, petName, now, now, now, now]);
        return await this.getPet(guildId, userId);
    }

    async abandonPet(guildId, userId) {
        await this.db.run('DELETE FROM user_pets WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
    }

    async feedPet(guildId, userId) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(`
            UPDATE user_pets SET hunger = MIN(100, hunger + 40), loyalty = MIN(100, loyalty + 5), xp = xp + 15, last_fed = ?
            WHERE guild_id = ? AND user_id = ?
        `, [now, guildId, userId]);
        return await this._checkPetLevelUp(guildId, userId);
    }

    async washPet(guildId, userId) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(`
            UPDATE user_pets SET hygiene = 100, loyalty = MIN(100, loyalty + 5), xp = xp + 10, last_washed = ?
            WHERE guild_id = ? AND user_id = ?
        `, [now, guildId, userId]);
        return await this._checkPetLevelUp(guildId, userId);
    }

    async playPet(guildId, userId) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(`
            UPDATE user_pets SET energy = MAX(0, energy - 20), loyalty = MIN(100, loyalty + 10), xp = xp + 25, last_played = ?
            WHERE guild_id = ? AND user_id = ?
        `, [now, guildId, userId]);
        return await this._checkPetLevelUp(guildId, userId);
    }

    async trainPet(guildId, userId) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run(`
            UPDATE user_pets SET energy = MAX(0, energy - 35), hunger = MAX(0, hunger - 15), xp = xp + 50, last_trained = ?
            WHERE guild_id = ? AND user_id = ?
        `, [now, guildId, userId]);
        return await this._checkPetLevelUp(guildId, userId);
    }

    async _checkPetLevelUp(guildId, userId) {
        const pet = await this.db.get('SELECT * FROM user_pets WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (!pet) return null;
        const requiredXp = pet.level * 100;
        if (pet.xp >= requiredXp) {
            await this.db.run('UPDATE user_pets SET level = level + 1, xp = xp - ? WHERE guild_id = ? AND user_id = ?', [requiredXp, guildId, userId]);
            pet.level += 1;
            pet.leveledUp = true;
        }
        return pet;
    }

    // --- Marriage System ---
    async getMarriage(guildId, userId) {
        const row = await this.db.get('SELECT * FROM user_marriages WHERE guild_id = ? AND (user1_id = ? OR user2_id = ?)', [guildId, userId, userId]);
        if (!row) return null;
        const partnerId = row.user1_id === userId ? row.user2_id : row.user1_id;
        return { ...row, partnerId };
    }

    async createMarriage(guildId, user1Id, user2Id) {
        const now = Math.floor(Date.now() / 1000);
        await this.db.run('INSERT INTO user_marriages (guild_id, user1_id, user2_id, created_at, level) VALUES (?, ?, ?, ?, 1)', [guildId, user1Id, user2Id, now]);
        return await this.getMarriage(guildId, user1Id);
    }

    async deleteMarriage(guildId, userId) {
        await this.db.run('DELETE FROM user_marriages WHERE guild_id = ? AND (user1_id = ? OR user2_id = ?)', [guildId, userId, userId]);
    }

    // --- Prestige System ---
    async prestigeUser(guildId, userId) {
        const eco = await this.getEconomy(guildId, userId);
        const newPrestige = (eco.prestige || 0) + 1;
        // Wipe wallet & bank, preserve vault and bump prestige
        await this.db.run('UPDATE user_economy SET wallet = 1000, bank = 0, prestige = ? WHERE guild_id = ? AND user_id = ?', [newPrestige, guildId, userId]);
        return newPrestige;
    }

    async resetGuildEconomy(guildId) {
        await this.db.run('DELETE FROM user_economy WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM user_inventory WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM economy_transactions WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM economy_cooldowns WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM economy_active_items WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM economy_bounties WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM economy_lottery WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM user_pets WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM user_marriages WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM user_cards WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM user_work WHERE guild_id = ?', [guildId]);
    }

    // --- Invite Tracking System ---
    async getUserInvites(guildId, userId) {
        if (!this.db || !guildId || !userId) return { joins: 0, leaves: 0, fakes: 0, bonus: 0, total: 0 };
        const row = await this.db.get('SELECT * FROM user_invites WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        if (!row) return { joins: 0, leaves: 0, fakes: 0, bonus: 0, total: 0 };
        const total = (row.joins || 0) - (row.leaves || 0) + (row.bonus || 0);
        return {
            joins: row.joins || 0,
            leaves: row.leaves || 0,
            fakes: row.fakes || 0,
            bonus: row.bonus || 0,
            total
        };
    }

    async recordInviteJoin(guildId, memberId, inviterId, code, isFake = false) {
        if (!this.db) return;
        const existing = await this.db.get('SELECT inviter_id FROM member_invites WHERE guild_id = ? AND member_id = ?', [guildId, memberId]);
        if (existing) return;

        await this.db.run(
            'INSERT OR REPLACE INTO member_invites (guild_id, member_id, inviter_id, code, timestamp) VALUES (?, ?, ?, ?, ?)',
            [guildId, memberId, inviterId, code, Math.floor(Date.now() / 1000)]
        );

        if (isFake) {
            await this.db.run(`
                INSERT INTO user_invites (guild_id, user_id, joins, fakes) VALUES (?, ?, 1, 1)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET joins = joins + 1, fakes = fakes + 1
            `, [guildId, inviterId]);
        } else {
            await this.db.run(`
                INSERT INTO user_invites (guild_id, user_id, joins) VALUES (?, ?, 1)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET joins = joins + 1
            `, [guildId, inviterId]);
        }
    }

    async recordInviteLeave(guildId, memberId) {
        if (!this.db) return;
        const row = await this.db.get('SELECT inviter_id FROM member_invites WHERE guild_id = ? AND member_id = ?', [guildId, memberId]);
        if (!row || !row.inviter_id) return;

        await this.db.run(`
            UPDATE user_invites SET leaves = leaves + 1 WHERE guild_id = ? AND user_id = ?
        `, [guildId, row.inviter_id]);
    }

    async addBonusInvites(guildId, userId, amount) {
        return await this.adjustBonusInvites(guildId, userId, amount);
    }

    async adjustBonusInvites(guildId, userId, amount) {
        if (!this.db || !guildId || !userId) return 0;
        await this.db.run(`
            INSERT INTO user_invites (guild_id, user_id, bonus) VALUES (?, ?, ?)
            ON CONFLICT(guild_id, user_id) DO UPDATE SET bonus = bonus + ?
        `, [guildId, userId, amount, amount]);

        const row = await this.db.get(`
            SELECT bonus FROM user_invites WHERE guild_id = ? AND user_id = ?
        `, [guildId, userId]);
        return row?.bonus || 0;
    }

    async resetUserInvites(guildId, userId) {
        if (!this.db) return;
        await this.db.run('DELETE FROM user_invites WHERE guild_id = ? AND user_id = ?', [guildId, userId]);
        await this.db.run('DELETE FROM member_invites WHERE guild_id = ? AND inviter_id = ?', [guildId, userId]);
    }

    async resetAllGuildInvites(guildId) {
        return await this.resetGuildInvites(guildId);
    }

    async resetGuildInvites(guildId) {
        if (!this.db) return;
        await this.db.run('DELETE FROM user_invites WHERE guild_id = ?', [guildId]);
        await this.db.run('DELETE FROM member_invites WHERE guild_id = ?', [guildId]);
    }

    async getTopInviters(guildId, limit = 10) {
        if (!this.db) return [];
        return await this.db.all(`
            SELECT user_id, joins, leaves, fakes, bonus, ((joins - leaves) + bonus) as total
            FROM user_invites
            WHERE guild_id = ?
            ORDER BY total DESC
            LIMIT ?
        `, [guildId, limit]) || [];
    }

    // --- Guild Movement ---
    async recordGuildMovement(guildId, type) {
        if (!this.db || !guildId) return;
        await this.db.run(
            'INSERT INTO guild_movement (guild_id, type, timestamp) VALUES (?, ?, ?)',
            [guildId, type, Math.floor(Date.now() / 1000)]
        );
    }

    async getGuildMovement(guildId) {
        if (!this.db || !guildId) return { joins1h: 0, leaves1h: 0, joins24h: 0, leaves24h: 0 };
        const now = Math.floor(Date.now() / 1000);
        const oneHourAgo = now - 3600;
        const oneDayAgo = now - 86400;

        const rows = await this.db.all(
            'SELECT type, timestamp FROM guild_movement WHERE guild_id = ? AND timestamp >= ?',
            [guildId, oneDayAgo]
        ) || [];

        let joins1h = 0, leaves1h = 0, joins24h = 0, leaves24h = 0;
        for (const r of rows) {
            if (r.type === 'join') {
                joins24h++;
                if (r.timestamp >= oneHourAgo) joins1h++;
            } else if (r.type === 'leave') {
                leaves24h++;
                if (r.timestamp >= oneHourAgo) leaves1h++;
            }
        }
        return { joins1h, leaves1h, joins24h, leaves24h };
    }

    // --- Giveaway System ---
    async createGiveaway({ messageId, channelId, guildId, hostId, prize, winnersCount, endsAt, imageUrl = null, requirement = null }) {
        if (!this.db) return null;
        const now = Math.floor(Date.now() / 1000);
        const result = await this.db.run(`
            INSERT INTO giveaways (message_id, channel_id, guild_id, host_id, prize, winners_count, ends_at, image_url, requirement, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [messageId, channelId, guildId, hostId, prize, winnersCount, endsAt, imageUrl, requirement, now]);
        return result?.lastInsertRowid || result?.lastID;
    }

    async getGiveawayByMessageId(messageId) {
        if (!this.db) return null;
        return await this.db.get('SELECT * FROM giveaways WHERE message_id = ?', [messageId]) || null;
    }

    async getGiveawayById(id) {
        if (!this.db) return null;
        return await this.db.get('SELECT * FROM giveaways WHERE id = ?', [id]) || null;
    }

    async getLatestGiveaway(guildId, channelId = null, { activeOnly = false, endedOnly = false } = {}) {
        if (!this.db) return null;
        let query = 'SELECT * FROM giveaways WHERE guild_id = ?';
        const params = [guildId];

        if (channelId) {
            query += ' AND channel_id = ?';
            params.push(channelId);
        }
        if (activeOnly) {
            query += ' AND ended = 0 AND cancelled = 0';
        } else if (endedOnly) {
            query += ' AND ended = 1 AND cancelled = 0';
        }

        query += ' ORDER BY created_at DESC LIMIT 1';
        let row = await this.db.get(query, params);

        if (!row && channelId) {
            let fallbackQuery = 'SELECT * FROM giveaways WHERE guild_id = ?';
            const fallbackParams = [guildId];
            if (activeOnly) fallbackQuery += ' AND ended = 0 AND cancelled = 0';
            else if (endedOnly) fallbackQuery += ' AND ended = 1 AND cancelled = 0';
            fallbackQuery += ' ORDER BY created_at DESC LIMIT 1';
            row = await this.db.get(fallbackQuery, fallbackParams);
        }

        return row || null;
    }

    async getActiveGiveaways(guildId = null) {
        if (!this.db) return [];
        if (guildId) {
            return await this.db.all('SELECT * FROM giveaways WHERE guild_id = ? AND ended = 0 AND cancelled = 0 ORDER BY ends_at ASC', [guildId]) || [];
        }
        return await this.db.all('SELECT * FROM giveaways WHERE ended = 0 AND cancelled = 0 ORDER BY ends_at ASC') || [];
    }

    async updateGiveawayPrize(id, prize) {
        if (!this.db) return;
        await this.db.run('UPDATE giveaways SET prize = ? WHERE id = ?', [prize, id]);
    }

    async updateGiveawayEndsAt(id, endsAt) {
        if (!this.db) return;
        await this.db.run('UPDATE giveaways SET ends_at = ? WHERE id = ?', [endsAt, id]);
    }

    async updateGiveawayImage(id, imageUrl) {
        if (!this.db) return;
        await this.db.run('UPDATE giveaways SET image_url = ? WHERE id = ?', [imageUrl, id]);
    }

    async updateGiveawayRequirement(id, requirement) {
        if (!this.db) return;
        await this.db.run('UPDATE giveaways SET requirement = ? WHERE id = ?', [requirement, id]);
    }

    async cancelGiveaway(id) {
        if (!this.db) return;
        await this.db.run('UPDATE giveaways SET ended = 1, cancelled = 1 WHERE id = ?', [id]);
    }

    async endGiveaway(id, winners = []) {
        if (!this.db) return;
        const winnersJson = JSON.stringify(winners);
        if (winners.length > 0) {
            await this.db.run('UPDATE giveaways SET ended = 1, winners = ? WHERE id = ?', [winnersJson, id]);
        } else {
            await this.db.run('UPDATE giveaways SET ended = 1 WHERE id = ?', [id]);
        }
    }

    async deleteGiveaway(messageId) {
        if (!this.db) return false;
        const gw = await this.getGiveawayByMessageId(messageId);
        if (!gw) return false;
        await this.db.run('DELETE FROM giveaway_entries WHERE giveaway_id = ?', [gw.id]);
        await this.db.run('DELETE FROM giveaways WHERE id = ?', [gw.id]);
        return true;
    }

    async addGiveawayEntry(giveawayId, userId) {
        if (!this.db) return false;
        try {
            await this.db.run(`
                INSERT INTO giveaway_entries (giveaway_id, user_id, entered_at)
                VALUES (?, ?, ?)
            `, [giveawayId, userId, Math.floor(Date.now() / 1000)]);
            return true;
        } catch (_) {
            return false;
        }
    }

    async removeGiveawayEntry(giveawayId, userId) {
        if (!this.db) return false;
        const res = await this.db.run('DELETE FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?', [giveawayId, userId]);
        return res?.changes > 0;
    }

    async hasUserEnteredGiveaway(giveawayId, userId) {
        if (!this.db) return false;
        const row = await this.db.get('SELECT 1 FROM giveaway_entries WHERE giveaway_id = ? AND user_id = ?', [giveawayId, userId]);
        return Boolean(row);
    }

    async getGiveawayEntries(giveawayId) {
        if (!this.db || !giveawayId) return [];
        const rows = await this.db.all('SELECT user_id FROM giveaway_entries WHERE giveaway_id = ? ORDER BY entered_at ASC', [giveawayId]) || [];
        return rows.map(r => r.user_id);
    }

    async getGiveawayEntriesCount(giveawayId) {
        if (!this.db || !giveawayId) return 0;
        const row = await this.db.get('SELECT COUNT(*) as count FROM giveaway_entries WHERE giveaway_id = ?', [giveawayId]);
        return row ? row.count : 0;
    }

    async getCommandUses(userId, command) {
        if (!this.db || !userId || !command) return 0;
        const row = await this.db.get('SELECT uses FROM free_command_uses WHERE user_id = ? AND command = ?', [userId, command]);
        return row ? row.uses : 0;
    }

    async incrementCommandUses(userId, command) {
        if (!this.db || !userId || !command) return 1;
        await this.db.run(
            `INSERT INTO free_command_uses (user_id, command, uses) VALUES (?, ?, 1)
             ON CONFLICT(user_id, command) DO UPDATE SET uses = uses + 1`,
            [userId, command]
        );
        const row = await this.db.get('SELECT uses FROM free_command_uses WHERE user_id = ? AND command = ?', [userId, command]);
        return row ? row.uses : 1;
    }

    // --- User Profiles & Premium ---
    async getUserProfile(userId, createIfMissing = false) {
        if (!this.db || !userId) return null;
        const row = await this.db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
        if (!row && createIfMissing) {
            return await this.ensureUserProfile(userId);
        }
        return row || null;
    }

    async ensureUserProfile(userId) {
        if (!this.db || !userId) return null;
        let row = await this.db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
        if (row) return row;

        const config = require('../../../config.js');
        const isOwner = config.owners?.includes(userId);

        let nextUid;
        if (isOwner) {
            const zeroRow = await this.db.get('SELECT * FROM user_profiles WHERE uid = 0');
            if (!zeroRow) {
                nextUid = 0;
            } else {
                const maxRow = await this.db.get('SELECT MAX(uid) AS max_uid FROM user_profiles WHERE uid IS NOT NULL');
                nextUid = (maxRow?.max_uid !== null && maxRow?.max_uid !== undefined) ? Number(maxRow.max_uid) + 1 : 1;
            }
        } else {
            const maxRow = await this.db.get('SELECT MAX(uid) AS max_uid FROM user_profiles WHERE uid IS NOT NULL');
            if (maxRow?.max_uid !== null && maxRow?.max_uid !== undefined) {
                nextUid = Number(maxRow.max_uid) + 1;
            } else {
                nextUid = 1;
            }
        }

        const now = Math.floor(Date.now() / 1000);
        const tier = isOwner ? 'owner' : 'standard';
        const premiumSince = isOwner ? now : null;

        try {
            await this.db.run(
                'INSERT INTO user_profiles (user_id, uid, tier, premium_since, premium_expires) VALUES (?, ?, ?, ?, ?)',
                [userId, nextUid, tier, premiumSince, null]
            );
            return { user_id: userId, uid: nextUid, tier, premium_since: premiumSince, premium_expires: null };
        } catch (_) {
            return await this.db.get('SELECT * FROM user_profiles WHERE user_id = ?', [userId]);
        }
    }

    async getUserProfileByUid(uid) {
        if (!this.db || uid === null || uid === undefined) return null;
        const num = parseInt(uid, 10);
        if (isNaN(num)) return null;
        return await this.db.get('SELECT * FROM user_profiles WHERE uid = ?', [num]);
    }

    async resolveUserOrProfile(input) {
        if (!this.db || !input) return null;
        if (typeof input === 'object' && input !== null) {
            input = input.id || input.userId || input.user_id || input.uid || '';
        }
        const clean = String(input).replace(/[<@!>]/g, '').trim();
        const num = parseInt(clean, 10);
        if (!isNaN(num) && clean.length < 17) {
            const byUid = await this.db.get('SELECT * FROM user_profiles WHERE uid = ?', [num]);
            if (byUid) return { userId: byUid.user_id, profile: byUid };
        }
        const byUserId = await this.db.get('SELECT * FROM user_profiles WHERE user_id = ?', [clean]);
        if (byUserId) return { userId: clean, profile: byUserId };
        return null;
    }

    async setUserPremium(userId, tier = 'premium', durationSeconds = null) {
        if (!this.db || !userId) return false;
        const now = Math.floor(Date.now() / 1000);
        const expires = durationSeconds ? now + durationSeconds : null;
        await this.ensureUserProfile(userId);
        const existing = await this.db.get('SELECT premium_since FROM user_profiles WHERE user_id = ?', [userId]);
        const since = existing?.premium_since || now;
        await this.db.run(
            'UPDATE user_profiles SET tier = ?, premium_since = ?, premium_expires = ? WHERE user_id = ?',
            [tier, since, expires, userId]
        );
        return true;
    }

    async revokeUserPremium(userId) {
        if (!this.db || !userId) return false;
        await this.ensureUserProfile(userId);
        await this.db.run(
            'UPDATE user_profiles SET tier = ?, premium_since = NULL, premium_expires = NULL WHERE user_id = ?',
            ['standard', userId]
        );
        return true;
    }

    async isUserPremium(userId) {
        if (!userId) return false;
        const config = require('../../../config.js');
        if (config.owners?.includes(userId)) return true;
        const profile = await this.getUserProfile(userId);
        if (!profile || profile.tier === 'standard') return false;
        const now = Math.floor(Date.now() / 1000);
        if (profile.premium_expires && profile.premium_expires <= now) {
            await this.db.run(
                'UPDATE user_profiles SET tier = ?, premium_since = NULL, premium_expires = NULL WHERE user_id = ?',
                ['standard', userId]
            );
            return false;
        }
        return true;
    }

    async getUserCommandUses(userId, commandName) {
        if (!this.db || !userId || !commandName) return 0;
        const row = await this.db.get(
            'SELECT uses FROM free_command_uses WHERE user_id = ? AND command = ?',
            [userId, commandName]
        );
        return row ? (row.uses || 0) : 0;
    }

    async incrementUserCommandUses(userId, commandName) {
        if (!this.db || !userId || !commandName) return 1;
        const existing = await this.getUserCommandUses(userId, commandName);
        if (existing === 0) {
            await this.db.run(
                'INSERT INTO free_command_uses (user_id, command, uses) VALUES (?, ?, 1)',
                [userId, commandName]
            );
            return 1;
        } else {
            await this.db.run(
                'UPDATE free_command_uses SET uses = uses + 1 WHERE user_id = ? AND command = ?',
                [userId, commandName]
            );
            return existing + 1;
        }
    }
}

module.exports = DatabaseManager;
