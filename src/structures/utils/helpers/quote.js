const { createCanvas, loadImage } = require('@napi-rs/canvas');
require('./fonts.js');

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

function applyGrayscale(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const contrast = 1.08;
        const adjusted = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
        d[i] = adjusted;
        d[i + 1] = adjusted;
        d[i + 2] = adjusted;
    }
    ctx.putImageData(imgData, 0, 0);
}

function applySepia(ctx, width, height) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
        const r = d[i], g = d[i + 1], b = d[i + 2];
        d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189);
        d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168);
        d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131);
    }
    ctx.putImageData(imgData, 0, 0);
}

async function renderQuote(options = {}) {
    const {
        text = 'hi',
        avatarUrl,
        displayName = 'venom',
        username = 'venomwoo',
        style = 'monochrome', // 'monochrome' | 'color' | 'burgundy' | 'sepia'
        font = 'ZenAntique',
        watermark = '• harm'
    } = options;

    const width = 1100;
    const height = 550;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const bgColor = style === 'burgundy' ? '#14050d' : '#000000';
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // 1. Render Left Avatar Photo with Feathered Fade
    const photoWidth = Math.round(width * 0.52);
    if (avatarUrl) {
        try {
            const rawAvatar = await loadImage(avatarUrl);

            const photoCanvas = createCanvas(photoWidth, height);
            const pCtx = photoCanvas.getContext('2d');

            const scale = Math.max(photoWidth / rawAvatar.width, height / rawAvatar.height);
            const drawW = rawAvatar.width * scale;
            const drawH = rawAvatar.height * scale;
            const drawX = (photoWidth - drawW) / 2;
            const drawY = (height - drawH) / 2;

            pCtx.drawImage(rawAvatar, drawX, drawY, drawW, drawH);

            if (style === 'monochrome' || style === 'burgundy') {
                applyGrayscale(pCtx, photoWidth, height);
            } else if (style === 'sepia') {
                applySepia(pCtx, photoWidth, height);
            }

            if (style === 'burgundy') {
                pCtx.save();
                pCtx.globalCompositeOperation = 'multiply';
                pCtx.fillStyle = '#4a1128';
                pCtx.fillRect(0, 0, photoWidth, height);
                pCtx.restore();
            }

            const fadeStart = photoWidth * 0.35;
            const grad = pCtx.createLinearGradient(fadeStart, 0, photoWidth, 0);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.7)');
            grad.addColorStop(1, bgColor);

            pCtx.fillStyle = grad;
            pCtx.fillRect(fadeStart, 0, photoWidth - fadeStart, height);

            const topGrad = pCtx.createLinearGradient(0, 0, 0, 70);
            topGrad.addColorStop(0, bgColor);
            topGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            pCtx.fillStyle = topGrad;
            pCtx.fillRect(0, 0, photoWidth, 70);

            const btmGrad = pCtx.createLinearGradient(0, height - 70, 0, height);
            btmGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            btmGrad.addColorStop(1, bgColor);
            pCtx.fillStyle = btmGrad;
            pCtx.fillRect(0, height - 70, photoWidth, 70);

            ctx.drawImage(photoCanvas, 0, 0);
        } catch (_) {}
    }

    // 2. Right Side Typography
    const rightCenterX = Math.round(width * 0.73);
    const rightMaxWidth = width - photoWidth - 90;

    const cleanText = text.trim();
    let fontSize = 48;
    if (cleanText.length > 180) fontSize = 23;
    else if (cleanText.length > 120) fontSize = 27;
    else if (cleanText.length > 70) fontSize = 32;
    else if (cleanText.length > 35) fontSize = 38;
    else if (cleanText.length > 15) fontSize = 44;

    const chosenFont = font || 'ZenAntique';
    ctx.font = `${fontSize}px "${chosenFont}", Cinzel, Inter, sans-serif`;

    const lines = wrapText(ctx, cleanText, rightMaxWidth);
    const lineHeight = Math.round(fontSize * 1.35);
    const quoteTotalHeight = lines.length * lineHeight;

    const authorNameSize = 21;
    const handleSize = 15;
    const authorBlockHeight = authorNameSize + handleSize + 14;

    const gap = 34;
    const totalBlockHeight = quoteTotalHeight + gap + authorBlockHeight;
    const startY = Math.round((height - totalBlockHeight) / 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';

    let currentY = startY + Math.round(lineHeight / 2);
    for (const line of lines) {
        ctx.fillText(line, rightCenterX, currentY);
        currentY += lineHeight;
    }

    const authorStartY = currentY + gap - Math.round(lineHeight / 2);

    // - display_name (italic)
    ctx.font = `italic ${authorNameSize}px "${chosenFont}", Cinzel, Inter, sans-serif`;
    ctx.fillStyle = '#dcdfe4';
    ctx.fillText(`- ${displayName.toLowerCase()}`, rightCenterX, authorStartY);

    // @username (muted sans-serif)
    ctx.font = `${handleSize}px Inter, "Segoe UI", sans-serif`;
    ctx.fillStyle = '#72767d';
    ctx.fillText(`@${username.toLowerCase()}`, rightCenterX, authorStartY + authorNameSize + 8);

    // 5. Watermark
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '13px Inter, "Segoe UI", sans-serif';
    ctx.fillStyle = '#4e5058';
    ctx.fillText(watermark, width - 42, height - 34);

    return canvas.toBuffer('image/png');
}

module.exports = {
    renderQuote
};
