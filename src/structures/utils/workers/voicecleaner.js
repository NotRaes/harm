const { ChannelType } = require('discord.js');
const VoiceMasterHelper = require('../helpers/voiceMasterHelper.js');

class VoiceCleanerWorker {
    /**
     * Sweeps a specific guild for empty or orphaned VoiceMaster channels
     * and synchronizes the active VCs counter.
     */
    static async sweepGuild(guild, db) {
        if (!guild || !db) return;
        try {
            const setup = await db.getVoiceMasterSetup(guild.id);
            if (!setup) return;

            const categoryId = setup.category_id;
            const j2cId = setup.vc_id;
            const counterId = setup.counter_channel_id;
            const waitingRoomId = setup.waiting_room_id;

            const activeVCs = await db.getAllActiveVCs(guild.id);
            const activeMap = new Map();
            for (const avc of activeVCs) {
                activeMap.set(avc.channel_id, avc);
            }

            // 1. Check all tracked active VCs in database
            for (const [channelId] of activeMap) {
                let ch = guild.channels.cache.get(channelId);
                if (!ch) {
                    ch = await guild.channels.fetch(channelId).catch(() => null);
                }

                if (!ch) {
                    // Channel was manually deleted or no longer exists in Discord
                    await db.removeActiveVC(channelId);
                    continue;
                }

                if (ch.members.size === 0) {
                    // Channel is empty, delete channel and remove from DB
                    await db.removeActiveVC(channelId);
                    await ch.delete('VoiceMaster cleaner: channel empty').catch(() => {});
                }
            }

            // 2. Check all voice channels in the VoiceMaster category for orphan channels
            if (categoryId) {
                let category = guild.channels.cache.get(categoryId);
                if (!category) {
                    category = await guild.channels.fetch(categoryId).catch(() => null);
                }

                if (category) {
                    // Fetch all channels in the guild to ensure full cache for this category
                    const categoryChannels = guild.channels.cache.filter(
                        c => c.parentId === categoryId && c.type === ChannelType.GuildVoice
                    );

                    for (const [, ch] of categoryChannels) {
                        // Skip system channels (j2c, counter channel, waiting room)
                        if (ch.id === j2cId || ch.id === counterId || ch.id === waitingRoomId) {
                            continue;
                        }

                        // Check if empty
                        if (ch.members.size === 0) {
                            await db.removeActiveVC(ch.id);
                            await ch.delete('VoiceMaster cleaner: orphan empty channel').catch(() => {});
                        } else {
                            // Non-empty channel: ensure it is tracked in DB
                            const tracked = await db.getActiveVC(ch.id);
                            if (!tracked) {
                                const owner = ch.members.first();
                                if (owner) {
                                    await db.addActiveVC(ch.id, owner.id, guild.id);
                                }
                            }
                        }
                    }
                }
            }

            // 3. Synchronize counter channel to the true active voice channel count
            await VoiceMasterHelper.updateCounter(guild, db);
        } catch (err) {
            console.error(`[voicecleaner error in guild ${guild.id}]:`, err.message);
        }
    }

    /**
     * Sweeps all guilds where the bot is currently joined
     */
    static async sweepAll(client) {
        if (!client || !client.isReady() || !client.db) return;
        const db = client.db;
        for (const guild of client.guilds.cache.values()) {
            await VoiceCleanerWorker.sweepGuild(guild, db).catch(() => {});
        }
    }

    /**
     * Starts the periodic background voice cleaner worker and executes an immediate startup sweep
     */
    static start(client, intervalMs = 30_000) {
        // Run an immediate sweep on startup to purge any channels left while offline
        VoiceCleanerWorker.sweepAll(client).catch(err => {
            console.error('[voicecleaner initial sweep error]:', err.message);
        });

        // Setup recurring background safety net interval
        const timer = setInterval(() => {
            VoiceCleanerWorker.sweepAll(client).catch(() => {});
        }, intervalMs);

        return timer;
    }
}

module.exports = VoiceCleanerWorker;
