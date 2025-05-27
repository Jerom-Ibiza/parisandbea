// cron/cleanTokensCron.js
const pool = require('../database');

/**
 * Borra tokens cuya fecha de expiración es anterior a NOW()-N días
 * @param {number} days - antigüedad máxima permitida
 */
async function cleanTokens(days = 2) {
    try {
        const [info] = await pool.query(
            'DELETE FROM registro_tokens WHERE expires_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
            [days]
        );
        console.log(`[cron] Tokens eliminados: ${info.affectedRows}`);
    } catch (e) {
        console.error('[cron] Error al limpiar tokens', e);
    }
}

module.exports = { cleanTokens };
