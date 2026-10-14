const { createCanvas, loadImage } = require('@napi-rs/canvas');
require('./fonts.js');

const THEMES = {
    dark: {
        bg: '#313338',
        text: '#dbdee1',
        name: '#f2f3f5',
        timestamp: '#949ba4',
        mentionBg: 'rgba(250, 166, 26, 0.08)',
        mentionBar: '#f0b232',
        reactionBg: '#2b2d31',
        reactionBorder: '#3b3e45',
        reactionText: '#dbdee1'
    },
    amoled: {
        bg: '#000000',
        text: '#e3e5e8',
        name: '#ffffff',
        timestamp: '#80848e',
        mentionBg: 'rgba(250, 166, 26, 0.12)',
        mentionBar: '#f0b232',
        reactionBg: '#18191c',
        reactionBorder: '#2e3035',
        reactionText: '#e3e5e8'
    },
    light: {
        bg: '#ffffff',
        text: '#2e3338',
        name: '#060607',
        timestamp: '#5c5f66',
        mentionBg: 'rgba(250, 166, 26, 0.15)',
        mentionBar: '#e69900',
        reactionBg: '#f2f3f5',
        reactionBorder: '#e3e5e8',
        reactionText: '#2e3338'
    },
    burgundy: {
        bg: '#180711',
        text: '#e8d5df',
        name: '#ffffff',
        timestamp: '#9e7389',
        mentionBg: 'rgba(240, 70, 130, 0.12)',
        mentionBar: '#851a44',
        reactionBg: '#260c1c',
        reactionBorder: '#4a1128',
        reactionText: '#f3e5ee'
    }
};

function formatTimestamp(customTs) {
    if (customTs) return customTs;
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `Today at ${hours}:${minutes}`;
}

function wrapText(ctx, text, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const para of paragraphs) {
        if (!para.trim()) {
            lines.push('');
            continue;
        }

        const words = para.split(/\s+/);
        let currentLine = '';

        for (const word of words) {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
    }

    return lines;
}

