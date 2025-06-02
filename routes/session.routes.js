/* routes/session.routes.js */
const express = require('express');
const router = express.Router();
const pool = require('../database');

/**
 * Devuelve:
 *   • user            → profesional logueado
 *   • patient         → datos básicos del paciente
 *   • historial       → su historial clínico (o null)
 *   • evaluacion      → última evaluación (o null)
 *   • tratamiento     → tratamiento activo/más reciente (o null)
 *   • sesion          → última sesión (o null)
 */
router.get('/info', async (req, res) => {
  try {
    const user = req.session.user || null;
    const patient = req.session.patient || null;

    if (!patient) return res.json({ user, patient: null });

    /* ---------- paciente + historial ---------- */
    const [pRows] = await pool.query(
      `SELECT id_paciente, fecha_nacimiento, fecha_registro,
              nombre, apellidos, telefono, email, lopd_estado
       FROM pacientes
       WHERE id_paciente = ? LIMIT 1`,
      [patient.id_paciente]
    );

    const [hRows] = await pool.query(
      `SELECT motivo_consulta, fecha_inicio_problema,
              antecedentes_personales, antecedentes_familiares, tratamientos_previos,
              medicacion_actual, alergias, habitos_vida, profesion
       FROM historial_clinico
       WHERE id_paciente = ? LIMIT 1`,
      [patient.id_paciente]
    );

    /* ---------- última evaluación ---------- */
    const [evRows] = await pool.query(
      `SELECT e.*, pr.nombre  AS prof_nombre
       FROM evaluaciones e
       LEFT JOIN profesionales pr ON pr.id_profesional = e.id_profesional
       WHERE e.id_paciente = ?
       ORDER BY e.fecha_evaluacion DESC, e.id_evaluacion DESC
       LIMIT 1`,
      [patient.id_paciente]
    );

    /* ---------- tratamiento más reciente ---------- */
    const [trRows] = await pool.query(
      `SELECT t.*, pr.nombre AS prof_nombre
       FROM tratamientos t
       LEFT JOIN profesionales pr ON pr.id_profesional = t.id_profesional
       WHERE t.id_paciente = ?
       ORDER BY t.fecha_inicio DESC, t.id_tratamiento DESC
       LIMIT 1`,
      [patient.id_paciente]
    );

    /* ---------- última sesión ---------- */
    const [seRows] = await pool.query(
      `SELECT s.*, pr.nombre AS prof_nombre
       FROM sesiones s
       LEFT JOIN profesionales pr ON pr.id_profesional = s.id_profesional
       INNER JOIN tratamientos t ON t.id_tratamiento = s.id_tratamiento
       WHERE t.id_paciente = ?
       ORDER BY s.fecha_sesion DESC, s.hora_sesion DESC, s.id_sesion DESC
       LIMIT 1`,
      [patient.id_paciente]
    );

    res.json({
      user,
      patient: pRows[0] || patient,
      historial: hRows.length ? hRows[0] : null,
      evaluacion: evRows.length ? evRows[0] : null,
      tratamiento: trRows.length ? trRows[0] : null,
      sesion: seRows.length ? seRows[0] : null
    });
  } catch (err) {
    console.error('[session/info]', err);
    res.status(500).json({ error: 'Error obteniendo la sesión' });
  }
});

module.exports = router;


