const path = require('path');
const fs = require('fs');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
require('./fonts.js');

/**
 * Generate ship name by blending two usernames
 */
function generateShipName(name1, name2) {
    const clean1 = (name1 || 'user1').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'harm';
    const clean2 = (name2 || 'user2').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user';

    const part1 = clean1.slice(0, Math.max(1, Math.ceil(clean1.length / 2)));
    const part2 = clean2.slice(Math.floor(clean2.length / 2));
    let combined = (part1 + part2).toLowerCase();
    if (combined.length < 3 && clean2.length >= 2) {
        combined = part1 + clean2;
    }
    return combined;
}

/**
 * True randomized ship percentage (0 to 100) on each roll
 */
function calculateShipPercent() {
    return Math.floor(Math.random() * 101);
}

/**
 * Compatibility rating description based on percentage
 */
function getShipComment(percent) {
    if (percent === 0) return "absolutely zero chemistry.";
    if (percent <= 10) return "not in a million years.";
    if (percent <= 25) return "these two aren't compatible at all.";
    if (percent <= 40) return "awkward silences ahead.";
    if (percent <= 55) return "just friends, maybe.";
    if (percent <= 70) return "there's definitely a spark.";
    if (percent <= 85) return "great chemistry.";
    if (percent <= 95) return "a match made in heaven.";
    return "true perfection. wedding when?";
}

/**
 * Draw the exact inspiration heart with pinched, elongated cusp
 */
function drawPinchedHeart(c, cx) {
    // cx = 500
    // Cleft at (500, 124)
    // Lobes apex at Y=88
    // Widest curve at Y=130 (halfW = 75)
    // Smooth pinched concavity towards tip at (500, 226)
    c.beginPath();
    c.moveTo(cx, 124);
    // Top-left lobe
    c.bezierCurveTo(cx - 20, 88, cx - 75, 88, cx - 75, 130);
    // Left swoop to bottom tip with concave flare
    c.bezierCurveTo(cx - 75, 165, cx - 14, 195, cx, 226);
    // Right swoop from bottom tip
    c.bezierCurveTo(cx + 14, 195, cx + 75, 165, cx + 75, 130);
    // Top-right lobe
    c.bezierCurveTo(cx + 75, 88, cx + 20, 88, cx, 124);
    c.closePath();
}

/**
 * Render 1000x400 widescreen ship card matching inspiration with Harm twist
 */
