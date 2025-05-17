/* controllers/chats.controller.js */
const pool = require('../database');

/* ------------------------------------------------------------------ */
/* 1. Guardar / actualizar la conversación corriente                   */
/* ------------------------------------------------------------------ */
/**
 * Crea un nuevo chat (estado = 'Iniciada') o actualiza el ya abierto
 * para el par (profesional + paciente) que viene de la sesión.
 *
 * Body ( { conversation:string, finalizar?:boolean } )
 *  – conversation : texto completo que quieres guardar
 *  – finalizar    : true → marca el chat como 'Finalizada'
 *
 * Respuesta: { id_chat, message }
 */
exports.saveOrUpdateChat = async (req, res) => {
  try {
    /* ––– validaciones de sesión ––– */
    if (!req.session.user || !req.session.patient) {
      return res.status(403).json({ error: 'Sesión no válida' });
    }

    const id_profesional = req.session.user.id_profesional;
    const id_paciente    = req.session.patient.id_paciente;
    const { conversation = '', finalizar = false } = req.body;

    if (!conversation.trim()) {
      return res.status(400).json({ error: 'Falta «conversation»' });
    }

    /* ––– buscamos si hay un chat “Iniciada” sin cerrar ––– */
    const [rows] = await pool.query(
      `SELECT id_chat FROM chats
       WHERE id_profesional = ? AND id_paciente = ?
         AND estado = 'Iniciada'
       ORDER BY fecha_hora DESC LIMIT 1`,
      [id_profesional, id_paciente]
    );

    let id_chat;

    if (rows.length) {
      /* actualizar el registro existente */
      id_chat = rows[0].id_chat;
      await pool.query(
        `UPDATE chats
           SET conversacion = ?, fecha_hora = NOW(),
               estado = ?
         WHERE id_chat = ?`,
        [conversation, finalizar ? 'Finalizada' : 'Iniciada', id_chat]
      );
    } else {
      /* crear uno nuevo */
      const [{ insertId }] = await pool.query(
        `INSERT INTO chats
           (id_profesional, id_paciente, conversacion, estado)
         VALUES (?, ?, ?, 'Iniciada')`,
        [id_profesional, id_paciente, conversation]
      );
      id_chat = insertId;

      /* si lo quieren cerrar inmediatamente */
      if (finalizar) {
        await pool.query(
          `UPDATE chats SET estado = 'Finalizada' WHERE id_chat = ?`,
          [id_chat]
        );
      }
    }

    res.json({ id_chat, message: 'Chat guardado correctamente' });
  } catch (err) {
    console.error('[saveChat]', err);
    res.status(500).json({ error: 'Error al guardar el chat' });
  }
};

/* ------------------------------------------------------------------ */
/* 2. Recuperar las últimas N conversaciones                           */
/* ------------------------------------------------------------------ */
/**
 * Query ?limit=3   (1…10, por defecto 1)
 * Devuelve array ordenado de más reciente → más antiguo.
 */
exports.getLastChats = async (req, res) => {
  try {
    if (!req.session.user || !req.session.patient) {
      return res.status(403).json({ error: 'Sesión no válida' });
    }

    const id_profesional = req.session.user.id_profesional;
    const id_paciente    = req.session.patient.id_paciente;
    const limit          = Math.max(1, Math.min(Number(req.query.limit) || 1, 10));

    const [rows] = await pool.query(
      `SELECT id_chat, conversacion, fecha_hora, estado
         FROM chats
        WHERE id_profesional = ? AND id_paciente = ?
        ORDER BY fecha_hora DESC
        LIMIT ?`,
      [id_profesional, id_paciente, limit]
    );

    res.json(rows);
  } catch (err) {
    console.error('[getLastChats]', err);
    res.status(500).json({ error: 'Error al obtener chats' });
  }
};
