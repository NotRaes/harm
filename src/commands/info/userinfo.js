const {
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    EmbedBuilder
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const ffmpegPath = require('ffmpeg-static');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const config = require('../../config.js');

const BADGE_MAP = {
    HypeSquadOnlineHouse1: { name: 'hypesquad bravery', emoji: '<:badge_bravery:1558785234550526013>' },
    HypeSquadOnlineHouse2: { name: 'hypesquad brilliance', emoji: '<:badge_brilliance:1558785306474451098>' },
    HypeSquadOnlineHouse3: { name: 'hypesquad balance', emoji: '<:badge_balance:1558785312640081974>' },
    ActiveDeveloper: { name: 'active developer', emoji: '<:badge_activedev:1558785319094984724>' },
    PremiumEarlySupporter: { name: 'early supporter', emoji: '<:badge_earlysupporter:1558785325017473035>' },
    VerifiedDeveloper: { name: 'early verified bot developer', emoji: '<:badge_verifieddev:1558785330621055109>' },
    Staff: { name: 'discord staff', emoji: '<:badge_staff:1558785336719704095>' },
    Partner: { name: 'partnered server owner', emoji: '<:badge_partner:1558785342985740370>' },
    BugHunterLevel1: { name: 'bug hunter level 1', emoji: '<:badge_bughunter1:1558785349088583770>' },
    BugHunterLevel2: { name: 'bug hunter level 2', emoji: '<:badge_bughunter2:1558785354817994833>' },
    CertifiedModerator: { name: 'certified moderator', emoji: '<:badge_mod:1558785360572452904>' }
};

function fetchRawUser(token, userId) {
    return new Promise((resolve) => {
        const req = https.request(`https://discord.com/api/v10/users/${userId}`, {
            headers: { 'Authorization': `Bot ${token}` }
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.end();
    });
}

function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sx, sy, sw, sh;
    if (imgRatio > targetRatio) {
        sh = img.height;
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
        sy = 0;
    } else {
        sw = img.width;
        sh = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sh) / 2;
    }
    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

async function renderProfileBanner(user, member, rawUser) {
    const width = 680;
    const height = 210;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background: User banner image > User banner/accent color > Sleek dark Harm gradient
    let bannerImg = null;
    const rawBanner = rawUser?.banner;
    const bannerUrl = (rawBanner ? `https://cdn.discordapp.com/banners/${user.id}/${rawBanner}.png?size=1024` : null)
        || user.bannerURL?.({ size: 1024, extension: 'png' })
        || member?.bannerURL?.({ size: 1024, extension: 'png' });

    if (bannerUrl) {
        bannerImg = await loadImage(bannerUrl).catch(() => null);
    }

    if (bannerImg) {
        drawImageCover(ctx, bannerImg, 0, 0, width, height);
    } else {
        let colorHex = rawUser?.banner_color;
        if (!colorHex && rawUser?.accent_color !== null && rawUser?.accent_color !== undefined) {
            colorHex = '#' + rawUser.accent_color.toString(16).padStart(6, '0');
        }
        if (!colorHex && user.hexAccentColor) {
            colorHex = user.hexAccentColor;
        }
        if (!colorHex && member?.displayHexColor && member.displayHexColor !== '#000000') {
            colorHex = member.displayHexColor;
        }

        if (colorHex) {
            ctx.fillStyle = colorHex;
            ctx.fillRect(0, 0, width, height);
        } else {
            const grad = ctx.createLinearGradient(0, 0, 0, height);
            grad.addColorStop(0, '#2b2d31');
            grad.addColorStop(1, '#18191c');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, width, height);
        }
    }

    // Subtle dark gradient overlay at bottom
    const vignette = ctx.createLinearGradient(0, height - 80, 0, height);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, height - 80, width, 80);

    // Subtle outer frosted outline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

    // 2. Custom status text (Live from activities)
    let statusText = null;
    if (member?.presence?.activities) {
        const custom = member.presence.activities.find(a => a.type === 4 || a.name === 'Custom Status');
        if (custom?.state) statusText = custom.state.trim();
    }

    // Dynamic Avatar Placement: Centered if no custom status, left-aligned if custom status exists
    const avX = statusText ? 130 : 340;
    const avY = 105;
    const avRadius = 48;

    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
    let avatarImg = null;
    try {
        avatarImg = await loadImage(avatarUrl);
    } catch {}

    if (avatarImg) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(avX, avY, avRadius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, avX - avRadius, avY - avRadius, avRadius * 2, avRadius * 2);
        ctx.restore();
    }

    // 3. Status Indicator Dot (Live from presence with authentic Discord glyphs)
    const status = member?.presence?.status || 'offline';
    const statusColors = {
        online: '#23a55a',
        idle: '#f0b232',
        dnd: '#f23f43',
        offline: '#80848e'
    };
    const stColor = statusColors[status] || statusColors.offline;

    const stX = avX + 33;
    const stY = avY + 33;

    // Dark outline ring
    ctx.beginPath();
    ctx.arc(stX, stY, 15, 0, Math.PI * 2);
    ctx.fillStyle = '#18191c';
    ctx.fill();

    // Base status circle
    ctx.beginPath();
    ctx.arc(stX, stY, 11, 0, Math.PI * 2);
    ctx.fillStyle = stColor;
    ctx.fill();

    // Authentic status glyphs
    if (status === 'dnd') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(stX - 6, stY - 2, 12, 4, 1.5);
        ctx.fill();
    } else if (status === 'idle') {
        ctx.fillStyle = '#18191c';
        ctx.beginPath();
        ctx.arc(stX - 4, stY - 4, 7.5, 0, Math.PI * 2);
        ctx.fill();
    } else if (status === 'offline') {
        ctx.fillStyle = '#18191c';
        ctx.beginPath();
        ctx.arc(stX, stY, 5.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Custom status text (rendered to right of avatar when present)
    if (statusText) {
        ctx.font = '21px sans-serif';
        ctx.fillStyle = '#e8eaed';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;

        let displayStatus = statusText;
        if (ctx.measureText(displayStatus).width > 400) {
            while (displayStatus.length > 3 && ctx.measureText(displayStatus + '...').width > 400) {
                displayStatus = displayStatus.slice(0, -1);
            }
            displayStatus += '...';
        }
        ctx.fillText(displayStatus, 220, 117);
        ctx.shadowColor = 'transparent';
    }

    // 5. Clan / Guild Tag Pill
    const clan = rawUser?.clan || rawUser?.primary_guild;
    if (clan && clan.tag) {
        const tagText = clan.tag;
        let badgeImg = null;
        if (clan.badge && clan.identity_guild_id) {
            const badgeUrl = `https://cdn.discordapp.com/clan-badges/${clan.identity_guild_id}/${clan.badge}.png`;
            badgeImg = await loadImage(badgeUrl).catch(() => null);
        }

        ctx.font = 'bold 15px monospace';
        const textWidth = ctx.measureText(tagText).width;
        const pillW = Math.max(75, Math.ceil((badgeImg ? 36 : 14) + textWidth + 14));
        const pillH = 34;
        const pillX = width - 15 - pillW;
        const pillY = height - 15 - pillH;

        ctx.beginPath();
        ctx.roundRect(pillX, pillY, pillW, pillH, 8);
        ctx.fillStyle = 'rgba(18, 19, 22, 0.75)';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.stroke();

        if (badgeImg) {
            ctx.drawImage(badgeImg, pillX + 8, pillY + 6, 22, 22);
        }

        ctx.fillStyle = '#f0f2f5';
        ctx.fillText(tagText, pillX + (badgeImg ? 36 : 12), pillY + 23);
    }

    // 6. Dynamic Animation Generation
    const decoAsset = rawUser?.avatar_decoration_data?.asset || null;
    const isAnimatedAvatar = Boolean(user.avatar && user.avatar.startsWith('a_'));
    const basePng = canvas.toBuffer('image/png');

    // Case A: Animated Avatar Decoration
    if (decoAsset && decoAsset.startsWith('a_')) {
        const decoUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${decoAsset}.png?size=512`;
        const tmpDir = os.tmpdir();
        const tempPng = path.join(tmpDir, `harm_ui_${Date.now()}_${Math.random().toString(36).substring(2)}.png`);
        const tempGif = path.join(tmpDir, `harm_ui_${Date.now()}_${Math.random().toString(36).substring(2)}.gif`);

        try {
            fs.writeFileSync(tempPng, basePng);

            const decoSize = 122;
            const decoX = Math.round(avX - decoSize / 2);
            const decoY = Math.round(avY - decoSize / 2);

            const filter = `[1:v]scale=${decoSize}:${decoSize}[d];[0:v][d]overlay=${decoX}:${decoY}:shortest=1[ov];[ov]split[o1][o2];[o1]palettegen=reserve_transparent=0[p];[o2][p]paletteuse=dither=floyd_steinberg`;

            const args = [
                '-y',
                '-loop', '1',
                '-i', tempPng,
                '-i', decoUrl,
                '-filter_complex', filter,
                '-t', '2.5',
                tempGif
            ];

            await new Promise((resolve, reject) => {
                const proc = spawn(ffmpegPath, args);
                proc.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`ffmpeg exited with code ${code}`));
                });
                proc.on('error', reject);
            });

            if (fs.existsSync(tempGif)) {
                const gifBuffer = fs.readFileSync(tempGif);
                try { fs.unlinkSync(tempPng); } catch {}
                try { fs.unlinkSync(tempGif); } catch {}
                return { buffer: gifBuffer, filename: 'profile.gif' };
            }
        } catch (err) {
            console.error('Failed to generate animated deco GIF:', err.message);
            try { if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng); } catch {}
            try { if (fs.existsSync(tempGif)) fs.unlinkSync(tempGif); } catch {}
        }
    }

    // Case B: Static Avatar Decoration
    if (decoAsset && !decoAsset.startsWith('a_')) {
        const decoUrl = `https://cdn.discordapp.com/avatar-decoration-presets/${decoAsset}.png?size=512`;
        try {
            const decoImg = await loadImage(decoUrl);
            const decoSize = 124;
            ctx.drawImage(decoImg, Math.round(avX - decoSize / 2), Math.round(avY - decoSize / 2), decoSize, decoSize);
            return { buffer: canvas.toBuffer('image/png'), filename: 'profile.png' };
        } catch {
            return { buffer: basePng, filename: 'profile.png' };
        }
    }

    // Case C: Animated Avatar without decoration
    if (isAnimatedAvatar && !decoAsset) {
        const animAvatarUrl = user.displayAvatarURL({ extension: 'gif', size: 256 });
        const tmpDir = os.tmpdir();
        const tempPng = path.join(tmpDir, `harm_ui_${Date.now()}_${Math.random().toString(36).substring(2)}.png`);
        const maskPng = path.join(tmpDir, `harm_mask_${Date.now()}.png`);
        const tempGif = path.join(tmpDir, `harm_ui_${Date.now()}_${Math.random().toString(36).substring(2)}.gif`);

        try {
            fs.writeFileSync(tempPng, basePng);

            const maskCanvas = createCanvas(96, 96);
            const mctx = maskCanvas.getContext('2d');
            mctx.beginPath();
            mctx.arc(48, 48, 48, 0, Math.PI * 2);
            mctx.fillStyle = '#ffffff';
            mctx.fill();
            fs.writeFileSync(maskPng, maskCanvas.toBuffer('image/png'));

            const filter = `[1:v]scale=96:96,format=rgba[av];[av][2:v]alphamerge[avc];[0:v][avc]overlay=${avX - avRadius}:${avY - avRadius}:shortest=1[ov];[ov]split[o1][o2];[o1]palettegen=reserve_transparent=0[p];[o2][p]paletteuse=dither=floyd_steinberg`;

            const args = [
                '-y',
                '-loop', '1',
                '-i', tempPng,
                '-i', animAvatarUrl,
                '-i', maskPng,
                '-filter_complex', filter,
                '-t', '2.5',
                tempGif
            ];

            await new Promise((resolve, reject) => {
                const proc = spawn(ffmpegPath, args);
                proc.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`ffmpeg exited with code ${code}`));
                });
                proc.on('error', reject);
            });

            if (fs.existsSync(tempGif)) {
                const gifBuffer = fs.readFileSync(tempGif);
                try { fs.unlinkSync(tempPng); } catch {}
                try { fs.unlinkSync(maskPng); } catch {}
                try { fs.unlinkSync(tempGif); } catch {}
                return { buffer: gifBuffer, filename: 'profile.gif' };
            }
        } catch (err) {
            try { if (fs.existsSync(tempPng)) fs.unlinkSync(tempPng); } catch {}
            try { if (fs.existsSync(maskPng)) fs.unlinkSync(maskPng); } catch {}
            try { if (fs.existsSync(tempGif)) fs.unlinkSync(tempGif); } catch {}
        }
    }

    return { buffer: basePng, filename: 'profile.png' };
}

