// controllers/blocks.controller.js

const fs      = require('fs');
const path    = require('path');
const multer  = require('multer');
const pool    = require('../database');
const OpenAI  = require('openai');
const logger  = require('../logger');

// ───────── carpeta temporal para audios ─────────
const TMP = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

const upload = multer({ dest: TMP });

// ───────── prompts (uno por bloque) ─────────
const prompts = {
  historial: `Devuelve SOLO un JSON con las claves:
{
 "motivo_consulta":"",
 "fecha_inicio_problema":"YYYY-MM-DD",
 "antecedentes_personales":"",
 "tratamientos_previos":"",
 "medicacion_actual":"",
 "alergias":"",
 "habitos_vida":"",
 "profesion":""
}`,
  evaluacion: `Devuelve SOLO un JSON con:
{
 "fecha_evaluacion":"YYYY-MM-DD",
 "dolor_localizacion":"",
 "dolor_intensidad":"",
 "dolor_tipo":"",
 "dolor_irradia":true,
 "dolor_descripcion":"",
 "inspeccion_visual":"",
 "palpacion":"",
 "movilidad_articular":"",
 "pruebas_funcionales":"",
 "valoracion_neurologica":"",
 "valoracion_postural":"",
 "evaluacion_funcional":"",
 "diagnostico":"",
 "objetivos_terapeuticos":""
}`,
  tratamiento: `Devuelve SOLO un JSON con:
{
 "fecha_inicio":"YYYY-MM-DD",
 "fecha_fin":"YYYY-MM-DD",
 "tecnicas_aplicadas":"",
 "frecuencia_sesiones":"",
 "duracion_sesion":"",
 "recomendaciones":"",
 "estado":"",
 "suplemento_prescrito":false,
 "capsulas_por_bote":null,
 "dosis_diaria":null,
 "fecha_inicio_suplementacion":"YYYY-MM-DD",
 "dias_alerta":null
}`,
  sesion: `Devuelve SOLO un JSON con:
{
 "fecha_sesion":"YYYY-MM-DD",     // si no se dice, usa la de hoy
 "hora_sesion":"HH:MM",           // si no se dice, usa hora actual
 "tecnicas_utilizadas":"",
 "evolucion":"",
 "modificaciones_tratamiento":"",
 "observaciones":""
}`
};

// ───────── utilidades ─────────
const extractJson = str => {
  const i = str.indexOf('{'), j = str.lastIndexOf('}');
  return i >= 0 && j >= i ? str.slice(i, j + 1) : str;
};
const today   = () => new Date().toISOString().slice(0, 10);
const nowHHMM = () => new Date().toTimeString().slice(0, 5);

// ───────── requisitos mínimos por bloque ─────────
const required = {
  historial   : ['motivo_consulta'],
  evaluacion  : ['fecha_evaluacion','dolor_localizacion'],
  tratamiento : ['fecha_inicio','tecnicas_aplicadas'],
  sesion      : ['tecnicas_utilizadas']
};

// ───────── nombres “bonitos” para mensajes ─────────
const niceName = {
  historial  : 'Historial clínico',
  evaluacion : 'Evaluación',
  tratamiento: 'Tratamiento',
  sesion     : 'Sesión'
};

// ------------------------------------------------------------------
// Controlador principal
// ------------------------------------------------------------------
exports.handleBlock = [
  upload.single('audio'),

  async (req, res) => {
    const block = (req.body.block || '').toLowerCase();
    const user  = req.session.user;
    const pat   = req.session.patient;

    if (!user || !pat)    return res.status(403).json({ error: 'Sin sesión' });
    if (!prompts[block])  return res.status(400).json({ error: 'Bloque inválido' });

    logger.info(`[block] ► ${block} – prof ${user.id_profesional} / pac ${pat.id_paciente}`);

    try {
      // 1 ─ Whisper con extensión dinámica
      const tmpPath = req.file.path;
      let ext = path.extname(req.file.originalname).toLowerCase();

      if (!ext) {
        const mime = req.file.mimetype;
        if (mime === 'audio/webm')                 ext = '.webm';
        else if (mime === 'video/mp4')             ext = '.mp4';
        else if (mime === 'audio/mp4' || mime === 'audio/x-m4a') ext = '.m4a';
      }

      const realPath = tmpPath + ext;
      fs.renameSync(tmpPath, realPath);

      const openai = new OpenAI();
      const { text } = await openai.audio.transcriptions.create({
        file    : fs.createReadStream(realPath),
        model   : 'whisper-1',
        language: 'es'
      });
      fs.unlink(realPath, () => {});
      logger.info('[block] texto: ' + text.slice(0, 80) + '…');

      // 2 ─ GPT-4.1-mini JSON-only
      const chat = await openai.chat.completions.create({
        model            : 'gpt-4.1-mini',
        temperature      : 0,
        response_format  : { type: 'json_object' },
        messages: [
          { role: 'system', content: prompts[block] },
          { role: 'user',   content: text }
        ]
      });

      let json;
      try {
        json = JSON.parse(chat.choices[0].message.content);
      } catch {
        json = JSON.parse(extractJson(chat.choices[0].message.content));
      }
      if (!json || typeof json !== 'object') {
        throw new Error('JSON vacío o ilegible de GPT');
      }

      // 3 ─ Defaults y validación mínima
      if (block === 'sesion') {
        if (!json.fecha_sesion) json.fecha_sesion = today();
        if (!json.hora_sesion)  json.hora_sesion  = nowHHMM();
      }
      const missing = required[block].filter(k =>
        !(k in json) || json[k] === null || String(json[k]).trim() === ''
      );
      if (missing.length) {
        throw new Error(
          `${niceName[block]} - faltan campos: ${missing.join(', ')}`
        );
      }

      // 4 ─ Guardar en la BD
      await saveToDB(block, json, pat.id_paciente, user.id_profesional);

      const msg = `${niceName[block]} - Registrado correctamente!`;
      logger.info(`[block] ✔ ${block} guardado`);
      return res.json({ ok: true, message: msg });

    } catch (err) {
      logger.error('[block] ' + err.stack);
      return res.status(500).json({ error: err.message });
    }
  }
];

// ------------------------------------------------------------------
// Función para guardar en la base de datos
// ------------------------------------------------------------------
async function saveToDB(block, data, id_paciente, id_profesional) {
  switch (block) {
    case 'historial':
      await pool.query(
        'INSERT INTO historial_clinico SET ? ON DUPLICATE KEY UPDATE ?',
        [{ ...data, id_paciente }, { ...data }]
      );
      break;

    case 'evaluacion':
      await pool.query(
        'INSERT INTO evaluaciones SET ?',
        { ...data, id_paciente, id_profesional }
      );
      break;

    case 'tratamiento':
      await pool.query(
        'INSERT INTO tratamientos SET ?',
        { ...data, id_paciente, id_profesional }
      );
      break;

    case 'sesion': {
      const [rows] = await pool.query(
        'SELECT id_tratamiento FROM tratamientos WHERE id_paciente = ? ORDER BY fecha_inicio DESC LIMIT 1',
        [id_paciente]
      );
      if (!rows.length) {
        throw new Error('El paciente no tiene tratamientos; no puedo registrar la sesión.');
      }
      await pool.query(
        'INSERT INTO sesiones SET ?',
        { ...data, id_tratamiento: rows[0].id_tratamiento, id_profesional }
      );
      break;
    }

    default:
      throw new Error('Bloque no soportado');
  }
}
