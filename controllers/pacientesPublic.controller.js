// controllers/pacientesPublic.controller.js
const pool = require('../database');
const tokensCtrl = require('./registroTokens.controller');
const { generateConsentDocument } = require('./documentos.controller');

/* ============================================================
 * Registro público de paciente
 *            POST /api/public/pacientes/register?token=xxx
 * ========================================================== */
exports.register = async (req, res) => {
    try {
        /* -------- token -------- */
        const { token } = req.query;
        if (!token) return res.status(400).json({ error: 'Token requerido' });

        /* -------- token válido / usable? -------- */
        const tkRow = await tokensCtrl.isUsable(token);
        if (!tkRow)
            return res.status(403).json({ error: 'Token inválido o caducado' });

        /* -------- datos del body -------- */
        const {
            nombre, apellidos, fecha_nacimiento, genero,
            dni, direccion, telefono, email, prefijo,
            sendViafirma            // checkbox del formulario (boolean)
        } = req.body;

        /* -------- validación mínima -------- */
        if (!nombre) return res.status(400).json({ error: 'Falta nombre' });
        if (!telefono && !prefijo)
            return res.status(400).json({ error: 'Falta teléfono' });

        /* -------- valores por defecto -------- */
        const apellidosFinal = apellidos && apellidos.trim() ? apellidos.trim() : 'Pendiente';
        const fechaNacimientoFinal = fecha_nacimiento && fecha_nacimiento.trim() ? fecha_nacimiento.trim() : '2000-01-01';
        const generoFinal = genero && genero.trim() ? genero.trim() : 'Otro';
        const direccionFinal = direccion && direccion.trim() ? direccion.trim() : 'Pendiente';
        const emailFinal = email && email.trim() ? email.trim() : 'Pendiente';

        /* -------- normalizar teléfono -------- */
        let telefonoFull = null;

        if (telefono) {
            let num = String(telefono).replace(/\s+/g, '');
            if (!num.startsWith('+') && prefijo) {
                let pre = String(prefijo).trim();
                if (!pre.startsWith('+')) pre = '+' + pre;
                num = pre + num;
            }
            if (!num.startsWith('+')) num = '+34' + num;
            telefonoFull = num;
        } else if (prefijo) {
            let pre = String(prefijo).trim();
            if (!pre.startsWith('+')) pre = '+' + pre;
            telefonoFull = pre;           // improbable, pero cubre el caso
        }

        /* -------- inserción en BD -------- */
        const [result] = await pool.query(
            `INSERT INTO pacientes
         (nombre, apellidos, fecha_nacimiento, genero,
          dni, direccion, telefono, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                apellidosFinal,
                fechaNacimientoFinal,
                generoFinal,
                dni || null,
                direccionFinal,
                telefonoFull,
                emailFinal
            ]
        );

        /* -------- Generar consentimiento LOPD -------- */
        const enviarFirma = sendViafirma !== false && emailFinal !== 'Pendiente';
        let consentInfo = null;

        try {
            consentInfo = await new Promise((resolve, reject) => {
                const mockReq = { body: { id_paciente: result.insertId, sendViafirma: enviarFirma } };
                const mockRes = {
                    status(c) { this.statusCode = c; return this; },
                    json(obj) {
                        if (this.statusCode >= 400)
                            return reject(new Error(obj?.error || 'Error en LOPD'));
                        resolve(obj);                 // { message, pdfURL, setCode? }
                    }
                };
                generateConsentDocument(mockReq, mockRes).catch(reject);
            });

            if (enviarFirma && consentInfo?.setCode)
                console.log('[auto-LOPD] Viafirma setCode:', consentInfo.setCode);

        } catch (e) {
            console.error('[auto-LOPD] error:', e?.message || e);
        }

        /* -------- consumimos el token -------- */
        await tokensCtrl.consume(token);

        /* -------- respuesta -------- */
        res.status(201).json({
            message: 'Paciente registrado',
            id_paciente: result.insertId,
            lopd: consentInfo
                ? { pdfURL: consentInfo.pdfURL, setCode: consentInfo.setCode || null }
                : null
        });

    } catch (e) {
        console.error('Error registro:', e);
        res.status(500).json({ error: 'Error registro' });
    }
};
