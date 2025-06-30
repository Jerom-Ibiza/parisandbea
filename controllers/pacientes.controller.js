const pool = require('../database');

/* -----------------------------------------------------------
 * 1.  Crear paciente
 * --------------------------------------------------------- */
exports.createPatient = async (req, res) => {
  try {
    const {
      nombre,
      apellidos,
      razon_social,
      fecha_nacimiento,
      genero,
      tipo_contraparte,
      dni,
      tipo_doc_id,
      id_fiscal,
      direccion,
      pais_iso,
      provincia,
      codigo_postal,
      telefono,
      email
    } = req.body;

    if (!nombre || !apellidos || !fecha_nacimiento || !genero) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const [result] = await pool.query(
      `INSERT INTO pacientes
         (nombre, apellidos, razon_social, fecha_nacimiento, genero,
          tipo_contraparte, dni, tipo_doc_id, id_fiscal,
          direccion, pais_iso, provincia, codigo_postal,
          telefono, email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        apellidos,
        razon_social || null,
        fecha_nacimiento,
        genero,
        tipo_contraparte || 'persona_fisica',
        dni || null,
        tipo_doc_id || 'NIF',
        id_fiscal || null,
        direccion || null,
        pais_iso || 'ES',
        provincia || null,
        codigo_postal || null,
        telefono || null,
        email || null
      ]
    );

    res.status(201).json({
      message: 'Paciente creado correctamente',
      id_paciente: result.insertId
    });
  } catch (error) {
    console.error('Error al crear paciente:', error);
    res.status(500).json({ error: 'Error al crear paciente' });
  }
};

/* -----------------------------------------------------------
 * 2.  Añadir historial clínico
 * --------------------------------------------------------- */
exports.addHistorial = async (req, res) => {
  try {
    const { id_paciente } = req.params;
    const {
      motivo_consulta,
      fecha_inicio_problema,
      antecedentes_personales,
      antecedentes_familiares,
      tratamientos_previos,
      medicacion_actual,
      alergias,
      habitos_vida,
      profesion
    } = req.body;

    if (!motivo_consulta) {
      return res
        .status(400)
        .json({ error: 'Faltan datos requeridos para el historial' });
    }

    const [patient] = await pool.query(
      'SELECT id_paciente FROM pacientes WHERE id_paciente = ?',
      [id_paciente]
    );
    if (!patient.length) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const [dup] = await pool.query(
      'SELECT id_historial FROM historial_clinico WHERE id_paciente = ?',
      [id_paciente]
    );
    if (dup.length) {
      return res
        .status(400)
        .json({ error: 'Este paciente ya tiene un historial clínico creado' });
    }

    await pool.query(
      `INSERT INTO historial_clinico
         (id_paciente, motivo_consulta, fecha_inicio_problema,
          antecedentes_personales, antecedentes_familiares,
          tratamientos_previos, medicacion_actual, alergias,
          habitos_vida, profesion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id_paciente,
        motivo_consulta,
        fecha_inicio_problema || null,
        antecedentes_personales || null,
        antecedentes_familiares || null,
        tratamientos_previos || null,
        medicacion_actual || null,
        alergias || null,
        habitos_vida || null,
        profesion || null
      ]
    );

    res.status(201).json({ message: 'Historial clínico añadido correctamente' });
  } catch (error) {
    console.error('Error al añadir historial clínico:', error);
    res.status(500).json({ error: 'Error al añadir historial clínico' });
  }
};

/* -----------------------------------------------------------
 * 3.  Actualizar paciente
 * --------------------------------------------------------- */
exports.updatePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      nombre,
      apellidos,
      razon_social,
      fecha_nacimiento,
      genero,
      tipo_contraparte,
      dni,
      tipo_doc_id,
      id_fiscal,
      direccion,
      pais_iso,
      provincia,
      codigo_postal,
      telefono,
      email
    } = req.body;

    const [rows] = await pool.query(
      'SELECT * FROM pacientes WHERE id_paciente = ?',
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const p = rows[0];

    await pool.query(
      `UPDATE pacientes SET
         nombre            = ?,
         apellidos         = ?,
         razon_social      = ?,
         fecha_nacimiento  = ?,
         genero            = ?,
         tipo_contraparte  = ?,
         dni               = ?,
         tipo_doc_id       = ?,
         id_fiscal         = ?,
         direccion         = ?,
         pais_iso          = ?,
         provincia         = ?,
         codigo_postal     = ?,
         telefono          = ?,
         email             = ?
       WHERE id_paciente = ?`,
      [
        nombre ?? p.nombre,
        apellidos ?? p.apellidos,
        razon_social ?? p.razon_social,
        fecha_nacimiento ?? p.fecha_nacimiento,
        genero ?? p.genero,
        tipo_contraparte ?? p.tipo_contraparte,
        dni ?? p.dni,
        tipo_doc_id ?? p.tipo_doc_id,
        id_fiscal ?? p.id_fiscal,
        direccion ?? p.direccion,
        pais_iso ?? p.pais_iso,
        provincia ?? p.provincia,
        codigo_postal ?? p.codigo_postal,
        telefono ?? p.telefono,
        email ?? p.email,
        id
      ]
    );

    res.json({ message: 'Paciente actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar paciente:', error);
    res.status(500).json({ error: 'Error al actualizar paciente' });
  }
};

