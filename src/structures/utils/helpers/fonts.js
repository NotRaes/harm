const path = require('path');
const fs = require('fs');
const { GlobalFonts } = require('@napi-rs/canvas');

let _loaded = false;

function initFonts() {
    if (_loaded) return;
    const fontsDir = path.resolve(__dirname, '../assets/fonts');
    if (!fs.existsSync(fontsDir)) return;

    const files = fs.readdirSync(fontsDir);
    for (const f of files) {
        if (f.endsWith('.ttf') || f.endsWith('.otf')) {
            const familyName = path.basename(f, path.extname(f));
            try {
                GlobalFonts.registerFromPath(path.join(fontsDir, f), familyName);
            } catch (_) {}
        }
    }
    _loaded = true;
}

initFonts();

module.exports = {
    initFonts,
    GlobalFonts
};
