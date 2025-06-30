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
            nombre, apellidos, razon_social, fecha_nacimiento, genero,
            tipo_contraparte, dni, tipo_doc_id, id_fiscal,
            direccion, pais_iso, provincia, codigo_postal,
            telefono, email, prefijo,
            sendViafirma, lang
        } = req.body;

        const consentLang =
            typeof lang === 'string' ? lang.trim().toLowerCase() : 'es';

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
        const tipoContraparteFinal =
            tipo_contraparte && tipo_contraparte.trim()
                ? tipo_contraparte.trim()
                : 'persona_fisica';
        const razonSocialFinal =
            razon_social && razon_social.trim() ? razon_social.trim() : null;
        const tipoDocFinal = tipo_doc_id && tipo_doc_id.trim() ? tipo_doc_id.trim() : 'NIF';
        const idFiscalFinal = id_fiscal && id_fiscal.trim() ? id_fiscal.trim() : null;
        const paisFinal = pais_iso && pais_iso.trim() ? pais_iso.trim() : 'ES';
        const provinciaFinal = provincia && provincia.trim() ? provincia.trim() : null;
        const cpFinal = codigo_postal && codigo_postal.trim() ? codigo_postal.trim() : null;

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
        let result;
        try {
            [result] = await pool.query(
                `INSERT INTO pacientes
         (nombre, apellidos, razon_social, fecha_nacimiento, genero, tipo_contraparte,
          dni, tipo_doc_id, id_fiscal, direccion, pais_iso, provincia, codigo_postal,
          telefono, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    nombre,
                    apellidosFinal,
                    razonSocialFinal,
                    fechaNacimientoFinal,
                    generoFinal,
                    tipoContraparteFinal,
                    dni || null,
                    tipoDocFinal,
                    idFiscalFinal,
                    direccionFinal,
                    paisFinal,
                    provinciaFinal,
                    cpFinal,
                    telefonoFull,
                    emailFinal
                ]
            );
        } catch (err) {
            if (err?.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'Paciente ya registrado' });
            }
            throw err;
        }

        /* -------- Generar consentimiento LOPD -------- */
        const enviarFirma = sendViafirma !== false && emailFinal !== 'Pendiente';
        let consentInfo = null;

        try {
            consentInfo = await new Promise((resolve, reject) => {
                const mockReq = { body: { id_paciente: result.insertId, sendViafirma: enviarFirma, lang: consentLang } };
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
