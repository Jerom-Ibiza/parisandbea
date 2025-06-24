const pool = require('../database');
const { sendMail, getEmailTemplate } = require('./mail.controller');
const { getCurrentDateTime } = require('./home.controller');

const LOCAL_FUNCTIONS = {
    async get_prof_preferences(_a, req) {
        const id = req.session.user.id_profesional;
        const [rows] = await pool.query(
            'SELECT preferencias FROM profesionales WHERE id_profesional = ? LIMIT 1',
            [id]
        );
        return rows[0]?.preferencias || null;
    },

    async get_prof_info(_a, req) {
        const id = req.session.user.id_profesional;
        const [rows] = await pool.query(
            `SELECT nombre, telefono, mail, especialidad, num_colegiado, notas
             FROM profesionales WHERE id_profesional = ? LIMIT 1`,
            [id]
        );
        return rows[0] || null;
    },

    async get_servicios() {
        const [rows] = await pool.query(
            `SELECT id_servicio, nombre, precio, activo
               FROM servicios
           ORDER BY orden ASC, id_servicio ASC`
        );
        return rows; // [{ id_servicio, nombre, precio, activo }, …]
    },

    async get_datetime() {
        return await new Promise((resolve, reject) => {
            const mockReq = {};
            const mockRes = {
                statusCode: 200,
                status(c) { this.statusCode = c; return this; },
                json(obj) {
                    if (this.statusCode >= 200 && this.statusCode < 300) return resolve(obj);
                    reject(new Error('Error obteniendo fecha/hora'));
                }
            };
            getCurrentDateTime(mockReq, mockRes).catch(reject);
        });
    },

    async send_mail(args = {}, req) {
        const { to, id_paciente, subject, text, htmlContent, attachments } = args;
        if (!subject) throw new Error('Falta "subject"');
        const html = getEmailTemplate(subject, htmlContent || (text ? `<p>${text}</p>` : ''));
        const payload = {
            id_profesional: req.session.user?.id_profesional ?? null,
            to,
            id_paciente,
            subject,
            text: 'Visualiza este correo en un cliente que soporte HTML.',
            htmlContent: html,
            attachments
        };
        return await new Promise((resolve, reject) => {
            const mockReq = { body: payload, session: req.session };
            const mockRes = {
                statusCode: 200,
                status(c) { this.statusCode = c; return this; },
                json(obj) {
                    if (this.statusCode >= 200 && this.statusCode < 300) return resolve(obj);
                    reject(new Error(obj?.error || 'Error enviando email'));
                }
            };
            sendMail(mockReq, mockRes).catch(reject);
        });
    },

    async add_cita(args = {}, req) {
        const {
            titulo,
            descripcion,
            fecha_hora_inicio,
            fecha_hora_fin,
            persona,
            id_paciente,
            estado,
            ubicacion,
            notificacion,
            id_profesional,
            id_servicio
        } = args;
        const profId = id_profesional || req.session.user.id_profesional;
        if (!titulo || !fecha_hora_inicio || !fecha_hora_fin || !profId)
            throw new Error('Faltan datos requeridos');
        if (new Date(fecha_hora_fin) <= new Date(fecha_hora_inicio))
            throw new Error('La fecha de fin debe ser posterior a la de inicio');

        const patientId = id_paciente || null;
        let personaFinal = persona || null;
        if (!personaFinal && patientId) {
            const [p] = await pool.query(
                'SELECT nombre, apellidos FROM pacientes WHERE id_paciente = ?',
                [patientId]
            );
            if (p.length) personaFinal = `${p[0].nombre} ${p[0].apellidos}`;
        }
        let tituloFinal = titulo;
        if (personaFinal && !titulo.startsWith(personaFinal)) {
            tituloFinal = `${personaFinal} - ${titulo}`;
        }
        let ubicacionFinal = ubicacion || null;
        if (!ubicacionFinal) {
            const [home] = await pool.query('SELECT direccion_centro FROM home WHERE id_home = 1');
            if (home.length) ubicacionFinal = home[0].direccion_centro;
        }
        const [overlap] = await pool.query(
            `SELECT COUNT(*) AS n FROM citas
        WHERE id_profesional = ? AND estado <> 'cancelada'
          AND ? < fecha_hora_fin AND ? > fecha_hora_inicio`,
            [profId, fecha_hora_inicio, fecha_hora_fin]
        );
        if (overlap[0].n) throw new Error('El profesional ya tiene otra cita en ese horario');
        const [res] = await pool.query(
            `INSERT INTO citas (titulo, descripcion, fecha_hora_inicio, fecha_hora_fin,
        persona, id_paciente, estado, ubicacion, notificacion, id_profesional, id_servicio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                tituloFinal,
                descripcion || null,
                fecha_hora_inicio,
                fecha_hora_fin,
                personaFinal,
                patientId,
                estado || 'pendiente',
                ubicacionFinal,
                notificacion || 'ninguna',
                profId,
                id_servicio || null
            ]
        );
        return { ok: true, id_cita: res.insertId, message: 'Operación realizada correctamente' };
    },

    async search_citas(args = {}, req) {
        const { id_profesional, id_paciente, id_servicio, estado, startDate, endDate, all } = args;
        const allFlag = all === '1' || all === true || all === 'true';
        const profId = allFlag ? null : id_profesional || req.session.user.id_profesional;
        let query = 'SELECT * FROM citas WHERE 1 = 1';
        const params = [];
        if (profId) { query += ' AND id_profesional = ?'; params.push(profId); }
        if (id_paciente) { query += ' AND id_paciente = ?'; params.push(id_paciente); }
        if (estado) { query += ' AND estado = ?'; params.push(estado); }
        if (id_servicio) { query += ' AND id_servicio = ?'; params.push(id_servicio); }
        if (startDate && endDate) { query += ' AND fecha_hora_inicio BETWEEN ? AND ?'; params.push(startDate, endDate); }
        else if (startDate) { query += ' AND fecha_hora_inicio >= ?'; params.push(startDate); }
        else if (endDate) { query += ' AND fecha_hora_inicio <= ?'; params.push(endDate); }
        const [rows] = await pool.query(query, params);
        return rows;
    },

    async update_cita(args = {}, req) {
        const { id_cita, ...body } = args;
        if (!id_cita) throw new Error('Falta id_cita');
        const [rows] = await pool.query('SELECT * FROM citas WHERE id_cita = ?', [id_cita]);
        if (!rows.length) throw new Error('Cita no encontrada');
        const c = rows[0];
        const inicio = body.fecha_hora_inicio ?? c.fecha_hora_inicio;
        const fin = body.fecha_hora_fin ?? c.fecha_hora_fin;
        const profId = body.id_profesional ?? c.id_profesional;
        if (new Date(fin) <= new Date(inicio))
            throw new Error('La fecha de fin debe ser posterior a la de inicio');
        const [overlap] = await pool.query(
            `SELECT COUNT(*) AS n FROM citas
        WHERE id_profesional = ? AND estado <> 'cancelada'
          AND ? < fecha_hora_fin AND ? > fecha_hora_inicio AND id_cita <> ?`,
            [profId, inicio, fin, id_cita]
        );
        if (overlap[0].n) throw new Error('El profesional ya tiene otra cita en ese horario');

        let personaFinal =
            body.persona !== undefined ? body.persona : c.persona;
        const idPacienteFinal =
            body.id_paciente !== undefined ? body.id_paciente : c.id_paciente;

        if (!personaFinal && idPacienteFinal) {
            const [p] = await pool.query(
                'SELECT nombre, apellidos FROM pacientes WHERE id_paciente = ?',
                [idPacienteFinal]
            );
            if (p.length) {
                personaFinal = `${p[0].nombre} ${p[0].apellidos}`;
            }
        }

        const tituloBase = body.titulo ?? c.titulo;
        let tituloFinal = tituloBase;
        if (personaFinal && !tituloBase.startsWith(personaFinal)) {
            tituloFinal = `${personaFinal} - ${tituloBase}`;
        }

        await pool.query(
            `UPDATE citas SET
         titulo            = ?,
         descripcion       = ?,
         fecha_hora_inicio = ?,
         fecha_hora_fin    = ?,
         persona           = ?,
         id_paciente       = ?,
         estado            = ?,
         ubicacion         = ?,
         notificacion      = ?,
         id_profesional    = ?,
         id_servicio       = ?
       WHERE id_cita = ?`,
            [
                tituloFinal,
                body.descripcion ?? c.descripcion,
                inicio,
                fin,
                personaFinal,
                idPacienteFinal,
                body.estado ?? c.estado,
                body.ubicacion ?? c.ubicacion,
                body.notificacion ?? c.notificacion,
                profId,
                body.id_servicio ?? c.id_servicio,
                id_cita
            ]
        );
        return { ok: true, message: 'Operación realizada correctamente' };
    },

    async delete_cita({ id_cita }, _req) {
        if (!id_cita) throw new Error('Falta id_cita');
        const [res] = await pool.query('DELETE FROM citas WHERE id_cita = ?', [id_cita]);
        if (!res.affectedRows) throw new Error('Cita no encontrada');
        return { ok: true, message: 'Operación realizada correctamente' };
    }
};

module.exports = { LOCAL_FUNCTIONS };