/* -----------------------------------------------------------
 * 4.  Actualizar historial clínico
 * --------------------------------------------------------- */
exports.updateHistorial = async (req, res) => {
  try {
    const { id_paciente } = req.params;
    const body = req.body;   // puede traer cualquier campo, incluido “profesion”

    const [rows] = await pool.query(
      'SELECT * FROM historial_clinico WHERE id_paciente = ?',
      [id_paciente]
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ error: 'No existe historial clínico para este paciente' });
    }
    const h = rows[0];

    const merged = {
      motivo_consulta: body.motivo_consulta ?? h.motivo_consulta,
      fecha_inicio_problema: body.fecha_inicio_problema ?? h.fecha_inicio_problema,
      antecedentes_personales: body.antecedentes_personales ?? h.antecedentes_personales,
      antecedentes_familiares: body.antecedentes_familiares ?? h.antecedentes_familiares,
      tratamientos_previos: body.tratamientos_previos ?? h.tratamientos_previos,
      medicacion_actual: body.medicacion_actual ?? h.medicacion_actual,
      alergias: body.alergias ?? h.alergias,
      habitos_vida: body.habitos_vida ?? h.habitos_vida,
      profesion: body.profesion ?? h.profesion
    };

    await pool.query(
      `UPDATE historial_clinico SET
         motivo_consulta = ?,
         fecha_inicio_problema = ?,
         antecedentes_personales = ?,
         antecedentes_familiares = ?,
         tratamientos_previos = ?,
         medicacion_actual = ?,
         alergias = ?,
         habitos_vida = ?,
         profesion = ?
       WHERE id_historial = ?`,
      [
        merged.motivo_consulta,
        merged.fecha_inicio_problema,
        merged.antecedentes_personales,
        merged.antecedentes_familiares,
        merged.tratamientos_previos,
        merged.medicacion_actual,
        merged.alergias,
        merged.habitos_vida,
        merged.profesion,
        h.id_historial
      ]
    );

    res.json({ message: 'Historial clínico actualizado correctamente' });
  } catch (error) {
    console.error('Error al actualizar historial clínico:', error);
    res.status(500).json({ error: 'Error al actualizar historial clínico' });
  }
};

/* -----------------------------------------------------------
 * 5.  Buscar pacientes
 * --------------------------------------------------------- */
exports.searchPatients = async (req, res) => {
  try {
    const { nombre, apellidos, telefono, dni, startDate, endDate } = req.query;

    let query = `
      SELECT
        p.id_paciente, p.nombre, p.apellidos, p.fecha_nacimiento, p.genero,
        p.dni, p.direccion, p.telefono, p.email, p.fecha_registro,
        h.id_historial, h.motivo_consulta, h.fecha_inicio_problema,
        h.antecedentes_personales, h.antecedentes_familiares,
        h.tratamientos_previos, h.medicacion_actual, h.alergias,
        h.habitos_vida, h.profesion AS profesion_historial
      FROM pacientes p
      LEFT JOIN historial_clinico h ON p.id_paciente = h.id_paciente
      WHERE 1 = 1`;
    const params = [];

    if (nombre) { query += ' AND p.nombre LIKE ?'; params.push(`%${nombre}%`); }
    if (apellidos) { query += ' AND p.apellidos LIKE ?'; params.push(`%${apellidos}%`); }
    if (telefono) { query += ' AND p.telefono LIKE ?'; params.push(`%${telefono}%`); }
    if (dni) { query += ' AND p.dni LIKE ?'; params.push(`%${dni}%`); }

    if (startDate && endDate) {
      query += ' AND p.fecha_registro BETWEEN ? AND ?';
      params.push(startDate, endDate);
    } else if (startDate) {
      query += ' AND p.fecha_registro >= ?';
      params.push(startDate);
    } else if (endDate) {
      query += ' AND p.fecha_registro <= ?';
      params.push(endDate);
    }

    const [rows] = await pool.query(query, params);

    const results = rows.map(r => ({
      id_paciente: r.id_paciente,
      nombre: r.nombre,
      apellidos: r.apellidos,
      fecha_nacimiento: r.fecha_nacimiento,
      genero: r.genero,
      dni: r.dni,
      direccion: r.direccion,
      telefono: r.telefono,
      email: r.email,
      fecha_registro: r.fecha_registro,
      historial: r.id_historial ? {
        id_historial: r.id_historial,
        motivo_consulta: r.motivo_consulta,
        fecha_inicio_problema: r.fecha_inicio_problema,
        antecedentes_personales: r.antecedentes_personales,
        antecedentes_familiares: r.antecedentes_familiares,
        tratamientos_previos: r.tratamientos_previos,
        medicacion_actual: r.medicacion_actual,
        alergias: r.alergias,
        habitos_vida: r.habitos_vida,
        profesion: r.profesion_historial
      } : null
    }));

    res.json(results);
  } catch (error) {
    console.error('Error al buscar pacientes:', error);
    res.status(500).json({ error: 'Error al buscar pacientes' });
  }
};

