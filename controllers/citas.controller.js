const pool = require('../database');

/* ─────────────────────────────────────────────────────────────
 * 1.  Crear cita
 * ──────────────────────────────────────────────────────────── */
exports.createAppointment = async (req, res) => {
    try {
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
        } = req.body;

        // ── Validaciones mínimas
        if (!titulo || !fecha_hora_inicio || !fecha_hora_fin || !id_profesional) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }
        if (new Date(fecha_hora_fin) <= new Date(fecha_hora_inicio)) {
            return res
                .status(400)
                .json({ error: 'La fecha de fin debe ser posterior a la de inicio' });
        }

        /* ──────────────────────────────────────────
         * 1‑A.  Completar datos automáticos
         * ────────────────────────────────────────── */
        let personaFinal = persona || null;
        if (!personaFinal && id_paciente) {
            const [p] = await pool.query(
                'SELECT nombre, apellidos FROM pacientes WHERE id_paciente = ?',
                [id_paciente]
            );
            if (p.length) {
                personaFinal = `${p[0].nombre} ${p[0].apellidos}`;
            }
        }

        let ubicacionFinal = ubicacion || null;
        if (!ubicacionFinal) {
            const [home] = await pool.query(
                'SELECT direccion_centro FROM home WHERE id_home = 1'
            );
            if (home.length) ubicacionFinal = home[0].direccion_centro;
        }

        /* ──────────────────────────────────────────
         * 1‑B.  Comprobar solapamientos
         * ────────────────────────────────────────── */
        const [overlap] = await pool.query(
            `SELECT COUNT(*) AS n
         FROM citas
        WHERE id_profesional = ?
          AND estado <> 'cancelada'
          AND ? < fecha_hora_fin
          AND ? > fecha_hora_inicio`,
            [id_profesional, fecha_hora_inicio, fecha_hora_fin]
        );
        if (overlap[0].n) {
            return res
                .status(409)
                .json({ error: 'El profesional ya tiene otra cita en ese horario' });
        }

        /* ──────────────────────────────────────────
         * 1‑C.  Insertar cita
         * ────────────────────────────────────────── */
        const [result] = await pool.query(
            `INSERT INTO citas
         (titulo, descripcion, fecha_hora_inicio, fecha_hora_fin,
          persona, id_paciente, estado, ubicacion, notificacion,
          id_profesional, id_servicio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                titulo,
                descripcion || null,
                fecha_hora_inicio,
                fecha_hora_fin,
                personaFinal,
                id_paciente || null,
                estado || 'pendiente',
                ubicacionFinal,
                notificacion || 'ninguna',
                id_profesional,
                id_servicio || null
            ]
        );

        res.status(201).json({
            message: 'Cita creada correctamente',
            id_cita: result.insertId
        });
    } catch (error) {
        console.error('Error al crear cita:', error);
        res.status(500).json({ error: 'Error al crear cita' });
    }
};

/* ─────────────────────────────────────────────────────────────
 * 2.  Obtener cita por ID
 * ──────────────────────────────────────────────────────────── */
exports.getAppointmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows] = await pool.query('SELECT * FROM citas WHERE id_cita = ?', [
            id
        ]);
        if (!rows.length) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error('Error al obtener cita:', error);
        res.status(500).json({ error: 'Error al obtener cita' });
    }
};

/* ─────────────────────────────────────────────────────────────
 * 3.  Actualizar cita
 * ──────────────────────────────────────────────────────────── */
exports.updateAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;

        const [rows] = await pool.query('SELECT * FROM citas WHERE id_cita = ?', [
            id
        ]);
        if (!rows.length) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        const c = rows[0];

        // Si se cambian las fechas o el profesional, revisa solapamientos
        const inicio = body.fecha_hora_inicio ?? c.fecha_hora_inicio;
        const fin = body.fecha_hora_fin ?? c.fecha_hora_fin;
        const profId = body.id_profesional ?? c.id_profesional;

        if (new Date(fin) <= new Date(inicio)) {
            return res
                .status(400)
                .json({ error: 'La fecha de fin debe ser posterior a la de inicio' });
        }

        const [overlap] = await pool.query(
            `SELECT COUNT(*) AS n
         FROM citas
        WHERE id_profesional = ?
          AND estado <> 'cancelada'
          AND ? < fecha_hora_fin
          AND ? > fecha_hora_inicio
          AND id_cita <> ?`,
            [profId, inicio, fin, id]
        );
        if (overlap[0].n) {
            return res
                .status(409)
                .json({ error: 'El profesional ya tiene otra cita en ese horario' });
        }

        /* ── Actualizar */
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
                body.titulo ?? c.titulo,
                body.descripcion ?? c.descripcion,
                inicio,
                fin,
                body.persona ?? c.persona,
                body.id_paciente ?? c.id_paciente,
                body.estado ?? c.estado,
                body.ubicacion ?? c.ubicacion,
                body.notificacion ?? c.notificacion,
                profId,
                body.id_servicio ?? c.id_servicio,
                id
            ]
        );

        res.json({ message: 'Cita actualizada correctamente' });
    } catch (error) {
        console.error('Error al actualizar cita:', error);
        res.status(500).json({ error: 'Error al actualizar cita' });
    }
};

/* ─────────────────────────────────────────────────────────────
 * 4.  Eliminar cita
 * ──────────────────────────────────────────────────────────── */
exports.deleteAppointment = async (req, res) => {
    try {
        const { id } = req.params;
        const [result] = await pool.query('DELETE FROM citas WHERE id_cita = ?', [
            id
        ]);
        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Cita no encontrada' });
        }
        res.json({ message: 'Cita eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar cita:', error);
        res.status(500).json({ error: 'Error al eliminar cita' });
    }
};

/* ─────────────────────────────────────────────────────────────
 * 5.  Buscar citas (filtros en query string)
 * ──────────────────────────────────────────────────────────── */
exports.searchAppointments = async (req, res) => {
    try {
        const {
            id_profesional,
            id_paciente,
            id_servicio,
            estado,
            startDate,
            endDate
        } = req.query;

        /*  Si no se indica el id_profesional por query, usamos el de la sesión  */
        const profId = id_profesional || (req.session.user && req.session.user.id_profesional);

        let query = 'SELECT * FROM citas WHERE 1 = 1';
        const params = [];

        if (profId) {
            query += ' AND id_profesional = ?';
            params.push(profId);
        }
        if (id_paciente) {
            query += ' AND id_paciente = ?';
            params.push(id_paciente);
        }
        if (estado) {
            query += ' AND estado = ?';
            params.push(estado);
        }
        if (id_servicio) {
            query += ' AND id_servicio = ?';
            params.push(id_servicio);
        }
        if (startDate && endDate) {
            query += ' AND fecha_hora_inicio BETWEEN ? AND ?';
            params.push(startDate, endDate);
        } else if (startDate) {
            query += ' AND fecha_hora_inicio >= ?';
            params.push(startDate);
        } else if (endDate) {
            query += ' AND fecha_hora_inicio <= ?';
            params.push(endDate);
        }

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error al buscar citas:', error);
        res.status(500).json({ error: 'Error al buscar citas' });
    }
};
