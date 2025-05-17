const pool = require('../database');
const fs   = require('fs');
const path = require('path');
const { getWeekType } = require('../utils/weekType');

/* ---------- Day.js (fechas & zona horaria) ---------- */
const dayjs    = require('dayjs');
const utc      = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc); dayjs.extend(timezone);

const TIMEZONE       = 'Europe/Madrid';
const MARGEN_MINUTOS = 5;            // ±5 min tolerancia

/* ---------- PDF & utilidades ---------- */
const PDFDocument = require('pdfkit');
const sizeOf      = require('image-size');

/* ---------- Logger a /images/pdf/fichajes/pdf‑debug.log ---------- */
const logDir = path.join(__dirname, '..', 'images', 'pdf', 'fichajes');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
function log(msg) {
  fs.appendFileSync(
    path.join(logDir, 'pdf‑debug.log'),
    `[${new Date().toISOString()}] ${msg}\n`
  );
}

/******************************************************************
 *  1.  REGISTRAR FICHAJE
 ******************************************************************/
exports.registrarFichaje = async (req, res) => {
  try {
    const { id_profesional, tipo, fecha_hora_pc, notas = null } = req.body;
    if (!id_profesional || !tipo) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    /* 1-A  fecha/hora */
    let fechaHoraSQL = 'NOW()';
    if (fecha_hora_pc) {
      const m = dayjs(fecha_hora_pc);
      if (m.isValid()) {
        fechaHoraSQL = `'${m.format('YYYY-MM-DD HH:mm:ss')}'`;
      }
    }

    /* 1-B  foto */
    const imagen = req.file ? `images/fichajes/${req.file.filename}` : null;

    /* 1-C  insertar fichaje */
    const [fichajeResult] = await pool.query(
      `INSERT INTO fichajes
         (id_profesional, tipo, imagen, fecha_hora, notas)
       VALUES (?, ?, ?, ${fechaHoraSQL}, ?)`,
      [id_profesional, tipo, imagen, notas]
    );

    /* 2.  comprobar horario ► incidencia */
    const ahora     = dayjs().tz(TIMEZONE);
    const diaSemana = ahora.locale('es').format('dddd');
	const semana    = getWeekType(ahora.toDate());   // 'A' | 'B'

    const [hor] = await pool.query(
      `SELECT hora_inicio, hora_fin
         FROM horarios
        WHERE id_profesional = ?
          AND dia_semana = ?
          AND activo = 1
          AND (alternancia IS NULL OR alternancia = ?)
        LIMIT 1`,
      [id_profesional, diaSemana, semana]
    );

    if (hor.length) {
      const { hora_inicio, hora_fin } = hor[0];
      const objetivo = dayjs.tz(
        `${ahora.format('YYYY-MM-DD')} ${tipo === 'entrada' ? hora_inicio : hora_fin}`,
        TIMEZONE
      );
      const diffMin = Math.round((ahora - objetivo) / 60000);

      if (Math.abs(diffMin) > MARGEN_MINUTOS) {
        const tipoInc =
          tipo === 'entrada'
            ? diffMin > 0 ? 'retraso_entrada' : 'adelanto_entrada'
            : diffMin > 0 ? 'retraso_salida' : 'adelanto_salida';

        await pool.query(
          `INSERT INTO incidencias_fichajes
             (id_profesional, fecha, tipo, minutos_diferencia, observaciones)
           VALUES (?, CURDATE(), ?, ?, ?)`,
          [id_profesional, tipoInc, diffMin, notas]
        );
      }
    }

    res.status(201).json({ message: 'Fichaje registrado correctamente',
                           id_fichaje: fichajeResult.insertId });

  } catch (err) {
    console.error('Error al registrar fichaje:', err);
    res.status(500).json({ error: 'Error interno al registrar fichaje' });
  }
};

/******************************************************************
 *  2.  CONSULTAR FICHAJES
 ******************************************************************/
