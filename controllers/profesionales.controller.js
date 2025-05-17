const bcrypt = require('bcrypt');
const pool = require('../database');
const { getWeekType } = require('../utils/weekType');

exports.getAllProfesionales = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT 
         id_profesional,
         nombre,
         mail,
         telefono,
         especialidad,
         notas,
         rol,
         fecha_alta,
         fecha_actualizacion,
         dni,
         num_colegiado,
         preferencias,
         voz
       FROM profesionales`
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener profesionales:', error);
    res.status(500).json({ error: 'Error al obtener profesionales' });
  }
};

exports.getSlimList = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id_profesional, nombre FROM profesionales ORDER BY nombre'
    );
    res.json(rows);                      // [{id_profesional,nombre},…]
  } catch (err) {
    console.error('Error slim list:', err);
    res.status(500).json({ error: 'Error al obtener lista' });
  }
};

exports.createProfesional = async (req, res) => {
  try {
    const {
      nombre,
      mail,
      password,
      rol,
      telefono,
      especialidad,
      notas,
      dni,
      num_colegiado,
	  preferencias,
	  voz
    } = req.body;

    if (!nombre || !mail || !password || !rol) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

	const [result] = await pool.query(
	  `INSERT INTO profesionales
		 (nombre, mail, password, rol,
		  telefono, especialidad, notas,
		  dni, num_colegiado, preferencias, voz)
	   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	  [
		nombre,
		mail,
		hashedPassword,
		rol,
		telefono        || null,
		especialidad    || null,
		notas           || null,
		dni             || null,
		num_colegiado   || null,
		preferencias    || null,
		voz             || null
	  ]
	);

    res.status(201).json({
      message: 'Profesional creado correctamente',
      id: result.insertId
    });
  } catch (error) {
    console.error('Error al crear profesional:', error);
    res.status(500).json({ error: 'Error al crear profesional' });
  }
};

exports.updateProfesional = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      mail,
      telefono,
      especialidad,
      notas,
      rol,
      dni,
      num_colegiado,
      preferencias,
      voz
    } = req.body;

    const [[current]] = await pool.query(
      'SELECT * FROM profesionales WHERE id_profesional = ?',
      [id]
    );
    if (!current) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    const query = `
      UPDATE profesionales
      SET nombre         = ?,
          mail           = ?,
          telefono       = ?,
          especialidad   = ?,
          notas          = ?,
          rol            = ?,
          dni            = ?,
          num_colegiado  = ?,
          preferencias   = ?,
          voz            = ?
      WHERE id_profesional = ?`;

    const params = [
      nombre        ?? current.nombre,
      mail          ?? current.mail,
      telefono      ?? current.telefono,
      especialidad  ?? current.especialidad,
      notas         ?? current.notas,
      rol           ?? current.rol,
      dni           ?? current.dni,
      num_colegiado ?? current.num_colegiado,
      preferencias  ?? current.preferencias,
      voz           ?? current.voz,
      id                                // ← ¡el id al final!
    ];

    const [result] = await pool.query(query, params);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }
    res.json({ message: 'Profesional actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar profesional:', error);
    res.status(500).json({ error: 'Error al actualizar profesional' });
  }
};

exports.deleteProfesional = async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      'DELETE FROM profesionales WHERE id_profesional = ?',
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Profesional no encontrado' });
    }

    res.json({ message: 'Profesional eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar profesional:', error);
    res.status(500).json({ error: 'Error al eliminar profesional' });
  }
};

/* ============================================================
   HORARIOS  ─  CRUD vinculado a cada profesional
   Endpoints:
     GET    /profesionales/:id/horarios
     POST   /profesionales/:id/horarios        (crear)
     PUT    /profesionales/horarios/:id_horario  (actualizar)
     DELETE /profesionales/horarios/:id_horario  (borrar)
   ===========================================================*/

// ► 1) Obtener todos los horarios de un profesional
exports.getHorariosByProfesional = async (req, res) => {
  try {
    const { id } = req.params;
    const semana = getWeekType();              // 'A' o 'B'

    const [rows] = await pool.query(
      `SELECT id_horario, dia_semana, hora_inicio, hora_fin, activo
       FROM   horarios
       WHERE  id_profesional = ?
         AND  (alternancia IS NULL OR alternancia = ?)
         AND  activo = 1
       ORDER BY FIELD(dia_semana,
         'lunes','martes','miércoles','jueves','viernes','sábado','domingo')`,
      [id, semana]
    );

    res.json(rows);
  } catch (err) {
    console.error('Error al obtener horarios:', err);
    res.status(500).json({ error:'Error al obtener horarios' });
  }
};

// ► 2) Crear horario
exports.createHorario = async (req, res) => {
  try {
    const { id } = req.params;                           // id_profesional
    const {
      dia_semana,
      hora_inicio,
      hora_fin,
      alternancia = null,
      activo      = 1
    } = req.body;

    if (!dia_semana || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error:'Faltan datos requeridos' });
    }

    await pool.query(
      `INSERT INTO horarios
         (id_profesional, dia_semana, hora_inicio, hora_fin, activo, alternancia)
       VALUES (?,?,?,?,?,?)`,
      [id, dia_semana, hora_inicio, hora_fin, activo, alternancia]
    );

    res.status(201).json({ message:'Horario creado correctamente' });
  } catch (err) {
    console.error('Error al crear horario:', err);
    res.status(500).json({ error:'Error al crear horario' });
  }
};

// ► 3) Actualizar horario  ⟶  versión corregida
exports.updateHorario = async (req, res) => {
  try {
    const { id_horario } = req.params;
    const {
      dia_semana,
      hora_inicio,
      hora_fin,
      alternancia,
      activo
    } = req.body;

    const [result] = await pool.query(
      `UPDATE horarios
         SET dia_semana  = COALESCE(?, dia_semana),
             hora_inicio = COALESCE(?, hora_inicio),
             hora_fin    = COALESCE(?, hora_fin),
             activo      = COALESCE(?, activo),
             alternancia = COALESCE(?, alternancia)
       WHERE id_horario = ?`,
      [dia_semana, hora_inicio, hora_fin, activo, alternancia, id_horario]
    );

    if (result.affectedRows === 0)
      return res.status(404).json({ error:'Horario no encontrado' });

    res.json({ message:'Horario actualizado correctamente' });
  } catch (err) {
    console.error('Error al actualizar horario:', err);
    res.status(500).json({ error:'Error al actualizar horario' });
  }
};

// ► 4) Eliminar horario
exports.deleteHorario = async (req, res) => {
  try {
    const { id_horario } = req.params;

    const [result] = await pool.query(
      'DELETE FROM horarios WHERE id_horario = ?',
      [id_horario]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Horario no encontrado' });
    }

    res.json({ message: 'Horario eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar horario:', error);
    res.status(500).json({ error: 'Error al eliminar horario' });
  }
};