class UserInfoCommand {
    constructor() {
        this.name = 'userinfo';
        this.aliases = ['ui', 'whois'];
        this.description = 'display member profile, identity, and server statistics.';
        this.cooldown = 2;
    }

    async execute(message, args) {
        let targetUser = message.author;

        if (args && args.length > 0) {
            const rawId = args[0].replace(/[<@!>]/g, '');
            targetUser = message.mentions?.users?.first()
                || message.guild?.members?.cache?.get(rawId)?.user
                || message.client.users.cache.get(rawId)
                || await message.client.users.fetch(rawId, { force: true }).catch(() => null)
                || message.author;
        }

        const targetMember = message.guild?.members?.cache?.get(targetUser.id)
            || (typeof message.guild?.members?.fetch === 'function'
                ? await message.guild.members.fetch({ user: targetUser.id, withPresences: true }).catch(() => null)
                : null);

        const rawUser = await fetchRawUser(config.token, targetUser.id);

        const createdTs = Math.floor(targetUser.createdTimestamp / 1000);
        const joinedTs = targetMember?.joinedTimestamp ? Math.floor(targetMember.joinedTimestamp / 1000) : null;

        // Dynamic Join Position
        let joinPos = null;
        if (targetMember?.joinedTimestamp && message.guild) {
            const cached = message.guild.members.cache.filter(m => m.joinedTimestamp);
            joinPos = cached.filter(m => m.joinedTimestamp < targetMember.joinedTimestamp).size + 1;
        }

        // Roles Section (Harm calm lowercase)
        let roleCount = 0;
        let rolesStr = 'none';
        if (targetMember && message.guild) {
            const filteredRoles = targetMember.roles.cache
                .filter(r => r.id !== message.guild.id)
                .sort((a, b) => b.position - a.position);
            roleCount = filteredRoles.size;
            if (roleCount > 0) {
                const display = filteredRoles.first(6).map(r => `<@&${r.id}>`);
                const remaining = roleCount - display.length;
                rolesStr = display.join(' ') + (remaining > 0 ? ` *+${remaining} more*` : '');
            }
        }

        // Badges Section (Harm calm lowercase)
        const fetchedUser = await targetUser.fetch().catch(() => targetUser);
        const flags = fetchedUser.flags?.toArray() || [];
        const badgeItems = [];

        for (const flag of flags) {
            if (BADGE_MAP[flag]) {
                badgeItems.push(BADGE_MAP[flag]);
            }
        }

        if (targetMember?.premiumSince) {
            badgeItems.push({ name: 'server booster', emoji: '<:badge_booster:1558785366234894379>' });
        }

        if (config.owners?.includes(targetUser.id)) {
            badgeItems.push({ name: 'harm owner', emoji: config.emojis?.crown || '<:gw_crown:1558198883883028621>' });
        }

        if (targetUser.bot) {
            badgeItems.push({ name: 'bot', emoji: '🤖' });
        }

        const badgesStr = badgeItems.length > 0
            ? badgeItems.map(b => `${b.emoji} ${b.name}`).join(' · ')
            : 'none';

        // 100% Dynamic Profile Banner Render (GIF or PNG based on target user's assets)
        const rendered = await renderProfileBanner(targetUser, targetMember, rawUser);
        const bannerAttachment = new AttachmentBuilder(rendered.buffer, { name: rendered.filename });

        const displayName = targetMember?.displayName || targetUser.globalName || targetUser.username;
        const bannerUrl = (rawUser?.banner ? `https://cdn.discordapp.com/banners/${targetUser.id}/${rawUser.banner}.png?size=1024` : null)
            || targetUser.bannerURL?.({ size: 1024, dynamic: true });

        const userAvatar = targetUser.displayAvatarURL({ size: 1024, dynamic: true });
        const memberAvatar = targetMember?.avatarURL?.({ size: 1024, dynamic: true });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel('avatar')
                .setEmoji(config.emojis?.harm || '<:harmsdio:1556221836507742278>')
                .setURL(userAvatar)
        );

