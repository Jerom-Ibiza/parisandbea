// controllers/pacientesPublic.controller.js
const pool = require('../database');
const tokensCtrl = require('./registroTokens.controller');
const { generateConsentDocument } = require('./documentos.controller');

/* ============================================================
 * Registro público de paciente  —  POST /api/public/pacientes/register?token=xxx
 * ========================================================== */
exports.register = async (req, res) => {
    try {
        /* -------- token en la URL -------- */
        const { token } = req.query;
        if (!token)
            return res.status(400).json({ error: 'Token requerido' });

        /* -------- token válido / usable? -------- */
        const tkRow = await tokensCtrl.isUsable(token);
        if (!tkRow)
            return res.status(403).json({ error: 'Token inválido o caducado' });

        /* -------- datos del body -------- */
        const {
            nombre, apellidos, fecha_nacimiento, genero,
            dni, direccion, telefono, email, prefijo   // <— prefijo opcional
        } = req.body;

        if (!nombre || !apellidos || !fecha_nacimiento || !genero || !email)
            return res.status(400).json({ error: 'Faltan datos' });

        /* -------- normalizar teléfono --------
           Aceptamos dos variantes:
           1) Front-end nuevo  → llega ya unido en “telefono” («+34600900123»)
           2) Front-end antiguo → llegan “prefijo” y “telefono” separados     */
        let telefonoFull = null;

        if (telefono) {
            // quita espacios y tabulaciones
            let num = String(telefono).replace(/\s+/g, '');

            // si no empieza por + quizá venga el prefijo aparte
            if (!num.startsWith('+') && prefijo) {
                let pre = String(prefijo).trim();
                if (!pre.startsWith('+')) pre = '+' + pre;
                num = pre + num;
            }
            // si aún no empieza por +, añadimos por defecto +34
            if (!num.startsWith('+')) num = '+34' + num;

            telefonoFull = num;
        } else if (prefijo) {
            // solo por compatibilidad – no debería ocurrir
            let pre = String(prefijo).trim();
            if (!pre.startsWith('+')) pre = '+' + pre;
            telefonoFull = pre;
        }

        /* -------- inserción en BD -------- */
        const [result] = await pool.query(
            `INSERT INTO pacientes
         (nombre, apellidos, fecha_nacimiento, genero,
          dni, direccion, telefono, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre,
                apellidos,
                fecha_nacimiento,
                genero,
                dni || null,
                direccion || null,
                telefonoFull,
                email
            ]
        );

        /* -------- Generar el consentimiento LOPD y enviarlo a Viafirma -------- */
        let consentInfo = null;
        try {
            consentInfo = await new Promise((resolve, reject) => {
                const mockReq = { body: { id_paciente: result.insertId } };
                const mockRes = {
                    status(c) { this.statusCode = c; return this; },
                    json(obj) {
                        if (this.statusCode >= 400) return reject(new Error(obj?.error || 'Error en LOPD'));
                        resolve(obj);              // { message, pdfURL, setCode }
                    }
                };
                generateConsentDocument(mockReq, mockRes).catch(reject);
            });
            console.log('[auto-LOPD] Viafirma setCode:', consentInfo.setCode);
        } catch (e) {
            console.error('[auto-LOPD] error:', e?.message || e);
        }

        /* -------- consumimos el token (un solo uso) -------- */
        await tokensCtrl.consume(token);

        /* -------- respuesta -------- */
        res.status(201).json({
            message: 'Paciente registrado',
            id_paciente: result.insertId,
            lopd: consentInfo ? { pdfURL: consentInfo.pdfURL, setCode: consentInfo.setCode } : null
        });

    } catch (e) {
        console.error('Error registro:', e);
        res.status(500).json({ error: 'Error registro' });
    }
};
