const pool = require('../database');

/**
 * Borra los drafts y sus chunks con más de N horas de antigüedad.
 * @param {number} horas – antigüedad en horas (default 24)
 */
async function limpiarDrafts(horas = 24){
  try{
    const [rows] = await pool.query(
      'DELETE FROM document_drafts ' +
      ' WHERE creado_en < DATE_SUB(NOW(), INTERVAL ? HOUR)',
      [horas]
    );
    console.log(`[cron] Drafts eliminados: ${rows.affectedRows}`);
  }catch(err){
    console.error('[cron] Error limpiando drafts', err);
  }
}

module.exports = { limpiarDrafts };
