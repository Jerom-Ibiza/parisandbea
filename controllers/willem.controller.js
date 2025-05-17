const pool = require('../database');

// GET /api/willem -> Devuelve los últimos 8 registros de progreso de Willem
const getProgresos = async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM progreso_willem ORDER BY fecha DESC LIMIT 8');
    res.json({ progresos: rows });
  } catch (error) {
    console.error('Error al obtener progreso de Willem:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// GET /api/willem/search -> Buscar registros de progreso por rango de fechas y asignatura
const searchProgresos = async (req, res) => {
  try {
    const { startDate, endDate, asignatura } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required.' });
    }
    let query = 'SELECT * FROM progreso_willem WHERE fecha BETWEEN ? AND ?';
    const params = [startDate, endDate];
    if (asignatura) {
      query += ' AND asignatura = ?';
      params.push(asignatura);
    }
    query += ' ORDER BY fecha DESC';
    const [rows] = await pool.query(query, params);
    res.json({ progresos: rows });
  } catch (error) {
    console.error('Error al buscar progresos:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// POST /api/willem -> Registra un nuevo progreso
const createProgreso = async (req, res) => {
  try {
    const {
      fecha,
      asignatura,
      temas,
      conceptos_dominados,
      conceptos_reforzar,
      estado_animo,
      comentarios_profesor
    } = req.body;
    
    const query = `INSERT INTO progreso_willem 
      (fecha, asignatura, temas, conceptos_dominados, conceptos_reforzar, estado_animo, comentarios_profesor) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await pool.query(query, [
      fecha,
      asignatura,
      temas,
      conceptos_dominados,
      conceptos_reforzar,
      estado_animo,
      comentarios_profesor
    ]);
    
    res.status(201).json({ message: 'Progreso registrado correctamente.', id: result.insertId });
  } catch (error) {
    console.error('Error al registrar progreso de Willem:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// PUT /api/willem/:id -> Actualiza un registro de progreso existente
const updateProgreso = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    
    const [result] = await pool.query('UPDATE progreso_willem SET ? WHERE id = ?', [data, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }
    
    res.json({ message: 'Progreso actualizado correctamente.' });
  } catch (error) {
    console.error('Error al actualizar progreso de Willem:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

// DELETE /api/willem/:id -> Elimina un registro de progreso existente
const deleteProgreso = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.query('DELETE FROM progreso_willem WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado.' });
    }
    res.json({ message: 'Progreso eliminado correctamente.' });
  } catch (error) {
    console.error('Error al eliminar progreso de Willem:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
};

module.exports = {
  getProgresos,
  searchProgresos,
  createProgreso,
  updateProgreso,
  deleteProgreso
};
