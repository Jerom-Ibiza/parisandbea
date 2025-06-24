const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

/**
 * Convert a local image URL (/tmp/xxx.jpg or full http://host/tmp/xxx.jpg)
 * to a data URL that can be sent to OpenAI.
 * If the file can't be read, the original URL is returned.
 * @param {string} url
 * @returns {string}
 */
module.exports = function localImageToDataUrl(url) {
    try {
        const parsed = new URL(url, 'http://dummy');
        const abs = path.join(__dirname, '..', decodeURIComponent(parsed.pathname));
        if (!fs.existsSync(abs)) return url;
        const type = mime.lookup(abs) || 'image/png';
        const data = fs.readFileSync(abs).toString('base64');
        return `data:${type};base64,${data}`;
    } catch {
        return url;
    }
};