async function renderFakeMessage(options = {}) {
    const {
        text = 'hello from harm.',
        avatarUrl,
        displayName = 'harm',
        username = 'harm',
        isBot = false,
        theme = 'dark',
        displayFont = 'Inter',
        imageUrl,
        timestamp,
        mentionHighlight = false,
        reactions = [],
        useUsername = false,
        hideClanTags = false,
        clanTag
    } = options;

    const t = THEMES[theme.toLowerCase()] || THEMES.dark;
    const formattedTs = formatTimestamp(timestamp);
    const chosenName = useUsername ? username : displayName;
    const fontName = displayFont || 'Inter';

    // 1. Measure text content
    const width = 940;
    const textStartX = 94;
    const maxContentWidth = width - textStartX - 36;

    const measureCanvas = createCanvas(100, 100);
    const mCtx = measureCanvas.getContext('2d');
    mCtx.font = '16.5px Inter, "Segoe UI", sans-serif';

    const lines = wrapText(mCtx, text, maxContentWidth);
    const lineHeight = 25;
    const textBlockHeight = Math.max(26, lines.length * lineHeight);

    // 2. Measure attachments & reactions
    let attachmentImage = null;
    let imgRenderWidth = 0;
    let imgRenderHeight = 0;

    if (imageUrl) {
        try {
            attachmentImage = await loadImage(imageUrl);
            const maxImgW = 560;
            const maxImgH = 360;
            const scale = Math.min(maxImgW / attachmentImage.width, maxImgH / attachmentImage.height, 1);
            imgRenderWidth = Math.round(attachmentImage.width * scale);
            imgRenderHeight = Math.round(attachmentImage.height * scale);
        } catch (_) {}
    }

    let parsedReactions = [];
    if (Array.isArray(reactions)) {
        parsedReactions = reactions;
    } else if (typeof reactions === 'string' && reactions.trim()) {
        const parts = reactions.split(/\s+/);
        for (const part of parts) {
            const [emo, cnt] = part.split(':');
            parsedReactions.push({ emoji: emo || '👍', count: parseInt(cnt, 10) || 1 });
        }
    }

    const hasAttachment = imgRenderHeight > 0;
    const hasReactions = parsedReactions.length > 0;

    // 3. Dynamic height
    let totalHeight = 64 + textBlockHeight + 16;
    if (hasAttachment) totalHeight += imgRenderHeight + 14;
    if (hasReactions) totalHeight += 38;
    totalHeight = Math.max(96, totalHeight);

    // 4. Primary canvas
    const canvas = createCanvas(width, totalHeight);
    const ctx = canvas.getContext('2d');

    // Background fill
    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, width, totalHeight);

    // Mention Highlight
    if (mentionHighlight) {
        ctx.fillStyle = t.mentionBg;
        ctx.fillRect(0, 0, width, totalHeight);
        ctx.fillStyle = t.mentionBar;
        ctx.fillRect(0, 0, 4, totalHeight);
    }

    // 5. Render Avatar
    const avatarX = 24;
    const avatarY = 18;
    const avatarSize = 52;

    ctx.save();
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    if (avatarUrl) {
        try {
            const avImg = await loadImage(avatarUrl);
            ctx.drawImage(avImg, avatarX, avatarY, avatarSize, avatarSize);
        } catch (_) {
            ctx.fillStyle = '#4a1128';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
    } else {
        ctx.fillStyle = '#4a1128';
        ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        ctx.fillStyle = '#ffffff';
        ctx.font = '24px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText((chosenName[0] || 'H').toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
    }
    ctx.restore();

    // 6. Header
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';

    // Display Name
    ctx.font = `600 18px "${fontName}", Inter, "Segoe UI", sans-serif`;
    ctx.fillStyle = t.name;
    const nameY = 36;
    ctx.fillText(chosenName, textStartX, nameY);
    const nameWidth = ctx.measureText(chosenName).width;

    let currentHeaderX = textStartX + nameWidth + 8;

    // Bot Badge
    if (isBot) {
        ctx.fillStyle = '#5865f2';
        ctx.beginPath();
        ctx.roundRect(currentHeaderX, 22, 38, 16, 3);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = '700 10.5px Inter, sans-serif';
        ctx.fillText('BOT', currentHeaderX + 7, 34);
        currentHeaderX += 46;
    }

    // Clan Tag
    if (clanTag && !hideClanTags) {
        ctx.font = '600 11px Inter, sans-serif';
        const tagText = clanTag.toUpperCase();
        const tagWidth = ctx.measureText(tagText).width + 12;

        ctx.fillStyle = theme === 'light' ? '#e3e5e8' : '#2b2d31';
        ctx.beginPath();
        ctx.roundRect(currentHeaderX, 22, tagWidth, 16, 4);
        ctx.fill();

        ctx.fillStyle = t.timestamp;
        ctx.fillText(tagText, currentHeaderX + 6, 34);
        currentHeaderX += tagWidth + 8;
    }

    // Timestamp
    ctx.font = '13px Inter, "Segoe UI", sans-serif';
    ctx.fillStyle = t.timestamp;
    ctx.fillText(formattedTs, currentHeaderX, nameY);

    // 7. Render Body Text
    ctx.font = '16.5px Inter, "Segoe UI", sans-serif';
    ctx.fillStyle = t.text;
    let lineY = 64;

    for (const line of lines) {
        if (!line) {
            lineY += lineHeight;
            continue;
        }

        if (line.includes('@')) {
            const tokens = line.split(/(\s+)/);
            let tokenX = textStartX;

            for (const token of tokens) {
                if (token.startsWith('@') && token.length > 1) {
                    const tokenW = ctx.measureText(token).width + 6;
                    ctx.save();
                    ctx.fillStyle = 'rgba(88, 101, 242, 0.18)';
                    ctx.beginPath();
                    ctx.roundRect(tokenX - 2, lineY - 17, tokenW, 22, 3);
                    ctx.fill();
                    ctx.fillStyle = '#c9cdfb';
                    ctx.fillText(token, tokenX + 1, lineY);
                    ctx.restore();
                    tokenX += tokenW + 2;
                } else {
                    ctx.fillStyle = t.text;
                    ctx.fillText(token, tokenX, lineY);
                    tokenX += ctx.measureText(token).width;
                }
            }
        } else {
            ctx.fillText(line, textStartX, lineY);
        }

        lineY += lineHeight;
    }

    // 8. Render Attachment Image
    let nextContentY = lineY + 6;
    if (hasAttachment && attachmentImage) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(textStartX, nextContentY, imgRenderWidth, imgRenderHeight, 10);
        ctx.clip();
        ctx.drawImage(attachmentImage, textStartX, nextContentY, imgRenderWidth, imgRenderHeight);
        ctx.restore();
        nextContentY += imgRenderHeight + 14;
    }

    // 9. Render Reactions
    if (hasReactions) {
        let rx = textStartX;
        const ry = nextContentY;
        const rHeight = 28;

        for (const r of parsedReactions) {
            const countStr = String(r.count || 1);
            ctx.font = '14px Inter, sans-serif';
            const labelText = `${r.emoji || '👍'} ${countStr}`;
            const rWidth = ctx.measureText(labelText).width + 18;

            ctx.fillStyle = t.reactionBg;
            ctx.strokeStyle = t.reactionBorder;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.roundRect(rx, ry, rWidth, rHeight, 8);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = t.reactionText;
            ctx.fillText(labelText, rx + 9, ry + 19);

            rx += rWidth + 8;
            if (rx > width - 120) break;
        }
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    renderFakeMessage,
    THEMES
};