        if (memberAvatar && memberAvatar !== userAvatar) {
            row.addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('server avatar')
                    .setURL(memberAvatar)
            );
        }

        if (bannerUrl) {
            row.addComponents(
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel('banner')
                    .setURL(bannerUrl)
            );
        }

        // Components V2 Container Inspired by welcomeDM (Strict 2-Divider Budget)
        try {
            const container = new ContainerBuilder();
            container.setAccentColor(config.colors.c ? parseInt(config.colors.c.replace('#', ''), 16) : 0x2b2d31);

            // 1. Summit Banner Media Gallery
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(
                    new MediaGalleryItemBuilder().setURL(`attachment://${rendered.filename}`)
                )
            );

            // 2. Separator (Divider 1 of 2)
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

            // 3. User Identity & Details (welcomeDM rhythm - clean, unified, breathable)
            const bodyLines = [
                `### [${displayName}](https://discord.com/users/${targetUser.id})`,
                `-# [@${targetUser.username}](https://discord.com/users/${targetUser.id}) · \`${targetUser.id}\` · created <t:${createdTs}:R>\n`
            ];

            if (joinedTs) {
                bodyLines.push(`-# **joined**: <t:${joinedTs}:R> · position **#${joinPos || 1}**`);
            }
            if (targetMember && message.guild) {
                if (roleCount > 0) {
                    bodyLines.push(`-# **roles** (${roleCount}): ${rolesStr}`);
                } else {
                    bodyLines.push(`-# **roles**: none`);
                }
            }
            bodyLines.push(`-# **badges**: ${badgesStr}`);

            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(bodyLines.join('\n'))
            );

            // 4. Separator (Divider 2 of 2)
            container.addSeparatorComponents(
                new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
            );

            // 5. Action Row Buttons
            container.addActionRowComponents(row);

            return await message.reply({
                components: [container],
                files: [bannerAttachment],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (_) {
            const fallbackEmbed = new EmbedBuilder()
                .setColor(config.colors.c || '#2b2d31')
                .setImage(`attachment://${rendered.filename}`)
                .setDescription(
                    `### [${displayName}](https://discord.com/users/${targetUser.id})\n` +
                    `-# [@${targetUser.username}](https://discord.com/users/${targetUser.id}) · \`${targetUser.id}\` · created <t:${createdTs}:R>\n\n` +
                    (joinedTs ? `-# **joined**: <t:${joinedTs}:R> · position **#${joinPos || 1}**\n` : '') +
                    (targetMember && message.guild ? (roleCount > 0 ? `-# **roles** (${roleCount}): ${rolesStr}\n` : `-# **roles**: none\n`) : '') +
                    `-# **badges**: ${badgesStr}`
                );

            return await message.reply({
                embeds: [fallbackEmbed],
                files: [bannerAttachment],
                components: [row]
            }).catch(() => {});
        }
    }
}

module.exports = UserInfoCommand;