async function renderShipCard({
    name1,
    name2,
    avatarUrl1,
    avatarUrl2,
    percent,
    shipName,
    comment
}) {
    const width = 1000;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Dark base background (no transparent crop, fills entire canvas)
    ctx.fillStyle = '#0c080c';
    ctx.fillRect(0, 0, width, height);

    // 2. Harm Twist: Deep signature burgundy & magenta glow aura behind the heart
    const glowGrad = ctx.createRadialGradient(500, 155, 15, 500, 155, 310);
    glowGrad.addColorStop(0, 'rgba(255, 95, 145, 0.36)');
    glowGrad.addColorStop(0.35, 'rgba(180, 35, 85, 0.18)');
    glowGrad.addColorStop(0.7, 'rgba(65, 12, 35, 0.06)');
    glowGrad.addColorStop(1, 'rgba(12, 8, 12, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, width, height);

    // 3. Top Title: name1 + name2
    const cleanName1 = String(name1 || 'user1');
    const cleanName2 = String(name2 || 'user2');
    ctx.save();
    ctx.font = 'bold 24px Inter, Montserrat, sans-serif';
    ctx.textBaseline = 'middle';

    const n1w = ctx.measureText(cleanName1).width;
    const plusText = '  +  ';
    const pw = ctx.measureText(plusText).width;
    const n2w = ctx.measureText(cleanName2).width;
    const totalW = n1w + pw + n2w;
    let startX = (width - totalW) / 2;
    const titleY = 62;

    ctx.fillStyle = '#f0e4ea';
    ctx.fillText(cleanName1, startX, titleY);
    startX += n1w;

    ctx.fillStyle = '#ff85ad';
    ctx.fillText(plusText, startX, titleY);
    startX += pw;

    ctx.fillStyle = '#f0e4ea';
    ctx.fillText(cleanName2, startX, titleY);
    ctx.restore();

    // 4. Avatars (154, 200) and (846, 200), radius 105 (diameter 210)
    const leftCx = 154;
    const rightCx = 846;
    const cy = 200;
    const r = 105;

    const drawAvatar = async (cx, url, fallbackName) => {
        let img = null;
        if (url) {
            try {
                img = await loadImage(url);
            } catch (_) {}
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 3, 0, Math.PI * 2);
        ctx.clip();

        if (img) {
            ctx.drawImage(img, cx - r + 3, cy - r + 3, (r - 3) * 2, (r - 3) * 2);
        } else {
            ctx.fillStyle = '#1c0f16';
            ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
            ctx.font = 'bold 54px Inter, Montserrat, sans-serif';
            ctx.fillStyle = '#ffa2be';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText((fallbackName || '?').charAt(0).toUpperCase(), cx, cy);
        }
        ctx.restore();

        // Thick pastel pink ring border
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1.5, 0, Math.PI * 2);
        ctx.lineWidth = 6.5;
        ctx.strokeStyle = '#ffa2be';
        ctx.stroke();
        ctx.restore();
    };

    await drawAvatar(leftCx, avatarUrl1, cleanName1);
    await drawAvatar(rightCx, avatarUrl2, cleanName2);

    // 5. Elongated Pinched Heart
    const heartCx = 500;
    ctx.save();
    ctx.shadowColor = 'rgba(255, 120, 170, 0.85)';
    ctx.shadowBlur = 35;
    ctx.fillStyle = '#ff85ad';
    drawPinchedHeart(ctx, heartCx);
    ctx.fill();
    ctx.restore();

    // 6. Percentage inside Heart
    ctx.save();
    ctx.font = 'bold 36px Inter, Montserrat, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${percent}%`, heartCx, 152);
    ctx.restore();

    // 7. Progress Bar: X: 274 to 726, Y: 253 to 275 (Width 452, Height 22, Radius 11)
    const barX = 274;
    const barY = 253;
    const barW = 452;
    const barH = 22;
    const barR = 11;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, barR);
    ctx.fillStyle = '#232023';
    ctx.fill();

    const fillW = Math.max(barR * 2, (barW * percent) / 100);
    ctx.beginPath();
    ctx.roundRect(barX, barY, fillW, barH, barR);
    ctx.fillStyle = '#ff87b1';
    ctx.shadowColor = 'rgba(255, 135, 177, 0.6)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.restore();

    // 8. Compatibility Rating Comment
    ctx.save();
    ctx.font = '16px Inter, Montserrat, sans-serif';
    ctx.fillStyle = '#9b9198';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(comment || getShipComment(percent), 500, 312);
    ctx.restore();

    // 9. Ship Name Pill
    const displayShip = shipName || generateShipName(cleanName1, cleanName2);
    ctx.save();
    ctx.font = 'bold 15px Inter, Montserrat, sans-serif';
    const textMetrics = ctx.measureText(displayShip);
    const pillW = Math.max(80, textMetrics.width + 36);
    const pillH = 30;
    const pillX = (width - pillW) / 2;
    const pillY = 340;
    const pillR = 15;

    ctx.beginPath();
    ctx.roundRect(pillX, pillY, pillW, pillH, pillR);
    ctx.fillStyle = '#311d27';
    ctx.fill();

    ctx.fillStyle = '#ff99bb';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(displayShip, 500, pillY + pillH / 2 + 1);
    ctx.restore();

    // 10. Dio Watermark (Bottom Right Corner)
    try {
        const dioPath = path.resolve(__dirname, '../assets/icons/dio.png');
        if (fs.existsSync(dioPath)) {
            const dioImg = await loadImage(dioPath);
            ctx.save();
            const dioSize = 26;
            const dioX = width - 44;
            const dioY = height - 44;
            ctx.beginPath();
            ctx.arc(dioX + dioSize / 2, dioY + dioSize / 2, dioSize / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.globalAlpha = 0.55;
            ctx.drawImage(dioImg, dioX, dioY, dioSize, dioSize);
            ctx.restore();

            // Subtle border around Dio watermark
            ctx.save();
            ctx.beginPath();
            ctx.arc(dioX + dioSize / 2, dioY + dioSize / 2, dioSize / 2, 0, Math.PI * 2);
            ctx.lineWidth = 1;
            ctx.strokeStyle = 'rgba(255, 160, 190, 0.3)';
            ctx.stroke();
            ctx.restore();
        }
    } catch (_) {}

    return canvas.toBuffer('image/png');
}

module.exports = {
    renderShipCard,
    generateShipName,
    calculateShipPercent,
    getShipComment
};
