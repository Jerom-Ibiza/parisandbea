// controllers/voice.controller.js

const fs     = require('fs');
const path   = require('path');
const multer = require('multer');
const pool   = require('../database');
const logger = require('../logger');
const OpenAI = require('openai');

const TMP = path.join(__dirname, '..', 'tmp');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });
const upload = multer({ dest: TMP });

// ——— utilidades de normalización y búsqueda ———
const normalize = s => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const words2digits = s => {
  const map = { cero:'0', uno:'1', dos:'2', tres:'3', cuatro:'4',
                cinco:'5', seis:'6', siete:'7', ocho:'8', nueve:'9' };
  return s.split(/\s+/).map(w => map[w] ?? w).join('');
};

const levenshtein = (a, b) => {
  if (a.length > b.length) [a, b] = [b, a];
  const row = Array.from({length: a.length+1}, (_, i) => i);
  for (let i = 1; i <= b.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= a.length; j++) {
      const cur = row[j];
      row[j] = b[i-1] === a[j-1]
        ? prev
        : 1 + Math.min(prev, row[j-1], cur);
      prev = cur;
    }
  }
  return row[a.length];
};

async function getBy(sql, params) {
  const [rows] = await pool.query(sql, params);
  if (!rows.length) return null;
  return { id_paciente: rows[0].id_paciente, nombre: rows[0].nombre, apellidos: rows[0].apellidos };
}

async function fuzzyByTokens(tokens) {
  const first = tokens[0];
  const like = `%${first.slice(0,3)}%`;
  const [rows] = await pool.query(
    `SELECT id_paciente,nombre,apellidos
       FROM pacientes
      WHERE nombre LIKE ? OR apellidos LIKE ?
      LIMIT 20`,
    [like, like]
  );
  for (const r of rows) {
    const full = normalize(`${r.nombre} ${r.apellidos}`);
    const cand = full.split(/\s+/);
    if (tokens.every(t => Math.min(...cand.map(c => levenshtein(t, c))) <= 1)) {
      return { id_paciente: r.id_paciente, nombre: r.nombre, apellidos: r.apellidos };
    }
  }
  return null;
}

async function searchPatient(raw) {
  // 1) email, DNI, teléfono
  const digitSeq  = words2digits(raw).replace(/\D/g, '');
  const email     = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
  const dni       = raw.match(/\b\d{7,8}[a-z]\b/i);
  const phoneLike = digitSeq.length >= 6 ? `%${digitSeq}%` : null;

  if (email)  return getBy(`SELECT id_paciente,nombre,apellidos FROM pacientes WHERE email = ? LIMIT 1`, [email[0]]);
  if (dni)    return getBy(`SELECT id_paciente,nombre,apellidos FROM pacientes WHERE dni = ? LIMIT 1`, [dni[0].toUpperCase()]);
  if (phoneLike) return getBy(`SELECT id_paciente,nombre,apellidos FROM pacientes WHERE REPLACE(telefono," ","") LIKE ? LIMIT 1`, [phoneLike]);

  // 2) tokens exactos
  const tokens = raw.split(/\s+/).filter(t => t.length > 2);
  if (tokens.length) {
    const wheres = tokens.map(_ => `(nombre_norm LIKE ? OR apellidos_norm LIKE ?)`).join(' AND ');
    const params = tokens.flatMap(t => [`%${t}%`, `%${t}%`]);
    const sql = `
      SELECT id_paciente,nombre,apellidos FROM (
        SELECT id_paciente,
               LOWER(CONVERT(nombre USING utf8mb4))    AS nombre_norm,
               LOWER(CONVERT(apellidos USING utf8mb4)) AS apellidos_norm,
               nombre,apellidos
          FROM pacientes
      ) p
      WHERE ${wheres}
      LIMIT 1`;
    const exact = await getBy(sql, params);
    if (exact) return exact;
  }

  // 3) fuzzy Levenshtein
  return fuzzyByTokens(tokens);
}

// ——— flujo de audio (Whisper) y ruta POST /identify ———
exports.identifyPatient = [
  upload.single('audio'),
  async (req, res) => {
    try {
      const tmpPath = req.file.path;
      let ext = path.extname(req.file.originalname).toLowerCase();
      if (!ext) {
        const mime = req.file.mimetype;
        if (mime === 'audio/webm') ext = '.webm';
        else if (mime === 'video/mp4') ext = '.mp4';
        else if (mime === 'audio/mp4' || mime === 'audio/x-m4a') ext = '.m4a';
      }
      const realPath = tmpPath + ext;
      fs.renameSync(tmpPath, realPath);

      const openai = new OpenAI();
      const { text } = await openai.audio.transcriptions.create({
        file: fs.createReadStream(realPath),
        model: 'whisper-1',
        language: 'es'
      });

      fs.unlink(realPath, () => {});
      const raw = normalize(text.trim());
      const pat = await searchPatient(raw);
      if (!pat) {
        return res.json({ found: false, message: 'Paciente no encontrado', debug: { raw } });
      }

      req.session.patient = pat;
      res.json({ found: true, redirect: '/consulta.html', paciente: pat });

    } catch (e) {
      logger.error(e);
      res.status(500).json({ error: e.message });
    }
  }
];

// ——— flujo de texto y ruta POST /identify-text ———
exports.identifyPatientByText = async (req, res) => {
  try {
    const raw = normalize(String(req.body.query || '').trim());
    if (!raw) return res.status(400).json({ error: 'Falta el campo query' });
    const pat = await searchPatient(raw);
    if (!pat) return res.json({ found: false });
    req.session.patient = pat;
    res.json({ found: true, redirect: '/consulta.html' });
  } catch (e) {
    logger.error(e);
    res.status(500).json({ error: 'Error buscando paciente' });
  }
};
