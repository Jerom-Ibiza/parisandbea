const crypto = require('crypto');
const pool = require('../database');

/* ---------- helpers ---------- */
const genToken = () => crypto.randomBytes(32).toString('hex');

const findToken = async t => {
    const [rows] = await pool.query(
        'SELECT * FROM registro_tokens WHERE token = ? LIMIT 1', [t]);
    return rows[0];
};
const markUsed = async t =>
    pool.query('UPDATE registro_tokens SET used = 1 WHERE token = ?', [t]);

/* ---------- API ---------- */
/* 1 · Crear y guardar un token -------------------------------- */
exports.create = async (req, res) => {
    try {
        if (!req.session.user) return res.status(401).json({ error: 'Sesión requerida' });

        const minutes = parseInt(req.body.minutes || 60, 10);
        if (![60, 120, 600, 1440, 2880].includes(minutes))
            return res.status(400).json({ error: 'Valor de caducidad no admitido' });

        const token = genToken();
        await pool.query(
            `INSERT INTO registro_tokens (token, expires_at)
       VALUES (?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
            [token, minutes]);

        const url = `https://parisandbea.es/pab-regis.html?token=${token}`;
        res.json({ url, token, expires_in: minutes });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error generando token' });
    }
};

/* 2 · Validar token (página registro) ------------------------- */
exports.validate = async (req, res) => {
    try {
        const tk = req.params.token;
        const row = await findToken(tk);
        if (!row) return res.status(404).json({ valid: false, reason: 'inexistente' });
        if (row.used) return res.status(410).json({ valid: false, reason: 'usado' });
        if (row.expires_at < new Date())
            return res.status(410).json({ valid: false, reason: 'caducado' });
        res.json({ valid: true });
    } catch (e) { res.status(500).json({ valid: false, reason: 'error' }); }
};

/* 3 · Uso interno: comprobar y consumir ----------------------- */
exports.isUsable = async tk => {
    const row = await findToken(tk);
    if (!row || row.used || row.expires_at < new Date()) return null;
    return row;
};
exports.consume = markUsed;