exports.getFichajes = async (req, res) => {
  try {
    const { id_profesional, start, end } = req.query;
    const cond = [], params = [];

    if (id_profesional) { cond.push('f.id_profesional = ?'); params.push(id_profesional); }
    if (start)          { cond.push('DATE(f.fecha_hora) >= ?'); params.push(start); }
    if (end)            { cond.push('DATE(f.fecha_hora) <= ?'); params.push(end); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT f.id_fichaje, f.id_profesional, f.tipo, f.fecha_hora, f.imagen, f.notas,
              p.nombre
         FROM fichajes f
         JOIN profesionales p USING (id_profesional)
         ${where}
         ORDER BY f.fecha_hora DESC`,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener fichajes:', err);
    res.status(500).json({ error: 'Error al obtener fichajes' });
  }
};

/******************************************************************
 *  3.  CONSULTAR INCIDENCIAS
 ******************************************************************/
exports.getIncidencias = async (req, res) => {
  try {
    const { id_profesional, start, end } = req.query;
    const cond = [], params = [];

    if (id_profesional) { cond.push('i.id_profesional = ?'); params.push(id_profesional); }
    if (start)          { cond.push('i.fecha >= ?');         params.push(start); }
    if (end)            { cond.push('i.fecha <= ?');         params.push(end); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const [rows] = await pool.query(
      `SELECT i.id_incidencia, i.id_profesional, i.fecha, i.tipo,
              i.minutos_diferencia, i.observaciones, p.nombre
         FROM incidencias_fichajes i
         JOIN profesionales p USING (id_profesional)
         ${where}
         ORDER BY i.fecha DESC`,
      params
    );

    res.json(rows);

  } catch (err) {
    console.error('Error al obtener incidencias:', err);
    res.status(500).json({ error: 'Error al obtener incidencias' });
  }
};

/******************************************************************
 *  4.  GENERAR PDF CON FOTOS – márgenes 40 izq/der, 20 sup/inf
 ******************************************************************/
exports.generarPdfFichajes = async (req, res) => {
  try {
    const { id_profesional, start, end } = req.query;
    if (!id_profesional || !start || !end) {
      return res
        .status(400)
        .json({ error: 'Parámetros requeridos: id_profesional, start, end' });
    }

    /* 1) Fotos -------------------------------------------------- */
    const [rows] = await pool.query(
      `SELECT imagen, fecha_hora
         FROM fichajes
        WHERE id_profesional = ?
          AND DATE(fecha_hora) BETWEEN ? AND ?
          AND imagen IS NOT NULL
        ORDER BY fecha_hora`,
      [id_profesional, start, end]
    );
    if (!rows.length) {
      return res
        .status(404)
        .json({ error: 'No hay fichajes con imagen en ese rango' });
    }

    /* 2) PDF ---------------------------------------------------- */
    const nombrePdf = `fichajes-${id_profesional}-${start}_a_${end}.pdf`;
    const rutaPdf   = path.join(logDir, nombrePdf);

    const doc = new PDFDocument({
      margins: { top: 20, bottom: 20, left: 40, right: 40 }
    });
    doc.pipe(fs.createWriteStream(rutaPdf));

    const COL      = 4;      // 4 columnas
    const GAP      = 10;     // espacio entre celdas
    const CAPTION  = 12;     // alto reservado para el texto

    /* 3) Variables de posición */
    const ML = doc.page.margins.left;                         // 40
    const MT = doc.page.margins.top;                          // 20
    const MB = doc.page.margins.bottom;                       // 20
    const usableW = doc.page.width  - ML * 2;
    const wSlot   = (usableW - GAP * (COL - 1)) / COL;
    const hSlot   = wSlot;                                    // cuadradas
    const rowH    = hSlot + CAPTION + GAP;                    // alto por fila

    let x = ML;
    let y = MT;

    for (const { imagen, fecha_hora } of rows) {

      /* salto manual si no cabe la fila siguiente */
      if (y + rowH > doc.page.height - MB) {
        doc.addPage();
        x = ML;
        y = MT;
      }

      const rutaImg = path.join(__dirname, '..', imagen.replace(/^[\\/]/, ''));
      if (!fs.existsSync(rutaImg)) { log(`No existe: ${rutaImg}`); continue; }

      try {
        doc.image(rutaImg, x, y, { fit: [wSlot, hSlot], align: 'center', valign: 'center' })
           .fontSize(8)
           .text(
             dayjs(fecha_hora).tz(TIMEZONE).format('DD/MM/YYYY HH:mm'),
             x, y + hSlot + 2, { width: wSlot, align: 'center' }
           );
      } catch (e) { log(`Error img ${rutaImg}: ${e.message}`); }

      /* avanzar columna / fila */
      x += wSlot + GAP;
      if (x + wSlot > doc.page.width - ML) {
        x  = ML;
        y += rowH;
      }
    }

    doc.end();

    /* 4) Respuesta --------------------------------------------- */
    const url = `https://parisandbea.es/images/pdf/fichajes/${nombrePdf}`;
    res.json({ message: 'PDF generado', url });

  } catch (err) {
    log(`ERROR GENERAL: ${err.stack}`);
    console.error('Error al generar PDF de fichajes:', err);
    res.status(500).json({ error: 'Error al generar PDF' });
  }
};


/******************************************************************
 *  5.  GESTIÓN DE PDFs      (/images/pdf/fichajes)
 ******************************************************************/
const pdfFolder = 'images/pdf/fichajes';          // ruta relativa
const pdfPath   = path.join(__dirname, '..', pdfFolder);

/* --- 5.1  Listar PDFs ----------------------------------------- */
exports.listPdfFichajes = async (_req, res) => {
  try {
    const files = (await fs.promises.readdir(pdfPath))
                  .filter(f => f.toLowerCase().endsWith('.pdf'));
    res.json({ files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer la carpeta de PDFs' });
  }
};

/* --- 5.2  Renombrar PDF --------------------------------------- */
exports.renamePdfFichaje = async (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) {
    return res.status(400).json({ error: 'Se requiere oldName y newName' });
  }
  try {
    await fs.promises.rename(
      path.join(pdfPath, oldName),
      path.join(pdfPath, newName)
    );
    res.json({ message: 'PDF renombrado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al renombrar PDF' });
  }
};

/* --- 5.3  Borrar uno o varios PDFs ---------------------------- */
exports.deletePdfFichaje = async (req, res) => {
  const fileName = req.params.filename;
  if (!fileName) {
    return res.status(400).json({ error: 'Se requiere nombre de archivo' });
  }
  try {
    await fs.promises.unlink(path.join(pdfPath, fileName));
    res.json({ message: 'PDF eliminado correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar PDF' });
  }
};

exports.deleteMultiplePdfs = async (req, res) => {
  const { files } = req.body;
  if (!files || !Array.isArray(files)) {
    return res.status(400).json({ error: 'Se requiere array de archivos' });
  }
  try {
    await Promise.all(files.map(f =>
      fs.promises.unlink(path.join(pdfPath, f))
    ));
    res.json({ message: 'PDFs eliminados correctamente' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar uno o varios PDFs' });
  }
};