/* -----------------------------------------------------------
 * 6.  Obtener paciente por ID
 * --------------------------------------------------------- */
exports.getPatientById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT
         p.id_paciente, p.nombre, p.apellidos, p.razon_social,
         p.fecha_nacimiento, p.genero, p.tipo_contraparte,
         p.dni, p.tipo_doc_id, p.id_fiscal,
         p.direccion, p.pais_iso, p.provincia, p.codigo_postal,
         p.telefono, p.email, p.fecha_registro,
         p.lopd_setcode, p.lopd_estado, p.lopd_firmado,
         p.fisio_setcode, p.fisio_estado, p.fisio_firmado,
         h.id_historial, h.motivo_consulta, h.fecha_inicio_problema,
         h.antecedentes_personales, h.antecedentes_familiares,
         h.tratamientos_previos, h.medicacion_actual, h.alergias,
         h.habitos_vida, h.profesion AS profesion_historial
       FROM pacientes p
       LEFT JOIN historial_clinico h ON p.id_paciente = h.id_paciente
       WHERE p.id_paciente = ?`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    const r = rows[0];

    res.json({
      id_paciente: r.id_paciente,
      nombre: r.nombre,
      apellidos: r.apellidos,
      razon_social: r.razon_social,
      fecha_nacimiento: r.fecha_nacimiento,
      genero: r.genero,
      tipo_contraparte: r.tipo_contraparte,
      dni: r.dni,
      tipo_doc_id: r.tipo_doc_id,
      id_fiscal: r.id_fiscal,
      direccion: r.direccion,
      pais_iso: r.pais_iso,
      provincia: r.provincia,
      codigo_postal: r.codigo_postal,
      telefono: r.telefono,
      email: r.email,
      fecha_registro: r.fecha_registro,
      lopd_setcode: r.lopd_setcode,
      lopd_estado: r.lopd_estado,
      lopd_firmado: r.lopd_firmado,
      fisio_setcode: r.fisio_setcode,
      fisio_estado: r.fisio_estado,
      fisio_firmado: r.fisio_firmado,
      historial: r.id_historial ? {
        id_historial: r.id_historial,
        motivo_consulta: r.motivo_consulta,
        fecha_inicio_problema: r.fecha_inicio_problema,
        antecedentes_personales: r.antecedentes_personales,
        antecedentes_familiares: r.antecedentes_familiares,
        tratamientos_previos: r.tratamientos_previos,
        medicacion_actual: r.medicacion_actual,
        alergias: r.alergias,
        habitos_vida: r.habitos_vida,
        profesion: r.profesion_historial
      } : null
    });
  } catch (error) {
    console.error('Error al obtener paciente por ID:', error);
    res.status(500).json({ error: 'Error al obtener paciente' });
  }
};

/* -----------------------------------------------------------
 * 7.  Eliminar paciente (cascade en historial)
 * --------------------------------------------------------- */
exports.deletePatient = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query(
      'DELETE FROM pacientes WHERE id_paciente = ?',
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json({ message: 'Paciente eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar paciente:', error);
    res.status(500).json({ error: 'Error al eliminar paciente' });
  }
};

/* -----------------------------------------------------------
 * 8.  Información de la empresa
 * --------------------------------------------------------- */
exports.getEmpresaInfo = async (_req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT informacion FROM Empresa WHERE id = 1'
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ error: 'Información de la empresa no encontrada' });
    }
    res.json({ informacion: rows[0].informacion });
  } catch (error) {
    console.error('Error al obtener información de la empresa:', error);
    res.status(500).json({ error: 'Error al obtener información de la empresa' });
  }
};
