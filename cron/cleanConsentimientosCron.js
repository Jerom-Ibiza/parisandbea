const fs = require('fs');
const path = require('path');

const CONSENT_DIR = path.join(__dirname, '..', 'documentos', 'consentimientos');

function cleanConsentimientos() {
    fs.readdir(CONSENT_DIR, (err, files) => {
        if (err) {
            console.error('[cron] Error leyendo directorio de consentimientos', err);
            return;
        }
        files.forEach(file => {
            const abs = path.join(CONSENT_DIR, file);
            fs.stat(abs, (errStat, stats) => {
                if (errStat) return;
                if (stats.isFile()) {
                    fs.unlink(abs, errUnlink => {
                        if (errUnlink) console.error('[cron] Error eliminando', abs, errUnlink);
                    });
                }
            });
        });
    });
}

module.exports = { cleanConsentimientos };