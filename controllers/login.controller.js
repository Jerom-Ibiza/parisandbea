/* ───────── controllers/login.controller.js ───────── */
const pool = require('../database');
const bcrypt = require('bcrypt');          // o bcryptjs si prefieres

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan credenciales' });
    }

    /* 1. Buscamos al profesional por email  */
    const [rows] = await pool.query(
      `SELECT id_profesional, nombre, mail, rol,
              especialidad,                     -- 🆕
              voz, preferencias, password
       FROM profesionales
       WHERE mail = ? LIMIT 1`,
      [email]
    );

    if (!rows.length) {
      return res.status(401).json({ error: 'Email no encontrado' });
    }

    const profesional = rows[0];

    /* 2. Comparamos la contraseña  */
    const match = await bcrypt.compare(password, profesional.password);
    if (!match) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    /* 3. Guardamos datos en la sesión (sin la pass)  */
    req.session.user = {
      id_profesional: profesional.id_profesional,
      nombre: profesional.nombre,
      mail: profesional.mail,
      rol: profesional.rol,
      especialidad: profesional.especialidad || null, // 🆕
      voz: profesional.voz || null,
      preferencias: profesional.preferencias || null
    };

    res.json({
      message: 'Login correcto',
      redirect: '/inicio-consulta.html'
    });
  } catch (err) {
    console.error('[login]', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Sesión cerrada correctamente' });
  });
};

exports.changePassword = async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ error: 'No autorizado. Sesión no iniciada.' });
    }

    const { newPassword, confirmPassword } = req.body;
    if (!newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Faltan campos de contraseña' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'Las contraseñas no coinciden' });
    }

    // 1. Hashear nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // 2. Actualizar
    await pool.query(
      'UPDATE profesionales SET password = ? WHERE id_profesional = ?',
      [hashedPassword, user.id_profesional]
    );

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};
