// cron/incidenciasCron.js
const pool = require('../database');
const dayjs = require('dayjs');
require('dayjs/locale/es');
const utc      = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(timezone);

const { getWeekType } = require('../utils/weekType');  // ← NUEVO

const TIMEZONE        = 'Europe/Madrid';
const MARGEN_MINUTOS  = 5;   // el mismo que en fichajes.controller

/* -----------------------------------------------------------
   Revisa el día anterior (ayer) – se lanza cada madrugada
------------------------------------------------------------ */
async function revisarAyer() {
  const ayer       = dayjs().tz(TIMEZONE).subtract(1, 'day');
  const fechaSQL   = ayer.format('YYYY-MM-DD');             // 2025-05-03
  const diaSemana  = ayer.locale('es').format('dddd');      // lunes, martes…
  const semana     = getWeekType(ayer.toDate());            // 'A' | 'B'

  try {
    /* 1) Horarios vigentes de AYER (filtra por alternancia) */
    const [horarios] = await pool.query(
      `SELECT h.id_profesional, h.hora_inicio, h.hora_fin
         FROM horarios h
        WHERE h.dia_semana = ?
          AND h.activo = 1
          AND (h.alternancia IS NULL OR h.alternancia = ?)`,
      [diaSemana, semana]
    );

    for (const h of horarios) {
      const { id_profesional, hora_inicio, hora_fin } = h;

      /* 2) Fichajes reales de ese profesional ayer */
      const [fichajes] = await pool.query(
        `SELECT tipo, fecha_hora
           FROM fichajes
          WHERE id_profesional = ? AND DATE(fecha_hora) = ?`,
        [id_profesional, fechaSQL]
      );

      const ent = fichajes.find(f => f.tipo === 'entrada');
      const sal = fichajes.find(f => f.tipo === 'salida');

      /* ----- ausencia completa ----- */
      if (!ent && !sal) {
        await insertarIncidencia(id_profesional, fechaSQL, 'ausencia', null);
        continue;                    // nada más que comprobar
      }

      /* ----- olvido de fichaje ----- */
      if (!ent) await insertarIncidencia(id_profesional, fechaSQL, 'olvido_entrada', null);
      if (!sal) await insertarIncidencia(id_profesional, fechaSQL, 'olvido_salida',  null);

      /* ----- retrasos / adelantos (por si la app estuvo offline) ----- */
      if (ent) {
        const objetivoEnt = dayjs.tz(`${fechaSQL} ${hora_inicio}`, TIMEZONE);
        const diffEntMin  = Math.round((dayjs(ent.fecha_hora).tz(TIMEZONE) - objetivoEnt) / 60000);
        if (Math.abs(diffEntMin) > MARGEN_MINUTOS) {
          await insertarIncidencia(
            id_profesional,
            fechaSQL,
            diffEntMin > 0 ? 'retraso_entrada' : 'adelanto_entrada',
            diffEntMin
          );
        }
      }
      if (sal) {
        const objetivoSal = dayjs.tz(`${fechaSQL} ${hora_fin}`, TIMEZONE);
        const diffSalMin  = Math.round((dayjs(sal.fecha_hora).tz(TIMEZONE) - objetivoSal) / 60000);
        if (Math.abs(diffSalMin) > MARGEN_MINUTOS) {
          await insertarIncidencia(
            id_profesional,
            fechaSQL,
            diffSalMin > 0 ? 'retraso_salida' : 'adelanto_salida',
            diffSalMin
          );
        }
      }
    }
  } catch (err) {
    console.error('[cron] Error al revisar incidencias de ayer:', err);
  }
}

/* -------- inserta si no existe duplicado ---------- */
async function insertarIncidencia(id_profesional, fecha, tipo, minutos) {
  await pool.query(
    `INSERT IGNORE INTO incidencias_fichajes
       (id_profesional, fecha, tipo, minutos_diferencia)
     VALUES (?, ?, ?, ?)`,
    [id_profesional, fecha, tipo, minutos]
  );
}

module.exports = { revisarAyer };

